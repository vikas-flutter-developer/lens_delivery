import Company from '../models/Company.js';

export const getCompanySettings = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        if (!companyId) return res.status(400).json({ message: "No company associated with user" });

        const company = await Company.findById(companyId).select('autoInvoiceEnabled invoiceDates name settings');
        if (!company) return res.status(404).json({ message: "Company not found" });

        res.json({ success: true, data: company });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const updateCompanySettings = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        if (!companyId) return res.status(400).json({ message: "No company associated with user" });

        const { autoInvoiceEnabled, invoiceDates } = req.body;

        // Validation: ensures dates are valid (1-31), max 2
        if (invoiceDates && Array.isArray(invoiceDates)) {
            const validDates = invoiceDates.every(d => Number.isInteger(d) && d >= 1 && d <= 31);
            if (!validDates) {
                return res.status(400).json({ message: "Individual invoice dates must be between 1 and 31" });
            }
            if (invoiceDates.length > 2) {
                return res.status(400).json({ message: "You can select up to 2 unique billing dates only" });
            }
        }

        const company = await Company.findByIdAndUpdate(
            companyId,
            { $set: { autoInvoiceEnabled, invoiceDates } },
            { new: true }
        ).select('autoInvoiceEnabled invoiceDates name settings');

        res.json({ success: true, message: "Settings updated successfully", data: company });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
