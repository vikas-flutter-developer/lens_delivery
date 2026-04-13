import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { getAllGroups, getGroup, updateGroup, addGroup , deleteGroup } from "../controllers/group.controller.js"
const router = express.Router();

router.post('/add-group', authMiddleware, addGroup);
router.post('/update/:id', authMiddleware, updateGroup);
router.get('/:id', authMiddleware, getGroup);
router.get('/', authMiddleware, getAllGroups);
router.delete('/delete/:id' , authMiddleware , deleteGroup);


export default router;