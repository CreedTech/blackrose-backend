import express from 'express';
// import {
//   placeOrder,
//   placeOrderStripe,
//   allOrders,
//   userOrders,
//   updateStatus,
//   verifyStripe,
// } from '../controllers/orderController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import {
  createOrder,
  getMyOrders,
//   getOrderById,
} from '../controllers/orderController.js';

const orderRouter = express.Router();

// Admin Features
// orderRouter.post('/list', adminAuth, allOrders);
// orderRouter.post('/status', adminAuth, updateStatus);

// // Payment Features
// orderRouter.post('/place', authUser, placeOrder);
// orderRouter.post('/stripe', authUser, placeOrderStripe);

// // User Feature
// orderRouter.post('/userorders', authUser, userOrders);

// // verify payment
// orderRouter.post('/verifyStripe', authUser, verifyStripe);

orderRouter.post('/create', authUser, createOrder);
orderRouter.get('/my-orders', authUser, getMyOrders); // Fetch all orders for authenticated user
// orderRouter.get('/:id', authUser, getOrderById); // Fetch order details for authenticated user

export default orderRouter;
