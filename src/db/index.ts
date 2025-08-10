import { Sequelize } from "sequelize";
import CombinedConfig from "@/lib/config/CombinedConfig";

const config = new CombinedConfig(process.env);

export const sequelize = new Sequelize(
  config.dbName,
  config.dbUser,
  config.dbPass,
  {
    host: config.dbHost,
    port: config.dbPort,
    dialect: "postgres",
    logging: !config.isProd,
  }
);

export const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established.");

    // Models already initialized with sequelize, just sync
    await sequelize.sync({ alter: true });
    console.log("✅ Models synced to DB");
  } catch (err) {
    console.error("❌ Database init failed:", err);
    process.exit(1);
  }
};
