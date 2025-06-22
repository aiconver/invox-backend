import { Sequelize } from 'sequelize';
import CombinedConfig from '@/lib/config/CombinedConfig';

// Load environment config
const config = new CombinedConfig(process.env);

// Initialize Sequelize instance
export const sequelize = new Sequelize(
  config.dbName,
  config.dbUser,
  config.dbPass,
  {
    host: config.dbHost,
    port: config.dbPort,
    dialect: 'postgres',
    logging: !config.isProd,
  }
);

// Optional: hook to add models in future
export const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
  } catch (err) {
    console.error('❌ Unable to connect to the database:', err);
    process.exit(1);
  }
};
