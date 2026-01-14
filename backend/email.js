// backend/email.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendPasswordResetEmail = async (toEmail, token) => {
    const resetUrl = `http://localhost:3000/reset-password.html?token=${token}`;

    const mailOptions = {
        from: '"WMS Pro Admin" <noreply@wms-pro.com>',
        to: toEmail,
        subject: 'Your Password Reset Link',
        html: `
            <p>You requested a password reset for your WMS Pro account.</p>
            <p>Please click the link below to set a new password. This link is valid for 1 hour.</p>
            <a href="${resetUrl}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                Reset Your Password
            </a>
            <p>If you did not request this, please ignore this email.</p>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        // This is the URL to view your FAKE email in the browser
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

module.exports = { sendPasswordResetEmail };