import express from 'express';
import {
  listProducts,
  addProduct,
  removeProduct,
  singleProduct,
  getSimilarProducts,
} from '../controllers/productController.js';
import upload from '../middleware/multer.js';
import adminAuth, { adminOnly } from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';

const productRouter = express.Router();

productRouter.post(
  '/add',
  authUser,
  adminOnly,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
  ]),
  addProduct
);
productRouter.post('/remove', authUser, adminOnly, removeProduct);
productRouter.get('/single/:productId', singleProduct);
productRouter.get('/similar/:productId', getSimilarProducts);
productRouter.get('/list', listProducts);

export default productRouter;
