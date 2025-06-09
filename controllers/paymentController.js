import axios from 'axios';
import crypto from 'crypto';
import orderModel from '../models/orderModel.js';
import userModel from '../models/userModel.js';
import webhookModel from '../models/webhookModel.js';
import transactionModel from '../models/transactionModel.js';
import productModel from '../models/productModel.js';
import { notifyPaymentSuccess } from '../utils/orderNotificationService.js';
import {
  sendLowStockAlert,
  sendNewOrderAlert,
  sendOrderConfirmation,
  sendOutOfStockAlert,
  sendPaymentConfirmation,
  sendPaymentFailedNotification,
  sendPreorderNotification,
} from '../utils/emailService.js';

// Initialize Paystack API
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export const initializePayment = async (req, res) => {
  try {
    const { orderId, callbackUrl } = req.body;

    // Get order details
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Verify order belongs to user
    if (order.userId !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to process this order',
      });
    }

    // Check if payment has already been initialized or completed
    if (order.paymentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Payment for this order is already ${order.paymentStatus}`,
      });
    }

    // Re-validate inventory before payment (UPDATED TO HANDLE PREORDERS)
    for (const item of order.items) {
      const product = await productModel.findById(item.productId);

      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.title} is no longer available`,
        });
      }

      // Skip stock validation for preorder items
      if (item.isPreorder) {
        console.log(
          `Skipping stock validation for preorder item: ${item.title}`
        );
        continue;
      }

      // Validate stock for non-preorder items
      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant || !variant.isActive) {
          return res.status(400).json({
            success: false,
            message: `Product variant ${item.title} is no longer available`,
          });
        }

        // Only check stock if it's not a preorder
        if (variant.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.title} (${
              item.selectedAttributes?.color || ''
            } ${item.selectedAttributes?.size || ''})`,
          });
        }
      } else {
        // Check main product stock for non-preorder items
        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.title}`,
          });
        }
      }
    }

    // Get user details
    const user = await userModel.findById(order.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Initialize payment with Paystack
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email: user.email,
        amount: Math.round(order.amount * 100), // Convert to kobo (multiply by 100)
        currency: 'NGN',
        callback_url:
          callbackUrl || `${process.env.FRONTEND_URL}/payment/callback`,
        metadata: {
          orderId: order._id.toString(),
          userId: user._id.toString(),
          orderNumber: order.orderNumber,
          hasPreorderItems: order.hasPreorderItems || false, // Include preorder info
          custom_fields: [
            {
              display_name: 'Order Number',
              variable_name: 'order_number',
              value: order.orderNumber,
            },
            {
              display_name: 'Customer Name',
              variable_name: 'customer_name',
              value: user.name,
            },
            ...(order.hasPreorderItems
              ? [
                  {
                    display_name: 'Order Type',
                    variable_name: 'order_type',
                    value: 'Contains Preorder Items',
                  },
                ]
              : []),
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Update order with payment reference
    order.paymentReference = response.data.data.reference;
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: order.hasPreorderItems
        ? 'Payment initialized for order with preorder items'
        : 'Payment initialized',
      updatedBy: req.user._id,
    });
    await order.save();

    // Create transaction record
    await transactionModel.create({
      reference: response.data.data.reference,
      orderId: order._id,
      userId: user._id,
      amount: order.amount,
      status: 'pending',
      paymentMethod: order.paymentMethod,
      gateway: 'paystack',
      gatewayReference: response.data.data.reference,
    });

    res.status(200).json({
      success: true,
      message: order.hasPreorderItems
        ? 'Payment initialized for order with preorder items'
        : 'Payment initialized',
      data: response.data.data,
      hasPreorderItems: order.hasPreorderItems,
    });
  } catch (error) {
    console.error(
      'Payment initialization error:',
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: 'Payment initialization failed',
      error: error.message,
    });
  }
};
export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    // Check if this reference exists in our transaction records
    const transaction = await transactionModel.findOne({ reference });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    // Verify with Paystack
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const paymentData = response.data.data;
    const paymentSuccessful = paymentData.status === 'success';

    // Update transaction status and details
    transaction.status = paymentSuccessful ? 'success' : 'failed';
    transaction.paymentDetails = paymentData;
    transaction.processedAt = new Date();
    transaction.gatewayResponse = paymentData;

    // Calculate and store fee information if available
    if (paymentData.fees) {
      transaction.fees = {
        gateway: paymentData.fees,
        platform: 0, // You can calculate your platform fee
        total: paymentData.fees,
      };
    }

    await transaction.save();

    // Only update order if still pending (to prevent double updates)
    const order = await orderModel.findById(transaction.orderId);
    const user = await userModel.findById(transaction.userId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Update order status only if it's still in pending payment status
    if (order.paymentStatus === 'pending') {
      // Update order status
      order.paymentStatus = paymentSuccessful ? 'success' : 'failed';
      order.payment = paymentSuccessful;
      order.status = paymentSuccessful ? 'confirmed' : 'payment_failed';
      order.paymentDetails = paymentData;

      // Add to status history
      order.statusHistory.push({
        status: order.status,
        timestamp: new Date(),
        note: paymentSuccessful ? 'Payment successful' : 'Payment failed',
        updatedBy: 'system',
      });

      await order.save();

      try {
        const customerEmail = user.email;
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';

        if (paymentSuccessful) {
          // Send payment confirmation to customer
          await sendPaymentConfirmation(order, customerEmail, transaction);

          // Send order confirmation based on type
          if (order.hasPreorderItems) {
            await sendPreorderNotification(order, customerEmail);
          } else {
            await sendOrderConfirmation(order, customerEmail);
          }

          // Send new order alert to admin
          await sendNewOrderAlert(order, adminEmail);

          // Update inventory and check for low stock alerts
          await updateInventoryWithNotifications(order, adminEmail);

          // Clear user's cart
          if (user) {
            user.cartData.clear();
            await user.save();
          }

          console.log('Payment success emails sent successfully');
        } else {
          // Send payment failed notification
          await sendPaymentFailedNotification(
            order,
            customerEmail,
            paymentData
          );
          console.log('Payment failed email sent successfully');
        }
      } catch (emailError) {
        console.error('Error sending payment emails:', emailError);
        // Continue with response even if email fails
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment verification complete',
      data: {
        status: paymentData.status,
        reference: paymentData.reference,
        amount: paymentData.amount / 100,
        orderId: transaction.orderId,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error) {
    console.error(
      'Payment verification error:',
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message,
    });
  }
};
async function updateInventoryWithNotifications(order, adminEmail) {
  const lowStockProducts = [];
  const outOfStockProducts = [];

  for (const item of order.items) {
    // Skip inventory updates for preorder items
    if (item.isPreorder) {
      console.log(`Skipping inventory update for preorder item: ${item.title}`);
      continue;
    }

    const product = await productModel.findById(item.productId);
    if (!product) continue;

    let updatedProduct = false;

    if (item.variantId) {
      // Update variant stock
      const variant = product.variants.id(item.variantId);
      if (variant) {
        variant.stock -= item.quantity;
        updatedProduct = true;

        // Check for low stock or out of stock
        if (variant.stock === 0) {
          outOfStockProducts.push({
            ...product.toObject(),
            title: `${product.title} (${variant.color || ''} ${
              variant.size || ''
            })`.trim(),
            sku: variant.sku,
            stock: variant.stock,
          });
        } else if (
          variant.stock <= (variant.inventory?.lowStockThreshold || 5)
        ) {
          lowStockProducts.push({
            ...product.toObject(),
            title: `${product.title} (${variant.color || ''} ${
              variant.size || ''
            })`.trim(),
            sku: variant.sku,
            stock: variant.stock,
            lowStockThreshold: variant.inventory?.lowStockThreshold || 5,
          });
        }
      }
    } else {
      // Update main product stock
      product.stock -= item.quantity;
      updatedProduct = true;

      // Check for low stock or out of stock
      if (product.stock === 0) {
        outOfStockProducts.push(product.toObject());
      } else if (product.stock <= 5) {
        lowStockProducts.push({
          ...product.toObject(),
          lowStockThreshold: 5,
        });
      }
    }

    if (updatedProduct) {
      await product.save();
    }
  }

  // Send stock alert emails
  try {
    for (const product of outOfStockProducts) {
      await sendOutOfStockAlert(product, adminEmail);
    }

    for (const product of lowStockProducts) {
      await sendLowStockAlert(product, adminEmail);
    }

    if (lowStockProducts.length > 0 || outOfStockProducts.length > 0) {
      console.log(
        `Stock alerts sent: ${lowStockProducts.length} low stock, ${outOfStockProducts.length} out of stock`
      );
    }
  } catch (alertError) {
    console.error('Error sending stock alerts:', alertError);
  }
}

async function updateInventory(order) {
  for (const item of order.items) {
    const product = await productModel.findById(item.productId);
    if (!product) continue;

    if (item.variantId) {
      // Update variant stock
      const variant = product.variants.id(item.variantId);
      if (variant) {
        variant.stock -= item.quantity;
        // Add low stock alert if needed
        if (variant.stock <= 5) {
          console.log(
            `Low stock alert: ${product.title} variant ${item.variantId} is low on stock (${variant.stock} remaining)`
          );
          // You could implement email notifications here
        }
      }
    } else {
      // Update main product stock
      product.stock -= item.quantity;
      // Add low stock alert if needed
      if (product.stock <= 5) {
        console.log(
          `Low stock alert: ${product.title} is low on stock (${product.stock} remaining)`
        );
        // You could implement email notifications here
      }
    }

    await product.save();
  }
}

// Enhanced processRefund function with better error handling and partial refunds
export const processRefund = async (req, res) => {
  try {
    const { orderId, amount, reason, items } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check permissions (admin only)
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can process refunds',
      });
    }

    if (order.paymentStatus !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Cannot refund an order that was not successfully paid',
      });
    }

    // Determine refund type (partial or full)
    const isPartialRefund = amount && amount < order.amount;
    const refundType = isPartialRefund ? 'partial_refund' : 'refund';
    const refundAmount = amount || order.amount;

    // For partial refunds with specific items
    let refundItems = [];
    if (isPartialRefund && items && items.length > 0) {
      // Validate refund items
      refundItems = items.map((item) => {
        const orderItem = order.items.find(
          (i) =>
            i.productId.toString() === item.productId &&
            i.variantId === item.variantId
        );

        if (!orderItem) {
          throw new Error(`Item not found in order: ${item.productId}`);
        }

        if (item.quantity > orderItem.quantity) {
          throw new Error(
            `Refund quantity exceeds ordered quantity for ${orderItem.title}`
          );
        }

        return {
          ...orderItem.toObject(),
          refundQuantity: item.quantity,
        };
      });
    }

    // Request refund from Paystack
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/refund`,
      {
        transaction: order.paymentReference,
        amount: Math.round(refundAmount * 100), // Convert to kobo
        reason,
        merchant_note: isPartialRefund ? `Partial refund: ${reason}` : reason,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Update order
    if (isPartialRefund) {
      order.status = 'partially_refunded';
      if (refundItems.length > 0) {
        // Mark specific items as refunded
        for (const refundItem of refundItems) {
          const orderItem = order.items.find(
            (i) =>
              i.productId.toString() === refundItem.productId &&
              i.variantId === refundItem.variantId
          );

          if (orderItem) {
            orderItem.itemStatus =
              refundItem.refundQuantity === orderItem.quantity
                ? 'returned'
                : 'partially_returned';
          }
        }
      }
    } else {
      order.status = 'refunded';
      // Mark all items as refunded
      for (const item of order.items) {
        item.itemStatus = 'returned';
      }
    }

    // Update refund details
    order.refundAmount = refundAmount;
    order.refundReason = reason;
    order.returnStatus = 'approved';

    // Add to status history
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `${isPartialRefund ? 'Partial refund' : 'Full refund'}: ${reason}`,
      updatedBy: req.user._id,
    });

    await order.save();
    const originalTransaction = await transactionModel.findOne({
      orderId: order._id,
      status: 'success',
      type: { $in: ['payment', undefined] }, // Original payment transaction
    });

    // Create transaction record for refund
    await transactionModel.create({
      reference: response.data.data.reference,
      orderId: order._id,
      userId: order.userId,
      amount: refundAmount,
      status: 'pending',
      type: refundType,
      paymentMethod: order.paymentMethod,
      paymentDetails: response.data.data,
      gateway: 'paystack',
      gatewayReference: response.data.data.reference,
      parentTransactionId: originalTransaction ? originalTransaction._id : null, // Fixed
    });

    // Restore inventory for refunded items
    if (refundItems.length > 0) {
      // Restore inventory for specific refunded items
      for (const refundItem of refundItems) {
        await restoreInventoryForItem(
          refundItem.productId,
          refundItem.variantId,
          refundItem.refundQuantity
        );
      }
    } else if (!isPartialRefund) {
      // Restore all inventory for full refund
      await restoreInventory(order);
    }

    res.status(200).json({
      success: true,
      message: isPartialRefund
        ? 'Partial refund initiated'
        : 'Refund initiated',
      data: {
        reference: response.data.data.reference,
        amount: refundAmount,
        type: refundType,
      },
    });
  } catch (error) {
    console.error('Refund error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Refund failed',
      error: error.message,
    });
  }
};

// Helper function to restore inventory for a specific item
async function restoreInventoryForItem(productId, variantId, quantity) {
  try {
    const product = await productModel.findById(productId);
    if (!product) return;

    if (variantId) {
      const variant = product.variants.id(variantId);
      if (variant) {
        variant.stock += quantity;
      }
    } else {
      product.stock += quantity;
    }

    await product.save();
  } catch (error) {
    console.error(`Error restoring inventory for product ${productId}:`, error);
    // Continue despite errors
  }
}
async function restoreInventory(order) {
  for (const item of order.items) {
    await restoreInventoryForItem(
      item.productId,
      item.variantId,
      item.quantity
    );
  }
}

// Add new function to check if order is eligible for refund
export const checkRefundEligibility = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if user has permission
    if (order.userId !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to check this order',
      });
    }

    // Check eligibility based on your business rules
    const isEligible =
      order.paymentStatus === 'success' &&
      ['confirmed', 'processing'].includes(order.status) &&
      !['refunded', 'partially_refunded'].includes(order.status);

    // Calculate time since order
    const orderDate = new Date(order.date);
    const currentDate = new Date();
    const daysSinceOrder = Math.floor(
      (currentDate - orderDate) / (1000 * 60 * 60 * 24)
    );

    // Most businesses allow refunds within 30 days
    const isWithinRefundPeriod = daysSinceOrder <= 30;

    res.json({
      success: true,
      isEligible: isEligible && isWithinRefundPeriod,
      reason: !isEligible
        ? `Order is not in a refundable state (${order.status})`
        : !isWithinRefundPeriod
        ? 'Order is outside the refund period (30 days)'
        : 'Order is eligible for refund',
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      daysSinceOrder,
    });
  } catch (error) {
    console.error('Refund eligibility check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check refund eligibility',
      error: error.message,
    });
  }
};
// Handle Callback
export const handleCallback = async (req, res) => {
  try {
    const { reference } = req.query;
    res.redirect(
      `${process.env.FRONTEND_URL}/payment/status?reference=${reference}`
    );
  } catch (error) {
    console.error('Callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?error=true`);
  }
};

