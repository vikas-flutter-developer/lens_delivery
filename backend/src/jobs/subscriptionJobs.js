import Company from '../models/Company.js';
import nodemailer from 'nodemailer'; // Assuming nodemailer is used based on system properties
// import { sendWhatsApp } from '../utils/whatsapp.js'; // Placeholder for WhatsApp

const sendExpiryReminder = async (company, daysLeft) => {
    // 1. Email Reminder
    try {
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            auth: {
                user: process.env.EMAIL_SERVICE_USER,
                pass: process.env.EMAIL_SERVICE_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_SERVICE_USER,
            to: company.email,
            subject: `Subscription Renewal Reminder - ${company.name}`,
            text: `Your subscription will expire in ${daysLeft} days on ${company.planExpiryDate.toLocaleDateString()}. Please renew to avoid service interruption.`,
            html: `<h3>Subscription Expiry Reminder</h3><p>Your subscription for <b>${company.name}</b> will expire in <b>${daysLeft} days</b>.</p><p>Expiry Date: ${company.planExpiryDate.toLocaleDateString()}</p><p>Please log in to the admin panel to renew your plan.</p>`
        };

        await transporter.sendMail(mailOptions);
        console.log(`Reminder sent to ${company.name} for ${daysLeft} days.`);
    } catch (error) {
        console.error(`Failed to send email to ${company.name}:`, error.message);
    }

    // 2. WhatsApp Reminder (Placeholder)
    if (company.whatsapp_enabled) {
        // sendWhatsApp(company.phoneNumber, `Reminder: Your subscription expires in ${daysLeft} days.`);
    }
};

export const runSubscriptionJobs = async () => {
    console.log("Running daily subscription sweep...");
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Find companies expiring in 7 days
    const sevenDayExpiring = await Company.find({
        planExpiryDate: { $gte: sevenDaysFromNow.setHours(0,0,0,0), $lte: sevenDaysFromNow.setHours(23,59,59,999) },
        subscriptionStatus: 'active'
    });
    for (const company of sevenDayExpiring) {
        await sendExpiryReminder(company, 7);
    }

    // 2. Find companies expiring in 3 days
    const threeDayExpiring = await Company.find({
        planExpiryDate: { $gte: threeDaysFromNow.setHours(0,0,0,0), $lte: threeDaysFromNow.setHours(23,59,59,999) },
        subscriptionStatus: 'active'
    });
    for (const company of threeDayExpiring) {
        await sendExpiryReminder(company, 3);
    }

    // 3. Mark companies as expired and send last warning
    const expiringToday = await Company.find({
        planExpiryDate: { $lte: now },
        subscriptionStatus: 'active'
    });
    for (const company of expiringToday) {
        company.subscriptionStatus = 'expired';
        await company.save();
        await sendExpiryReminder(company, 0);
    }
    
    console.log("Subscription sweep completed.");
};
