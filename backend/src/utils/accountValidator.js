import LensSaleOrder from "../models/LensSaleOrder.js";
import RxSaleOrder from "../models/RxSaleOrder.js";
import ContactLensSaleOrder from "../models/ContactLensSaleOrder.js";
import Account from "../models/Account.js";

/**
 * Validates account limits (Credit and Day limits)
 * @param {string} accountName - Account name/alias/printname
 * @param {number} transactionAmount - Current order net amount
 * @param {string} companyId - Tenant ID
 * @returns {Promise<{success: boolean, creditLimitValid: boolean, dayLimitValid: boolean, messages: string[]}>}
 */
export const validateAccountLimitsHelper = async (accountName, transactionAmount, companyId) => {
    try {
        const account = await Account.findOne({
            $or: [
                { Name: { $regex: new RegExp("^" + accountName + "$", "i") } },
                { PrintName: { $regex: new RegExp("^" + accountName + "$", "i") } },
                { Alias: { $regex: new RegExp("^" + accountName + "$", "i") } }
            ],
            companyId: companyId
        });

        if (!account) {
            return {
                success: false,
                message: "Account not found",
                creditLimitValid: true,
                dayLimitValid: true,
                messages: [`Account "${accountName}" not found in this company.`]
            };
        }

        const result = {
            success: true,
            creditLimitValid: true,
            dayLimitValid: true,
            messages: []
        };

        // 1. Credit Limit Validation
        const creditLimit = Number(account.CreditLimit) || 0;
        const amount = Number(transactionAmount) || 0;

        if (creditLimit > 0 && amount > creditLimit) {
            result.creditLimitValid = false;
            result.messages.push(`Credit limit exceeded. Limit: ₹${creditLimit}, Order: ₹${amount}`);
        }

        // 2. Day Limit Validation (Temporal: days since account creation)
        const dayLimitStr = (account.DayLimit || "").trim();
        if (dayLimitStr) {
            const dayMatch = dayLimitStr.match(/(\d+)/);
            const dayLimitCount = dayMatch ? parseInt(dayMatch[1]) : 0;

            if (dayLimitCount > 0) {
                const createdAt = new Date(account.createdAt || Date.now());
                const expiryDate = new Date(createdAt.getTime() + dayLimitCount * 24 * 60 * 60 * 1000);
                const today = new Date();

                console.log(`[Account Validation] Account: ${account.Name}, DayLimit: ${dayLimitCount}, Created: ${createdAt.toISOString()}, Expiry: ${expiryDate.toISOString()}, Today: ${today.toISOString()}`);

                if (today > expiryDate) {
                    result.dayLimitValid = false;
                    const daysSinceCreation = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                    result.messages.push(`The day limit for this account (${dayLimitCount} days) has expired. Account is ${daysSinceCreation} days old (Created: ${createdAt.toLocaleDateString("en-IN")}).`);
                }
            }
        }

        result.success = result.creditLimitValid && result.dayLimitValid;
        return result;
    } catch (err) {
        console.error("Account validation helper error:", err);
        throw err;
    }
};
