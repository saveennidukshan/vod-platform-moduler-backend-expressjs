import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import errorHandler from './src/middlewares/errorHandler.js';
import authRouter from './src/modules/auth/auth.routes.js';
import usersRouter from './src/modules/users/user.routes.js';
import authConfig from './src/configs/auth.config.js';

const app = express();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/uploads', express.static('uploads'));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);

app.use(errorHandler);

export default app;
