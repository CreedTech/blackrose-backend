import mongoose from 'mongoose';

const backInStockRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  email: { type: String, required: true },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'product',
    required: true,
  },
  variantId: { type: String }, // Optional for variant-specific requests
  requestedAt: { type: Date, default: Date.now },
  notified: { type: Boolean, default: false },
  notifiedAt: { type: Date },
});

const BackInStockRequest =
  mongoose.models.BackInStockRequest ||
  mongoose.model('BackInStockRequest', backInStockRequestSchema);
export default BackInStockRequest;