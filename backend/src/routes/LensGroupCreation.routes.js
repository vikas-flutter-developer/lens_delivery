import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import {
    addLensPower,
    getLensPower,
    getAllLensPower,
    removeLensPower,
    editLensPower,
    checkBarcodeExists,
    generateUniqueBarcode,
    verifyLensStock,
    getMissingLenses,
    getPowerRangeLibrary,
    getPowerGroupsForProduct,
    resetAllLensPriceHighlights,
    updateLensGroupLocations,
    getCombinationStock,
} from '../controllers/lensGroupCreation.controller.js'
const router = express.Router();

router.post('/createLensPower', authMiddleware, addLensPower);
router.get('/getLensPower', authMiddleware, getLensPower);
router.post('/getLensPower', authMiddleware, getLensPower);
router.get('/getAllLensPower', authMiddleware, getAllLensPower);
router.put('/editLensPower', authMiddleware, editLensPower)
router.delete('/deletelensPower', authMiddleware, removeLensPower)
router.post('/checkBarcodeExists', authMiddleware, checkBarcodeExists);
router.post('/generateUniqueBarcode', authMiddleware, generateUniqueBarcode);
router.post('/verifyStock', authMiddleware, verifyLensStock);
router.get('/missing-lenses', authMiddleware, getMissingLenses);
router.get('/power-range-library', authMiddleware, getPowerRangeLibrary);
router.get('/power-groups-for-product', authMiddleware, getPowerGroupsForProduct);
router.post('/resetAllPriceHighlights', authMiddleware, resetAllLensPriceHighlights);
router.post('/update-locations', authMiddleware, updateLensGroupLocations);
router.post('/getCombinationStock', authMiddleware, getCombinationStock);

export default router;
