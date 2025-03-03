import Image from '../models/imageModel.js';
import { v2 as cloudinary } from 'cloudinary';
import jwt from 'jsonwebtoken';
import path from 'path'; // If you're using ES module syntax
import fs from 'fs';

import userModel from '../models/userModel.js';
import sharp from 'sharp';
import { Readable } from 'stream';
import Collection from '../models/collectionModel.js';

// const watermarkPath = 'assets/water_mark.png';

// Ensure watermark image is in correct path
const watermarkPath = path.resolve('assets', 'water_mark.png');

const processAndUploadImage = async (file) => {
  try {
    // Upload original image to Cloudinary
    const originalResult = await cloudinary.uploader.upload(file.path, {
      folder: 'originals',
    });

    // Load the watermark image and resize it to match original image dimensions
    const originalImageMetadata = await sharp(file.path).metadata();
    const resizedWatermark = await sharp(watermarkPath)
      .resize({
        width: originalImageMetadata.width,
        height: originalImageMetadata.height,
        fit: sharp.fit.cover,
      })
      .toBuffer();

    // Create watermarked version of the image
    const watermarkedImage = await sharp(file.path)
      .composite([
        {
          input: resizedWatermark, // Resized watermark
          gravity: 'center',
          blend: 'over',
        },
      ])
      .toBuffer();

    // Convert the watermarked buffer into a readable stream
    const watermarkedStream = Readable.from(watermarkedImage);

    // Upload the watermarked image as a stream to Cloudinary
    const watermarkedResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'watermarked',
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve(result);
        }
      );
      // Pipe the watermarked stream to Cloudinary
      watermarkedStream.pipe(uploadStream);
    });

    return {
      originalUrl: originalResult.secure_url,
      watermarkedUrl: watermarkedResult.secure_url,
      publicId: originalResult.public_id,
    };
  } catch (error) {
    console.error('Error in processAndUploadImage:', error);
    throw error;
  }
};
const getImages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const category = req.query.category;
    const search = req.query.search;

    let query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const images = await Image.find(query)
      .select('-originalUrl -publicId') // Exclude fields here
      .populate('photographer', 'name')
      .populate('category', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(); // Ensure images are plain JavaScript objects

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
const getSingleImage = async (req, res) => {
  // Handle token check locally here for this route only
  const token = req.headers['authorization']
    ? req.headers['authorization'].split(' ')[1]
    : null;

  try {
    // If there is a token, try to authenticate and get the user
    if (token) {
      const token_decode = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userModel.findById(token_decode.id);
      req.user = user; // Attach the authenticated user to the request
    } else {
      req.user = null; // Guest user (no token)
    }

    // Now fetch the image data
    const image = await Image.findById(req.params.id)
      .select('-originalUrl -publicId')
      .populate('photographer', 'name')
      .populate('category')
      .populate({
        path: 'likes',
        select: 'name',
      });

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Increment view count
    image.views += 1;
    await image.save();

    // Determine if the user (or guest) has liked the image
    const isLiked = req?.user
      ? image.likes.some((like) => like._id.equals(req.user._id))
      : false;

    // Return different data based on whether the user is authenticated or not
    const responseData = {
      ...image.toObject(),
      isLiked,
      downloadUrl: req.user ? image.downloadUrl : null,
      originalUrl: req.user ? image.originalUrl : null,
      url: image.watermarkedUrl,
      title: image.title,
      description: image.description,
      category: image.category,
      tags: image.tags,
      views: image.views,
      likeCount: image.likes.length,
      photographer: {
        name: image.photographer.name,
      },
    };

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const postImage = async (req, res) => {
  console.log('eq.user');
  console.log(req.file);
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }
    const { originalUrl, watermarkedUrl, publicId } =
      await processAndUploadImage(req.file);

    // Create tags array from string
    const tags = req.body.tags
      ? req.body.tags.split(',').map((tag) => tag.trim())
      : [];

    const image = new Image({
      photographer: req.user._id,
      title: req.body.title,
      description: req.body.description,
      originalUrl,
      watermarkedUrl,
      publicId,
      category: req.body.category,
      tags: tags,
    });

    await image.save();

    // Update user's uploadedPhotos
    await userModel.findByIdAndUpdate(req.user._id, {
      $push: { uploadedPhotos: image._id },
    });
    res.status(201).json(image);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Download original image (requires authentication)
// router.get('/gallery/:id/download', auth,
const downloadImage = async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    if (!image.originalUrl) {
      return res.status(500).json({ message: 'Image URL is missing' });
    }

    // Set headers to trigger download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${image.title}.jpg"`
    );

    // Stream the image from Cloudinary to the user
    const response = await fetch(image.originalUrl);
    const imageBuffer = await response.arrayBuffer();

    res.send(Buffer.from(imageBuffer));

    // Track download count
    image.downloads = (image.downloads || 0) + 1;
    await image.save();
  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).json({ message: error.message });
  }
};

