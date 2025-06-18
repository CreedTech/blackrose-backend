import express from 'express';
import {
  listProducts,
  addProduct,
  updateProduct,
  removeProduct,
  singleProduct,
  getSimilarProducts,
  addReview,
  getProductVariants,
  getProductsByCategory,
  checkVariantAvailability,
  findProductBySku,
  getInventoryStatus,
  updateVariantStock,
  addProductVariant,
  getProductsByFilters,
  requestBackInStockNotification,
} from '../controllers/productController.js';
import upload from '../middleware/multer.js';
import { authUser, requireMarketerAccess } from '../middleware/auth.js';

const productRouter = express.Router();

// Public product routes
productRouter.get('/list', listProducts);
productRouter.get('/single/:productId', singleProduct);
productRouter.get('/similar/:productId', getSimilarProducts);
productRouter.get('/category/:categoryId', getProductsByCategory);
productRouter.get('/filters', getProductsByFilters);
productRouter.get('/variants/:productId', getProductVariants);
productRouter.get('/check-availability/:productId', checkVariantAvailability);

// Protected product routes (require authentication)
productRouter.post('/review', authUser, addReview);

// Admin product routes
productRouter.post(
  '/add',
  requireMarketerAccess,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
    { name: 'image5', maxCount: 1 },
  ]),
  addProduct
);

productRouter.put(
  '/:productId',
  requireMarketerAccess,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
    { name: 'image5', maxCount: 1 },
  ]),
  updateProduct
);

productRouter.delete('/:id', requireMarketerAccess, removeProduct);

// Admin variant management routes
productRouter.post(
  '/variant/:productId',
  requireMarketerAccess,
  upload.fields([
    { name: 'variantImage1', maxCount: 1 },
    { name: 'variantImage2', maxCount: 1 },
    { name: 'variantImage3', maxCount: 1 },
  ]),
  addProductVariant
);

productRouter.put(
  '/variant/:productId/:variantId/stock',
  requireMarketerAccess,
  updateVariantStock
);
productRouter.post('/back-in-stock/:productId', requestBackInStockNotification);
productRouter.get(
  '/inventory/:productId',
  requireMarketerAccess,
  getInventoryStatus
);
productRouter.get('/sku/:sku', requireMarketerAccess, findProductBySku);

export default productRouter;
