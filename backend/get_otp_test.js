import mongoose from "mongoose";
import dotenv from "dotenv";
import LensSaleChallan from "./src/models/LensSaleChallan.js";
import LensSale from "./src/models/LensSale.js";
import RxSale from "./src/models/RxSale.js";

dotenv.config();

// The order ID you are testing
const orderId = "69d60dbdc82c7b678323c35e";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const order = await LensSaleChallan.findById(orderId) || 
                  await LensSale.findById(orderId) || 
                  await RxSale.findById(orderId);
    
    if (order && order.deliveryOtp) {
      console.log(`\n>>> SUCCESS: THE OTP FOR THIS ORDER IS: ${order.deliveryOtp} <<<\n`);
    } else if (order) {
      console.log("\n>>> ERROR: Order found but OTP is missing. Please scan the QR code first. <<<\n");
    } else {
      console.log("\n>>> ERROR: Order not found in database. <<<\n");
    }
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}
run();
