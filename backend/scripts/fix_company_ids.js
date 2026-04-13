import mongoose from 'mongoose';
import 'dotenv/config';
import '../src/config/dbConfig/Db.js';

// Import all models that need fixing
import User from '../src/models/User.js';
import LensGroup from '../src/models/LensGroup.js';
import Item from '../src/models/Item.js';
import LensSaleOrder from '../src/models/LensSaleOrder.js';
import RxSaleOrder from '../src/models/RxSaleOrder.js';
import ContactLensSaleOrder from '../src/models/ContactLensSaleOrder.js';
import Account from '../src/models/Account.js';

async function fixAllRecords() {
    try {
        const COMPANY_ID = "699d38c830d447103770fbca"; // Your actual Company ID from Compass

        const models = [
            { name: "User", model: User },
            { name: "LensGroup", model: LensGroup },
            { name: "Item", model: Item },
            { name: "LensSaleOrder", model: LensSaleOrder },
            { name: "RxSaleOrder", model: RxSaleOrder },
            { name: "ContactLensSaleOrder", model: ContactLensSaleOrder },
            { name: "Account", model: Account }
        ];

        console.log("--- Starting Global companyId Cleanup ---");

        for (const { name, model } of models) {
            const collection = mongoose.connection.db.collection(model.collection.name);
            const result = await collection.updateMany(
                {
                    $or: [
                        { companyId: null },
                        { companyId: { $exists: false } },
                        { companyId: "" }
                    ]
                },
                { $set: { companyId: new mongoose.Types.ObjectId(COMPANY_ID) } }
            );
            console.log(`[${name}]: Updated ${result.modifiedCount} records.`);
        }

        console.log("--- Cleanup Complete ---");
        process.exit(0);
    } catch (err) {
        console.error("Critical Error during cleanup:", err);
        process.exit(1);
    }
}

// Wait for DB connection
setTimeout(fixAllRecords, 2000);
