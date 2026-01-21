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

const sendResetEmail = async (email, token) => {
    // Check if transporter works
    try {
        await transporter.verify();
        console.log("📧 SMTP Server is ready to take messages");
    } catch (error) {
        console.error("❌ SMTP Connection Error:", error);
        return;
    }

    const domain = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${domain}/reset-password.html?token=${token}`;

    const mailOptions = {
        from: `"Inventory Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset Request',
        html: `
            <h3>Password Reset</h3>
            <p>Click below to reset your password:</p>
            <a href="${resetLink}">Reset Password</a>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent: %s", info.messageId);
        console.log("🔗 Preview URL: %s", nodemailer.getTestMessageUrl(info));
        return info;
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        throw error;
    }
};

module.exports = { sendResetEmail };