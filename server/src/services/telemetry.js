// Deliberately manual instrumentation: no request bodies, paths, prompts, emails or tokens.
const { context, trace, propagation, SpanStatusCode, ROOT_CONTEXT } = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader, InMemoryMetricExporter, AggregationTemporality } = require('@opentelemetry/sdk-metrics');
const { BatchSpanProcessor, SimpleSpanProcessor, InMemorySpanExporter } = require('@opentelemetry/sdk-trace');
const testExporter = process.env.NODE_ENV === 'test' && process.env.PHASE6_CAPTURE === '1' ? new InMemorySpanExporter() : null;
const testMetrics = testExporter ? new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE) : null;
let sdk;
function start({ spanProcessors, metricReaders } = {}) {
  if (sdk) return sdk;
  const enabled = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'careerforge-' + (process.env.QUEUE_MODE || 'combined'),
    autoDetectResources: false,
    logRecordProcessors: [],
    // No collector configured means no network exports, including SDK defaults.
    spanProcessors: spanProcessors || [testExporter ? new SimpleSpanProcessor({ exporter: testExporter }) : new BatchSpanProcessor({ exporter: enabled ? new OTLPTraceExporter() : { export(_spans, callback) { callback({ code: 0 }); }, shutdown: async () => {} } })],
    metricReaders: metricReaders || (enabled || testMetrics ? [new PeriodicExportingMetricReader({ exporter: testMetrics || new OTLPMetricExporter(), exportIntervalMillis: 10000, exportTimeoutMillis: 5000 })] : []),
  });
  sdk.start();
  return sdk;
}
start();
const tracer = trace.getTracer('careerforge', '6.0');
const meter = require('@opentelemetry/api').metrics.getMeter('careerforge', '6.0');
const instruments = new Map();
function measure(name, value = 1, attributes = {}, histogram = false) {
  if (!instruments.has(name)) instruments.set(name, histogram ? meter.createHistogram(name) : meter.createCounter(name));
  const instrument = instruments.get(name);
  histogram ? instrument.record(value, attributes) : instrument.add(value, attributes);
}
function ids() {
  const span = trace.getSpan(context.active())?.spanContext();
  return span ? { traceId: span.traceId, spanId: span.spanId } : {};
}
function carrier() { const value = {}; propagation.inject(context.active(), value); return value; }
async function span(name, attributes, work, parent) {
  return tracer.startActiveSpan(name, { attributes }, parent ? propagation.extract(ROOT_CONTEXT, parent) : context.active(), async (active) => {
    try { return await work(active); }
    catch (error) { active.setStatus({ code: SpanStatusCode.ERROR }); active.setAttribute('error.type', typeof error.code === 'string' ? error.code : 'operation_failed'); throw error; }
    finally { active.end(); }
  });
}
function http(req, res, next) {
  // Accept only W3C trace context; never propagate baggage from untrusted clients.
  const parent = propagation.extract(ROOT_CONTEXT, { traceparent: req.headers.traceparent });
  tracer.startActiveSpan('http.request', {}, parent, (active) => {
    const begin = performance.now();
    req.traceId = active.spanContext().traceId;
    res.setHeader('X-Trace-Id', req.traceId);
    res.setHeader('traceparent', carrier().traceparent || '');
    let ended = false;
    const end = () => {
      if (ended) return; ended = true;
      const attributes = { 'http.request.method': ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method) ? req.method : 'OTHER',
        'http.route': req.route?.path && req.route.path !== '*' ? String(req.baseUrl || '').replace(/[a-f\d]{24}/gi, ':id') + req.route.path : 'unmatched',
        'http.response.status_code': res.statusCode };
      active.setAttributes(attributes);
      if (res.statusCode >= 500 || !res.writableFinished) active.setStatus({ code: SpanStatusCode.ERROR });
      measure('careerforge.http.duration_ms', performance.now() - begin, attributes, true);
      if (res.getHeader('Content-Disposition') && res.statusCode < 400) {
        active.addEvent('export.completed'); measure('careerforge.exports', 1, { outcome: res.writableFinished ? 'finished' : 'disconnected' });
      }
      active.end();
    };
    res.once('finish', end); res.once('close', end); next();
  });
}
module.exports = { start, span, ids, carrier, measure, http, testExporter, testMetrics, shutdown: () => sdk?.shutdown(), flush: () => Promise.all([sdk?._tracerProvider?.forceFlush(), sdk?._meterProvider?.forceFlush()]) };
