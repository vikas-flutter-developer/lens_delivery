import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../src/models/User.js';
import Company from '../src/models/Company.js';

const createSuperAdmin = async () => {
    try {
        console.log("Connecting to:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Create/Find a System Company
        let systemCompany = await Company.findOne({ name: "System Admin" });
        if (!systemCompany) {
            systemCompany = new Company({
                name: "System Admin",
                email: "admin@system.com",
                isActive: true
            });
            await systemCompany.save();
            console.log("Created System Company");
        }

        // 2. Create Super Admin User
        const email = "superadmin@lens.com";
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            existingUser.role = "super_admin";
            existingUser.companyId = systemCompany._id;
            await existingUser.save();
            console.log("Updated existing user to Super Admin");
        } else {
            const hashedPassword = await bcrypt.hash("SuperAdmin@123", 10);
            const superAdmin = new User({
                name: "Master Admin",
                email,
                password: hashedPassword,
                role: "super_admin",
                companyId: systemCompany._id,
                isActive: true
            });
            await superAdmin.save();
            console.log("Created New Super Admin");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error creating Super Admin:", error);
        process.exit(1);
    }
};

createSuperAdmin();
