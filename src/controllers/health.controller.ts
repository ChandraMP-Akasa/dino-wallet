// src/controllers/health.controller.ts
import { Controller, Get, Post, Route, Tags, Query } from 'tsoa';
import { spawn } from 'child_process';
import path from 'path';

@Route('health')
@Tags('Health')
export class HealthController extends Controller {
  @Get('/')
  public async health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('/rate-limit-test')
  public async runRateLimitTest(@Query() requests?: number): Promise<object> {
    const totalRequests = requests || 100;
    const scriptPath = path.join(process.cwd(), 'testing', 'test.py');

    return new Promise((resolve) => {
      const output: string[] = [];
      const errors: string[] = [];

      const python = spawn('python', [scriptPath, totalRequests.toString()], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      python.stdout.on('data', (data) => {
        output.push(data.toString());
      });

      python.stderr.on('data', (data) => {
        errors.push(data.toString());
      });

      python.on('close', (code) => {
        if (code !== 0) {
          resolve({
            status: 'error',
            message: 'Python script failed',
            errors: errors.join(''),
          });
          return;
        }

        try {
          const fullOutput = output.join('');
          const jsonMatch = fullOutput.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            resolve({
              status: 'completed',
              results: result,
            });
          } else {
            resolve({
              status: 'completed',
              rawOutput: fullOutput,
            });
          }
        } catch (parseErr: any) {
          resolve({
            status: 'error',
            message: 'Failed to parse Python output',
            output: output.join(''),
            errors: errors.join(''),
          });
        }
      });

      python.on('error', (err) => {
        resolve({
          status: 'error',
          message: 'Failed to run Python script',
          error: err.message,
        });
      });
    });
  }
}
