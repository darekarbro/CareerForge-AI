const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { authLimiter, aiIpLimiter } = require('./middlewares/rateLimits');

const env = require('./config/env');
const { errorHandler } = require('./middlewares/errorHandler');

// Route imports
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const processingRoutes = require('./routes/processingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
if (env.TRUST_PROXY) {
  app.set('trust proxy', /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY);
}

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = env.CLIENT_URL.split(',').map((value) => value.trim());
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        const error = new Error('Origin is not allowed');
        error.statusCode = 403;
        callback(error);
      }
    },
    credentials: true,
    exposedHeaders: ['X-Page-Count', 'X-Content-Revision', 'X-Layout-Revision', 'Content-Disposition'],
  })
);

app.use(compression());
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/firebase', authLimiter);
app.use('/api/auth/password', authLimiter);
for (const route of ['forgot-password', 'reset-password', 'verify-email', 'resend-verification']) app.use('/api/auth/' + route, authLimiter);
app.use((req, res, next) => {
  const costly = /^\/api\/resumes\/(upload|[^/]+\/(tailor|gap-analysis))\/?$/.test(req.path) ||
    /^\/api\/interview\/sessions(?:\/[^/]+\/questions\/[^/]+\/answer)?\/?$/.test(req.path) ||
    /^\/api\/(?:workspaces\/[^/]+\/(?:tailor|analyze|interview)|resumes\/[^/]+\/assess|resumes\/[^/]+\/versions\/[^/]+\/regenerate|interview\/sessions\/[^/]+\/follow-up|processing-jobs\/[^/]+\/retry)\/?$/.test(req.path);
  return req.method === 'POST' && (costly || /^\/api\/evidence\/(?:copilot(?:\/[^/]+\/answers)?|imports\/(?:github|document))\/?$/.test(req.path)) ? aiIpLimiter(req, res, next) : next();
});

// Mount API Routes
app.get('/api/openapi.json', (_req, res) => res.json(require('./openapi')));
app.use('/api/docs', require('swagger-ui-express').serve, require('swagger-ui-express').setup(require('./openapi'), { swaggerOptions: { persistAuthorization: false } }));
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/privacy', require('./routes/privacyRoutes'));
app.use('/api/workspaces', require('./routes/workspaceRoutes'));
app.use('/api/resumes', resumeRoutes);
app.use('/api/evidence', require('./routes/evidenceRoutes'));
app.use('/api/interview', interviewRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/processing-jobs', processingRoutes);
app.use('/api/notifications', notificationRoutes);

// Catch-all 404 for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found on this server`,
  });
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
