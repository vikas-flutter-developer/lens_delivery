import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;

async function dropIndex() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        const db = mongoose.connection.db;
        const collection = db.collection('purchasechallans');

        const indexes = await collection.indexes();
        console.log('Current indexes on purchasechallans:');
        indexes.forEach(idx => console.log(' -', idx.name, ':', JSON.stringify(idx.key)));

        const targetIndex = indexes.find(idx => idx.name === 'billData.billNo_1');
        if (targetIndex) {
            await collection.dropIndex('billData.billNo_1');
            console.log('✅ Successfully dropped unique index "billData.billNo_1"');
        } else {
            console.log('ℹ️  Index "billData.billNo_1" not found — may already be dropped.');
        }

        const remainingIndexes = await collection.indexes();
        console.log('Remaining indexes:');
        remainingIndexes.forEach(idx => console.log(' -', idx.name));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

dropIndex();
