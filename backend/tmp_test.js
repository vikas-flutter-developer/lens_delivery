import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import fs from "fs";

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const LensSale = mongoose.model('LensSale', new mongoose.Schema({}, { strict: false }));
    const sample = await LensSale.aggregate([
        { $unwind: "$items" },
        { $limit: 5 },
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
    
    const agg = await LensSale.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        { $unwind: "$items" },
        {
            $group: {
                _id: "$items.itemName",
                sumQty: { $sum: "$items.qty" },
                liveProfitOld: {
                    $sum: {
                        $multiply: [
                            {
                                $subtract: [
                                    { $ifNull: ["$items.sellPrice", { $ifNull: ["$items.salePrice", 0] }] },
                                    { $ifNull: ["$items.purchasePrice", 0] }
                                ]
                            },
                            { $ifNull: ["$items.qty", 0] }
                        ]
                    }
                },
                liveProfitNew: {
                    $sum: {
                        $subtract: [
                            { $ifNull: ["$items.totalAmount", 0] },
                            { $ifNull: [ { $multiply: ["$items.purchasePrice", "$items.qty"] } , 0] }
                        ]
                    }
                }
            }
        }
    ]);
    fs.writeFileSync("db_dump.json", JSON.stringify({ sample, agg }, null, 2), 'utf8');
    process.exit(0);
}
run();
