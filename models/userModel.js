import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    likedPhotos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image',
      },
    ],
    collections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection',
      },
    ],
    // Statistics
    uploadedPhotos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image',
      },
    ],
    totalViews: {
      type: Number,
      default: 0,
    },
    totalLikes: {
      type: Number,
      default: 0,
    },
    cartData: { type: Object, default: {} },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { minimize: false },
  {
    timestamps: true,
  }
);

const userModel = mongoose.models.user || mongoose.model('user', userSchema);

export default userModel;
