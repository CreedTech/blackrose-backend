// controllers/blogController.js
import BlogPost from '../models/blogModel.js';
import BlogCategory from '../models/blogCategoryModel.js';
import { v2 as cloudinary } from 'cloudinary';

// Get all blog posts (public)
export const getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 9, category, tag, search } = req.query;
    const skip = (page - 1) * limit;

    let query = { status: 'published' };

    if (category) {
      query.category = category;
    }

    if (tag) {
      query.tags = { $in: [tag] };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const posts = await BlogPost.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'name')
      .select('-content');

    const totalPosts = await BlogPost.countDocuments(query);

    res.status(200).json({
      status: 'success',
      results: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: parseInt(page),
      data: {
        posts,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Get a single blog post by slug (public)
export const getPostBySlug = async (req, res) => {
  try {
    const post = await BlogPost.findOne({
      slug: req.params.slug,
      status: 'published',
    })
      .populate('author', 'name')
      .populate('relatedProducts')
      .populate({
        path: 'relatedPosts',
        select: 'title slug featuredImage category publishedAt',
      });

    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found',
      });
    }

    // Get unique identifier for the viewer
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const viewerId = `${ip}-${userAgent}`;

    // Check if this post has a viewedBy array, if not create it
    if (!post.viewedBy) {
      // Add viewedBy field to your schema if you haven't already
      post.viewedBy = [];
    }

    // Check if this viewer has already viewed the post
    const hasViewed = post.viewedBy.includes(viewerId);

    // Only increment view count for new viewers
    if (!hasViewed) {
      post.views += 1;
      post.viewedBy.push(viewerId);
      await post.save({ validateBeforeSave: false });
    }

    res.status(200).json({
      status: 'success',
      data: {
        post,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Admin: Get all blog posts (including drafts)
export const getAllPostsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const posts = await BlogPost.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'name');

    const totalPosts = await BlogPost.countDocuments(query);

    res.status(200).json({
      status: 'success',
      results: posts.length,
      totalPages: Math.ceil(totalPosts / limit),
      currentPage: parseInt(page),
      data: {
        posts,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Admin: Get a single post by ID
export const getPostById = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id)
      .populate('author', 'name')
      .populate('relatedProducts')
      .populate('relatedPosts');

    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        post,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Admin: Create a new blog post
export const createPost = async (req, res) => {
  try {
    // Handle image upload to Cloudinary if included
    let featuredImage = req.body.featuredImage;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'blog',
      });
      featuredImage = result.secure_url;
    }

    // Create new post
    const newPost = await BlogPost.create({
      ...req.body,
      author: req.user._id,
      featuredImage,
    });

    // if (req.body.status === 'published') {
    //   try {
    //     const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';
    //     await sendNewBlogPostAlert(newPost, adminEmail);
    //   } catch (emailError) {
    //     console.error('Error sending blog post alert:', emailError);
    //   }
    // }
    res.status(201).json({
      status: 'success',
      data: {
        post: newPost,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Admin: Update a blog post
export const updatePost = async (req, res) => {
  try {
    // Handle image upload if included
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'blog',
      });
      req.body.featuredImage = result.secure_url;
    }

    const post = await BlogPost.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('author', 'name');

    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        post,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Admin: Delete a blog post
export const deletePost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found',
      });
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Get blog categories
export const getCategories = async (req, res) => {
  try {
    const categories = await BlogCategory.find();

    res.status(200).json({
      status: 'success',
      results: categories.length,
      data: {
        categories,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Admin: Create a blog category
export const createCategory = async (req, res) => {
  try {
    const newCategory = await BlogCategory.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        category: newCategory,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const category = await BlogCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined) {
        category[key] = req.body[key];
      }
    });

    const updatedCategory = await category.save();
    res.json(updatedCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete category (soft delete)
export const deleteCategory = async (req, res) => {
  try {
    console.log('Deleting category with ID:', req.params.id);

    // Use findByIdAndDelete to directly remove the document
    const deletedCategory = await BlogCategory.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({
      message: 'Category deleted successfully',
      deletedCategory: {
        name: deletedCategory.name,
        id: deletedCategory._id,
      },
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: error.message });
  }
};
