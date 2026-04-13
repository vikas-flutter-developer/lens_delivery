import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import {addAccountGroup , getAllAccountGroups , getAccountGroupById ,updateAccountGroup , deleteAccountGroup } from '../controllers/AccountGroup.controller.js'
const router = express.Router();

router.post('/add-account-group', authMiddleware, addAccountGroup);
router.get('/get-all-account-groups' , authMiddleware , getAllAccountGroups )
router.get('/get/:id', authMiddleware, getAccountGroupById)
router.put('/update/:id', authMiddleware, updateAccountGroup);
router.delete('/delete/:id' , authMiddleware , deleteAccountGroup)
export default router;