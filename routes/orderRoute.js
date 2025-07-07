

import express from 'express';
import { authUser, requireMarketerAccess } from '../middleware/auth.js';
import {
  createOrder,
  getMyOrders,
  getOrderDetails,
  cancelOrder,
} from '../controllers/orderController.js';

const orderRouter = express.Router();

// User order routes
orderRouter.post('/create', authUser, createOrder);
orderRouter.get('/my-orders', authUser, getMyOrders);
orderRouter.get('/:orderId', requireMarketerAccess, getOrderDetails);
orderRouter.post('/:orderId/cancel', authUser, cancelOrder);

// Add admin routes for order management
orderRouter.get('/admin/all', requireMarketerAccess, (req, res) => {
  // This can be implemented in your orderController
  res.status(501).json({ message: 'Not implemented yet' });
});

orderRouter.put('/admin/:orderId/status', requireMarketerAccess, (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

export default orderRouter;
