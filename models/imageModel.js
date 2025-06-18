import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: {
    type: String,
    required: true,
  },
  originalUrl: String, // Original image without watermark
  watermarkedUrl: String,
  publicId: String,
  photographer: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'PhotographyCategory' },
  tags: { type: [String], default: [] },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  likeCount: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  uniqueViews: { type: Number, default: 0 },
  viewedBy: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const imageModel = mongoose.model('Image', imageSchema);

export default imageModel;
