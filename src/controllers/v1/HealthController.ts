import { Request, Response } from 'express';
import { HealthService } from '@/services/HealthService';
import { ApiResponse } from '@/types/ApiResponse';
import { HealthStatus } from '@/types/HealthStatus';

export class HealthController {
  private healthService: HealthService;

  constructor() {
    this.healthService = new HealthService();
  }

  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthData = await this.healthService.getBasicHealth();
      
      const response: ApiResponse<HealthStatus> = {
        success: true,
        data: healthData,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to get health status',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  async getDetailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthData = await this.healthService.getDetailedHealth();
      
      const response: ApiResponse<HealthStatus> = {
        success: true,
        data: healthData,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to get detailed health status',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}