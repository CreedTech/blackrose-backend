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
import { requireMarketerAccess } from '../middleware/auth.js';

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
  requireMarketerAccess,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  createCategory
);

categoryRouter.put(
  '/:id',
  requireMarketerAccess,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  updateCategory
);

categoryRouter.delete('/:id', requireMarketerAccess, deleteCategory);
categoryRouter.put('/:id/status', requireMarketerAccess, toggleCategoryStatus);
categoryRouter.put(
  '/:id/featured',
  requireMarketerAccess,
  toggleFeaturedStatus
);
categoryRouter.post('/reorder', requireMarketerAccess, reorderCategories);
categoryRouter.put(
  '/:categoryId/filters',
  requireMarketerAccess,
  updateCategoryFilters
);

// Admin reporting routes
categoryRouter.get('/statistics', requireMarketerAccess, getCategoryStatistics);
categoryRouter.get(
  '/:categoryId/report',
  requireMarketerAccess,
  generateCategoryReport
);

export default categoryRouter;
