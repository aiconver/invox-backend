import express from 'express';
import cors from 'cors';
import CombinedConfig from './lib/config/CombinedConfig';
import { setupMiddleware } from './middleware';
import { setupRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const config = new CombinedConfig(process.env);

export const startServer = async () => {
  try {
    const app = express();
    
    // Setup middleware
    setupMiddleware(app);
    
    // Setup routes
    setupRoutes(app);
    
    // Error handling (should be last)
    app.use(notFoundHandler);
    app.use(errorHandler);

    app.listen(config.port, () => {
      console.log(`🚀 Invox backend running at http://localhost:${config.port}`);
      console.log(`📖 API docs available at http://localhost:${config.port}/api/v1`);
    });
    
  } catch (err) {
    console.error('❌ Failed to start server:', err);
  }
};