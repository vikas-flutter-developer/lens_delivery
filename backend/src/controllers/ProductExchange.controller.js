import ProductExchange from "../models/ProductExchange.js";
import { logDeletion } from "../utils/logDeletion.js";

export const addProductExchange = async (req, res) => {
    try {
        const data = req.body;
        const newExchange = new ProductExchange(data);
        const savedExchange = await newExchange.save();
        res.status(201).json({ success: true, data: savedExchange });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to add product exchange", error: err.message });
    }
};

export const getAllProductExchanges = async (req, res) => {
    try {
        const exchanges = await ProductExchange.find().sort({ "billData.date": -1, "billData.billNo": -1 });
        res.status(200).json({ success: true, data: exchanges });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch product exchanges", error: err.message });
    }
};

export const getProductExchangeById = async (req, res) => {
    try {
        const { id } = req.params;
        const exchange = await ProductExchange.findById(id);
        if (!exchange) return res.status(404).json({ success: false, message: "Product exchange not found" });
        res.status(200).json({ success: true, data: exchange });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

export const updateProductExchange = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const updatedExchange = await ProductExchange.findByIdAndUpdate(id, data, { new: true });
        if (!updatedExchange) return res.status(404).json({ success: false, message: "Product exchange not found" });
        res.status(200).json({ success: true, data: updatedExchange });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update product exchange", error: err.message });
    }
};

export const deleteProductExchange = async (req, res) => {
    try {
        const { id } = req.params;
        const exchange = await ProductExchange.findById(id);
        if (!exchange) return res.status(404).json({ success: false, message: "Product exchange not found" });

        await logDeletion({
            type: "transaction",
            name: `Product Exchange - ${exchange.billData?.billNo || 'N/A'}`,
            originalData: exchange
        });

        await ProductExchange.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Product exchange deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to delete product exchange", error: err.message });
    }
};
