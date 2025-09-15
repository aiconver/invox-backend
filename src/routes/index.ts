import { Application } from 'express';
import v1Routes from './v1';
import { hasAnyRole, verifyJwt } from '@/middleware/verifyJwt';

export const setupRoutes = (app: Application): void => {
  // API versioning
  app.use('/api/v1', verifyJwt, hasAnyRole, v1Routes);
  
  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'Invox API',
      version: '1.0.0',
      status: 'running',
      availableVersions: {
        v1: '/api/v1'
      },
      documentation: '/api/v1'
    });
  });
};
