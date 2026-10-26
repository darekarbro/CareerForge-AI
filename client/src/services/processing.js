import api from './api';
import { subscribeToJob } from './socket';

const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
const sessionToken = () => {
  try { return JSON.parse(localStorage.getItem('careerforge_auth') || '{}').token; } catch { return undefined; }
};
export function watchProcessingJob(jobId, { onEvent = () => {}, onStatus = () => {}, onError = () => {}, pollMs = 1000 } = {}) {
  let stopped = false, timer;
  const controller = new AbortController(), token = sessionToken(), seen = new Set();
  const deliver = (event) => {
    if (stopped) return;
    const key = event._id || [event.step, event.timestamp || event.createdAt, event.message].join(':');
    if (seen.has(key)) return;
    seen.add(key);
    onEvent({ ...event, timestamp: event.timestamp || event.createdAt });
  };
  const unsubscribe = subscribeToJob(jobId, deliver);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer); controller.abort(); unsubscribe();
  };
  const reconcile = async () => {
    if (stopped) return;
    if (token !== sessionToken()) {
      onError(Object.assign(new Error('Session changed'), { name: 'AbortError' }));
      stop(); return;
    }
    try {
      const [status, timeline] = await Promise.all([
        api.get('/processing-jobs/' + jobId, { signal: controller.signal }),
        api.get('/processing-jobs/' + jobId + '/timeline', { signal: controller.signal }),
      ]);
      if (stopped) return;
      (timeline.data.data || []).forEach(deliver);
      const job = status.data.data;
      onStatus(job);
      if (terminal.has(job.status)) { stop(); return; }
    } catch (error) {
      if (stopped) return;
      onError(error);
      if ([401, 403, 404].includes(error.response?.status)) { stop(); return; }
    }
    if (!stopped) timer = setTimeout(reconcile, pollMs);
  };
  reconcile();
  return stop;
}
export function waitForProcessingJob(jobId, { signal, onStatus, pollMs } = {}) {
  return new Promise((resolve, reject) => {
    let stop = () => {}, finished = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true; signal?.removeEventListener('abort', abort); stop();
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(Object.assign(new Error('Stopped waiting for processing'), { name: 'AbortError' }));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    stop = watchProcessingJob(jobId, {
      pollMs, onStatus: (job) => {
        onStatus?.(job);
        if (job.status === 'COMPLETED') finish(null, { ...job.output, jobId: job._id });
        else if (terminal.has(job.status)) finish(Object.assign(
          new Error(job.error?.message || (job.status === 'CANCELLED' ? 'Processing cancelled' : 'Processing failed')),
          { code: job.error?.code || job.status }
        ));
      },
      onError: (error) => {
        if (error.name === 'AbortError' || [401, 403, 404].includes(error.response?.status)) finish(error);
      },
    });
    if (finished) stop();
  });
}
export async function submitProcessingRequest(url, payload, options = {}) {
  const response = await api.post(url, payload, { signal: options.signal });
  if (response.status === 202 && response.data.data.jobId) {
    const data = await waitForProcessingJob(response.data.data.jobId, options);
    return { ...response, data: { ...response.data, data } };
  }
  return response;
}
