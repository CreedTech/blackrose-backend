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
  updateUserRoleStatus,
} from '../controllers/adminController.js';
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
import {
  adminAuth,
  authUser,
  requireMarketerAccess,
  requirePhotoGrapherAccess,
  requireWriterAccess,
  superAdminAuth,
} from '../middleware/auth.js';
import userModel from '../models/userModel.js';

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


const productUpload = upload.any();
const variantUpload = upload.fields([
  { name: 'variantImage1', maxCount: 1 },
  { name: 'variantImage2', maxCount: 1 },
  { name: 'variantImage3', maxCount: 1 },
]);

adminRouter.get(
  '/metrics/users',
  requireMarketerAccess,
  requirePhotoGrapherAccess,
  requireWriterAccess,
  getUserMetrics
);
adminRouter.get(
  '/metrics/range',
  requireMarketerAccess,
  requirePhotoGrapherAccess,
  requireWriterAccess,
  getMetricsByRange
);
adminRouter.get(
  '/metrics/custom',
  requireMarketerAccess,
  requirePhotoGrapherAccess,
  requireWriterAccess,
  getMetricsByCustomRange
);
adminRouter.get(
  '/metrics/export',
  requireMarketerAccess,
  requirePhotoGrapherAccess,
  requireWriterAccess,
  exportMetrics
);
adminRouter.get(
  '/stats',
  requireMarketerAccess,
  requirePhotoGrapherAccess,
  requireWriterAccess,
  getDashboardStats
);
adminRouter.get(
  '/analytics',
  requireMarketerAccess,
  requirePhotoGrapherAccess,
  requireWriterAccess,
  getAnalytics
);
adminRouter.get('/get-users', adminAuth, getUsers);
adminRouter.patch('/updateRole/:id', superAdminAuth, updateUserRole);

// E-commerce Metrics Routes
adminRouter.get(
  '/ecommerce/overview',
  requireMarketerAccess,
  requirePhotoGrapherAccess,
  requireWriterAccess,
  getEcommerceOverview
);
adminRouter.get(
  '/ecommerce/orders',
  requireMarketerAccess,
  getOrders
);
adminRouter.put(
  '/ecommerce/orders/:orderId',
  requireMarketerAccess,
  updateOrderStatus
);
adminRouter.get(
  '/ecommerce/product-metrics',
  requireMarketerAccess,
  getProductMetrics
);

// Products Management Routes
adminRouter.post('/products', requireMarketerAccess, productUpload, addProduct);
adminRouter.put(
  '/products/:productId',
  requireMarketerAccess,
  productUpload,
  updateProduct
);
adminRouter.get('/products', requireMarketerAccess, listProducts);
adminRouter.delete('/products/:id', requireMarketerAccess, removeProduct);

// routes/adminRoutes.js
adminRouter.get('/photo-stats', requirePhotoGrapherAccess, getPhotoStats);

// User management
adminRouter.get('/users', adminAuth, getUsers);
adminRouter.get('/users/:id', adminAuth, getUserDetails);
adminRouter.put('/users/:id', adminAuth, updateUser);
adminRouter.delete('/users/:id', adminAuth, deleteUser);
adminRouter.put('/users/:userId/role', superAdminAuth, updateUserRoleStatus);

// Image management
adminRouter.get('/images', requirePhotoGrapherAccess, getImages);
adminRouter.get('/images/:id', requirePhotoGrapherAccess, getImageDetails);
adminRouter.put('/images/:id', requirePhotoGrapherAccess, updateImage);
adminRouter.delete('/images/:id', requirePhotoGrapherAccess, deleteImage);
adminRouter.put(
  '/images/:id/feature',
  requirePhotoGrapherAccess,
  toggleFeatureImage
);

// Category management
adminRouter.get('/categories', requireMarketerAccess, getCategories);
adminRouter.post('/categories', requireMarketerAccess, createCategory);
adminRouter.put('/categories/:id', requireMarketerAccess, updateCategory);
adminRouter.delete('/categories/:id', requireMarketerAccess, deleteCategory);

adminRouter.post(
  '/products/:productId/variants',
  requireMarketerAccess,
  productUpload,
  addProductVariant
);

adminRouter.put(
  '/products/:productId/variants/:variantId/stock',
  requireMarketerAccess,
  updateVariantStock
);

adminRouter.get(
  '/products/:productId/inventory',
  requireMarketerAccess,
  getInventoryStatus
);

// Admin Category Management (additional)
adminRouter.get(
  '/categories/statistics',
  requireMarketerAccess,
  getCategoryStatistics
);

adminRouter.get(
  '/categories/:categoryId/report',
  requireMarketerAccess,
  generateCategoryReport
);

adminRouter.put(
  '/categories/:categoryId/filters',
  requireMarketerAccess,
  updateCategoryFilters
);

// Admin Order Management
adminRouter.get('/orders/refund-requests', superAdminAuth, (req, res) => {
  // This can be implemented in your orderController
  res.status(501).json({ message: 'Not implemented yet' });
});

adminRouter.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    let query = {};

    // Filter by role if specified
    if (role && role !== 'all') {
      query.role = role;
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await userModel
      .find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalUsers = await userModel.countDocuments(query);

    // Get role statistics
    const roleStats = await userModel.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit),
      },
      roleStats,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.json({ success: false, message: 'Error fetching users' });
  }
});


// Get user role history
adminRouter.get('/users/:userId/role-history', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await userModel
      .findById(userId)
      .populate('roleHistory.changedBy', 'name email')
      .select('name email role roleHistory');

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        currentRole: user.role,
        roleHistory: user.roleHistory,
      },
    });
  } catch (error) {
    console.error('Get role history error:', error);
    res.json({ success: false, message: 'Error fetching role history' });
  }
});

// Bulk role update
adminRouter.put('/users/bulk-role-update', superAdminAuth, async (req, res) => {
  try {
    const { userIds, newRole, reason } = req.body;
    const adminUserId = req.body.userId;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.json({ success: false, message: 'No users selected' });
    }

    const validRoles = [
      'user',
      'admin',
      'super-admin',
      'photographer',
      'marketer',
      'writer',
    ];
    if (!validRoles.includes(newRole)) {
      return res.json({ success: false, message: 'Invalid role specified' });
    }

    const updatedUsers = [];

    for (const userId of userIds) {
      try {
        const user = await userModel.findById(userId);
        if (user) {
          await user.updateRole(newRole, adminUserId, reason);
          updatedUsers.push({
            id: user._id,
            name: user.name,
            email: user.email,
            newRole: user.role,
          });
        }
      } catch (error) {
        console.error(`Error updating user ${userId}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Updated ${updatedUsers.length} users to ${newRole}`,
      updatedUsers,
    });
  } catch (error) {
    console.error('Bulk role update error:', error);
    res.json({ success: false, message: 'Error updating user roles' });
  }
});
export default adminRouter;
