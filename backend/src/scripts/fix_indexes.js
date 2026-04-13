import mongoose from 'mongoose';
import 'dotenv/config';

const uri = process.env.MONGO_URI;

const collections = [
    'purchasereturns',
    'salereturns',
    'rxpurchasereturns',
    'rxsalereturns'
];

async function fix() {
    if (!uri) {
        console.error("MONGO_URI not found in environment");
        return;
    }
    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;

        for (const collName of collections) {
            console.log(`\n=========================================`);
            console.log(`Processing collection: ${collName}`);
            const collection = db.collection(collName);

            let indexes;
            try {
                indexes = await collection.indexes();
            } catch (e) {
                console.warn(`Could not get indexes for ${collName} (maybe collection doesn't exist yet): ${e.message}`);
                continue;
            }

            // 1. Find and drop the old unique index on billNo if it exists
            const oldIndex = indexes.find(idx => idx.name === 'billData.billNo_1');
            if (oldIndex) {
                console.log(`- Found index 'billData.billNo_1'. Checking if it's unique...`);
                if (oldIndex.unique) {
                    console.log(`- Dropping unique index 'billData.billNo_1'`);
                    await collection.dropIndex('billData.billNo_1');
                } else {
                    console.log(`- Index 'billData.billNo_1' is not unique. Dropping anyway to avoid confusion.`);
                    await collection.dropIndex('billData.billNo_1');
                }
            } else {
                console.log(`- No index named 'billData.billNo_1' found.`);
            }

            // 2. Create the new compound unique index
            console.log(`- Creating compound unique index: { companyId: 1, "billData.billNo": 1 }`);
            try {
                await collection.createIndex({ companyId: 1, "billData.billNo": 1 }, { unique: true, name: "companyId_1_billNo_1" });
                console.log(`- SUCCESS: Compound unique index created for ${collName}`);
            } catch (err) {
                console.error(`- FAILED to create index for ${collName}.`);
                console.error(`  Error: ${err.message}`);
                if (err.code === 11000) {
                    console.error(`  Reason: There are already duplicate billNo for the SAME companyId.`);
                }
            }
        }

    } catch (err) {
        console.error("Connection error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    }
}

fix();
