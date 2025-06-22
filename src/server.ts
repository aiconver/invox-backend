import express from 'express';
import CombinedConfig from '@/lib/config/CombinedConfig';
import { initDatabase } from './db';
import { rpcMethods } from '@/api';

const jsonrpcRouter = require('express-json-rpc-router');
const config = new CombinedConfig(process.env);

export const startServer = async () => {
  try {
    await initDatabase();

    const app = express();
    app.use(express.json());

    // 🪵 Log rpcMethods info
    console.log('🔍 Checking rpcMethods...');
    console.log('➡️ typeof rpcMethods:', typeof rpcMethods);
    console.log('➡️ rpcMethods:', rpcMethods);

    if (!rpcMethods || typeof rpcMethods !== 'object' || Array.isArray(rpcMethods)) {
      console.error('❌ rpcMethods must be a plain object');
      throw new Error('rpcMethods must be a plain object');
    }

    app.post('/rpc', jsonrpcRouter({ methods: rpcMethods }));

    app.listen(config.port, () => {
      console.log(`🚀 Invox backend running at http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
  }
};
