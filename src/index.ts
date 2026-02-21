import "./utils/setupLogging";
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { closePool } from "./config/db";
import { apiLogger } from './middlewares/global-api-request-logger';
import { exceptionFilter } from './middlewares/global-exception-filter';
import { RegisterRoutes } from './routes/routes';
import openapiSpec from '../dist/swagger.json';

import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import prettyListRoutes from './utils/route-list';
dotenv.config();

const app = express();

// 1. trust proxy
app.set('trust proxy', true);

// 2. security
app.use(helmet());

// 3. cors
// app.use(cors({
//   origin: false
// }));


// 4. body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. logger
app.use(apiLogger());


//TSOA Generated Routes
// create a router, register generated routes onto it, then mount under /api
const tsoaRouter = express.Router();
try {
  RegisterRoutes(tsoaRouter); 
  app.use('/api', tsoaRouter);
  console.log('✅ TSOA routes registered under /api');
} catch (err) {
  console.warn('⚠️ Failed to register TSOA routes. Did you run `npm run tsoa:gen`?', err);
}

//List Routes
prettyListRoutes(app, tsoaRouter, '/api');

// Swagger (TSOA generated)
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, { explorer: true })
);

app.get('/api/docs.json', (_req, res) => {
  res.json(openapiSpec);
});


//404
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});


// Global Exception Filter
app.use(exceptionFilter());

//Error
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal error' });
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await closePool();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down gracefully...");
  await closePool();
  process.exit(0);
});


//Run Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