export const handleWebhook = async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const event = req.body;

    await webhookModel.create({
      event: event.event,
      data: event.data,
      reference: event.data.reference,
    });

    switch (event.event) {
      case 'charge.success':
        await processSuccessfulPayment(event.data);
        break;

      case 'charge.failed':
        await processFailedPayment(event.data);
        break;

      case 'transfer.success':
        await processSuccessfulRefund(event.data);
        break;

      case 'transfer.failed':
        await processFailedRefund(event.data);
        break;
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('Webhook received with errors');
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    const transaction = await transactionModel.findOne({ reference });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    const order = await orderModel.findById(transaction.orderId);

    res.status(200).json({
      success: true,
      data: {
        transactionStatus: transaction.status,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        reference: transaction.reference,
        amount: transaction.amount,
        orderId: transaction.orderId,
      },
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment status',
      error: error.message,
    });
  }
};

async function processSuccessfulPayment(data) {
  try {
    const reference = data.reference;
    const existingTransaction = await transactionModel.findOne({
      reference,
      status: 'success',
    });
    if (existingTransaction) {
      console.log('Payment already processed:', reference);
      return;
    }

    const transaction = await transactionModel.findOneAndUpdate(
      { reference },
      {
        status: 'success',
        paymentDetails: data,
        processedAt: new Date(),
        gatewayResponse: data,
        fees: data.fees
          ? {
              gateway: data.fees,
              platform: 0,
              total: data.fees,
            }
          : undefined,
      },
      { new: true }
    );

    if (!transaction) return;

    const order = await orderModel.findOne({
      _id: transaction.orderId,
      paymentStatus: 'pending',
    });

    if (!order) return;
    const user = await userModel.findById(order.userId);

    order.paymentStatus = 'success';
    order.payment = true;
    order.status = 'confirmed';
    order.paymentDetails = data;

    order.statusHistory.push({
      status: 'confirmed',
      timestamp: new Date(),
      note: 'Payment successful',
      updatedBy: 'system',
      metadata: {
        paymentReference: reference,
        amount: data.amount / 100,
        paymentMethod: data.channel || 'card',
      },
    });

    await order.save();
    try {
      const customerEmail = user.email;
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';

      // Send payment confirmation
      await sendPaymentConfirmation(order, customerEmail, transaction);

      // Send order confirmation
      if (order.hasPreorderItems) {
        await sendPreorderNotification(order, customerEmail);
      } else {
        await sendOrderConfirmation(order, customerEmail);
      }

      // Send admin notification
      await sendNewOrderAlert(order, adminEmail);

      console.log('Webhook payment success emails sent');
    } catch (emailError) {
      console.error('Error sending webhook emails:', emailError);
    }

    // Update inventory with notifications
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';
      await updateInventoryWithNotifications(order, adminEmail);
    } catch (invError) {
      console.error('Inventory update error:', invError);
      order.statusHistory.push({
        status: order.status,
        timestamp: new Date(),
        note: 'Inventory update failed - manual check required',
        updatedBy: 'system',
        metadata: { error: invError.message },
      });
      await order.save();
    }
    // try {
    //   await updateInventory(order);
    // } catch (invError) {
    //   console.error('Inventory update error:', invError);
    //   order.statusHistory.push({
    //     status: order.status,
    //     timestamp: new Date(),
    //     note: 'Inventory update failed - manual check required',
    //     updatedBy: 'system',
    //     metadata: { error: invError.message },
    //   });
    //   await order.save();
    // }

    // await userModel.findByIdAndUpdate(transaction.userId, { cartData: {} });
    // const user = await userModel.findById(order.userId);
    if (user) {
      user.cartData.clear();
      await user.save();
    }
    await notifyPaymentSuccess(order, transaction, user.email);

    // await sendOrderConfirmationEmail(order);
  } catch (error) {
    console.error('Error processing successful payment:', error);
  }
}

