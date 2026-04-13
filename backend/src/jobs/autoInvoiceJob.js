import cron from 'node-cron';
import LensSaleChallan from '../models/LensSaleChallan.js';
import LensSale from '../models/LensSale.js';
import mongoose from 'mongoose';
import RxSaleOrder from '../models/RxSaleOrder.js';
import LensSaleOrder from '../models/LensSaleOrder.js';
import ContactLensSaleOrder from '../models/ContactLensSaleOrder.js';
import { deriveOrderStatus } from '../utils/statusManager.js';
import Company from '../models/Company.js';
import AutoInvoiceLog from '../models/AutoInvoiceLog.js';

/**
 * Parses duration string (e.g., '1m', '15d') to milliseconds.
 * @param {string} duration 
 * @returns {number}
 */
export const parseDuration = (duration) => {
    if (!duration) return 30 * 24 * 60 * 60 * 1000; // Default 30 days
    const trimmed = String(duration).trim().toLowerCase();
    const unit = trimmed.slice(-1);
    const value = parseInt(trimmed.slice(0, -1));

    if (isNaN(value)) return 30 * 24 * 60 * 60 * 1000;

    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'd') return value * 24 * 60 * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;

    // If no unit or invalid unit, assume days for safety
    return value * 24 * 60 * 60 * 1000;
};

/**
 * Generates the next bill number for a given series.
 * @param {string} series 
 * @param {string} companyId
 * @returns {string}
 */
const getNextInvoiceBillNo = async (series, companyId) => {
    if (!companyId) return "1";

    // Aggregation to find the maximum numeric billNo for the given series & company
    const lastSale = await LensSale.aggregate([
        { $match: { "billData.billSeries": series, companyId: new mongoose.Types.ObjectId(companyId) } },
        {
            $addFields: {
                numericBillNo: { $toInt: "$billData.billNo" }
            }
        },
        { $sort: { numericBillNo: -1 } },
        { $limit: 1 }
    ]);

    let nextBillNo = 1;

    if (lastSale && lastSale.length > 0 && lastSale[0].billData && lastSale[0].billData.billNo) {
        const lastNo = parseInt(lastSale[0].billData.billNo);
        if (!isNaN(lastNo)) {
            nextBillNo = lastNo + 1;
        }
    }
    return String(nextBillNo);
};

/**
 * Refactored logic to process auto-invoices for a specific company.
 * Exactly reuses the core logic of creating invoice documents from challans.
 */
