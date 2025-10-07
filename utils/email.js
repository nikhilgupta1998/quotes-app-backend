const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false, // optional: true in prod if you verify certs
  },
});

const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `"Social Media App" <${process.env.SENDER_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", options.to);
  } catch (error) {
    console.error("Email send error:", error);
    throw error;
  }
};

module.exports = { sendEmail };
