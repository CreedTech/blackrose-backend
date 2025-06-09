// services/emailService.js
import nodemailer from 'nodemailer';
import { emailTemplates } from './emailTemplates.js';

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  auth: {
    user: 'resend',
    pass: process.env.RESEND_API_KEY,
  },
  from: 'no-reply@dblackrose.com',
});

const sendEmail = async ({
  to,
  subject,
  template,
  data = {},
  attachments = [],
}) => {
  console.log('Preparing to send email to:', to);

  try {
    const htmlContent = emailTemplates[template]
      ? emailTemplates[template](data)
      : `<div>${data.message || 'Default message'}</div>`;

    const info = await transporter.sendMail({
      from: 'BlackRose Store <no-reply@dblackrose.com>',
      to,
      subject,
      html: htmlContent,
      attachments,
    });

    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Error sending email:', err.message);
    return { success: false, error: err.message };
  }
};

// Email notification functions for different events
export const sendOrderConfirmation = async (order, userEmail) => {
  return await sendEmail({
    to: userEmail,
    subject: `Order Confirmation - ${order.orderNumber}`,
    template: 'orderConfirmation',
    data: { order },
  });
};

export const sendOrderStatusUpdate = async (order, userEmail, oldStatus) => {
  return await sendEmail({
    to: userEmail,
    subject: `Order Update - ${order.orderNumber}`,
    template: 'orderStatusUpdate',
    data: { order, oldStatus },
  });
};

export const sendPaymentConfirmation = async (
  order,
  userEmail,
  transaction
) => {
  return await sendEmail({
    to: userEmail,
    subject: `Payment Confirmed - ${order.orderNumber}`,
    template: 'paymentConfirmation',
    data: { order, transaction },
  });
};

export const sendShippingNotification = async (order, userEmail) => {
  return await sendEmail({
    to: userEmail,
    subject: `Your Order Has Shipped - ${order.orderNumber}`,
    template: 'orderShipped',
    data: { order },
  });
};

export const sendDeliveryConfirmation = async (order, userEmail) => {
  return await sendEmail({
    to: userEmail,
    subject: `Order Delivered - ${order.orderNumber}`,
    template: 'orderDelivered',
    data: { order },
  });
};

export const sendOrderCancellation = async (order, userEmail, reason) => {
  return await sendEmail({
    to: userEmail,
    subject: `Order Cancelled - ${order.orderNumber}`,
    template: 'orderCancelled',
    data: { order, reason },
  });
};

export const sendLowStockAlert = async (product, adminEmail) => {
  return await sendEmail({
    to: adminEmail,
    subject: `Low Stock Alert - ${product.title}`,
    template: 'lowStockAlert',
    data: { product },
  });
};

export const sendOutOfStockAlert = async (product, adminEmail) => {
  return await sendEmail({
    to: adminEmail,
    subject: `Out of Stock Alert - ${product.title}`,
    template: 'outOfStockAlert',
    data: { product },
  });
};

export const sendNewOrderAlert = async (order, adminEmail) => {
  return await sendEmail({
    to: adminEmail,
    subject: `New Order Received - ${order.orderNumber}`,
    template: 'newOrderAlert',
    data: { order },
  });
};

export const sendPreorderNotification = async (order, userEmail) => {
  return await sendEmail({
    to: userEmail,
    subject: `Preorder Confirmation - ${order.orderNumber}`,
    template: 'preorderConfirmation',
    data: { order },
  });
};

export const sendDigitalDownload = async (order, userEmail) => {
  return await sendEmail({
    to: userEmail,
    subject: `Your Digital Downloads - ${order.orderNumber}`,
    template: 'digitalDownload',
    data: { order },
  });
};
export const sendPaymentFailedNotification = async (
  order,
  userEmail,
  paymentData
) => {
  return await sendEmail({
    to: userEmail,
    subject: `Payment Failed - Order ${order.orderNumber}`,
    template: 'paymentFailed',
    data: { order, paymentData },
  });
};
export const sendRefundNotification = async (order, userEmail) => {
  return await sendEmail({
    to: userEmail,
    subject: `Refund Processed - Order ${order.orderNumber}`,
    template: 'refundNotification',
    data: { order },
  });
};
export const sendDailyOrderSummary = async (summaryData, adminEmail) => {
  return await sendEmail({
    to: adminEmail,
    subject: `Daily Order Summary - ${formatDate(summaryData.date)}`,
    template: 'dailyOrderSummary',
    data: summaryData,
  });
};

export const sendNewProductAlert = async (product, adminEmail) => {
  return await sendEmail({
    to: adminEmail,
    subject: `New Product Added - ${product.title}`,
    template: 'newProductAlert',
    data: { product },
  });
};

export const sendProductReviewAlert = async (
  product,
  adminEmail,
  reviewData
) => {
  return await sendEmail({
    to: adminEmail,
    subject: `New Review for ${product.title} - ${reviewData.rating}⭐`,
    template: 'productReviewAlert',
    data: { product, ...reviewData },
  });
};

export const sendProductBackInStockAlert = async (
  product,
  customerEmail,
  customerName,
  variantInfo = null
) => {
  return await sendEmail({
    to: customerEmail,
    subject: `Back in Stock: ${product.title}`,
    template: 'backInStockAlert',
    data: { product, customerName, variantInfo },
  });
};

export const sendReviewConfirmation = async (
  product,
  customerEmail,
  customerName
) => {
  return await sendEmail({
    to: customerEmail,
    subject: `Thank you for your review - ${product.title}`,
    template: 'reviewConfirmation',
    data: { product, customerName },
  });
};
export const sendPriceDropAlert = async (
  product,
  customerEmail,
  customerName,
  priceData
) => {
  return await sendEmail({
    to: customerEmail,
    subject: `Price Drop: ${product.title} - Save ${(
      ((priceData.oldPrice - priceData.newPrice) / priceData.oldPrice) *
      100
    ).toFixed(0)}%!`,
    template: 'priceDropAlert',
    data: { product, customerName, ...priceData },
  });
};
export const sendPasswordResetEmail = async (user, resetToken, resetUrl) => {
  return await sendEmail({
    to: user.email,
    subject: 'Reset Your Password - BlackRose',
    template: 'forgotPasswordEmail',
    data: { user, resetToken, resetUrl },
  });
};

export const sendPasswordResetSuccess = async (user) => {
  return await sendEmail({
    to: user.email,
    subject: 'Password Reset Successful - BlackRose',
    template: 'passwordResetSuccess',
    data: { user },
  });
};

export const sendPasswordResetAlert = async (
  user,
  ipAddress,
  userAgent,
  timestamp
) => {
  return await sendEmail({
    to: user.email,
    subject: 'Password Reset Alert - BlackRose',
    template: 'passwordResetAlert',
    data: { user, ipAddress, userAgent, timestamp },
  });
};
export const sendContactFormNotification = async (contact, adminEmail) => {
  return await sendEmail({
    to: adminEmail,
    subject: `New Contact Form: ${contact.subject}`,
    template: 'contactFormSubmission',
    data: { contact },
  });
};

export const sendContactConfirmation = async (contact) => {
  return await sendEmail({
    to: contact.email,
    subject: 'Thank you for contacting BlackRose Photography',
    template: 'contactConfirmation',
    data: { contact },
  });
};

export const sendAdminContactReply = async (
  contact,
  replyMessage,
  adminName
) => {
  return await sendEmail({
    to: contact.email,
    subject: `Re: ${contact.subject}`,
    template: 'adminContactReply',
    data: { contact, replyMessage, adminName },
  });
};

export default sendEmail;
