import mongoose from 'mongoose';

const loginActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: ['login', 'logout', 'failed_login'],
    required: true,
  },
  ip: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const LoginActivity = mongoose.model('LoginActivity', loginActivitySchema);

export default LoginActivity;
