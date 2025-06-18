import express from 'express';
import adminAuth from '../middleware/adminAuth.js';
import upload from '../middleware/multer.js';
import {
  //   addToCollection,
  createCollection,
  //   deleteFromCollection,
  //   getCollectionDetails,
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

// ✅ STATIC ROUTES BEFORE DYNAMIC ONES
galleryRouter.get('/categories', getCategories);
galleryRouter.post('/categories', requirePhotoGrapherAccess, createCategory);
galleryRouter.put('/categories/:id', requirePhotoGrapherAccess, updateCategory);
galleryRouter.delete(
  '/categories/:id',
  requirePhotoGrapherAccess,
  deleteCategory
);

// ✅ NOW THE DYNAMIC ROUTE COMES
galleryRouter.get('/:id', getSingleImage);
galleryRouter.post('/images/:id/like', trackUserActivity, authUser, postLike);
galleryRouter.get('/:id/download', authUser, trackUserActivity, downloadImage);

// galleryRouter.post('/collections', authUser, createCollection); // Create a new collection
// galleryRouter.post(
//   '/collections/:collectionId/images',
//   authUser,
//   addToCollection
// ); // Add image to collection
// galleryRouter.get('/collections/:id', authUser, getCollectionDetails); // Get details of a specific collection
// galleryRouter.delete(
//   '/collections/:collectionId/images/:imageId',
//   authUser,
//   deleteFromCollection
// ); // Remove image from collection

export default galleryRouter;
