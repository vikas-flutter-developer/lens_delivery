import mongoose from "mongoose";
import "dotenv/config";
import LensSaleChallan from "./backend/src/models/LensSaleChallan.js";
import LensSale from "./backend/src/models/LensSale.js";
import RxSale from "./backend/src/models/RxSale.js";

// The order ID from your screenshot
const orderId = "69d60dbdc82c7b678323c35e";

async function run() {
  try {
    // Connect using your local .env MONGO_URI
    await mongoose.connect(process.env.MONGO_URI);
    
    const order = await LensSaleChallan.findById(orderId) || 
                  await LensSale.findById(orderId) || 
                  await RxSale.findById(orderId);
    
    if (order && order.deliveryOtp) {
      console.log("\n========================================");
      console.log(`|  TESTING OTP FOR ORDER: ${orderId}  |`);
      console.log(`|  CODE: ${order.deliveryOtp}                        |`);
      console.log("========================================\n");
    } else if (order) {
      console.log("Order found, but no OTP has been generated yet. Please scan it in the app first.");
    } else {
      console.log("Order not found in database.");
    }
  } catch (e) {
    console.error("Error fetching OTP:", e.message);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}
run();
