
import { jsonRpcRouter } from "../../lib/jsonRpc";
import * as system from "./system.rpc";

export const rpcRouter = jsonRpcRouter({
  ...system,
});
