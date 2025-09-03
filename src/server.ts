// server.ts
import express from 'express';
import CombinedConfig from '@/lib/config/CombinedConfig';


const config = new CombinedConfig(process.env);

export const startServer = async () => {
  try {
    const app = express();
    app.use(express.json({ limit: "20mb" }));
    

    app.listen(config.port, () => {
      console.log(`🚀 Invox backend running at http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
  }
};
