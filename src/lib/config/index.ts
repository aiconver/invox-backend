import * as dotenv from "dotenv";
import CombinedConfig from "./CombinedConfig";

dotenv.config(); // load .env

const config = new CombinedConfig(process.env);

export default config;
