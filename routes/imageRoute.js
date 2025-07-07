import express from 'express';
import adminAuth from '../middleware/adminAuth.js';
import upload from '../middleware/multer.js';
import {

  downloadImage,
  getCollections,
  getImages,
  getSingleImage,
  postImage,
  postLike,
} from '../controllers/galleryController.js';
import { authUser, requirePhotoGrapherAccess } from '../middleware/auth.js';
import { trackUserActivity } from '../middleware/activityTracking.js';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
} from '../controllers/photographyCategoryController.js';

const galleryRouter = express.Router();

galleryRouter.post('/', authUser, upload.single('image'), postImage);
galleryRouter.get('/', getImages);

// ✅ FIXED SLASH HERE
galleryRouter.get('/collections', authUser, getCollections);


galleryRouter.get('/categories', getCategories);
galleryRouter.post('/categories', requirePhotoGrapherAccess, createCategory);
galleryRouter.put('/categories/:id', requirePhotoGrapherAccess, updateCategory);
galleryRouter.delete(
  '/categories/:id',
  requirePhotoGrapherAccess,
  deleteCategory
);


galleryRouter.get('/:id', getSingleImage);
galleryRouter.post('/images/:id/like', trackUserActivity, authUser, postLike);
galleryRouter.get('/:id/download', authUser, trackUserActivity, downloadImage);



export default galleryRouter;
