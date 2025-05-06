import mongoose from 'mongoose';

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
    enum: ['pending', 'success', 'failed'],
    required: true,
  },
  currency: {
    type: String,
    default: 'NGN',
  },
  paymentMethod: {
    type: String,
    default: 'card',
  },
  paymentDetails: {
    type: Object,
  },
  type: {
    type: String,
    enum: ['payment', 'refund'],
    default: 'payment',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const transactionModel =
  mongoose.models.transaction ||
  mongoose.model('transaction', transactionSchema);
export default transactionModel;
