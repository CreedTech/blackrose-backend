import mongoose from 'mongoose';

const collectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Image' }],
  imageCount: {
    type: Number,
    default: 0,
  },
  isPrivate: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update imageCount before saving
collectionSchema.pre('save', function (next) {
  if (this.isModified('images')) {
    this.imageCount = this.images.length;
  }
  this.updatedAt = Date.now();
  next();
});

const Collection = mongoose.model('Collection', collectionSchema);

export default Collection;
