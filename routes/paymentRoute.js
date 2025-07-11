

import express from 'express';
import {
  initializePayment,
  verifyPayment,
  handleCallback,
  handleWebhook,
  getPaymentStatus,
  processRefund,
  checkRefundEligibility,
} from '../controllers/paymentController.js';
import { adminAuth, authUser } from '../middleware/auth.js';

const paymentRouter = express.Router();

// User payment routes
paymentRouter.post('/initialize', authUser, initializePayment);
paymentRouter.get('/verify/:reference', authUser, verifyPayment);
paymentRouter.get('/status/:reference', authUser, getPaymentStatus);
paymentRouter.get(
  '/refund-eligibility/:orderId',
  authUser,
  checkRefundEligibility
);

// Public webhook and callback routes
paymentRouter.get('/callback', handleCallback);
paymentRouter.post('/webhook', handleWebhook);

// Admin-only routes
paymentRouter.post('/refund', adminAuth, processRefund);

export default paymentRouter;
