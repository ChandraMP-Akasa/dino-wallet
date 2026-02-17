import "./utils/setupLogging";
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import { apiLogger } from './middlewares/global-api-request-logger';
import { exceptionFilter } from './middlewares/global-exception-filter';
import { RegisterRoutes } from './routes/routes';

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
app.use(cors({ origin: true, credentials: true }));

// 4. body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. logger
app.use(apiLogger());

// ==============================
// 7. TSOA GENERATED ROUTES
// ==============================
// Mount TSOA generated routes
let registerRoutes: ((app: any) => void) | undefined;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires

  registerRoutes =
    RegisterRoutes ??           // named export
    RegisterRoutes ??                  // default export
    undefined;
} catch (err) {
  console.warn('⚠️ TSOA generated routes not found. Did you run `npm run tsoa:gen`?');
}

if (registerRoutes) {
  registerRoutes(app);
  console.log('✅ TSOA routes registered');
}

// create a router, register generated routes onto it, then mount under /api
const tsoaRouter = express.Router();
try {
  RegisterRoutes(tsoaRouter); // register onto the router, not the app
  app.use('/api', tsoaRouter); // mount all generated routes under /api
  console.log('✅ TSOA routes registered under /api');
} catch (err) {
  console.warn('⚠️ Failed to register TSOA routes. Did you run `npm run tsoa:gen`?', err);
}

//List Routes
prettyListRoutes(app, tsoaRouter, '/api');

// ==============================
// 9. MOUNT SWAGGER (TSOA GENERATED OPENAPI.JSON)
// ==============================
const openapiPath = path.join(__dirname, '../dist/swagger.json'); // adjust if your spec path differs

if (fs.existsSync(openapiPath)) {
  const openapiSpec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
  // Serve raw OpenAPI JSON
  app.get('/api/docs.json', (req, res) => res.json(openapiSpec));
  // Serve Swagger UI
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, { explorer: true })
  );
  console.log('Swagger UI running at /api/docs');
} else {
  console.warn('⚠️  No openapi.json found. Run:  npm run tsoa:gen');
}

// ==============================
// 10. 404 Handler
// ==============================
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// ==============================
// 11. Error Handler
// ==============================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal error' });
});

// Global Exception Filter
app.use(exceptionFilter());

// ==============================
// 12. Start Server
// ==============================
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
