import { AsyncLocalStorage } from 'async_hooks';
import mongoose from 'mongoose';

export const tenantStorage = new AsyncLocalStorage();

export const tenantPlugin = (schema, options) => {
    // Check if the schema already has companyId to avoid duplicate paths error
    if (!schema.paths.companyId) {
        schema.add({ companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null } });
    }

    const filterByTenant = function(next) {
        const tenantId = tenantStorage.getStore();
        if (tenantId) {
            this.where({
                $or: [
                    { companyId: tenantId },
                    { companyId: null }
                ]
            });
        }
        next();
    };

    schema.pre('find', filterByTenant);
    schema.pre('findOne', filterByTenant);
    schema.pre('countDocuments', filterByTenant);
    schema.pre('findOneAndUpdate', filterByTenant);
    schema.pre('updateMany', filterByTenant);
    schema.pre('updateOne', filterByTenant);
    schema.pre('aggregate', function(next) {
        const tenantId = tenantStorage.getStore();
        if (tenantId) {
            // Must convert string ID to ObjectId for aggregate pipeline matches
            const oid = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
            this.pipeline().unshift({
                $match: {
                    $or: [
                        { companyId: oid },
                        { companyId: null }
                    ]
                }
            });
        }
        next();
    });

    schema.pre('insertMany', function(next, docs) {
        const tenantId = tenantStorage.getStore();
        if (tenantId) {
            if (Array.isArray(docs)) {
                docs.forEach(doc => {
                    if (!doc.companyId) doc.companyId = tenantId;
                });
            }
        }
        next();
    });

    schema.pre('save', function(next) {
        const tenantId = tenantStorage.getStore();
        if (tenantId && !this.companyId) {
            this.companyId = tenantId;
        }
        next();
    });
};
