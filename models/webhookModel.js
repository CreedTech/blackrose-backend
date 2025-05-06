import mongoose from 'mongoose';

const webhookSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: true,
  },
  processed: {
    type: Boolean,
    default: false,
  },
  reference: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const webhookModel =
  mongoose.models.webhook || mongoose.model('webhook', webhookSchema);
export default webhookModel;
