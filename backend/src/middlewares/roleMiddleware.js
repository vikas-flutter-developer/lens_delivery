import Role from '../models/Role.js';

export const checkPermission = (module, action) => {
    return async (req, res, next) => {
        try {
            const { role, roleId, super_admin } = req.user;

            // 1. Super Admin bypass
            if (role === 'super_admin') {
                return next();
            }

            // 2. If user has a specific dynamic role assigned
            if (roleId) {
                const foundRole = await Role.findById(roleId);
                if (foundRole && foundRole.isActive) {
                    const permission = foundRole.permissions.find(p => p.module === module);
                    if (permission && permission[action]) {
                        return next();
                    }
                }
            }

            // 3. Fallback to basic roles if no dynamic role or permission not found
            // This allows us to keep using "admin", "manager", "employee" strings for now
            if (role === 'admin') {
                return next(); // Admins usually have full access within their company
            }

            return res.status(403).json({ message: `Permission denied: ${action} on ${module}` });
        } catch (error) {
            console.error('RBAC Error:', error);
            res.status(500).json({ message: 'Internal server error in RBAC' });
        }
    };
};

export const isSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super Admin access required" });
    }
    next();
};

export const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
};

export const isDeliveryPerson = (req, res, next) => {
    if (
        req.user.role !== "delivery_person" && 
        req.user.role !== "admin" && 
        req.user.role !== "super_admin"
    ) {
        return res.status(403).json({ message: "Access denied: Delivery role required" });
    }
    next();
};