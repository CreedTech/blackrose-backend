import express from 'express';
import multer from 'multer';
import path from 'path';
// import fs from 'fs';
import {
  deleteImage,
  deleteUser,
  exportMetrics,
  getAnalytics,
  getCategories,
  getDashboardStats,
  getImageDetails,
  getImages,
  getMetricsByCustomRange,
  getMetricsByRange,
  getPhotoStats,
  getUserDetails,
  getUserMetrics,
  getUsers,
  toggleFeatureImage,
  updateImage,
  updateUser,
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
  addProductVariant,
  getInventoryStatus,
  listProducts,
  removeProduct,
  updateProduct,
  updateVariantStock,
} from '../controllers/productController.js';
import {
  createCategory,
  deleteCategory,
  generateCategoryReport,
  getCategoryStatistics,
  updateCategory,
  updateCategoryFilters,
} from '../controllers/categoryController.js';

const adminRouter = express.Router();

// Configure storage
const storage = multer.diskStorage({
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
adminRouter.put('/products/:productId', authUser, adminOnly, productUpload, updateProduct);
adminRouter.get('/products', authUser, adminOnly, listProducts);
adminRouter.delete('/products/:id', authUser, adminOnly, removeProduct);

// routes/adminRoutes.js
adminRouter.get('/photo-stats', authUser, adminOnly, getPhotoStats);

// User management
adminRouter.get('/users', authUser, adminOnly, getUsers);
adminRouter.get('/users/:id', authUser, adminOnly, getUserDetails);
adminRouter.put('/users/:id', authUser, adminOnly, updateUser);
adminRouter.delete('/users/:id', authUser, adminOnly, deleteUser);
adminRouter.put('/users/:id/role', authUser, adminOnly, updateUserRole);

// Image management
adminRouter.get('/images', authUser, adminOnly, getImages);
adminRouter.get('/images/:id', authUser, adminOnly, getImageDetails);
adminRouter.put('/images/:id', authUser, adminOnly, updateImage);
adminRouter.delete('/images/:id', authUser, adminOnly, deleteImage);
adminRouter.put('/images/:id/feature', authUser, adminOnly, toggleFeatureImage);

// Category management
adminRouter.get('/categories', authUser, adminOnly, getCategories);
adminRouter.post('/categories', authUser, adminOnly, createCategory);
adminRouter.put('/categories/:id', authUser, adminOnly, updateCategory);
adminRouter.delete('/categories/:id', authUser, adminOnly, deleteCategory);

adminRouter.post(
  '/products/:productId/variants',
  authUser,
  adminOnly,
  productUpload,
  addProductVariant
);

adminRouter.put(
  '/products/:productId/variants/:variantId/stock',
  authUser,
  adminOnly,
  updateVariantStock
);

adminRouter.get(
  '/products/:productId/inventory',
  authUser,
  adminOnly,
  getInventoryStatus
);

// Admin Category Management (additional)
adminRouter.get(
  '/categories/statistics',
  authUser,
  adminOnly,
  getCategoryStatistics
);

adminRouter.get(
  '/categories/:categoryId/report',
  authUser,
  adminOnly,
  generateCategoryReport
);

adminRouter.put(
  '/categories/:categoryId/filters',
  authUser,
  adminOnly,
  updateCategoryFilters
);

// Admin Order Management
adminRouter.get('/orders/refund-requests', authUser, adminOnly, (req, res) => {
  // This can be implemented in your orderController
  res.status(501).json({ message: 'Not implemented yet' });
});
export default adminRouter;