export const processAutoInvoicesForCompany = async (companyId, runDate) => {
    try {
        console.log(`[AutoInvoice] Starting run for Company: ${companyId} at ${runDate.toDateString()}`);
        
        // Define date range for today to prevent duplicates
        const startOfDay = new Date(runDate);
        startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(runDate);
        endOfDay.setHours(23,59,59,999);

        // Check if already processed today
        const existingLog = await AutoInvoiceLog.findOne({
            companyId,
            runDate: { $gte: startOfDay, $lte: endOfDay },
            status: 'success'
        });

        if (existingLog) {
            console.log(`[AutoInvoice] Skipping company ${companyId}: Already processed today.`);
            return { skipped: true, reason: 'Already processed' };
        }

        const now = new Date();
        // Fetch all pending challans for this company
        const challans = await LensSaleChallan.find({
            isInvoiced: false,
            companyId: new mongoose.Types.ObjectId(companyId)
        });

        if (challans.length === 0) {
            await AutoInvoiceLog.create({
                companyId,
                runDate: startOfDay,
                status: 'skipped',
                details: 'No pending challans found'
            });
            return { skipped: true, reason: 'No challans' };
        }

        let processedCount = 0;
        let errorCount = 0;

        for (const challan of challans) {
            try {
                // ATOMIC LOCK
                const lockedChallan = await LensSaleChallan.findOneAndUpdate(
                    { _id: challan._id, isInvoiced: false },
                    { $set: { isInvoiced: true } }, 
                    { new: true }
                );

                if (!lockedChallan) continue;

                // --- EXISTING INVOICE GENERATION LOGIC (UNCHANGED) ---
                const nextNo = await getNextInvoiceBillNo(challan.billData.billSeries, challan.companyId);
                const invoiceItems = challan.items.map(item => {
                    const it = item.toObject();
                    delete it._id;
                    return { ...it, isInvoiced: true, itemStatus: "Done" };
                });

                const invoiceData = {
                    billData: {
                        billSeries: challan.billData.billSeries || "",
                        billNo: nextNo,
                        date: new Date(),
                        billType: challan.billData.billType || "",
                        bankAccount: challan.billData.bankAccount || "",
                        godown: challan.billData.godown || "",
                        bookedBy: challan.billData.bookedBy || "",
                    },
                    partyData: challan.partyData,
                    items: invoiceItems,
                    taxes: challan.taxes,
                    grossAmount: (challan.grossAmount || 0),
                    subtotal: (challan.subtotal || 0),
                    taxesAmount: (challan.taxesAmount || 0),
                    netAmount: (challan.netAmount || 0),
                    paidAmount: (challan.paidAmount || 0),
                    dueAmount: (challan.dueAmount || 0),
                    summary: {
                        totalQty: challan.items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0),
                        totalAmount: challan.subtotal
                    },
                    deliveryDate: new Date(),
                    time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
                    remark: "SYSTEM_AUTO: " + (challan.remark || ""),
                    status: "Done",
                    parentStatus: "Done",
                    sourceChallanId: challan._id.toString(),
                    autoGenerated: true,
                    createdBy: "SYSTEM_AUTO",
                    companyId: challan.companyId 
                };

                const newInvoice = new LensSale(invoiceData);
                const savedInvoice = await newInvoice.save();

                const totalQty = challan.items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

                await LensSaleChallan.updateOne(
                    { _id: challan._id },
                    {
                        $set: {
                            invoiceId: savedInvoice._id,
                            usedQty: totalQty,
                            balQty: 0,
                            "items.$[].isInvoiced": true,
                            "items.$[].itemStatus": "Done",
                            status: "Done",
                            parentStatus: "Done"
                        },
                        $push: {
                            usageHistory: {
                                invoiceId: savedInvoice._id.toString(),
                                billNo: savedInvoice.billData.billNo,
                                series: savedInvoice.billData.billSeries,
                                qtyUsed: totalQty,
                                date: new Date()
                            }
                        }
                    }
                );

                // Sale Order Sync
                if (challan.sourceSaleId) {
                    try {
                        const invoicedItemIds = challan.items.map(it => String(it._id));
                        let OrderModel;
                        if (challan.orderType === 'RX') OrderModel = RxSaleOrder;
                        else if (challan.orderType === 'CONTACT') OrderModel = ContactLensSaleOrder;
                        else OrderModel = LensSaleOrder;

                        if (OrderModel) {
                            const saleOrder = await OrderModel.findById(challan.sourceSaleId);
                            if (saleOrder) {
                                saleOrder.items = saleOrder.items.map(sItem => {
                                    if (invoicedItemIds.includes(String(sItem._id))) {
                                        sItem.isInvoiced = true;
                                        sItem.itemStatus = "Done";
                                    }
                                    return sItem;
                                });
                                saleOrder.status = deriveOrderStatus(saleOrder.items, saleOrder.status);
                                saleOrder.parentStatus = "Done";
                                if (!saleOrder.usedIn) saleOrder.usedIn = [];
                                if (!saleOrder.usedIn.some(u => u.type === 'SI' && u.number === savedInvoice.billData.billNo)) {
                                    saleOrder.usedIn.push({ type: 'SI', number: savedInvoice.billData.billNo });
                                }
                                await saleOrder.save();
                            }
                        }
                    } catch (syncErr) {
                        console.error(`[AutoInvoice] Order sync error: ${challan._id}`, syncErr);
                    }
                }
                processedCount++;
            } catch (err) {
                errorCount++;
                await LensSaleChallan.updateOne({ _id: challan._id }, { $set: { isInvoiced: false } });
                console.error(`[AutoInvoice] Error processing challan ${challan._id}:`, err);
            }
        }

        await AutoInvoiceLog.create({
            companyId,
            runDate: startOfDay,
            status: errorCount > 0 && processedCount === 0 ? 'failed' : 'success',
            processedChallansCount: processedCount,
            details: `Processed ${processedCount} challans. Errors: ${errorCount}`
        });

        return { processedCount, errorCount };

    } catch (err) {
        console.error(`[AutoInvoice] Fatal error for company ${companyId}:`, err);
        return { error: err.message };
    }
};

const isLastDayOfMonth = (date) => {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    return nextDay.getMonth() !== date.getMonth();
};

export const isTodayScheduled = (invoiceDates, today) => {
    if (!invoiceDates || !Array.isArray(invoiceDates) || invoiceDates.length === 0) return false;
    
    const day = today.getDate();
    const isLastDay = isLastDayOfMonth(today);

    for (const d of invoiceDates) {
        // Direct match (e.g. today is 10th and scheduled date is 10)
        if (d === day) return true;
        
        // Handle dates that don't exist in shorter months (e.g. Feb 28/29, or April 30 for 31st)
        // If today is the last day of the month AND the scheduled date is greater than today's date, 
        // we trigger it now so the company doesn't miss their billing cycle.
        if (isLastDay && d > day) return true;
    }
    return false;
};

/**
 * Starts the daily background job to sweep through all tenants.
 */
export const startAutoInvoiceJob = () => {
    console.log(`[AutoInvoiceJob] Configurable scheduler initialized (Runs daily at 2 AM)`);

    // Run daily at 02:00
    cron.schedule('0 2 * * *', async () => {
        try {
            const today = new Date();
            console.log(`[AutoInvoiceJob] Daily sweep started at ${today.toISOString()}`);
            
            const companies = await Company.find({ autoInvoiceEnabled: true });
            
            for (const company of companies) {
                if (isTodayScheduled(company.invoiceDates, today)) {
                    await processAutoInvoicesForCompany(company._id, today);
                }
            }
        } catch (err) {
            console.error('[AutoInvoiceJob] JOB FATAL ERROR:', err);
        }
    });

    // Run check once on start to ensure we didn't miss today if server restarted
    setTimeout(async () => {
        try {
            const today = new Date();
            const companies = await Company.find({ autoInvoiceEnabled: true });
            for (const company of companies) {
                if (isTodayScheduled(company.invoiceDates, today)) {
                    console.log(`[AutoInvoiceJob] Immediate check: Running for company ${company.name}`);
                    await processAutoInvoicesForCompany(company._id, today);
                }
            }
        } catch (err) {
            console.error('[AutoInvoiceJob] Initial check error:', err);
        }
    }, 5000);
};
