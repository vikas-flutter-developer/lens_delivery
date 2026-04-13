import mongoose from 'mongoose';
import LensPurchase from './src/models/LensPurchase.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const purchases = await LensPurchase.find().limit(5);
  console.log("Found purchases:", purchases.length);
  for (const p of purchases) {
    if (p.items) p.items.forEach(it => console.log(it.itemName, p.partyData.partyAccount, it.eye, it.sph, it.add));
  }
  
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
  console.log("Aggregation:", res);
  mongoose.disconnect();
}

test().catch(console.error);
