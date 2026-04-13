import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { getAllItems, getItem, addItem, updateItem, deleteItem, bulkUpdateItems, getNextAlias } from "../controllers/item.controller.js"
const router = express.Router();

router.get('/next-alias', authMiddleware, getNextAlias);
router.post('/add-item', authMiddleware, addItem);
router.post('/update/:id', authMiddleware, updateItem);
router.post('/bulk-update', authMiddleware, bulkUpdateItems);
router.get('/:id', authMiddleware, getItem);
router.get('/', authMiddleware, getAllItems);
router.delete('/delete/:id', authMiddleware, deleteItem);


export default router;