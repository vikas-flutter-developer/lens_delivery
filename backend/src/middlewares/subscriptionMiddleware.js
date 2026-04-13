import Company from '../models/Company.js';

export const checkSubscription = async (req, res, next) => {
    try {
        const { companyId, role } = req.user;

        // Skip for super_admin
        if (role === 'super_admin') {
            return next();
        }

        if (!companyId) {
            return res.status(403).json({ message: "No company associated with this user" });
        }

        const company = await Company.findById(companyId);

        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (!company.isActive || company.subscriptionStatus === 'suspended') {
            return res.status(403).json({ message: "Your account is inactive or suspended. Please contact system admin." });
        }

        const now = new Date();
        const expiry = company.planExpiryDate ? new Date(company.planExpiryDate) : null;
        const grace = company.gracePeriodEndDate ? new Date(company.gracePeriodEndDate) : null;

        if (expiry && now > expiry) {
            if (grace && now <= grace) {
                // Within grace period - allow but potentially flag for UI
                req.subscriptionWarning = "Your subscription has expired. Please renew soon to avoid service interruption.";
                return next();
            } else {
                return res.status(403).json({ 
                    message: "Your subscription has expired. Please renew to continue using the system.",
                    isExpired: true 
                });
            }
        }

        next();
    } catch (error) {
        console.error('Subscription Check Error:', error);
        res.status(500).json({ message: 'Internal server error during subscription check' });
    }
};

export const checkLimit = (limitKey) => {
    return async (req, res, next) => {
        try {
            const { companyId, role } = req.user;
            if (role === 'super_admin') return next();

            const company = await Company.findById(companyId).populate('planId');
            if (!company || !company.planId) {
                // If no plan, use default limits (or allow if not strictly SaaS yet)
                return next();
            }

            const limitValue = company.planId.limits[limitKey];
            
            // Example for maxUsers:
            if (limitKey === 'maxUsers') {
                const User = mongoose.model('User');
                const userCount = await User.countDocuments({ companyId });
                if (userCount >= limitValue) {
                    return res.status(403).json({ message: `Limit reached: Maximum ${limitValue} users allowed in your plan.` });
                }
            }

            next();
        } catch (error) {
            console.error('Limit Check Error:', error);
            res.status(500).json({ message: 'Internal server error during limit check' });
        }
    };
};
