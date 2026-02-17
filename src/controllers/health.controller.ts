// src/controllers/health.controller.ts
import { Controller, Get, Route, Tags } from 'tsoa';

@Route('health')
@Tags('Health')
export class HealthController extends Controller {
  @Get('/')
  public async health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
