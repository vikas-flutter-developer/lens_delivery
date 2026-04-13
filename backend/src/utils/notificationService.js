import axios from 'axios';
import nodemailer from 'nodemailer';

/**
 * Sends a WhatsApp message using Meta Cloud API.
 * @param {string} phoneNumber 
 * @param {string} message 
 * @param {object} options Optional credentials { accessToken, phoneNumberId }
 * @returns {Promise<object>}
 */
export const sendWhatsAppMessage = async (phoneNumber, message, options = {}) => {
    try {
        const accessToken = options.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = options.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!accessToken || !phoneNumberId) {
            console.warn('[NotificationService] WhatsApp credentials missing. Skipping send.');
            return { status: 'Failed', response: 'WhatsApp credentials missing' };
        }

        // Clean phone number (remove +, spaces, etc. - Meta expects digits only with country code)
        const cleanNumber = phoneNumber.replace(/\D/g, '');

        const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

        // Meta Cloud API supports text or template messages
        // For business-initiated reminders, templates are usually required.
        const data = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanNumber,
        };

        if (options.template) {
            data.type = 'template';
            data.template = options.template;
        } else {
            data.type = 'text';
            data.text = {
                preview_url: false,
                body: message
            };
        }

        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return { status: 'Success', response: response.data };
    } catch (error) {
        console.error('[NotificationService] WhatsApp Error:', error.response?.data || error.message);
        return { status: 'Failed', response: error.response?.data || error.message };
    }
};

/**
 * Sends an Email message using nodemailer.
 * @param {string} email 
 * @param {string} subject 
 * @param {string} body 
 * @returns {Promise<object>}
 */
export const sendEmailMessage = async (email, subject, body) => {
    try {
        console.log(`[NotificationService] Sending Email to ${email}...`);

        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_SERVICE_USER,
                pass: process.env.EMAIL_SERVICE_PASS
            }
        });

        if (!process.env.EMAIL_SERVICE_USER || !process.env.EMAIL_SERVICE_PASS) {
            console.warn('[NotificationService] Email credentials missing. Skipping send.');
            return { status: 'Failed', response: 'Email credentials missing' };
        }

        const mailOptions = {
            from: process.env.EMAIL_SERVICE_USER,
            to: email,
            subject: subject,
            text: body
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[NotificationService] Email sent: ${info.messageId}`);

        return {
            status: 'Success',
            response: { messageId: info.messageId, recipient: email }
        };
    } catch (error) {
        console.error('[NotificationService] Email Error:', error.message);
        return { status: 'Failed', response: error.message };
    }
};
