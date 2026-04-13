import mongoose from "mongoose";
import Account from "./models/Account.js";
import dotenv from "dotenv";

dotenv.config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const accounts = await Account.find({ AccountType: "Purchase" });
        console.log(`Found ${accounts.length} Purchase accounts.`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

check();
