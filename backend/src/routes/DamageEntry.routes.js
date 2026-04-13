import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import {
    createDamageEntry,
    getAllDamageEntries,
    getDamageEntry,
    updateDamageEntry,
    deleteDamageEntry,
    getNextDamageBillNo,
} from '../controllers/DamageEntry.controller.js';

const router = express.Router();

router.post('/create', authMiddleware, createDamageEntry);
router.get('/all', authMiddleware, getAllDamageEntries);
router.get('/nextBillNo', authMiddleware, getNextDamageBillNo);
router.get('/:id', authMiddleware, getDamageEntry);
router.put('/:id', authMiddleware, updateDamageEntry);
router.delete('/:id', authMiddleware, deleteDamageEntry);

export default router;
