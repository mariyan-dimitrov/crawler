const smtpTransport = require("nodemailer-smtp-transport");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport(
  smtpTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    auth: {
      user: "mirka.dimitrov@gmail.com",
      pass: "fvkhkpscizopchqr",
    },
  })
);

module.exports = ({ text = "", subject = "" }) => {
  const mailOptions = {
    from: "mirka.dimitrov@gmail.com",
    to: "mariyan_dimitrov@yahoo.com",
    subject,
    text,
  };

  transporter.sendMail(mailOptions);
};
