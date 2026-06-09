const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const hasSmtpConfig = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  if (!hasSmtpConfig) {
    console.log('[Email dev fallback] SMTP ayari yok. E-posta gonderilmedi, icerik loglandi.');
    console.log('[Email dev fallback] To:', options.email);
    console.log('[Email dev fallback] Subject:', options.subject);
    console.log('[Email dev fallback] Message:', options.message || options.html || '');
    return { messageId: 'dev-fallback' };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const message = {
    from: `${process.env.FROM_NAME || 'AI Mülakat Sistemi'} <${process.env.FROM_EMAIL || 'noreply@aimulakat.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await transporter.sendMail(message);

  if (process.env.NODE_ENV === 'development') {
    console.log('E-posta gonderildi: %s', info.messageId);
    console.log('Onizleme URL: %s', nodemailer.getTestMessageUrl(info));
  }

  return info;
};

module.exports = sendEmail;
