import mongoose from 'mongoose';

// const transactionSchema = new mongoose.Schema({
//   reference: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   orderId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'order',
//   },
//   userId: {
//     type: String,
//     required: true,
//   },
//   amount: {
//     type: Number,
//     required: true,
//   },
//   status: {
//     type: String,
//     enum: ['pending', 'success', 'failed'],
//     required: true,
//   },
//   currency: {
//     type: String,
//     default: 'NGN',
//   },
//   paymentMethod: {
//     type: String,
//     default: 'card',
//   },
//   paymentDetails: {
//     type: Object,
//   },
//   type: {
//     type: String,
//     enum: ['payment', 'refund'],
//     default: 'payment',
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// const transactionModel =
//   mongoose.models.transaction ||
//   mongoose.model('transaction', transactionSchema);

const transactionSchema = new mongoose.Schema({
  reference: {
    type: String,
    required: true,
    unique: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'order',
  },
  userId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'cancelled', 'refunded'],
    required: true,
  },
  currency: {
    type: String,
    default: 'NGN',
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'wallet', 'crypto', 'paypal', 'paystack'],
    default: 'card',
  },
  paymentDetails: {
    type: Object,
  },
  type: {
    type: String,
    enum: ['payment', 'refund', 'partial_refund'],
    default: 'payment',
  },

  // Enhanced transaction tracking
  gateway: {
    type: String,
    enum: ['paystack', 'flutterwave', 'stripe', 'paypal'],
  },
  gatewayReference: String,
  gatewayResponse: Object,

  // Fee breakdown
  fees: {
    gateway: { type: Number, default: 0 },
    platform: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },

  // Related transactions (for refunds)
  parentTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'transaction',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: Date,
  failureReason: String,
});
transactionSchema.index({ orderId: 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, type: 1 });

const transactionModel =
  mongoose.models.transaction ||
  mongoose.model('transaction', transactionSchema);
export default transactionModel;
