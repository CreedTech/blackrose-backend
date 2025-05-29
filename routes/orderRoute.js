// import express from 'express';
// import adminAuth from '../middleware/adminAuth.js';
// import authUser from '../middleware/auth.js';
// import {
//   createOrder,
//   getMyOrders,
// //   getOrderById,
// } from '../controllers/orderController.js';

// const orderRouter = express.Router();

// orderRouter.post('/create', authUser, createOrder);
// orderRouter.get('/my-orders', authUser, getMyOrders);

// export default orderRouter;

import express from 'express';
import adminAuth, { adminOnly } from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
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
orderRouter.get('/:orderId', authUser, adminOnly, getOrderDetails);
orderRouter.post('/:orderId/cancel', authUser, cancelOrder);

// Add admin routes for order management
orderRouter.get('/admin/all', authUser, adminOnly, (req, res) => {
  // This can be implemented in your orderController
  res.status(501).json({ message: 'Not implemented yet' });
});

orderRouter.put('/admin/:orderId/status', authUser, adminOnly, (req, res) => {
  // This can be implemented in your orderController
  res.status(501).json({ message: 'Not implemented yet' });
});

export default orderRouter;
