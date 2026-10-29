export const sendAuthEmail = async ({ email, subject, text, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.info('[auth.audit] Email credentials are not configured. Skipping outbound email.', {
      email,
      subject,
    });
    return false;
  }

  try {
    const transportModule = await import('../../infrastructure/mail/transport.js');
    await transportModule.default.sendMail({
      from: `no-reply@${process.env.APP_NAME || 'vod-platform'}`,
      to: email,
      subject,
      text,
      html,
    });
    return true;
  } catch {
    return false;
  }
};
