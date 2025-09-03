import express, { Application } from 'express';
import cors from 'cors';
import { requestLogger } from './requestLogger';

export const setupMiddleware = (app: Application): void => {
  // Basic middleware
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  
  // Custom middleware
  app.use(requestLogger);
};