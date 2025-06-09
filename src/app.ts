
import express from "express";
import cors from "cors";
import { json } from "body-parser";
import { rpcRouter } from "./api/rpc";

const app = express();
app.use(cors());
app.use(json());

app.post("/rpc", rpcRouter);

export default app;
