import Activity from '../models/activityModel.js';
import categoryModel from '../models/categoryModel.js';
import Image from '../models/imageModel.js';
import Settings from '../models/settingsModel.js';
import userModel from '../models/userModel.js';
import {
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  format,
  parseISO,
} from 'date-fns';
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import LoginActivity from '../models/loginActivityModel.js';
import Collection from '../models/collectionModel.js';

// Helper function to get date range
const getDateRangeFromType = (type) => {
  const end = new Date();
  let start;

  switch (type) {
    case 'week':
      start = subWeeks(end, 1);
      break;
    case 'month':
      start = subMonths(end, 1);
      break;
    case 'year':
      start = subYears(end, 1);
      break;
    default:
      start = subWeeks(end, 1);
  }

  return { start, end };
};

// Get metrics by date range type
const getMetricsByRange = async (req, res) => {
  try {
    const { range = 'week' } = req.query;
    const { start, end } = getDateRangeFromType(range);

    const metrics = await calculateMetrics(start, end);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get metrics by custom date range
const getMetricsByCustomRange = async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res
        .status(400)
        .json({ message: 'Start and end dates are required' });
    }

    const startDate = parseISO(start);
    const endDate = parseISO(end);

    const metrics = await calculateMetrics(startDate, endDate);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to calculate metrics
const calculateMetrics = async (start, end) => {
  // Get previous period for comparison
  const periodLength = end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - periodLength);
  const previousEnd = start;

  // Calculate all metrics
  const [
    currentPeriodUsers,
    previousPeriodUsers,
    totalUsers,
    activeUsers,
    userActivity,
    dailyActiveUsers,
    retentionData,
  ] = await Promise.all([
    // New users in current period
    userModel.countDocuments({
      createdAt: { $gte: start, $lte: end },
    }),

    // New users in previous period
    userModel.countDocuments({
      createdAt: { $gte: previousStart, $lte: previousEnd },
    }),

    // Total users
    userModel.countDocuments(),

    // Active users
    userModel.countDocuments({
      lastActive: { $gte: start },
    }),

    // User activity by day of week
    Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]),

    // Daily active users
    Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          date: '$_id',
          activeUsers: { $size: '$uniqueUsers' },
        },
      },
      {
        $sort: { date: 1 },
      },
    ]),

    // Retention data
    Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$userId',
          visitCount: { $sum: 1 },
        },
      },
      {
        $match: {
          visitCount: { $gt: 1 },
        },
      },
      {
        $count: 'returnedUsers',
      },
    ]),
  ]);

  // Calculate growth rate
  const userGrowthRate =
    previousPeriodUsers > 0
      ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100
      : 100;

  // Calculate engagement rate
  const averageDailyActiveUsers =
    dailyActiveUsers.reduce((acc, day) => acc + day.activeUsers, 0) /
    dailyActiveUsers.length;
  const engagementRate = (averageDailyActiveUsers / totalUsers) * 100;

  // Calculate retention rate
  const retentionRate =
    ((retentionData[0]?.returnedUsers || 0) / totalUsers) * 100;

  return {
    overview: {
      totalUsers,
      activeUsers,
      newUsers: currentPeriodUsers,
      userGrowthRate: parseFloat(userGrowthRate.toFixed(2)),
      engagementRate: parseFloat(engagementRate.toFixed(2)),
      retentionRate: parseFloat(retentionRate.toFixed(2)),
      mostActiveDay: userActivity[0]?._id,
    },
    trends: {
      dailyActiveUsers,
      activityByDayOfWeek: userActivity,
    },
    period: {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    },
  };
};

