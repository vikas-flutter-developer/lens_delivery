import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import fs from "fs";

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const LensSaleOrder = mongoose.model('LensSaleOrder', new mongoose.Schema({}, { strict: false }));
    const sample = await LensSaleOrder.aggregate([
        { $unwind: "$items" },
        { $limit: 1 },
        { 
            $project: {
                itemName: "$items.itemName",
                qty: "$items.qty",
                price: "$items.price",
                sellPrice: "$items.sellPrice",
                salePrice: "$items.salePrice",
                totalAmount: "$items.totalAmount",
                purchasePrice: "$items.purchasePrice"
            }
        }
    ]);
    console.log("LensSaleOrder sample:", JSON.stringify(sample));
    
    // Check LensSaleChallan
    const LensSaleChallan = mongoose.model('LensSaleChallan', new mongoose.Schema({}, { strict: false }));
    const sampleChallan = await LensSaleChallan.aggregate([
        { $unwind: "$items" },
        { $limit: 1 },
        { 
            $project: {
                itemName: "$items.itemName",
                totalAmount: "$items.totalAmount"
            }
        }
    ]);
    console.log("LensSaleChallan sample:", JSON.stringify(sampleChallan));

    process.exit(0);
}
run();
