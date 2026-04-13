import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import {addVendor,getAllVendors,getVendorById,deleteVendor,editVendor} from "../controllers/Vendor.js"
const router = express.Router();
router.get('/getAllVendors' , authMiddleware , getAllVendors )
router.post('/addVendor', authMiddleware, addVendor );
router.put('/editVendor',authMiddleware,editVendor)
router.get('/getVendorById',authMiddleware,getVendorById)
router.delete('/deleteVendor' , authMiddleware , deleteVendor)
export default router;