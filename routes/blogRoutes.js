// routes/blogRoutes.js
import express from 'express';
import { adminOnly } from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
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
blogRouter.get('/admin/posts', authUser, adminOnly, getAllPostsAdmin);
blogRouter.get('/admin/posts/:id', authUser, adminOnly, getPostById);
blogRouter.post(
  '/admin/posts',
  authUser,
  adminOnly,
  upload.single('featuredImage'),
  createPost
);
blogRouter.patch(
  '/admin/posts/:id',
  authUser,
  adminOnly,
  upload.single('featuredImage'),
  updatePost
);
blogRouter.post(
  '/admin/upload',
  authUser,
  adminOnly,
  upload.single('image'),
  uploadImage
);
blogRouter.delete('/admin/posts/:id', authUser, adminOnly, deletePost);
blogRouter.post('/admin/categories', authUser, adminOnly, createCategory);

export default blogRouter;
