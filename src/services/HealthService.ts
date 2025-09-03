import { HealthStatus } from '@/types/HealthStatus';
import os from 'os';

export class HealthService {
  async getBasicHealth(): Promise<HealthStatus> {
    return {
      status: 'OK',
      service: 'Invox Backend',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  async getDetailedHealth(): Promise<HealthStatus> {
    const basicHealth = await this.getBasicHealth();
    
    return {
      ...basicHealth,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          system: Math.round(os.totalmem() / 1024 / 1024)
        },
        cpu: {
          count: os.cpus().length,
          loadAverage: os.loadavg()
        }
      }
    };
  }
}