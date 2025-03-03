import express from 'express';
import {
  getAnalytics,
  getDashboardStats,
  getUsers,
  updateUserRole,
} from '../controllers/adminController.js';
import { adminOnly } from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';

const adminRouter = express.Router();

adminRouter.get('/stats', authUser, adminOnly, getDashboardStats);
adminRouter.get('/analytics', authUser, adminOnly, getAnalytics);
adminRouter.get('/get-users', authUser, adminOnly, getUsers);
adminRouter.patch('/updateRole/:id', authUser, adminOnly, updateUserRole);

export default adminRouter;