// Export metrics
const exportMetrics = async (req, res) => {
  try {
    const { format = 'csv', start, end } = req.query;

    // Get metrics data
    const metrics = await calculateMetrics(
      start ? parseISO(start) : subWeeks(new Date(), 1),
      end ? parseISO(end) : new Date()
    );

    // Prepare data for export
    const exportData = {
      overview: {
        'Total Users': metrics.overview.totalUsers,
        'Active Users': metrics.overview.activeUsers,
        'New Users': metrics.overview.newUsers,
        'Growth Rate': `${metrics.overview.userGrowthRate}%`,
        'Engagement Rate': `${metrics.overview.engagementRate}%`,
        'Retention Rate': `${metrics.overview.retentionRate}%`,
      },
      dailyActiveUsers: metrics.trends.dailyActiveUsers.map((day) => ({
        Date: day.date,
        'Active Users': day.activeUsers,
      })),
      activityByDay: metrics.trends.activityByDayOfWeek.map((day) => ({
        Day: day._id,
        'Activity Count': day.count,
      })),
    };

    // Handle different export formats
    switch (format.toLowerCase()) {
      case 'csv': {
        const parser = new Parser();
        const csv = parser.parse(exportData.overview);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=metrics.csv'
        );
        res.send(csv);
        break;
      }

      case 'excel': {
        const workbook = new ExcelJS.Workbook();

        // Overview sheet
        const overviewSheet = workbook.addWorksheet('Overview');
        overviewSheet.columns = [
          { header: 'Metric', key: 'metric' },
          { header: 'Value', key: 'value' },
        ];
        Object.entries(exportData.overview).forEach(([metric, value]) => {
          overviewSheet.addRow({ metric, value });
        });

        // Daily Active Users sheet
        const dauSheet = workbook.addWorksheet('Daily Active Users');
        dauSheet.columns = [
          { header: 'Date', key: 'date' },
          { header: 'Active Users', key: 'activeUsers' },
        ];
        exportData.dailyActiveUsers.forEach((day) => {
          dauSheet.addRow(day);
        });

        // Activity by Day sheet
        const activitySheet = workbook.addWorksheet('Activity by Day');
        activitySheet.columns = [
          { header: 'Day', key: 'day' },
          { header: 'Activity Count', key: 'count' },
        ];
        exportData.activityByDay.forEach((day) => {
          activitySheet.addRow(day);
        });

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=metrics.xlsx'
        );

        await workbook.xlsx.write(res);
        res.end();
        break;
      }

      default:
        res.json(exportData);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getUserMetrics = async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);
    const previousThirtyDays = subDays(thirtyDaysAgo, 30);

    // Total registered users
    const totalUsers = await userModel.countDocuments();

    // New users in last 30 days
    const newUsers = await userModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // New users in previous 30 days period
    const previousPeriodUsers = await userModel.countDocuments({
      createdAt: {
        $gte: previousThirtyDays,
        $lt: thirtyDaysAgo,
      },
    });

    // Calculate user growth rate
    const userGrowthRate =
      previousPeriodUsers > 0
        ? ((newUsers - previousPeriodUsers) / previousPeriodUsers) * 100
        : 100;

    // Active users (users who logged in within last 7 days)
    const activeUsers = await userModel.countDocuments({
      lastActive: { $gte: subDays(today, 7) },
    });

    // User activity by day of week
    const userActivityByDay = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Convert day numbers to names and find most active day
    const daysOfWeek = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const mostActiveDay = daysOfWeek[userActivityByDay[0]?._id - 1] || 'N/A';

    // Daily active users for the past 30 days
    const dailyActiveUsers = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          date: '$_id',
          activeUsers: { $size: '$uniqueUsers' },
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    // Calculate engagement rate
    const totalActivities = await Activity.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });
    const averageDailyActiveUsers =
      dailyActiveUsers.reduce((acc, day) => acc + day.activeUsers, 0) /
      dailyActiveUsers.length;
    const engagementRate = (averageDailyActiveUsers / totalUsers) * 100;

    // User retention (users who returned after first visit)
    const retentionData = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: '$userId',
          visitCount: { $sum: 1 },
        },
      },
      {
        $match: {
          visitCount: { $gt: 1 },
        },
      },
      {
        $count: 'returnedUsers',
      },
    ]);

    const retentionRate =
      ((retentionData[0]?.returnedUsers || 0) / totalUsers) * 100;

    // New users trend
    const newUsersTrend = await userModel.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        newUsers,
        userGrowthRate: parseFloat(userGrowthRate.toFixed(2)),
        engagementRate: parseFloat(engagementRate.toFixed(2)),
        retentionRate: parseFloat(retentionRate.toFixed(2)),
        mostActiveDay,
      },
      trends: {
        dailyActiveUsers,
        newUsersTrend,
        activityByDayOfWeek: userActivityByDay.map((day) => ({
          day: daysOfWeek[day._id - 1],
          count: day.count,
        })),
      },
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
      .find(query).populate('uploadedPhotos', 'title watermarkedUrl views likeCount')
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

export const getUserDetails = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.params.id)
      .select('-password')
      .populate('uploadedPhotos', 'title watermarkedUrl views likes')
      .populate('likedPhotos', 'title watermarkedUrl')
      .populate('collections', 'name imageCount');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user activity
    const activity = await Activity.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('imageId', 'title');

    // Get login history
    const loginHistory = await LoginActivity.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      user,
      activity,
      loginHistory,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.password; // Don't allow password updates through this route

    const user = await userModel
      .findByIdAndUpdate(req.params.id, updates, { new: true })
      .select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await userModel.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Could add code to handle user's images, collections, etc.

    res.json({ message: 'User deleted successfully' });
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

