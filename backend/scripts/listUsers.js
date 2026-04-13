import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import mongoose from 'mongoose';

// Define minimal schemas inline to avoid conflicts
const CompanySchema = new mongoose.Schema({ name: String });
const UserSchema = new mongoose.Schema({ name: String, email: String, role: String, isActive: Boolean, companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' } });

const Company = mongoose.models.Company || mongoose.model('Company', CompanySchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'name email role isActive').populate('companyId', 'name');
    const output = users.map(u => ({
        name: u.name,
        email: u.email,
        role: u.role,
        company: u.companyId?.name || 'N/A',
        active: u.isActive
    }));
    fs.writeFileSync(path.join(__dirname, 'users_list.json'), JSON.stringify(output, null, 2));
    console.log('Done - saved to scripts/users_list.json');
    process.exit(0);
};
run().catch(e => { console.error(e.message); process.exit(1); });
