export interface HealthStatus {
  status: 'OK' | 'ERROR' | 'WARNING';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  system?: {
    platform: string;
    arch: string;
    nodeVersion: string;
    memory: {
      used: number;
      total: number;
      system: number;
    };
    cpu: {
      count: number;
      loadAverage: number[];
    };
  };
}