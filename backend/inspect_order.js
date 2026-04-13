import mongoose from "mongoose";
import dotenv from "dotenv";
import LensSaleChallan from "./src/models/LensSaleChallan.js";
import LensSale from "./src/models/LensSale.js";
import RxSale from "./src/models/RxSale.js";

dotenv.config();

const orderId = "69d60dbdc82c7b678323c35e";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const order = await LensSaleChallan.findById(orderId) || 
                  await LensSale.findById(orderId) || 
                  await RxSale.findById(orderId);
    
    if (order) {
      console.log("\nDOCUMENT_START");
      console.log(JSON.stringify(order, null, 2));
      console.log("DOCUMENT_END\n");
    } else {
      console.log("Order not found");
    }
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}
run();
