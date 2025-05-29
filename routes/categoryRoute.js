// import express from 'express';
// import adminAuth from '../middleware/adminAuth.js';
// import upload from '../middleware/multer.js';
// import {
//   createCategory,
//   getCategories,
//   getCategoryBySlug,
// } from '../controllers/categoryController.js';
// import authUser from '../middleware/auth.js';

// const categoryRouter = express.Router();

// categoryRouter.post(
//   '/',
//   authUser,
//   adminAuth,
//   upload.fields([{ name: 'category', maxCount: 1 }]),
//   createCategory
// );
// categoryRouter.get('/', getCategories);
// categoryRouter.get('/:slug', getCategoryBySlug);

// export default categoryRouter;

import express from 'express';
import { adminOnly } from '../middleware/adminAuth.js';
import upload from '../middleware/multer.js';
import {
  createCategory,
  getCategories,
  getCategoryBySlug,
  getCategoryById,
  getSubcategories,
  getFeaturedCategories,
  getCategoryHierarchy,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  toggleFeaturedStatus,
  reorderCategories,
  getCategoriesByType,
  searchCategories,
  getCategoryStatistics,
  updateCategoryFilters,
  generateCategoryReport,
} from '../controllers/categoryController.js';
import authUser from '../middleware/auth.js';

const categoryRouter = express.Router();

// Public category routes
categoryRouter.get('/', getCategories);
categoryRouter.get('/slug/:slug', getCategoryBySlug);
categoryRouter.get('/id/:id', getCategoryById);
categoryRouter.get('/subcategories/:parentId', getSubcategories);
categoryRouter.get('/featured', getFeaturedCategories);
categoryRouter.get('/hierarchy', getCategoryHierarchy);
categoryRouter.get('/type/:categoryType', getCategoriesByType);
categoryRouter.get('/search', searchCategories);

// Admin category routes
categoryRouter.post(
  '/',
  authUser,
  adminOnly,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  createCategory
);

categoryRouter.put(
  '/:id',
  authUser,
  adminOnly,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  updateCategory
);

categoryRouter.delete('/:id', authUser, adminOnly, deleteCategory);
categoryRouter.put('/:id/status', authUser, adminOnly, toggleCategoryStatus);
categoryRouter.put('/:id/featured', authUser, adminOnly, toggleFeaturedStatus);
categoryRouter.post('/reorder', authUser, adminOnly, reorderCategories);
categoryRouter.put(
  '/:categoryId/filters',
  authUser,
  adminOnly,
  updateCategoryFilters
);

// Admin reporting routes
categoryRouter.get('/statistics', authUser, adminOnly, getCategoryStatistics);
categoryRouter.get(
  '/:categoryId/report',
  authUser,
  adminOnly,
  generateCategoryReport
);

export default categoryRouter;
