import Company from '../models/Company.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import ActivityLog from '../models/ActivityLog.js';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import Payment from '../models/Payment.js';
import bcrypt from 'bcrypt';


class SuperAdminController {
    // Helper to calculate expiry date
    calculateExpiry(startDate, cycle) {
        let date = new Date(startDate);
        switch (cycle) {
            case 'monthly': date.setMonth(date.getMonth() + 1); break;
            case 'quarterly': date.setMonth(date.getMonth() + 3); break;
            case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
            default: date.setMonth(date.getMonth() + 1);
        }
        return date;
    }

    // Dashboard Stats
    async getDashboardStats(req, res) {
        try {
            const [totalCompanies, totalUsers, activeCompanies, inactiveCompanies, expiredCompanies] = await Promise.all([
                Company.countDocuments(),
                User.countDocuments(),
                Company.countDocuments({ isActive: true, subscriptionStatus: 'active' }),
                Company.countDocuments({ isActive: false }),
                Company.countDocuments({ subscriptionStatus: 'expired' })
            ]);

            res.json({
                totalCompanies,
                totalUsers,
                activeCompanies,
                inactiveCompanies,
                expiredCompanies,
                recentActivities: [] 
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Company Management (existing)
    async getAllCompanies(req, res) {
        try {
            const companies = await Company.find().populate('planId');
            res.json(companies);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async createCompany(req, res) {
        try {
            const { password, ...rest } = req.body;
            const companyData = { ...rest };

            if (!companyData.planExpiryDate) {
                const trialExpiry = new Date();
                trialExpiry.setDate(trialExpiry.getDate() + 14); // 14 days trial
                companyData.planExpiryDate = trialExpiry;
                companyData.subscriptionStatus = 'trial';
            }

            // Hash and store company login password
            if (password) {
                companyData.loginPassword = await bcrypt.hash(password, 10);
            }

            const company = new Company(companyData);
            await company.save();

            // Auto-create an Admin user for this company using company email & password
            if (companyData.email && password) {
                const existingUser = await User.findOne({ email: companyData.email.toLowerCase() });
                if (!existingUser) {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    const adminUser = new User({
                        name: companyData.name,
                        email: companyData.email.toLowerCase(),
                        password: hashedPassword,
                        role: 'admin',
                        companyId: company._id,
                        isActive: true,
                    });
                    await adminUser.save();
                }
            }

            res.status(201).json(company);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async updateCompany(req, res) {
        try {
            const { password, ...rest } = req.body;
            const updateData = { ...rest };

            // If a new password is provided, hash it and update admin user password too
            if (password) {
                updateData.loginPassword = await bcrypt.hash(password, 10);
                const company = await Company.findById(req.params.id);
                if (company?.email) {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await User.findOneAndUpdate(
                        { email: company.email.toLowerCase(), companyId: company._id, role: 'admin' },
                        { password: hashedPassword }
                    );
                }
            }

            const company = await Company.findByIdAndUpdate(req.params.id, updateData, { new: true });
            res.json(company);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    // Subscription Management
    async assignSubscription(req, res) {
        try {
            const { companyId, planId, billingCycle, startDate } = req.body;
            const plan = await Plan.findById(planId);
            if (!plan) return res.status(404).json({ message: "Plan not found" });

            const calculatedStartDate = startDate ? new Date(startDate) : new Date();
            const expiryDate = this.calculateExpiry(calculatedStartDate, billingCycle);
            
            // Add grace period (7 days)
            const gracePeriodDate = new Date(expiryDate);
            gracePeriodDate.setDate(gracePeriodDate.getDate() + 7);

            const company = await Company.findByIdAndUpdate(companyId, {
                planId,
                billingCycle,
                subscriptionStartDate: calculatedStartDate,
                planExpiryDate: expiryDate,
                gracePeriodEndDate: gracePeriodDate,
                subscriptionStatus: 'active',
                isTrial: false,
                isActive: true
            }, { new: true });

            // Record Payment (Manual for now)
            const amount = plan.prices[billingCycle];
            const payment = new Payment({
                companyId,
                planId,
                billingCycle,
                amount,
                totalAmount: amount, // Logic for GST can be added
                expiryDate,
                status: 'paid',
                paymentMethod: 'manual',
                invoiceNumber: `INV-${Date.now()}`
            });
            await payment.save();

            res.json({ company, payment });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getPaymentsHistory(req, res) {
        try {
            const payments = await Payment.find().populate('companyId planId').sort({ createdAt: -1 });
            res.json(payments);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getPaymentInvoice(req, res) {
        try {
            const payment = await Payment.findById(req.params.id).populate('companyId planId');
            if (!payment) return res.status(404).json({ message: "Payment not found" });
            res.json(payment);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Existing methods below...
    async getAllUsers(req, res) {
        try {
            const users = await User.find().populate('companyId').select('-password');
            res.json(users);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async impersonateUser(req, res) {
        try {
            const user = await User.findById(req.params.userId);
            if (!user) return res.status(404).json({ message: "User not found" });

            const token = jwt.sign(
                { 
                    id: user._id, 
                    role: user.role, 
                    companyId: user.companyId,
                    isImpersonated: true,
                    originalAdminId: req.user.id
                },
                config.JWT_SECRET,
                { expiresIn: '2h' }
            );

            res.json({ token, user: { name: user.name, role: user.role, companyId: user.companyId } });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getAllPlans(req, res) {
        try {
            const plans = await Plan.find();
            res.json(plans);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async createPlan(req, res) {
        try {
            const plan = new Plan(req.body);
            await plan.save();
            res.status(201).json(plan);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async updatePlan(req, res) {
        try {
            const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!plan) return res.status(404).json({ message: "Plan not found" });
            res.json(plan);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async deletePlan(req, res) {
        try {
            // Optional: Check if any company is using this plan before deleting
            const companiesUsingPlan = await Company.countDocuments({ planId: req.params.id });
            if (companiesUsingPlan > 0) {
                return res.status(400).json({ message: `Cannot delete plan. ${companiesUsingPlan} companies are currently using it.` });
            }
            
            const plan = await Plan.findByIdAndDelete(req.params.id);
            if (!plan) return res.status(404).json({ message: "Plan not found" });
            res.json({ message: "Plan deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteCompany(req, res) {
        try {
            await Company.findByIdAndDelete(req.params.id);
            res.json({ message: "Company deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

export default new SuperAdminController();
