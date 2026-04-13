import express from "express";
import {
    addProductExchange,
    getAllProductExchanges,
    getProductExchangeById,
    updateProductExchange,
    deleteProductExchange,
} from "../controllers/ProductExchange.controller.js";

const router = express.Router();

router.post("/add", addProductExchange);
router.get("/getall", getAllProductExchanges);
router.get("/get/:id", getProductExchangeById);
router.put("/update/:id", updateProductExchange);
router.delete("/delete/:id", deleteProductExchange);

export default router;
