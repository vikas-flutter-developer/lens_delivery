import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import {addTaxCategory , editTaxCategory, getAllTaxCategories , getTaxCategoryById , deleteTaxCategory} from "../controllers/TaxCategory.Controller.js"
const router = express.Router();
router.get('/getAllTaxCategories' , authMiddleware , getAllTaxCategories )
router.post('/add-taxCategory', authMiddleware, addTaxCategory );
router.put('/edit-taxCategory',authMiddleware,editTaxCategory)
router.get('/getTaxCategoryById',authMiddleware,getTaxCategoryById)
router.delete('/deleteTaxCategory' , authMiddleware , deleteTaxCategory)
export default router;