const smtpTransport = require("nodemailer-smtp-transport");
const nodemailer = require("nodemailer");

module.exports = ({ text = "", subject = "", to, auth }) => {
  const transporter = nodemailer.createTransport(
    smtpTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      auth: auth,
    })
  );

  const mailOptions = {
    from: auth.email,
    subject,
    text,
    to,
  };

  transporter.sendMail(mailOptions);
};
