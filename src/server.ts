// server.ts
import express, { Request, Response } from 'express';
import CombinedConfig from '@/lib/config/CombinedConfig';
import { initDatabase } from './db';
import { rpcMethods } from '@/api';
import { registerCronJobs } from './jobs';
import { verifyJwt } from './middlewares/verify-jwt';
import { requireRole } from './middlewares/require-role';
import { JwtUser } from '@/types/typed-request';

import { z } from 'zod';
import { extractStructuredData } from './api/methods/alpha/orchestrator/extract';
import { ProcessingType } from './api/methods/alpha/types/public';

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

    // ✅ JSON-RPC (auth required)
    app.post('/rpc', verifyJwt, requireRole('admin', 'employee'), async (req: Request, res: Response) => {
      const { jsonrpc, method, params, id } = req.body;
      const user = (req as any).user as JwtUser;

      if (!method || typeof method !== 'string') {
        return res.status(400).json({ jsonrpc: "2.0", error: { code: -32600, message: "Invalid method name" }, id });
      }
      const handler = (rpcMethods as any)[method];
      if (!handler) {
        return res.status(404).json({ jsonrpc: "2.0", error: { code: -32601, message: "Method not found" }, id });
      }
      try {
        const result = await handler(params, { user });
        return res.json({ jsonrpc: "2.0", result, id });
      } catch (error: any) {
        console.error(`❌ RPC method ${method} failed:`, error);
        return res.status(500).json({ jsonrpc: "2.0", error: { code: -32000, message: error.message || "Internal server error" }, id });
      }
    });

    // 🔓 TEMP: Unauthenticated REST endpoint for extractor (enable with env)
    if (process.env.ENABLE_UNSAFE_EXTRACT === 'true') {
      console.warn('⚠️ ENABLE_UNSAFE_EXTRACT=true — /test/extract is exposed without auth. Do NOT use in production.');

      // Minimal request schema (same shape as RPC params)
      const KnowledgeItemSchema = z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("text"), title: z.string().optional(), content: z.string() }),
        z.object({ kind: z.literal("glossary"), terms: z.array(z.object({ term: z.string(), definition: z.string() })) }),
        z.object({ kind: z.literal("rules"), rules: z.array(z.string()) }),
        z.object({ kind: z.literal("faq"), pairs: z.array(z.object({ q: z.string(), a: z.string() })) }),
      ]);
      const FieldConstraintSchema = z.object({
        required: z.boolean().optional(),
        pattern: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        enum: z.array(z.string()).optional(),
        format: z.enum(["iban","vat","zipcode","country","url"]).optional(),
        confidenceThreshold: z.number().min(0).max(1).optional(),
        parseLocale: z.string().optional(),
      });
      const FieldSchema = z.object({
        id: z.string(),
        label: z.string().optional(),
        type: z.enum(["string","number","integer","date","datetime","boolean","enum","email","phone","currency","array","object"]),
        description: z.string().optional(),
        constraints: FieldConstraintSchema.optional(),
        properties: z.record(z.any()).optional(),
        items: z.any().optional(),
        priority: z.enum(["high","medium","low"]).optional(),
      });
      const SchemaSchema = z.object({
        version: z.string(),
        title: z.string().optional(),
        fields: z.array(FieldSchema).min(1),
      });
      const BodySchema = z.object({
        transcript: z.union([
          z.string(),
          z.object({ text: z.string(), locale: z.string().optional(), sourceId: z.string().optional() })
        ]),
        structure: SchemaSchema,
        knowledge: z.object({ context: z.string().optional(), items: z.array(KnowledgeItemSchema).optional() }).optional(),
        examples: z.array(z.object({ transcript: z.string(), answers: z.record(z.unknown()), notes: z.string().optional() })).optional(),
        processingType: z.nativeEnum(ProcessingType).optional(),
        options: z.object({
          model: z.string().optional(),
          timeoutMs: z.number().int().positive().optional(),
          minConfidenceDefault: z.number().min(0).max(1).optional(),
          maxEscalationsPerField: z.number().int().min(0).max(3).optional(),
          todayISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        }).optional(),
      });

      app.post('/test/extract', async (req: Request, res: Response) => {
        const parsed = BodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
        }
        const { transcript, structure, knowledge, examples, processingType, options } = parsed.data;
        try {
          const result = await extractStructuredData(
            { transcript, structure, knowledge, examples, processingType },
            {
              model: options?.model ?? "gpt-4o",
              timeoutMs: options?.timeoutMs ?? 20000,
              minConfidenceDefault: options?.minConfidenceDefault ?? 0.7,
              maxEscalationsPerField: options?.maxEscalationsPerField ?? 1,
              todayISO: options?.todayISO,
            }
          );
          res.json(result);
        } catch (e: any) {
          console.error('❌ /test/extract failed:', e);
          res.status(500).json({ error: e?.message ?? 'Extraction failed' });
        }
      });
    }

    app.listen(config.port, () => {
      console.log(`🚀 Invox backend running at http://localhost:${config.port}`);
      if (process.env.ENABLE_UNSAFE_EXTRACT === 'true') {
        console.log(`🧪 Test endpoint available at http://localhost:${config.port}/test/extract`);
      }
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
  }
};
