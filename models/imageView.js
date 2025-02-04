import mongoose from 'mongoose';

const imageViewSchema = new mongoose.Schema({
  image: { type: mongoose.Schema.Types.ObjectId, ref: 'Image', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  sessionId: String,
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now },
  duration: Number, // Time spent viewing in seconds
});

const ImageView = mongoose.model('ImageView', imageViewSchema);

export default ImageView;
