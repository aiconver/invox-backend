import { Router, Request, Response } from 'express';
import { HealthController } from '../../controllers/v1/HealthController';

const router = Router();
const healthController = new HealthController();

// GET /api/v1/health
router.get('/', healthController.getHealth.bind(healthController));

// GET /api/v1/health/detailed
router.get('/detailed', healthController.getDetailedHealth.bind(healthController));

export default router;
