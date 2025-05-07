import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  exportMetrics,
  getAnalytics,
  getDashboardStats,
  getMetricsByCustomRange,
  getMetricsByRange,
  getUserMetrics,
  getUsers,
  updateUserRole,
} from '../controllers/adminController.js';
import { adminOnly } from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import {
  getEcommerceOverview,
  getOrders,
  updateOrderStatus,
  getProductMetrics,
} from '../controllers/ecommerceMetricsController.js';
import {
  addProduct,
  listProducts,
  removeProduct,
} from '../controllers/productController.js';

const adminRouter = express.Router();

// Make sure upload directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  // destination: function (req, file, cb) {
  //   cb(null, file.originalname);
  // },
  // filename: function (req, file, cb) {
  //   // Create unique filename with original extension
  //   const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  //   const ext = path.extname(file.originalname);
  //   cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  // },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  },
});

// Configure upload options
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: function (req, file, cb) {
    // Check file types
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error('Only image files are allowed!'));
  },
});

// Product upload middleware setup
const productUpload = upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 },
  { name: 'image5', maxCount: 1 },
]);

adminRouter.get('/metrics/users', authUser, adminOnly, getUserMetrics);
adminRouter.get('/metrics/range', authUser, adminOnly, getMetricsByRange);
adminRouter.get(
  '/metrics/custom',
  authUser,
  adminOnly,
  getMetricsByCustomRange
);
adminRouter.get('/metrics/export', authUser, adminOnly, exportMetrics);
adminRouter.get('/stats', authUser, adminOnly, getDashboardStats);
adminRouter.get('/analytics', authUser, adminOnly, getAnalytics);
adminRouter.get('/get-users', authUser, adminOnly, getUsers);
adminRouter.patch('/updateRole/:id', authUser, adminOnly, updateUserRole);

// E-commerce Metrics Routes
adminRouter.get(
  '/ecommerce/overview',
  authUser,
  adminOnly,
  getEcommerceOverview
);
adminRouter.get('/ecommerce/orders', authUser, adminOnly, getOrders);
adminRouter.put(
  '/ecommerce/orders/:orderId',
  authUser,
  adminOnly,
  updateOrderStatus
);
adminRouter.get(
  '/ecommerce/product-metrics',
  authUser,
  adminOnly,
  getProductMetrics
);

// Products Management Routes
adminRouter.post('/products', authUser, adminOnly, productUpload, addProduct);
adminRouter.get('/products', authUser, adminOnly, listProducts);
adminRouter.delete('/products/:id', authUser, adminOnly, removeProduct);

export default adminRouter;
