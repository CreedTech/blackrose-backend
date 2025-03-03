import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    required: true,
    default: 'Photo Gallery',
  },
  siteDescription: {
    type: String,
    default: 'A beautiful photo gallery',
  },
  maxUploadSize: {
    type: Number,
    default: 10, // MB
  },
  allowedFileTypes: {
    type: [String],
    default: ['jpg', 'jpeg', 'png', 'gif'],
  },
  enableWatermark: {
    type: Boolean,
    default: true,
  },
  watermarkOpacity: {
    type: Number,
    default: 50,
  },
  // Add more settings as needed
});

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
