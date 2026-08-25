import { resend } from "./resend.js";

export async function sendUnreadMessageEmail({ toEmail, toName, messageCount, conversationCount }) {
  if (!resend || !process.env.RESEND_FROM || !toEmail) return;
  const msgWord = messageCount === 1 ? "message" : "messages";
  const convWord = conversationCount === 1 ? "conversation" : "conversations";
  const subject = `You have ${messageCount} unread ${msgWord} on Lost & Hound`;
  const html = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #e0e0e0; border-radius: 8px; color: #000000;">

  <h2 style="color: #A84D48; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-top: 0;">
    Unread Messages
  </h2>

  <p style="font-size: 16px; line-height: 1.5;">
    ${toName ? `Hi <strong>${toName}</strong>, you have` : "You have"} <strong>${messageCount} unread ${msgWord}</strong> across <strong>${conversationCount} ${convWord}</strong> on Lost &amp; Hound.
  </p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="https://thelostandhound.com/messages" style="display: inline-block; background-color: #A84D48; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 6px;">View Messages</a>
  </div>

  <p style="font-size: 12px; color: #666666; border-top: 1px solid #eeeeee; padding-top: 20px;">
    You're receiving this because someone sent you a message on <a href="https://thelostandhound.com" style="color: #A84D48;">Lost & Hound</a>. You won't receive another reminder for these messages unless you read them and receive new ones.
  </p>

</div>`;
  try {
    await resend.emails.send({ from: process.env.RESEND_FROM, to: toEmail, subject, html });
  } catch (err) {
    console.error("[Resend] Failed to send unread message notification:", err?.message);
  }
}

export async function sendReplyNotificationEmail({ toEmail, toName, ticketTitle, ticketCode, replyMessage, moderatorName }) {
  if (!resend || !process.env.RESEND_FROM || !toEmail) return;
  const from = process.env.RESEND_FROM;
  const subject = `A moderator replied to your ticket — Lost & Hound`;
  const html = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #e0e0e0; border-radius: 8px; color: #000000;">

  <h2 style="color: #A84D48; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-top: 0;">
    You have a new reply
  </h2>

  <p style="font-size: 16px; line-height: 1.5;">
    ${toName ? `Hi <strong>${toName}</strong>, a` : "A"} member of the <strong>Lost & Hound</strong> support team has responded to your ticket.
  </p>

  <div style="background-color: #fdf5f5; border-left: 4px solid #A84D48; border-radius: 0 6px 6px 0; padding: 16px 20px; margin: 24px 0;">
    <p style="margin: 0 0 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #A84D48;">${moderatorName || "Support Team"} replied</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #000000;">${replyMessage.replace(/\n/g, "<br>")}</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 28px;">
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; color: #666666;">Ticket</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; text-align: right;">${ticketTitle}</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; color: #666666;">Ticket Code</td>
      <td style="padding: 10px 0; font-weight: bold; text-align: right; letter-spacing: 2px;">${ticketCode}</td>
    </tr>
  </table>

  <div style="text-align: center; margin: 32px 0;">
    <a href="https://thelostandhound.com" style="display: inline-block; background-color: #A84D48; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 6px;">View Your Ticket</a>
  </div>

  <p style="font-size: 12px; color: #666666; border-top: 1px solid #eeeeee; padding-top: 20px;">
    To reply, visit <a href="https://thelostandhound.com" style="color: #A84D48;">thelostandhound.com</a> and use your ticket code <strong>${ticketCode}</strong> with your email address. If you did not submit this ticket, you can safely ignore this email.
  </p>

</div>`;

  try {
    await resend.emails.send({ from, to: toEmail, subject, html });
  } catch (err) {
    console.error("[Resend] Failed to send reply notification:", err?.message);
  }
}

export async function sendTicketConfirmationEmail({ toEmail, toName, ticketCode, ticketType, category }) {
  if (!resend || !process.env.RESEND_FROM || !toEmail) return;
  const from = process.env.RESEND_FROM;
  const subject = `We received your ${ticketType} ticket — Lost & Hound`;
  const html = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #e0e0e0; border-radius: 8px; color: #000000;">

  <h2 style="color: #A84D48; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-top: 0;">
    Support Ticket Received
  </h2>

  <p style="font-size: 16px; line-height: 1.5;">
    ${toName ? `Hi <strong>${toName}</strong>, we` : "We"} received your <strong>${ticketType}</strong> ticket for <strong>Lost & Hound</strong>. A moderator will review it and get back to you shortly.
  </p>

  <div style="background-color: #fdf5f5; border: 2px solid #A84D48; border-radius: 6px; padding: 24px; text-align: center; margin: 32px 0;">
    <p style="margin: 0 0 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #A84D48;">Your Ticket Code</p>
    <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #000000;">${ticketCode}</p>
    <p style="margin: 10px 0 0; font-size: 13px; color: #666666;">Save this code — use it with your email address to check your ticket status anytime.</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; color: #666666;">Type</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; text-align: right;">${ticketType}</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; color: #666666;">Category</td>
      <td style="padding: 10px 0; font-weight: bold; text-align: right;">${category}</td>
    </tr>
  </table>

  <p style="font-size: 12px; color: #666666; border-top: 1px solid #eeeeee; padding-top: 20px;">
    If you did not submit this ticket, you can safely ignore this email.
  </p>

</div>`;

  try {
    await resend.emails.send({ from, to: toEmail, subject, html });
  } catch (err) {
    console.error("[Resend] Failed to send ticket confirmation:", err?.message);
  }
}
