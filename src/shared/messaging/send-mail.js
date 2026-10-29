import transport from '../../infrastructure/mail/transport.js';

export const sendMail = async (data) => {
  try {
    await transport.sendMail({
      from: `no-reply@${process.env.APP_NAME}`,
      to: data.email,
      subject: 'Reset Password',
      text: `Hello,
                    You requested a password reset.
                    Use this link: ${process.env.FRONTEND_PW_RESET_URL}?email=${data.email}&ts=${data.ts}&token=${data.hmac}
                    This link expires in 15 minutes.`,
      html: `<!DOCTYPE html>
                    <html>
                    <body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, sans-serif;">

                        <table align="center" width="100%" style="max-width:600px; background:#ffffff; margin-top:40px; border-radius:8px;">
                        
                        <tr>
                            <td style="background:#4CAF50; color:#fff; text-align:center; padding:20px;">
                            <h2 style="margin:0;">Reset Your Password</h2>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:30px; color:#333;">
                            <p>Hello,</p>

                            <p>You requested to reset your password. Click the button below:</p>

                            <div style="text-align:center; margin:30px 0;">
                                <a href="${process.env.FRONTEND_PW_RESET_URL}?email=${data.email}&ts=${data.ts}&token=${data.hmac}" 
                                style="background:#4CAF50; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">
                                Reset Password
                                </a>
                            </div>

                            <p>If you didn’t request this, ignore this email.</p>
                            <p>This link expires in <strong>15 minutes</strong>.</p>

                            <p>Thanks,<br>${process.env.APP_NAME}</p>
                            </td>
                        </tr>

                        <tr>
                            <td style="background:#f4f4f4; text-align:center; padding:15px; font-size:12px; color:#777;">
                            © 2026 ${process.env.APP_NAME}
                            </td>
                        </tr>

                        </table>

                    </body>
                    </html>
                    `,
    });
    return true;
  } catch {
    return false;
  }
};
