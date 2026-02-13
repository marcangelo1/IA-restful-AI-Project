const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

exports.sendPasswordResetEmail = async (email, firstName, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}reset_password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset - Lyrics Generator",
        html: `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
    <h1 style="color: #4a6ee0;">Reset Your Password</h1>
    <p>Hi ${firstName || "there"},</p>
    <p>We received a request to reset your password for your Lyrics Generator account.</p>
    <p>Click the button below to set a new password:</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4a6ee0; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
    </p>
    <p><strong>Note:</strong> This link is valid for 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
    <p>Best regards,<br>The Lyrics Generator Team</p>
  </div>
</body>
</html>
`,
    };

    await transporter.sendMail(mailOptions);
};