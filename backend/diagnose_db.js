import mongoose from 'mongoose';
import 'dotenv/config';

async function diagnose() {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        if (collections.some(c => c.name === 'purchasereturns')) {
            const count = await mongoose.connection.db.collection('purchasereturns').countDocuments();
            console.log('Document count in purchasereturns:', count);

            const docs = await mongoose.connection.db.collection('purchasereturns')
                .find({})
                .project({ "billData.billNo": 1, companyId: 1 })
                .toArray();

            console.log('Current billNo values:', docs.map(d => d.billData?.billNo));

            const indexes = await mongoose.connection.db.collection('purchasereturns').indexes();
            console.log('Indexes on purchasereturns:', JSON.stringify(indexes, null, 2));
        } else {
            console.log('purchasereturns collection NOT FOUND');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Diagnosis failed:', err);
    }
}

diagnose();
