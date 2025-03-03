// Enhanced version of activityTracking.js with more detailed tracking
import Activity from '../models/activityModel.js';
import { promisify } from 'util';
// import redis from '../config/redis.js';

// const getAsync = promisify(redis.get).bind(redis);
// const setAsync = promisify(redis.set).bind(redis);

export const trackUserActivity = async (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const responseTime = Date.now() - startTime;

    // Track the activity after response is sent
    process.nextTick(async () => {
      try {
        if (req.user) {
          // Basic activity data
          const activity = {
            userId: req.user._id,
            type: getActivityType(req),
            metadata: {
              ip: req.ip,
              userAgent: req.headers['user-agent'],
              path: req.path,
              method: req.method,
              responseTime,
              statusCode: res.statusCode,
              referer: req.headers.referer || '',
              query: req.query,
            },
          };

          // Add image-specific data
          if (req.params.imageId) {
            activity.imageId = req.params.imageId;
            activity.metadata.imageAction = req.method;
          }

          // Add search-specific data
          if (req.query.search) {
            activity.metadata.searchQuery = req.query.search;
          }

          // Track session data
          //   const sessionKey = `session:${req.user._id}`;
          //   const sessionData = await getAsync(sessionKey);
          //   if (sessionData) {
          //     const session = JSON.parse(sessionData);
          //     activity.metadata.sessionDuration = Date.now() - session.startTime;
          //     activity.metadata.sessionPageViews = session.pageViews + 1;

          //     await setAsync(sessionKey, JSON.stringify({
          //       ...session,
          //       pageViews: session.pageViews + 1,
          //       lastActivity: Date.now()
          //     }));
          //   } else {
          //     await setAsync(sessionKey, JSON.stringify({
          //       startTime: Date.now(),
          //       pageViews: 1,
          //       lastActivity: Date.now()
          //     }));
          //   }

          // Save activity
          await Activity.create(activity);

          // Update user's last active timestamp
          await req.user.updateOne({
            $set: { lastActive: new Date() },
            $inc: { totalActivities: 1 },
          });
        }
      } catch (error) {
        console.error('Activity tracking error:', error);
      }
    });

    originalSend.apply(res, arguments);
  };

  next();
};

const getActivityType = (req) => {
  // Enhanced activity type detection
  const path = req.path.toLowerCase();
  const method = req.method;

  // Image related activities
  if (path.includes('/images')) {
    if (method === 'GET') return 'view';
    if (method === 'POST') return 'upload';
    if (method === 'PUT') return 'edit';
    if (method === 'DELETE') return 'delete';
  }

  // User related activities
  if (path.includes('/users')) {
    if (path.includes('/profile')) return 'profile_update';
    if (path.includes('/settings')) return 'settings_update';
  }

  // Collection related activities
  if (path.includes('/collections')) {
    if (method === 'POST') return 'collection_create';
    if (method === 'PUT') return 'collection_update';
    if (path.includes('/add')) return 'collection_add';
    if (path.includes('/remove')) return 'collection_remove';
  }

  // Interaction activities
  if (path.includes('/like')) return 'like';
  if (path.includes('/comment')) return 'comment';
  if (path.includes('/share')) return 'share';
  if (path.includes('/download')) return 'download';

  // Search activities
  if (path.includes('/search')) return 'search';

  return 'other';
};
