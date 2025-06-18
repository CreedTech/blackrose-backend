// import jwt from 'jsonwebtoken';
// import userModel from '../models/userModel.js';

// const authUser = async (req, res, next) => {
//   // const token = req.header('Authorization')?.replace('Bearer ', '');
//   const token = req.headers['authorization']
//     ? req.headers['authorization'].split(' ')[1]
//     : null;

//   if (!token) {
//     return res
//       .status(400)
//       .json({ success: false, message: 'Not Authorized Login Again' });
//   }

//   try {
//     const token_decode = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await userModel.findById(token_decode.id);
//     req.body.userId = token_decode.id;
//     req.user = user;
//     next();
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// export default authUser;

// middleware/auth.js - Update your existing auth middleware
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

// Basic authentication
const authUser = async (req, res, next) => {
  const token = req.headers['authorization']
    ? req.headers['authorization'].split(' ')[1]
    : null;

  if (!token) {
    return res.json({ success: false, message: 'Not Authorized Login Again' });
  }

  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    req.body.userId = token_decode.id;

    // Add user data to request for role checking
    const user = await userModel.findById(token_decode.id);
    req.user = user;

    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Admin authentication (admin or super-admin)
const adminAuth = async (req, res, next) => {
  const token = req.headers['authorization']
    ? req.headers['authorization'].split(' ')[1]
    : null;

  if (!token) {
    return res.json({ success: false, message: 'Not Authorized Login Again' });
  }

  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(token_decode.id);

    if (!user || !user.hasRole(['admin', 'super-admin'])) {
      return res.json({ success: false, message: 'Admin access required' });
    }

    req.body.userId = token_decode.id;
    req.user = user;
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Super admin authentication
const superAdminAuth = async (req, res, next) => {
  const token = req.headers['authorization']
    ? req.headers['authorization'].split(' ')[1]
    : null;

  if (!token) {
    return res.json({ success: false, message: 'Not Authorized Login Again' });
  }

  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(token_decode.id);

    if (!user || !user.hasRole('super-admin')) {
      return res.json({
        success: false,
        message: 'Super admin access required',
      });
    }

    req.body.userId = token_decode.id;
    req.user = user;
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
const requireWriterAccess = async (req, res, next) => {
  const token = req.headers['authorization']
    ? req.headers['authorization'].split(' ')[1]
    : null;

  if (!token) {
    return res.json({ success: false, message: 'Not Authorized' });
  }

  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(token_decode.id);

    if (
      !user ||
      (!user.hasRole(['writer', 'admin', 'super-admin']) &&
        !user.hasPermission('canManageProducts') &&
        !user.hasPermission('canManageOrders') &&
        !user.hasPermission('canManageUsers') &&
        !user.hasPermission('canViewAnalytics') &&
        !user.hasPermission('canUploadPhotos') &&
        !user.hasPermission('canManageMarketing'))
    ) {
      return res.json({ success: false, message: 'Writer access required' });
    }

    req.body.userId = token_decode.id;
    req.user = user;
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
const requirePhotoGrapherAccess = async (req, res, next) => {
  const token = req.headers['authorization']
    ? req.headers['authorization'].split(' ')[1]
    : null;

  if (!token) {
    return res.json({ success: false, message: 'Not Authorized' });
  }

  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(token_decode.id);

    if (
      !user ||
      (!user.hasRole(['photographer', 'admin', 'super-admin']) &&
        !user.hasPermission('canManageProducts') &&
        !user.hasPermission('canManageOrders') &&
        !user.hasPermission('canManageUsers') &&
        !user.hasPermission('canViewAnalytics') &&
        !user.hasPermission('canManageContent') &&
        !user.hasPermission('canManageMarketing'))
    ) {
      return res.json({
        success: false,
        message: 'Photographer access required',
      });
    }

    req.body.userId = token_decode.id;
    req.user = user;
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
const requireMarketerAccess = async (req, res, next) => {
  const token = req.headers['authorization']
    ? req.headers['authorization'].split(' ')[1]
    : null;

  if (!token) {
    return res.json({ success: false, message: 'Not Authorized' });
  }

  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(token_decode.id);

    if (
      !user ||
      (!user.hasRole(['marketer', 'admin', 'super-admin']) &&
        !user.hasPermission('canManageContent') &&
        !user.hasPermission('canManageOrders') &&
        !user.hasPermission('canManageUsers') &&
        !user.hasPermission('canViewAnalytics') &&
        !user.hasPermission('canUploadPhotos'))
    ) {
      return res.json({
        success: false,
        message: 'Marketer access required',
      });
    }

    req.body.userId = token_decode.id;
    req.user = user;
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Permission-based authentication
const requirePermission = (permission) => {
  return async (req, res, next) => {
    const token = req.headers['authorization']
      ? req.headers['authorization'].split(' ')[1]
      : null;

    if (!token) {
      return res.json({
        success: false,
        message: 'Not Authorized Login Again',
      });
    }

    try {
      const token_decode = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userModel.findById(token_decode.id);

      if (!user || !user.hasPermission(permission)) {
        return res.json({
          success: false,
          message: `Permission required: ${permission}`,
        });
      }

      req.body.userId = token_decode.id;
      req.user = user;
      next();
    } catch (error) {
      res.json({ success: false, message: error.message });
    }
  };
};

export {
  authUser,
  adminAuth,
  superAdminAuth,
  requirePermission,
  requireWriterAccess,
  requirePhotoGrapherAccess,
  requireMarketerAccess,
};
