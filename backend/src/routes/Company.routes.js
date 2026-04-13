import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { getCompanySettings, updateCompanySettings } from '../controllers/Company.controller.js';

const router = express.Router();

router.get('/settings', authMiddleware, getCompanySettings);
router.put('/settings', authMiddleware, updateCompanySettings);

export default router;
