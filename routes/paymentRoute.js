// import express from 'express';
// import {
//   initializePayment,
//   verifyPayment,
//   handleCallback,
//   handleWebhook,
//   getPaymentStatus,
//   processRefund,
// } from '../controllers/paymentController.js';
// import authUser from '../middleware/auth.js';

// const paymentRouter = express.Router();

// paymentRouter.post('/initialize', authUser, initializePayment);
// paymentRouter.get('/verify/:reference', authUser, verifyPayment);
// paymentRouter.get('/callback', handleCallback);
// paymentRouter.post('/webhook', handleWebhook);
// paymentRouter.get('/status/:reference', authUser, getPaymentStatus);
// paymentRouter.post('/refund', authUser, processRefund);

// export default paymentRouter;

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
import authUser from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminAuth.js';

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
paymentRouter.post('/refund', authUser, adminOnly, processRefund);

export default paymentRouter;
