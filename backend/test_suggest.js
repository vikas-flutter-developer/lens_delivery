import 'dotenv/config';
import mongoose from 'mongoose';
import Suggestion from './src/models/Suggestion.js';

async function test() {
  await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017/optosoft', { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected");
  
  const type = "tax";
  const v = "Delivery";
  
  const ops = [
  {
      updateOne: {
          filter: { type, value: new RegExp(`^${v}$`, "i") }, // Case-insensitive exact match
          update: { $setOnInsert: { type, value: v } },     // Store original case
          upsert: true
      }
  }];
  
  try {
     const res = await Suggestion.bulkWrite(ops);
     console.log("BulkWrite res:", res);
     
     const suggs = await Suggestion.find({});
     console.log("Suggestions:", suggs);
  } catch(e) {
     console.error("Error bulkWrite:", e);
  }
  process.exit(0);
}

test();