async function processFailedPayment(data) {
  try {
    const reference = data.reference;

    const transaction = await transactionModel.findOneAndUpdate(
      { reference },
      {
        status: 'failed',
        paymentDetails: data,
        processedAt: new Date(),
        gatewayResponse: data,
      },
      { new: true }
    );

    if (!transaction) return;

    const order = await orderModel.findOne({
      _id: transaction.orderId,
      paymentStatus: 'pending',
    });

    if (!order) return;

    const user = await userModel.findById(order.userId);

    order.paymentStatus = 'failed';
    order.payment = false;
    order.status = 'payment_failed';
    order.paymentDetails = data;

    order.statusHistory.push({
      status: 'payment_failed',
      timestamp: new Date(),
      note: `Payment failed via webhook: ${
        data.gateway_response || 'Unknown error'
      }`,
      updatedBy: 'system',
      metadata: {
        paymentReference: reference,
        failureReason: data.gateway_response,
        failureCode: data.failure_code,
      },
    });

    await order.save();

    // Send payment failed notification
    try {
      if (user) {
        await sendPaymentFailedNotification(order, user.email, data);
        console.log('Payment failed email sent via webhook');
      }
    } catch (emailError) {
      console.error('Error sending payment failed email:', emailError);
    }

    // Restore inventory if it was reserved
    if (order.inventoryReserved) {
      try {
        await restoreInventory(order);
        order.inventoryReserved = false;

        order.statusHistory.push({
          status: order.status,
          timestamp: new Date(),
          note: 'Inventory restored after payment failure',
          updatedBy: 'system',
        });

        await order.save();
      } catch (invError) {
        console.error('Inventory restoration error:', invError);
      }
    }
  } catch (error) {
    console.error('Error processing failed payment:', error);
  }
}
async function processSuccessfulRefund(data) {
  try {
    const { reference, transfer_code, recipient, metadata } = data;

    let order;
    if (metadata && metadata.orderId) {
      order = await orderModel.findById(metadata.orderId);
    } else {
      const transaction = await transactionModel.findOne({
        gatewayReference: reference,
        type: 'refund',
      });
      if (transaction) {
        order = await orderModel.findById(transaction.orderId);
      }
    }

    if (!order) {
      console.error('Order not found for refund:', reference);
      return;
    }

    order.refundStatus = 'completed';
    order.status = 'refunded';
    order.refundDetails = {
      ...order.refundDetails,
      completedAt: new Date(),
      transferCode: transfer_code,
      amount: data.amount / 100,
    };

    // Add to status history
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `Refund completed: ₦${data.amount / 100}`,
      updatedBy: 'system',
      metadata: {
        refundAmount: data.amount / 100,
        transferCode: transfer_code,
        recipientDetails: recipient,
      },
    });

    await order.save();

    await transactionModel.findOneAndUpdate(
      { reference: order.paymentDetails.reference },
      {
        refundStatus: 'completed',
        refundDetails: data,
        refundedAt: new Date(),
      }
    );
  } catch (error) {
    console.error('Error processing successful refund:', error);
  }
}

async function processFailedRefund(data) {
  try {
    const { reference } = data;

    const order = await orderModel.findOne({
      'paymentDetails.reference': reference,
    });

    if (!order) return;

    order.refundStatus = 'failed';
    order.refundDetails = {
      ...order.refundDetails,
      failedAt: new Date(),
      failureReason: data.failure_reason || 'Unknown reason',
    };
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `Refund failed: ${data.failure_reason || 'Unknown reason'}`,
      updatedBy: 'system',
      metadata: {
        failureReason: data.failure_reason,
        failureCode: data.failure_code,
      },
    });

    await order.save();
  } catch (error) {
    console.error('Error processing failed refund:', error);
  }
}
