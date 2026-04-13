import nodemailer from 'nodemailer';
import config from '../config/env.js';

const transporter = nodemailer.createTransport({
    service: config.EMAIL_SERVICE || 'gmail',
    auth: {
        user: config.EMAIL_SERVICE_USER,
        pass: config.EMAIL_SERVICE_PASS
    }
});

export const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: config.EMAIL_SERVICE_USER,
        to: email,
        subject: 'Password Reset Verification',
        text: `Your OTP for password reset is: ${otp}\n\nThis OTP will expire in 5 minutes.\n\nIf you did not request this password reset, please ignore this email.`
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
};
