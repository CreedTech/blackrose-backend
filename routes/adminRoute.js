import express from 'express';
import {
  exportMetrics,
  getAnalytics,
  getDashboardStats,
  getMetricsByCustomRange,
  getMetricsByRange,
  getUserMetrics,
  getUsers,
  updateUserRole,
} from '../controllers/adminController.js';
import { adminOnly } from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';

const adminRouter = express.Router();

adminRouter.get('/metrics/users', authUser, adminOnly, getUserMetrics);
adminRouter.get('/metrics/range', authUser, adminOnly, getMetricsByRange);
adminRouter.get('/metrics/custom', authUser, adminOnly, getMetricsByCustomRange);
adminRouter.get('/metrics/export', authUser, adminOnly, exportMetrics);
adminRouter.get('/stats', authUser, adminOnly, getDashboardStats);
adminRouter.get('/analytics', authUser, adminOnly, getAnalytics);
adminRouter.get('/get-users', authUser, adminOnly, getUsers);
adminRouter.patch('/updateRole/:id', authUser, adminOnly, updateUserRole);

export default adminRouter;