// export const getDashboardStats = async (req, res) => {
//   try {
//     const stats = {
//       totalUsers: await userModel.countDocuments(),
//       totalImages: await Image.countDocuments(),
//       totalCategories: await Category.countDocuments(),
//       totalCollections: await Collection.countDocuments(),
//       totalViews: await Image.aggregate([
//         { $group: { _id: null, totalViews: { $sum: '$views' } } }
//       ]).then(result => (result.length > 0 ? result[0].totalViews : 0)),
//       totalDownloads: await Image.aggregate([
//         { $group: { _id: null, totalDownloads: { $sum: '$downloads' } } }
//       ]).then(result => (result.length > 0 ? result[0].totalDownloads : 0)),
//       recentActivity: await Activity.find()
//         .sort({ createdAt: -1 })
//         .limit(10)
//         .populate('userId', 'name email')
//         .populate('imageId', 'title'),
//       topImages: await Image.find()
//         .sort({ views: -1 })
//         .limit(5)
//         .select('title watermarkedUrl views downloads')
//         .populate('photographer', 'name')
//     };

//     res.json(stats);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// controllers/adminMetricsController.js
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = await Promise.all([
      // User stats
      userModel.countDocuments(),
      userModel.countDocuments({ createdAt: { $gte: lastWeek } }),
      userModel.countDocuments({ createdAt: { $gte: lastMonth } }),

      // Image stats
      Image.countDocuments(),
      Image.countDocuments({ createdAt: { $gte: lastWeek } }),

      // Total views and downloads
      Image.aggregate([
        {
          $group: {
            _id: null,
            totalViews: { $sum: '$views' },
            totalDownloads: { $sum: '$downloads' },
            totalLikes: { $sum: { $size: '$likes' } },
          },
        },
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

      // Most popular photos
      Image.aggregate([
        {
          $project: {
            title: 1,
            views: 1,
            downloads: 1,
            likes: { $size: '$likes' },
            watermarkedUrl: 1,
            category: 1,
            photographer: 1,
            score: {
              $add: [
                '$views',
                { $multiply: ['$downloads', 2] },
                { $multiply: [{ $size: '$likes' }, 3] },
              ],
            },
          },
        },
        { $sort: { score: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'photographer',
            foreignField: '_id',
            as: 'photographer',
          },
        },
        {
          $unwind: '$category',
        },
        {
          $unwind: '$photographer',
        },
      ]),
    ]);

    // Calculate growth rates
    const monthlyUserGrowth = (stats[1] / stats[2] - 1) * 100;

    res.json({
      users: {
        total: stats[0],
        new: stats[1],
        growth: monthlyUserGrowth.toFixed(1),
      },
      images: {
        total: stats[3],
        new: stats[4],
      },
      engagement: {
        views: stats[5][0]?.totalViews || 0,
        downloads: stats[5][0]?.totalDownloads || 0,
        likes: stats[5][0]?.totalLikes || 0,
      },
      categoryDistribution: stats[6],
      popularPhotos: stats[7],
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// const getAnalytics = async (req, res) => {
//   try {
//     const { range = 'week', type = 'all' } = req.query;
//     const today = new Date();
//     let startDate;

//     switch (range) {
//       case 'month':
//         startDate = new Date(today.setMonth(today.getMonth() - 1));
//         break;
//       case 'year':
//         startDate = new Date(today.setFullYear(today.getFullYear() - 1));
//         break;
//       default: // week
//         startDate = new Date(today.setDate(today.getDate() - 7));
//     }

//     // Get metrics based on type
//     let metrics;
//     switch (type) {
//       case 'users':
//         metrics = await getUserMetric(startDate);
//         break;
//       case 'content':
//         metrics = await getContentMetrics(startDate);
//         break;
//       case 'engagement':
//         metrics = await getEngagementMetrics(startDate);
//         break;
//       default:
//         metrics = await getUserMetric(startDate);
//     }

//     res.json(metrics);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // Helper functions for different metric types
// const getUserMetric = async (startDate) => {
//   console.log(startDate);
//   const metric = await userModel.aggregate([
//     {
//       $match: {
//         createdAt: { $gte: startDate },
//       },
//     },
//     {
//       $group: {
//         _id: {
//           $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
//         },
//         newUsers: { $sum: 1 },
//         activeUsers: {
//           $sum: {
//             $cond: [{ $gte: ['$lastActive', startDate] }, 1, 0],
//           },
//         },
//       },
//     },
//     { $sort: { _id: 1 } },
//   ]);
//   console.log(metric);
//   return await userModel.aggregate([
//     {
//       $match: {
//         createdAt: { $gte: startDate },
//       },
//     },
//     {
//       $group: {
//         _id: {
//           $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
//         },
//         newUsers: { $sum: 1 },
//         activeUsers: {
//           $sum: {
//             $cond: [{ $gte: ['$lastActive', startDate] }, 1, 0],
//           },
//         },
//       },
//     },
//     { $sort: { _id: 1 } },
//   ]);
// };

// const getContentMetrics = async (startDate) => {
//   return await Image.aggregate([
//     {
//       $match: {
//         createdAt: { $gte: startDate },
//       },
//     },
//     {
//       $group: {
//         _id: {
//           $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
//         },
//         uploads: { $sum: 1 },
//         views: { $sum: '$views' },
//         downloads: { $sum: '$downloads' },
//         likes: { $sum: { $size: '$likes' } },
//       },
//     },
//     { $sort: { _id: 1 } },
//   ]);
// };

// const getEngagementMetrics = async (startDate) => {
//   return await Activity.aggregate([
//     {
//       $match: {
//         createdAt: { $gte: startDate },
//       },
//     },
//     {
//       $group: {
//         _id: {
//           $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
//         },
//         totalActivities: { $sum: 1 },
//         uniqueUsers: { $addToSet: '$userId' },
//       },
//     },
//     {
//       $project: {
//         date: '$_id',
//         totalActivities: 1,
//         uniqueUsers: { $size: '$uniqueUsers' },
//       },
//     },
//     { $sort: { _id: 1 } },
//   ]);
// };

const getAnalytics = async (req, res) => {
  try {
    const { range = 'week', type = 'all' } = req.query;
    const today = new Date();
    let startDate;

    // Ensure we're working with the start of the day
    today.setHours(0, 0, 0, 0);

    switch (range) {
      case 'month':
        startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(today);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default: // week
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
    }

    // Generate date range array for complete data
    const dateRange = [];
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      dateRange.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let analyticsData;

    switch (type) {
      case 'users':
        analyticsData = await getUserMetric(startDate, dateRange);
        break;
      case 'content':
        analyticsData = await getContentMetrics(startDate, dateRange);
        break;
      case 'engagement':
        analyticsData = await getEngagementMetrics(startDate, dateRange);
        break;
      default:
        // Get all metrics
        const [userMetrics, contentMetrics, engagementMetrics] =
          await Promise.all([
            getUserMetric(startDate, dateRange),
            getContentMetrics(startDate, dateRange),
            getEngagementMetrics(startDate, dateRange),
          ]);

        // Combine all metrics
        analyticsData = dateRange.map((date) => ({
          date,
          ...(userMetrics.find((m) => m.date === date) || {
            newUsers: 0,
            activeUsers: 0,
          }),
          ...(contentMetrics.find((m) => m.date === date) || {
            uploads: 0,
            views: 0,
            downloads: 0,
          }),
          ...(engagementMetrics.find((m) => m.date === date) || {
            totalActivities: 0,
            uniqueUsers: 0,
          }),
        }));
    }

    res.json({
      timeRange: range,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
      data: analyticsData,
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getUserMetric = async (startDate, dateRange) => {
  const metrics = await userModel.aggregate([
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
        newUsers: { $sum: 1 },
        activeUsers: {
          $sum: {
            $cond: [{ $gte: ['$lastActive', startDate] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        date: '$_id',
        newUsers: 1,
        activeUsers: 1,
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ]);

  // Fill in missing dates with zero values
  return dateRange.map((date) => ({
    date,
    ...(metrics.find((m) => m.date === date) || {
      newUsers: 0,
      activeUsers: 0,
    }),
  }));
};

const getContentMetrics = async (startDate, dateRange) => {
  const metrics = await Image.aggregate([
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
        uploads: { $sum: 1 },
        views: { $sum: '$views' },
        downloads: { $sum: '$downloads' },
        likes: { $sum: { $size: '$likes' } },
      },
    },
    {
      $project: {
        date: '$_id',
        uploads: 1,
        views: 1,
        downloads: 1,
        likes: 1,
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ]);

  return dateRange.map((date) => ({
    date,
    ...(metrics.find((m) => m.date === date) || {
      uploads: 0,
      views: 0,
      downloads: 0,
      likes: 0,
    }),
  }));
};

const getEngagementMetrics = async (startDate, dateRange) => {
  const metrics = await Activity.aggregate([
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
        totalActivities: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
      },
    },
    {
      $project: {
        date: '$_id',
        totalActivities: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ]);

  return dateRange.map((date) => ({
    date,
    ...(metrics.find((m) => m.date === date) || {
      totalActivities: 0,
      uniqueUsers: 0,
    }),
  }));
};

// Image management
export const getImages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const category = req.query.category;
    const sort = req.query.sort || '-createdAt';

    let query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }

    const images = await Image.find(query)
      .populate('photographer', 'name email')
      .populate('category', 'title')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort(sort);

    const total = await Image.countDocuments(query);

    res.json({
      images,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getImageDetails = async (req, res) => {
  try {
    const image = await Image.findById(req.params.id)
      .populate('photographer', 'name email')
      .populate('category', 'title')
      .populate('likes', 'name email');

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.json(image);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateImage = async (req, res) => {
  try {
    const updates = { ...req.body };

    // Convert tags from string to array if provided as string
    if (typeof updates.tags === 'string') {
      updates.tags = updates.tags.split(',').map((tag) => tag.trim());
    }

    const image = await Image.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    })
      .populate('photographer', 'name email')
      .populate('category', 'title');

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.json(image);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteImage = async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Remove from collections
    await Collection.updateMany(
      { images: image._id },
      { $pull: { images: image._id } }
    );

    // Remove from user's uploaded photos
    await userModel.updateMany(
      { uploadedPhotos: image._id },
      { $pull: { uploadedPhotos: image._id } }
    );

    // Remove from user's liked photos
    await userModel.updateMany(
      { likedPhotos: image._id },
      { $pull: { likedPhotos: image._id } }
    );

    // Delete image document
    await image.deleteOne();

    // Actually delete from cloudinary
    // cloudinary.uploader.destroy(image.publicId);

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: error.message });
  }
};

export const toggleFeatureImage = async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    image.featured = !image.featured;
    await image.save();

    res.json({ featured: image.featured });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1, title: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Already implemented in your categoryController
export const createCategory = async (req, res) => {
  // Use your existing implementation
};

export const updateCategory = async (req, res) => {
  // Use your existing implementation
};

export const deleteCategory = async (req, res) => {
  // Use your existing implementation
};

// Activity logs
export const getActivityLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type;
    const userId = req.query.userId;

    let query = {};

    if (type) {
      query.type = type;
    }

    if (userId) {
      query.userId = userId;
    }

    const activities = await Activity.find(query)
      .populate('userId', 'name email')
      .populate('imageId', 'title watermarkedUrl')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Activity.countDocuments(query);

    res.json({
      activities,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// controllers/adminController.js (add this function)

const getPhotoStats = async (req, res) => {
  try {
    // Fetch all the necessary stats in parallel
    const [
      totalPhotos,
      // pendingPhotos,
      mostPopularPhoto,
      // totalRevenue,
      // More complex query for 30-day growth
      previousPeriodPhotos,
      currentPeriodPhotos,
    ] = await Promise.all([
      Image.countDocuments(),
      // Image.countDocuments({ status: 'pending' }),
      Image.findOne().sort({ views: -1 }).select('title views'),
      // If you have a revenue collection or field
      // Otherwise you might need to calculate this from orders or payment records
      0, // Placeholder if you don't have this data yet

      // Photos uploaded in previous 30 days
      Image.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      }),
      // Photos uploaded in last 30 days
      Image.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    // Calculate growth rate
    const growthRate =
      previousPeriodPhotos > 0
        ? ((currentPeriodPhotos - previousPeriodPhotos) /
            previousPeriodPhotos) *
          100
        : 100;

    // Format response
    res.json({
      totalPhotos,
      // pendingApprovals: pendingPhotos,
      mostPopular: mostPopularPhoto
        ? {
            title: mostPopularPhoto.title,
            views: mostPopularPhoto.views,
          }
        : { title: 'N/A', views: 0 },
      // earnings: totalRevenue,
      growthRate: growthRate.toFixed(1),
    });
  } catch (error) {
    console.error('Error fetching photo stats:', error);
    res.status(500).json({ message: error.message });
  }
};
export {
  getMetricsByRange,
  getMetricsByCustomRange,
  exportMetrics,
  getUserMetrics,
  getDashboardStats,
  getAnalytics,
  getUsers,
  updateUserRole,
  getSettings,
  updateSettings,
  getPhotoStats
};
