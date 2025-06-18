// routes/blogRoutes.js
import express from 'express';
import { adminOnly } from '../middleware/adminAuth.js';
import { requireWriterAccess } from '../middleware/auth.js';
import {
  getAllPosts,
  getPostBySlug,
  getAllPostsAdmin,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/blogController.js';
import upload from '../middleware/multer.js';
import { uploadImage } from '../controllers/uploadController.js';
// import multer from 'multer';

const blogRouter = express.Router();
// const upload = multer({ dest: 'uploads/' });

// Public routes
blogRouter.get('/posts', getAllPosts);
blogRouter.get('/posts/:slug', getPostBySlug);
blogRouter.get('/categories', getCategories);

// Admin routes
blogRouter.get('/admin/posts', requireWriterAccess, getAllPostsAdmin);
blogRouter.get('/admin/posts/:id', requireWriterAccess, getPostById);
blogRouter.post(
  '/admin/posts',
  requireWriterAccess,
  upload.single('featuredImage'),
  createPost
);
blogRouter.patch(
  '/admin/posts/:id',
  requireWriterAccess,
  upload.single('featuredImage'),
  updatePost
);
blogRouter.post(
  '/admin/upload',
  requireWriterAccess,
  upload.single('image'),
  uploadImage
);
blogRouter.delete('/admin/posts/:id', requireWriterAccess, deletePost);
blogRouter.post('/admin/categories', requireWriterAccess, createCategory);
blogRouter.put('/admin/categories/:id', requireWriterAccess, updateCategory);
blogRouter.delete('/admin/categories/:id', requireWriterAccess, deleteCategory);

export default blogRouter;
