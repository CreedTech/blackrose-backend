// import express from 'express';
// import {
//   loginUser,
//   registerUser,
//   adminLogin,
//   getMe,
// } from '../controllers/userController.js';
// import authUser from '../middleware/auth.js';

// const userRouter = express.Router();

// userRouter.post('/register', registerUser);
// userRouter.post('/login', loginUser);
// userRouter.post('/admin', adminLogin);
// userRouter.get('/me', authUser, getMe);

// export default userRouter;

import express from 'express';
import {
  loginUser,
  registerUser,
  adminLogin,
  getMe,
  addToCart,
  getCart,
  removeFromCart,
  updateCartQuantity,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  addAddress,
  updateAddress,
  deleteAddress,
  addToRecentlyViewed,
  updatePreferences,
  likePhoto,
  unlikePhoto,
} from '../controllers/userController.js';
import authUser from '../middleware/auth.js';

const userRouter = express.Router();

// Authentication routes
userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);
userRouter.post('/admin', adminLogin);
userRouter.get('/me', authUser, getMe);

// Cart management routes
userRouter.post('/cart/add', authUser, addToCart);
userRouter.get('/cart', authUser, getCart);
userRouter.delete('/cart', authUser, removeFromCart);
userRouter.put('/cart/quantity', authUser, updateCartQuantity);

// Wishlist management routes
userRouter.post('/wishlist/add', authUser, addToWishlist);
userRouter.delete('/wishlist', authUser, removeFromWishlist);
userRouter.get('/wishlist', authUser, getWishlist);

// Address management routes
userRouter.post('/address', authUser, addAddress);
userRouter.put('/address/:addressId', authUser, updateAddress);
userRouter.delete('/address/:addressId', authUser, deleteAddress);

// Recently viewed products
userRouter.post('/recently-viewed', authUser, addToRecentlyViewed);

// User preferences
userRouter.put('/preferences', authUser, updatePreferences);

// Photography-related routes
userRouter.post('/like-photo', authUser, likePhoto);
userRouter.post('/unlike-photo', authUser, unlikePhoto);

export default userRouter;
