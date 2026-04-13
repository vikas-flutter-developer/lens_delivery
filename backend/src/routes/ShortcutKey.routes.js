import express from 'express';
const router = express.Router();
import * as shortcutController from '../controllers/ShortcutKey.controller.js';
import authMiddleware from '../middlewares/AuthMiddleware.js';

router.get('/', authMiddleware, shortcutController.getShortcuts);
router.post('/', authMiddleware, shortcutController.createShortcut);
router.put('/:id', authMiddleware, shortcutController.updateShortcut);
router.delete('/:id', authMiddleware, shortcutController.deleteShortcut);
router.post('/reset', authMiddleware, shortcutController.resetToDefaults);

export default router;
