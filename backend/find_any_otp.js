import mongoose from "mongoose";
import dotenv from "dotenv";
import LensSaleChallan from "./src/models/LensSaleChallan.js";
import LensSale from "./src/models/LensSale.js";
import RxSale from "./src/models/RxSale.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find the most recently updated order that HAS an OTP
    const models = [
      { Model: LensSaleChallan, name: "Challan" },
      { Model: LensSale, name: "Invoice" },
      { Model: RxSale, name: "Rx Invoice" }
    ];
    let latestOrder = null;
    let latestModel = "";

    for (const m of models) {
      const order = await m.Model.findOne({ deliveryOtp: { $ne: null } }).sort({ updatedAt: -1 }).lean();
      if (order) {
        if (!latestOrder || order.updatedAt > latestOrder.updatedAt) {
          latestOrder = order;
          latestModel = m.name;
        }
      }
    }

    if (latestOrder) {
      console.log("\n==========================================");
      console.log(`|  FOUND RECENT OTP FOR TEST              |`);
      console.log(`|  ORDER ID: ${latestOrder._id}  |`);
      console.log(`|  OTP CODE: ${latestOrder.deliveryOtp}                        |`);
      console.log(`|  TYPE:     ${latestModel}                       |`);
      console.log(`|  CUSTOMER: ${latestOrder.partyData?.partyAccount || "Unknown"}       |`);
      console.log("==========================================\n");
    } else {
      console.log("\n>>> No orders found with an OTP assigned. <<<");
      console.log("This usually means no orders have been scanned yet with OTP requirements.");
    }
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}
run();
