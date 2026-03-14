# Dino Wallet - AGENTS.md

This document provides guidelines for agents working on the Dino Wallet project.

## Project Overview

Dino Wallet is an in-game currency wallet system built with Node.js, TypeScript, and Express. It uses:

- **tsoa** for routing and Swagger/OpenAPI spec generation
- **PostgreSQL** for database (assumes payment system is external)
- **JWT** for API authentication
- **express-rate-limit** for rate limiting (global and per-endpoint)
- **Docker + nginx** for containerization and reverse proxy

## Build Commands

```bash
# Install dependencies
npm install

# Generate tsoa routes and swagger spec (run before dev/build)
npm run tsoa:gen

# Run in development mode (auto-regenerates tsoa on changes)
npm run dev

# Watch mode for tsoa (regenerates on controller file changes)
npm run watch:tsoa

# Run both watchers concurrently
npm run dev:all

# Build for production
npm run build

# Start production server
npm start

# Type checking only
npm run type-check

# Lint code
npm run lint

# Format code
npm run format
```

## Testing

### Python Rate Limiting Tests

```bash
# Setup virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install test dependencies
pip install -r requirements.txt

# Run rate limiter tests
python testing/test.py
```

The test script sends concurrent requests to test the rate limiting middleware. Modify `total_requests` parameter (default 100) in `testing/test.py` to adjust load.

### Manual API Testing

Import `dinowallet_postman_collections.json` into Postman for API testing.

## Code Style Guidelines

### TypeScript Configuration

- Target: ES2021
- Strict mode enabled
- No implicit `any` (`noImplicitAny: true`)
- Use decorators for tsoa routing

### Imports

```typescript
// Standard library imports first
import path from 'path';
import fs from 'fs';

// External imports second
import express from 'express';
import jwt from 'jsonwebtoken';

// Local imports third (relative paths)
import { RegisterRoutes } from './routes/routes';
import { authenticate } from '../services/user.service';
```

### Naming Conventions

- **Files**: kebab-case (e.g., `user-controller.ts`, `rate-limiter.ts`)
- **Classes**: PascalCase (e.g., `UserController`, `RateLimit`)
- **Functions**: camelCase (e.g., `createUser`, `authenticate`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `JWT_SECRET`, `BASE_ASSET_ID`)
- **Interfaces/Types**: PascalCase (e.g., `CreateUserRequest`, `RateLimitOptions`)
- **DTOs**: Use suffix `DTO` (e.g., `CreateUserDTO`, `UserDTO`)

### Formatting

- Use Prettier with config in `.prettierrc`:
  - Semi-colons: enabled
  - Single quotes: enabled
  - Print width: 80
  - Tab width: 2

### Error Handling

```typescript
// Throw errors with status code
throw { status: 400, message: "Invalid request payload" };

// Or use http-errors package
import createError from 'http-errors';
throw createError(400, 'Invalid request');

// Always include status in caught errors
catch (err: any) {
  err.status = err.status || 500;
  throw err;
}
```

### Database Operations

- Always use parameterized queries (`$1, $2, etc.`)
- Use transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) for multi-step operations
- Use `FOR UPDATE` to lock rows when needed
- Release PoolClient in `finally` block:

```typescript
const client: PoolClient = await pool.connect();
try {
  await client.query('BEGIN');
  // operations
  await client.query('COMMIT');
} catch (err: any) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### tsoa Controller Guidelines

- Use decorators: `@Route`, `@Tags`, `@Get`, `@Post`, `@Body`, `@Path`, `@Security`, `@Request`
- Always add `@RateLimit` decorator for rate-limited endpoints
- Return proper DTOs/interfaces, not raw objects when possible
- Add JSDoc comments for Swagger documentation:

```typescript
/**
 * @summary Get user profile
 * @description Returns the authenticated user's profile with wallets and orders
 */
@Security("BearerAuth")
@Get("/profile")
public async getUserProfile(@Request() request: any): Promise<object> {
  return getUserDetails(request);
}
```

### Authentication

- BearerAuth: JWT tokens (use `@Security("BearerAuth")`)
- BasicAuth: Username/password login (use `@Security("BasicAuth")`)
- JWT algorithm forced to HS256 in `src/auth/auth.ts`

### Rate Limiting

- Global rate limiter: configured in `src/utils/ratelimiter.ts`
- Per-endpoint: Use `@RateLimit` decorator
- Default: 10 requests per second (capacity: 10, refillRate: 1)

### File Structure

```
src/
├── auth/
│   └── auth.ts           # JWT/Basic auth middleware
├── config/
│   ├── app-config.ts     # App configuration
│   ├── db.ts            # Database connection pool
│   └── query.ts         # Query helper functions
├── controllers/
│   ├── health.controller.ts
│   └── user.controller.ts
├── decorators/
│   └── rateLimit.ts     # Rate limit decorator
├── dto/
│   ├── CreateUserDTO.ts
│   └── UserDTO.ts
├── middlewares/
│   ├── global-api-request-logger.ts
│   └── global-exception-filter.ts
├── queries/
│   └── sql.ts           # SQL query strings
├── routes/
│   └── routes.ts        # tsoa generated
├── services/
│   └── user.service.ts  # Business logic
├── utils/
│   ├── hashing.ts       # Password hashing
│   ├── httpErrors.ts
│   ├── logger.ts       # Winston logger
│   ├── ratelimiter.ts  # Rate limit logic
│   ├── route-list.ts
│   └── setupLogging.ts
└── index.ts             # Express app entry point
```

### Docker Commands

```bash
# Build and start containers
docker-compose up --build

# Stop containers
docker-compose down

# View logs
docker-compose logs -f app
```

## Environment Variables

Required in `.env`:

- `NODE_ENV`: local/development/production
- `PORT`: Server port (default 8000)
- `DATABASE_URL`: PostgreSQL connection string
- `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- `JWT_SECRET`: Secret key for JWT signing
- `SEARCH_PATH`: Database schema (default: dinowallet)

## Database

- Run `seed.sql` to populate test data
- ER diagram available in `er-diagram.png`
- Use `dinowallet` schema for all tables

## Swagger Documentation

- Swagger UI: `http://localhost:8000/api/docs`
- OpenAPI spec JSON: `http://localhost:8000/api/docs.json`
