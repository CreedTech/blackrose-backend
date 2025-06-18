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
import { adminAuth, authUser } from '../middleware/auth.js';

const contactRouter = express.Router();

// Public routes
contactRouter.post('/submit', submitContactForm);

// Admin routes
contactRouter.get('/admin', adminAuth, getAllContacts);
contactRouter.get('/admin/stats', adminAuth, getContactStats);
contactRouter.get('/admin/:contactId', adminAuth, getContact);
contactRouter.put('/admin/:contactId', adminAuth, updateContactStatus);
contactRouter.post('/admin/:contactId/reply', adminAuth, replyToContact);
contactRouter.delete('/admin/:contactId', adminAuth, deleteContact);

export default contactRouter;
