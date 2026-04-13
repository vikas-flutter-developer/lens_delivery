import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const fixIndex = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;
        console.log('Connecting to Mongo...');
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        const collectionName = 'saleorders';
        const collection = db.collection(collectionName);

        const indexes = await collection.indexes();
        console.log(`Indexes for ${collectionName}:`, JSON.stringify(indexes, null, 2));

        const targetIndex = 'billData.billNo_1';
        const exists = indexes.some(idx => idx.name === targetIndex);

        if (exists) {
            console.log(`Dropping index: ${targetIndex}`);
            await collection.dropIndex(targetIndex);
            console.log('Index dropped successfully');
        } else {
            console.log(`Index ${targetIndex} not found`);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

fixIndex();
