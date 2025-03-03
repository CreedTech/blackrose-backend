import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'view',
      'download',
      'upload',
      'edit',
      'delete',
      'like',
      'comment',
      'share',
      'search',
      'profile_update',
      'settings_update',
      'collection_create',
      'collection_update',
      'collection_add',
      'collection_remove',
      'other', // Added 'other' to enum
    ],
    required: true,
  },
  imageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;
