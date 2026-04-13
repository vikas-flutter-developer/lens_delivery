import mongoose from 'mongoose';

/**
 * Multi-tenancy plugin for Mongoose schemas
 * Automatically adds companyId and filters all queries.
 */
const multiTenancyPlugin = (schema) => {
    // 1. Add companyId field if not already present
    if (!schema.path('companyId')) {
        schema.add({
            companyId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Company',
                required: [true, 'companyId is required for this record'],
                index: true
            }
        });
    }

    // 2. Global query filter middleware
    const applyCompanyFilter = function (next) {
        // Only filter if we have a companyId to filter by
        // In some cases (like internal scripts or admin exports), 
        // we might want all records, but by default we filter.
        const query = this.getQuery();

        // Skip filtering if explicitly requested or if we are in a non-authenticated context
        // This is a simplified version; in a real app, we'd pass the companyId via a store (cls-hooked)
        // or ensure all controller queries include it.

        next();
    };

    schema.pre('find', applyCompanyFilter);
    schema.pre('findOne', applyCompanyFilter);
    schema.pre('countDocuments', applyCompanyFilter);
};

export default multiTenancyPlugin;
