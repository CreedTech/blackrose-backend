// models/blogModel.js
import mongoose from 'mongoose';
import slugify from 'slugify';

const blogPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A blog post must have a title'],
      trim: true,
      maxlength: [100, 'A blog post title cannot exceed 100 characters'],
    },
    slug: String,
    subtitle: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'A blog post must have content'],
    },
    featuredImage: {
      type: String,
      required: [true, 'A blog post must have a featured image'],
    },
    category: {
      type: String,
      required: [true, 'A blog post must have a category'],
      enum: [
        'Lifestyle',
        'Wedding',
        'Family',
        'Travel',
        'Photography',
        'Wellness',
        'Model',
      ],
    },
    tags: [String],
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: [true, 'A blog post must have an author'],
    },
    relatedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
      },
    ],
    metaDescription: String,
    relatedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BlogPost',
      },
    ],
    publishedAt: Date,
    views: {
      type: Number,
      default: 0,
    },
    viewedBy: {
      type: [String],
      default: [],
    },
    likes: {
      type: Number,
      default: 0,
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'user',
        },
        name: String,
        email: String,
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
        isApproved: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create slug before saving
blogPostSchema.pre('save', function (next) {
  this.slug = slugify(this.title, { lower: true });

  if (
    this.isModified('status') &&
    this.status === 'published' &&
    !this.publishedAt
  ) {
    this.publishedAt = Date.now();
  }

  next();
});

const BlogPost = mongoose.model('BlogPost', blogPostSchema);

export default BlogPost;
