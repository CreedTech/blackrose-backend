// models/blogCategoryModel.js
import mongoose from 'mongoose';
import slugify from 'slugify';

const blogCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A category must have a name'],
      unique: true,
      trim: true,
    },
    slug: String,
    description: String,
    featuredImage: String,
  },
  {
    timestamps: true,
  }
);

blogCategorySchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

const BlogCategory = mongoose.model('BlogCategory', blogCategorySchema);

export default BlogCategory;
