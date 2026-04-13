import mongoose from 'mongoose';
import LensPurchase from './src/models/LensPurchase.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const res = await LensPurchase.aggregate([
    { $match: { 'items.itemName': 'lens7' } },
    { $unwind: '$items' },
    { $match: { 'items.itemName': 'lens7' } },
    {
       $group: {
         _id: { sph: '$items.sph', cyl: '$items.cyl', add: '$items.add', eye: '$items.eye' },
         vendors: { $addToSet: '$partyData.partyAccount' }
       }
    }
  ]);
  console.log(JSON.stringify(res, null, 2));
  mongoose.disconnect();
}

test().catch(console.error);
