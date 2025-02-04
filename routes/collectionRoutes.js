import express from 'express';

import authUser from '../middleware/auth.js';
import {
  addToCollection,
  createCollection,
  deleteFromCollection,
  getCollectionDetails,
  getCollections,
} from '../controllers/galleryController.js';

const collectionRouter = express.Router();

collectionRouter.get('/', authUser, getCollections);
collectionRouter.post('/', authUser, createCollection);
collectionRouter.post('/:collectionId/images', authUser, addToCollection);
collectionRouter.get('/:id', authUser, getCollectionDetails); // Get details of a specific collection
collectionRouter.delete(
  '/:collectionId/images/:imageId',
  authUser,
  deleteFromCollection
); // Remove image from collection

export default collectionRouter;
