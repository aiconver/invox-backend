import { Request, Response, Router } from "express";

export function jsonRpcRouter(methods: Record<string, Function>): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const { method, params, id } = req.body;

    try {
      const fn = methods[method];
      if (!fn) throw new Error(`Method not found: ${method}`);

      const result = await fn(...(Array.isArray(params) ? params : [params]));

      res.json({ jsonrpc: "2.0", result, id });
    } catch (error: any) {
      res.json({ jsonrpc: "2.0", error: { code: -32000, message: error.message }, id });
    }
  });

  return router;
}
