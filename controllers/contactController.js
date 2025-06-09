import contactModel from '../models/contactModel.js';
import { sendContactConfirmation, sendContactFormNotification } from '../utils/emailService.js';
import validator from 'validator';

export const submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validation
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Validate email
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // Validate message length
    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message is too long. Please keep it under 2000 characters.',
      });
    }

    // Check for spam (simple rate limiting by IP)
    const clientIP = req.ip || req.connection.remoteAddress;
    const recentSubmissions = await contactModel.find({
      ipAddress: clientIP,
      createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) }, // 10 minutes
    });

    if (recentSubmissions.length >= 3) {
      return res.status(429).json({
        success: false,
        message:
          'Too many submissions. Please wait before sending another message.',
      });
    }

    // Create contact submission
    const contact = new contactModel({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      subject: subject.trim(),
      message: message.trim(),
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
    });

    await contact.save();

    // Send emails
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';

      // Send notification to admin
      await sendContactFormNotification(contact, adminEmail);

      // Send confirmation to user
      await sendContactConfirmation(contact);

      console.log(`Contact form submitted by ${name} (${email})`);
    } catch (emailError) {
      console.error('Error sending contact emails:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.',
      referenceId: contact._id.toString().slice(-8).toUpperCase(),
    });
  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({
      success: false,
      message:
        'An error occurred while sending your message. Please try again.',
    });
  }
};

// Get all contacts (Admin only)
export const getAllContacts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const contacts = await contactModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('repliedBy', 'name email');

    const totalContacts = await contactModel.countDocuments(query);
    const totalPages = Math.ceil(totalContacts / Number(limit));

    res.json({
      success: true,
      contacts,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalContacts,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contacts',
    });
  }
};

// Get single contact (Admin only)
export const getContact = async (req, res) => {
  try {
    const { contactId } = req.params;

    const contact = await contactModel
      .findById(contactId)
      .populate('repliedBy', 'name email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
    }

    // Mark as read if it was new
    if (contact.status === 'new') {
      contact.status = 'read';
      await contact.save();
    }

    res.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contact',
    });
  }
};

// controllers/contactController.js (continued)

// Update contact status (Admin only)
export const updateContactStatus = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['new', 'read', 'replied', 'archived'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const contact = await contactModel.findByIdAndUpdate(
      contactId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
    }

    res.json({
      success: true,
      message: 'Contact updated successfully',
      contact,
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact',
    });
  }
};

// Reply to contact (Admin only)
export const replyToContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { replyMessage } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply message is required',
      });
    }

    const contact = await contactModel.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
    }

    // Update contact status
    contact.status = 'replied';
    contact.replied = true;
    contact.repliedAt = new Date();
    contact.repliedBy = req.user._id;
    await contact.save();

    // Send reply email
    try {
      const { sendAdminContactReply } = await import(
        '../services/emailService.js'
      );
      await sendAdminContactReply(contact, replyMessage.trim(), req.user.name);

      console.log(`Reply sent to ${contact.email} for contact ${contactId}`);
    } catch (emailError) {
      console.error('Error sending reply email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send reply email',
      });
    }

    res.json({
      success: true,
      message: 'Reply sent successfully',
      contact,
    });
  } catch (error) {
    console.error('Reply to contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply',
    });
  }
};

// Delete contact (Admin only)
export const deleteContact = async (req, res) => {
  try {
    const { contactId } = req.params;

    const contact = await contactModel.findByIdAndDelete(contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact',
    });
  }
};

// Get contact statistics (Admin only)
export const getContactStats = async (req, res) => {
  try {
    const stats = await contactModel.aggregate([
      {
        $facet: {
          statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          totalContacts: [{ $count: 'total' }],
          recentContacts: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            },
            { $count: 'recent' },
          ],
          monthlyStats: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 },
          ],
        },
      },
    ]);

    const result = stats[0];

    // Format status counts
    const statusCounts = {};
    result.statusCounts.forEach((item) => {
      statusCounts[item._id] = item.count;
    });

    res.json({
      success: true,
      stats: {
        total: result.totalContacts[0]?.total || 0,
        recent: result.recentContacts[0]?.recent || 0,
        statusCounts,
        monthlyStats: result.monthlyStats,
      },
    });
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contact statistics',
    });
  }
};
