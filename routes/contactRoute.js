// routes/contactRoute.js
import express from 'express';
import {
  submitContactForm,
  getAllContacts,
  getContact,
  updateContactStatus,
  replyToContact,
  deleteContact,
  getContactStats,
} from '../controllers/contactController.js';
import authUser from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminAuth.js';

const contactRouter = express.Router();

// Public routes
contactRouter.post('/submit', submitContactForm);

// Admin routes
contactRouter.get('/admin', authUser, adminOnly, getAllContacts);
contactRouter.get('/admin/stats', authUser, adminOnly, getContactStats);
contactRouter.get('/admin/:contactId', authUser, adminOnly, getContact);
contactRouter.put(
  '/admin/:contactId',
  authUser,
  adminOnly,
  updateContactStatus
);
contactRouter.post(
  '/admin/:contactId/reply',
  authUser,
  adminOnly,
  replyToContact
);
contactRouter.delete('/admin/:contactId', authUser, adminOnly, deleteContact);

export default contactRouter;
