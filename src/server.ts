// server.ts
import express, { Request, Response } from 'express';
import CombinedConfig from '@/lib/config/CombinedConfig';
import { initDatabase } from './db';
import { rpcMethods } from '@/api';
import { registerCronJobs } from './jobs';
import { verifyJwt } from './middlewares/verifyJwt';
import { requireRole } from './middlewares/requireRole';
import { JwtUser } from '@/types/typed-request';

const config = new CombinedConfig(process.env);

export const startServer = async () => {
  try {
    await initDatabase();
    await registerCronJobs();

    const app = express();
    app.use(express.json({ limit: "20mb" }));

    console.log('🔍 Checking rpcMethods...');
    if (!rpcMethods || typeof rpcMethods !== 'object' || Array.isArray(rpcMethods)) {
      throw new Error('❌ rpcMethods must be a plain object');
    }

    // ✅ Custom JSON-RPC route with JWT and role checks
    app.post('/rpc', verifyJwt, requireRole('admin', 'employee'), async (req: Request, res: Response) => {
      const { jsonrpc, method, params, id } = req.body;
      const user = (req as any).user as JwtUser;

      if (!method || typeof method !== 'string') {
        return res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid method name" },
          id,
        });
      }

      const handler = (rpcMethods as any)[method];
      if (!handler) {
        return res.status(404).json({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id,
        });
      }

      try {
        const result = await handler(params, { user });
        return res.json({ jsonrpc: "2.0", result, id });
      } catch (error: any) {
        console.error(`❌ RPC method ${method} failed:`, error);
        return res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: error.message || "Internal server error" },
          id,
        });
      }
    });

    app.listen(config.port, () => {
      console.log(`🚀 Invox backend running at http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
  }
};
