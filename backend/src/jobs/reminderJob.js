import cron from 'node-cron';
import LensSaleChallan from '../models/LensSaleChallan.js';
import Account from '../models/Account.js';
import Company from '../models/Company.js';
import { parseDuration } from './autoInvoiceJob.js';
import { sendWhatsAppMessage, sendEmailMessage } from '../utils/notificationService.js';
import mongoose from 'mongoose';

/**
 * Starts the background job for pre-invoice reminders.
 */
export const startReminderJob = () => {
    const reminderBeforeStr = process.env.REMINDER_BEFORE_DURATION || '7d';
    const reminderBeforeMs = parseDuration(reminderBeforeStr);

    console.log(`[ReminderJob] Initialized with reminder offset: ${reminderBeforeStr} (${reminderBeforeMs}ms)`);

    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            console.log('[Reminder Cron] Checking challans...');
            const now = new Date();
            const reminderCutoff = new Date(now.getTime() + reminderBeforeMs);

            // Fetch challans that need reminders
            const challans = await LensSaleChallan.find({
                isInvoiced: false,
                reminderSent: false,
                autoInvoiceDate: { $lte: reminderCutoff },
                dueAmount: { $gt: 0 },
                companyId: { $ne: null } // Ensure company context exists
            });

            if (challans.length > 0) {
                console.log(`[Reminder Cron] Found ${challans.length} challans potentially needing reminders.`);
            }

            for (const challan of challans) {
                try {
                    // ATOMIC CHECK: Ensure we don't double send if multiple job instances run
                    // We also check isInvoiced again in case it was just converted
                    const lockedChallan = await LensSaleChallan.findOneAndUpdate(
                        { _id: challan._id, reminderSent: false, isInvoiced: false },
                        { $set: { reminderSent: true } },
                        { new: true }
                    );

                    if (!lockedChallan) continue;

                    console.log(`[Reminder Cron] Sending reminder for Challan #${challan.billData.billNo} (Company: ${challan.companyId})`);

                    // Get Company credentials for this specific challan/tenant ONLY (Strict Isolation)
                    const company = await Company.findById(challan.companyId);

                    if (!company) {
                        console.warn(`[Reminder Cron] Company ${challan.companyId} not found for Challan #${challan.billData.billNo}. skipping.`);
                        // Optional: we don't rollback flag here to avoid infinite loops if company is deleted
                        continue;
                    }

                    // Get Party Details from Account model (STRICT TENANT ISOLATION)
                    // We search within the same companyId to avoid picking wrong account
                    const account = await Account.findOne({
                        companyId: challan.companyId,
                        $or: [
                            { Name: challan.partyData.partyAccount },
                            { AccountId: challan.partyData.partyAccount }
                        ]
                    });

                    const phoneNumber = account?.MobileNumber || challan.partyData.contactNumber;
                    const emailAddress = account?.Email;

                    if (!phoneNumber && !emailAddress) {
                        console.log(`[Reminder Cron] Skipped Challan ${challan.billData.billNo}: No phone or email found.`);
                        continue;
                    }

                    const partyName = account?.PrintName || account?.Name || challan.partyData.partyAccount;
                    const invoiceDateStr = challan.autoInvoiceDate ? challan.autoInvoiceDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : 'TBD';
                    const challanDateStr = challan.billData.date ? challan.billData.date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : 'N/A';
                    const challanNo = challan.billData.billNo;
                    const amount = challan.dueAmount;

                    const message = `Dear ${partyName},\nThis is a reminder that payment for your Sale Challan is still pending.\n\nVoucher No: ${challanNo}\nPending Amount: ₹${amount}\n\nPlease clear the payment before the invoice is automatically generated.\n\nThank you.`;
                    const subject = `Pending Payment Reminder – Sale Challan No ${challanNo}`;

                    let whatsappResult = null;
                    let emailResult = null;
                    let typeSent = [];

                    // Send WhatsApp if enabled for this company
                    if (phoneNumber && company.whatsapp_enabled) {
                        const waOptions = {
                            accessToken: company.whatsapp_access_token,
                            phoneNumberId: company.whatsapp_phone_number_id,
                        };

                        whatsappResult = await sendWhatsAppMessage(phoneNumber, message, waOptions);
                        if (whatsappResult.status === 'Success') typeSent.push('WhatsApp');
                    }

                    // Send Email if available
                    if (emailAddress) {
                        emailResult = await sendEmailMessage(emailAddress, subject, message);
                        if (emailResult.status === 'Success') typeSent.push('Email');
                    }

                    // Update challan record with final results
                    await LensSaleChallan.updateOne(
                        { _id: challan._id },
                        {
                            $set: {
                                reminderSentAt: new Date(),
                                reminderType: typeSent.length === 2 ? 'Both' : (typeSent[0] || null),
                                whatsappStatus: whatsappResult?.status || null,
                                whatsappResponse: whatsappResult?.response || null,
                                emailStatus: emailResult?.status || null,
                                emailResponse: emailResult?.response || null
                            }
                        }
                    );

                    console.log(`[Reminder Cron] SUCCESS: Reminder sent for Challan #${challan.billData.billNo} via ${typeSent.join(' & ') || 'None'}`);

                } catch (err) {
                    // Rollback flag on error so it can be retried in next run
                    await LensSaleChallan.updateOne({ _id: challan._id }, { $set: { reminderSent: false } });
                    console.error(`[ReminderJob] ERROR processing challan ${challan._id}:`, err);
                }
            }
        } catch (err) {
            console.error('[ReminderJob] JOB ERROR:', err);
        }
    });
};
