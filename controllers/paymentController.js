import axios from 'axios';
import crypto from 'crypto';
import orderModel from '../models/orderModel.js';
import userModel from '../models/userModel.js';
import webhookModel from '../models/webhookModel.js';
import transactionModel from '../models/transactionModel.js';

// Initialize Paystack API
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Initialize Payment
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
          custom_fields: [
            {
              display_name: 'Order ID',
              variable_name: 'order_id',
              value: order._id.toString(),
            },
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
    await order.save();

    // Create transaction record
    await transactionModel.create({
      reference: response.data.data.reference,
      orderId: order._id,
      userId: user._id,
      amount: order.amount,
      status: 'pending',
      paymentMethod: order.paymentMethod,
    });

    res.status(200).json({
      success: true,
      message: 'Payment initialized',
      data: response.data.data,
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

// Verify Payment
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

    // Update transaction status
    transaction.status =
      paymentData.status === 'success' ? 'success' : 'failed';
    transaction.paymentDetails = paymentData;
    await transaction.save();

    // Only update order if still pending (to prevent double updates)
    const order = await orderModel.findOneAndUpdate(
      {
        _id: transaction.orderId,
        paymentStatus: 'pending',
      },
      {
        paymentStatus: paymentData.status === 'success' ? 'success' : 'failed',
        payment: paymentData.status === 'success',
        status:
          paymentData.status === 'success' ? 'Processing' : 'Payment Failed',
        paymentDetails: paymentData,
      },
      { new: true }
    );

    // Clear cart if payment successful and order was updated
    if (paymentData.status === 'success' && order) {
      await userModel.findByIdAndUpdate(transaction.userId, { cartData: {} });
    }

    res.status(200).json({
      success: true,
      message: 'Payment verification complete',
      data: {
        status: paymentData.status,
        reference: paymentData.reference,
        amount: paymentData.amount / 100,
        orderId: transaction.orderId,
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

// Handle Callback
export const handleCallback = async (req, res) => {
  try {
    const { reference } = req.query;

    // Just redirect to frontend with reference
    // Let frontend handle verification and status display
    // This prevents double updates between callback and webhook
    res.redirect(
      `${process.env.FRONTEND_URL}/payment/status?reference=${reference}`
    );
  } catch (error) {
    console.error('Callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?error=true`);
  }
};

// Handle Webhook
export const handleWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const event = req.body;

    // Log webhook
    await webhookModel.create({
      event: event.event,
      data: event.data,
      reference: event.data.reference,
    });

    // Process different events
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

    // Always return 200 to acknowledge receipt
    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to acknowledge receipt
    res.status(200).send('Webhook received with errors');
  }
};

// Check Payment Status
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

// Process Refund
export const processRefund = async (req, res) => {
  try {
    const { orderId, amount, reason } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.paymentStatus !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Cannot refund an order that was not successfully paid',
      });
    }

    // Request refund from Paystack
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/refund`,
      {
        transaction: order.paymentReference,
        amount: amount ? Math.round(amount * 100) : undefined, // Convert to kobo
        reason,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Update order
    order.refundStatus = 'processing';
    order.refundDetails = {
      reference: response.data.data.reference,
      amount: amount || order.amount,
      reason,
      date: new Date(),
    };
    await order.save();

    // Create transaction record for refund
    await transactionModel.create({
      reference: response.data.data.reference,
      orderId: order._id,
      userId: order.userId,
      amount: amount || order.amount,
      status: 'pending',
      type: 'refund',
      paymentDetails: response.data.data,
    });

    res.status(200).json({
      success: true,
      message: 'Refund initiated',
      data: response.data.data,
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

// Helper functions for webhook processing
async function processSuccessfulPayment(data) {
  try {
    const reference = data.reference;

    // Update transaction
    const transaction = await transactionModel.findOneAndUpdate(
      { reference },
      {
        status: 'success',
        paymentDetails: data,
      },
      { new: true }
    );

    if (!transaction) return;

    // Update order only if still pending
    const order = await orderModel.findOneAndUpdate(
      {
        _id: transaction.orderId,
        paymentStatus: 'pending',
      },
      {
        paymentStatus: 'success',
        payment: true,
        status: 'Processing',
        paymentDetails: data,
      },
      { new: true }
    );

    // Clear cart if order was updated
    if (order) {
      await userModel.findByIdAndUpdate(transaction.userId, { cartData: {} });
    }
  } catch (error) {
    console.error('Error processing successful payment:', error);
  }
}

async function processFailedPayment(data) {
  try {
    const reference = data.reference;

    // Update transaction
    const transaction = await transactionModel.findOneAndUpdate(
      { reference },
      {
        status: 'failed',
        paymentDetails: data,
      },
      { new: true }
    );

    if (!transaction) return;

    // Update order
    await orderModel.findOneAndUpdate(
      { _id: transaction.orderId },
      {
        paymentStatus: 'failed',
        status: 'Payment Failed',
        paymentDetails: data,
      }
    );
  } catch (error) {
    console.error('Error processing failed payment:', error);
  }
}

async function processSuccessfulRefund(data) {
  try {
    // Find transaction by reference
    const transaction = await transactionModel.findOneAndUpdate(
      { reference: data.reference, type: 'refund' },
      {
        status: 'success',
        paymentDetails: data,
      },
      { new: true }
    );

    if (!transaction) return;

    // Update order
    await orderModel.findByIdAndUpdate(transaction.orderId, {
      refundStatus: 'completed',
      status: 'Refunded',
      'refundDetails.status': 'completed',
      'refundDetails.completedAt': new Date(),
    });
  } catch (error) {
    console.error('Error processing successful refund:', error);
  }
}

async function processFailedRefund(data) {
  try {
    // Find transaction by reference
    const transaction = await transactionModel.findOneAndUpdate(
      { reference: data.reference, type: 'refund' },
      {
        status: 'failed',
        paymentDetails: data,
      },
      { new: true }
    );

    if (!transaction) return;

    // Update order
    await orderModel.findByIdAndUpdate(transaction.orderId, {
      refundStatus: 'failed',
      'refundDetails.status': 'failed',
      'refundDetails.failedAt': new Date(),
      'refundDetails.failureReason': data.reason || 'Unknown reason',
    });
  } catch (error) {
    console.error('Error processing failed refund:', error);
  }
}