const searchImage = async (req, res) => {
  try {
    const { q, category, tags, page = 1, limit = 12 } = req.query;

    let query = {};

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (tags) {
      query.tags = { $in: tags.split(',').map((tag) => tag.trim()) };
    }

    const images = await Image.find(query)
      .populate('photographer', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

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

const postImageView = async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Increment total views
    image.views += 1;

    // If user is logged in, track unique views
    if (req.user) {
      const hasViewed = image.viewedBy.some(
        (view) => view.user.toString() === req.user._id.toString()
      );

      if (!hasViewed) {
        image.viewedBy.push({ user: req.user._id });
        image.uniqueViews += 1;
      }
    }

    await image.save();
    res.json({ views: image.views, uniqueViews: image.uniqueViews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Like/Unlike an image
const postLike = async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Use .equals() to compare ObjectIds
    const userIndex = image.likes.findIndex((like) =>
      like.equals(req.user._id)
    );

    if (userIndex === -1) {
      // Like
      image.likes.push(req.user._id);
      image.likeCount += 1;
    } else {
      // Unlike
      image.likes.splice(userIndex, 1);
      image.likeCount -= 1;
    }

    await image.save();
    console.log('Response Data:', {
      likes: image.likeCount,
      isLiked: userIndex === -1,
    });
    res.json({ likes: image.likeCount, isLiked: userIndex === -1 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCollections = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const collections = await Collection.find({ owner: req.user._id })
      .populate('images', '_id watermarkedUrl title')
      // .select('name imageCount updatedAt')
      .sort({ updatedAt: -1 });
    if (!collections.length) {
      return res.status(404).json({ message: 'No collections found' });
    }

    res.json(collections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCollection = async (req, res) => {
  try {
    const collection = new Collection({
      name: req.body.name,
      //   description: req.body.description,
      owner: req.user._id,
      isPrivate: req.body.isPrivate || false,
    });

    await collection.save();
    res.status(201).json(collection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
// Add image to collection
const addToCollection = async (req, res) => {
  try {
    const collection = await Collection.findOne({
      _id: req.params.collectionId,
      owner: req.user._id,
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    const image = await Image.findById(req.body.imageId);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Check if image is already in collection
    if (collection.images.includes(image._id)) {
      return res.status(400).json({ message: 'Image already in collection' });
    }

    collection.images.push(image._id);
    await collection.save();

    res.json(collection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteFromCollection = async (req, res) => {
  try {
    const collection = await Collection.findOne({
      _id: req.params.collectionId,
      owner: req.user._id,
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    collection.images = collection.images.filter(
      (id) => id.toString() !== req.params.imageId
    );

    await collection.save();
    res.json(collection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get collection details
const getCollectionDetails = async (req, res) => {
  try {
    const collection = await Collection.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).populate('images', 'url title');

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    res.json(collection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  postImage,
  getImages,
  getSingleImage,
  searchImage,
  postImageView,
  postLike,
  downloadImage,
  getCollections,
  createCollection,
  addToCollection,
  deleteFromCollection,
  getCollectionDetails,
};
