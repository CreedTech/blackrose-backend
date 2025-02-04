import express from 'express';
import adminAuth from '../middleware/adminAuth.js';
import upload from '../middleware/multer.js';
import {
  createCategory,
  getCategories,
  getCategoryBySlug,
} from '../controllers/categoryController.js';
import authUser from '../middleware/auth.js';

const categoryRouter = express.Router();

categoryRouter.post(
  '/',
  authUser,
  adminAuth,
  upload.fields([{ name: 'category', maxCount: 1 }]),
  createCategory
);
categoryRouter.get('/', getCategories);
categoryRouter.get('/:slug', getCategoryBySlug);

export default categoryRouter;
