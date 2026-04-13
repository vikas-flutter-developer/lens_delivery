import mongoose from "mongoose";
import Vendor from "./models/Vendor.js";
import Account from "./models/Account.js";
import dotenv from "dotenv";

dotenv.config();

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const vendors = await Vendor.find();
        console.log(`Found ${vendors.length} vendors to migrate.`);

        for (const v of vendors) {
            // Check if already migrated
            const exists = await Account.findOne({ Name: v.name, AccountType: "Purchase" });
            if (exists) {
                console.log(`Vendor ${v.name} already exists as Account, skipping.`);
                continue;
            }

            // Generate a simple AccountID if not available (ideally this should match the gap in existing IDs)
            const lastAccount = await Account.findOne().sort({ createdAt: -1 });
            let nextId = 2000; 
            if (lastAccount && lastAccount.AccountId) {
                const match = String(lastAccount.AccountId).match(/\d+/);
                if (match) nextId = parseInt(match[0]) + 1;
            }

            const newAccount = new Account({
                Name: v.name,
                PrintName: v.name,
                AccountId: String(nextId),
                Groups: ["Sundry Creditors"], // Default group for vendors/purchases
                Stations: ["Mumbai"], // Default station
                AccountDealerType: v.gstNo ? "Registerd" : "unregisterd",
                GSTIN: v.gstNo || "",
                Address: v.address || "",
                Email: v.email || "",
                MobileNumber: v.phone || "",
                Remark: v.remark || "",
                Tags: v.tags || [],
                AccountType: "Purchase",
                State: "Maharashtra", // Default
            });

            await newAccount.save();
            console.log(`Migrated vendor: ${v.name}`);
        }

        console.log("Migration complete.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await mongoose.disconnect();
    }
};

migrate();
