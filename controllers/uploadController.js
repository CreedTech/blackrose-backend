// controllers/uploadController.js
import asyncHandler from 'express-async-handler';
import { v2 as cloudinary } from 'cloudinary';
// import cloudinary from '../config/cloudinaryConfig.js';
// import fs from 'fs';

// @desc    Upload image to Cloudinary
// @route   POST /api/upload
// @access  Private
const uploadImage = asyncHandler(async (req, res) => {
  try {
    // Check if file exists
    if (!req.file) {
      res.status(400);
      throw new Error('Please upload a file');
    }

    // Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'blog',
      width: 1200,
      crop: 'limit',
    });

    // Remove file from local storage after upload
    // fs.unlinkSync(req.file.path);

    // Return success response
    res.status(200).json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    // If an error occurs while uploading, remove the file
    // if (req.file && req.file.path) {
    //   fs.unlinkSync(req.file.path);
    // }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export { uploadImage };
