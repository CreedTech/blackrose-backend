import categoryModel from '../models/categoryModel.js';
import imageModel from '../models/imageModel.js';
import Settings from '../models/settingsModel.js';
import userModel from '../models/userModel.js';

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = await Promise.all([
      // Total users
      userModel.countDocuments(),
      // New users this week
      userModel.countDocuments({ createdAt: { $gte: lastWeek } }),
      // Total images
      imageModel.countDocuments(),
      // New images this week
      imageModel.countDocuments({ createdAt: { $gte: lastWeek } }),
      // Total views
      imageModel.aggregate([
        { $group: { _id: null, totalViews: { $sum: '$views' } } },
      ]),
      // Total downloads
      imageModel.aggregate([
        { $group: { _id: null, totalDownloads: { $sum: '$downloads' } } },
      ]),
      // Category distribution
      categoryModel.aggregate([
        {
          $lookup: {
            from: 'images',
            localField: '_id',
            foreignField: 'category',
            as: 'images',
          },
        },
        {
          $project: {
            title: 1,
            imageCount: { $size: '$images' },
          },
        },
      ]),
    ]);

    res.json({
      users: {
        total: stats[0],
        new: stats[1],
      },
      images: {
        total: stats[2],
        new: stats[3],
      },
      views: stats[4][0]?.totalViews || 0,
      downloads: stats[5][0]?.totalDownloads || 0,
      categoryDistribution: stats[6],
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const { range = 'week' } = req.query;
    const today = new Date();
    let startDate;

    switch (range) {
      case 'month':
        startDate = new Date(today.setMonth(today.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(today.setFullYear(today.getFullYear() - 1));
        break;
      default: // week
        startDate = new Date(today.setDate(today.getDate() - 7));
    }

    const analyticsData = await imageModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          views: { $sum: '$views' },
          downloads: { $sum: '$downloads' },
          uploads: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get user activity
    const userActivity = await userModel.aggregate([
      {
        $match: {
          lastActive: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$lastActive' },
          },
          activeUsers: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.json({
      analytics: analyticsData,
      userActivity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;
    const role = req.query.role;

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) {
      query.role = role;
    }

    const users = await userModel
      .find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await userModel.countDocuments(query);

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUserRole = async (req, res) => {
  console.log(req.params);
  try {
    const { isAdmin } = req.body;
    const user = await userModel
      .findByIdAndUpdate(req.params.id, { isAdmin }, { new: true })
      .select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Settings Management
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        siteName: 'Photo Gallery',
        siteDescription: 'A beautiful photo gallery',
        maxUploadSize: 10,
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif'],
        enableWatermark: true,
        watermarkOpacity: 50,
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate({}, req.body, {
      new: true,
      upsert: true,
    });
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export {
  getDashboardStats,
  getAnalytics,
  getUsers,
  updateUserRole,
  getSettings,
  updateSettings,
};
