import express from 'express';
import { getBackups, triggerBackup, downloadBackup, deleteBackup, restoreBackup } from '../controllers/Backup.controller.js';
import authMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();

router.use(authMiddleware); // Protect all backup routes

router.get('/', getBackups);
router.post('/trigger', triggerBackup);
router.get('/download/:id', downloadBackup);
router.delete('/:id', deleteBackup);
router.post('/restore/:id', restoreBackup);

export default router;
