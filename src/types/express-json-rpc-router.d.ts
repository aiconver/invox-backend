declare module 'express-json-rpc-router' {
  import { RequestHandler } from 'express';
  function jsonrpcRouter(methods: Record<string, (...args: any[]) => any>): RequestHandler;
  export = jsonrpcRouter;
}
