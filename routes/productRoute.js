// import express from 'express';
// import {
//   listProducts,
//   addProduct,
//   removeProduct,
//   singleProduct,
//   getSimilarProducts,
// } from '../controllers/productController.js';
// import upload from '../middleware/multer.js';
// import adminAuth, { adminOnly } from '../middleware/adminAuth.js';
// import authUser from '../middleware/auth.js';

// const productRouter = express.Router();

// productRouter.post(
//   '/add',
//   authUser,
//   adminOnly,
//   upload.fields([
//     { name: 'image1', maxCount: 1 },
//     { name: 'image2', maxCount: 1 },
//     { name: 'image3', maxCount: 1 },
//     { name: 'image4', maxCount: 1 },
//     { name: 'image5', maxCount: 1 },
//   ]),
//   addProduct
// );
// productRouter.post('/remove', authUser, adminOnly, removeProduct);
// productRouter.get('/single/:productId', singleProduct);
// productRouter.get('/similar/:productId', getSimilarProducts);
// productRouter.get('/list', listProducts);

// export default productRouter;

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
} from '../controllers/productController.js';
import upload from '../middleware/multer.js';
import adminAuth, { adminOnly } from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';

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
  authUser,
  adminOnly,
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
  authUser,
  adminOnly,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
    { name: 'image5', maxCount: 1 },
  ]),
  updateProduct
);

productRouter.delete('/:id', authUser, adminOnly, removeProduct);

// Admin variant management routes
productRouter.post(
  '/variant/:productId',
  authUser,
  adminOnly,
  upload.fields([
    { name: 'variantImage1', maxCount: 1 },
    { name: 'variantImage2', maxCount: 1 },
    { name: 'variantImage3', maxCount: 1 },
  ]),
  addProductVariant
);

productRouter.put(
  '/variant/:productId/:variantId/stock',
  authUser,
  adminOnly,
  updateVariantStock
);
productRouter.get(
  '/inventory/:productId',
  authUser,
  adminOnly,
  getInventoryStatus
);
productRouter.get('/sku/:sku', authUser, adminOnly, findProductBySku);

export default productRouter;
