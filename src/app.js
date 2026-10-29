import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import crypto from 'crypto';
import errorHandler from './http/middleware/error-handler.js';
import authRouter from './modules/auth/auth.routes.js';
import usersRouter from './modules/users/user.routes.js';
import authConfig from './config/auth.js';
import { apiRateLimiter } from './http/middleware/rate-limit.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY || (authConfig.isProduction ? 1 : false));

app.use((req, res, next) => {
  const requestId = req.get('x-request-id');
  req.id = requestId && /^[a-zA-Z0-9._-]{8,128}$/.test(requestId) ? requestId : crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || authConfig.frontendOrigin.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(helmet());
app.use(compression());
app.use(apiRateLimiter);
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

app.get('/health/live', (req, res) =>
  res.status(200).json({ success: true, status: 'ok', requestId: req.id })
);
app.get('/health/ready', (req, res) =>
  res.status(200).json({ success: true, status: 'ready', requestId: req.id })
);

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestId: req.id,
  });
});

app.use(errorHandler);

export default app;
