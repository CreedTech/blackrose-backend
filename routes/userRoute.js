import express from 'express';
import {
  loginUser,
  registerUser,
  adminLogin,
  getMe,
} from '../controllers/userController.js';
import authUser from '../middleware/auth.js';

const userRouter = express.Router();

userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);
userRouter.post('/admin', adminLogin);
userRouter.get('/me', authUser, getMe);

export default userRouter;
