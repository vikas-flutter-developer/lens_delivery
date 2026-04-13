import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addAccount, getAllAccounts, getAccountById, updateAccount, deleteAccount, patchAccount, getNextAccountId } from '../controllers/Account.controller.js'
const router = express.Router();

router.post('/add-account', authMiddleware, addAccount);
router.get('/next-id', authMiddleware, getNextAccountId);
router.get('/getallaccounts', authMiddleware, getAllAccounts)
router.get('/get/:id', authMiddleware, getAccountById)
router.put('/update/:id', authMiddleware, updateAccount);
router.patch('/patch/:id', authMiddleware, patchAccount);
router.delete('/delete/:id', authMiddleware, deleteAccount)
export default router;