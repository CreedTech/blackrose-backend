
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },

    // Enhanced for photography equipment hierarchy
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    level: {
      type: Number,
      default: 0, // 0 = main category, 1 = subcategory, etc.
    },

    // Photography-specific category types
    categoryType: {
      type: String,
      enum: [
        'Equipment',
        'Accessories',
        'Lighting',
        'Backdrops',
        'Props',
        'Camera Gear',
        'Post-Processing',
        'Storage',
        'Bundles',
      ],
    },

    // Applicable product types for this category
    applicableProductTypes: [
      {
        type: String,
        enum: [
          'Backdrop',
          'Camera Case',
          'Paper Fan',
          'Lighting Gear',
          'Product Photography Prop',
          'Tripod',
          'Clamp / Holder',
          'Surface Mat',
          'Diffuser',
          'Reflector',
          'Camera',
          'Lens',
          'Studio Kit',
          'Bundle',
        ],
      },
    ],

    featured: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },

    // SEO enhancements
    seoTitle: String,
    seoDescription: String,
    seoKeywords: [String],

    // Category-specific filtering attributes
    availableFilters: [
      {
        type: String,
        enum: [
          'color',
          'size',
          'material',
          'finish',
          'brand',
          'price',
          'features',
          'compatibility',
          'weight',
          'portability',
        ],
      },
    ],

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate slug from title
categorySchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  next();
});

// Get subcategories
categorySchema.methods.getSubcategories = function () {
  return mongoose
    .model('Category')
    .find({ parentCategory: this._id, active: true });
};

// Get category path (breadcrumb)
categorySchema.methods.getCategoryPath = async function () {
  const path = [this];
  let current = this;

  while (current.parentCategory) {
    current = await mongoose.model('Category').findById(current.parentCategory);
    if (current) path.unshift(current);
  }

  return path;
};

// Add to the category schema for better filtering and navigation
categorySchema.virtual('hasChildren').get(function () {
  return (
    mongoose.model('Category').countDocuments({ parentCategory: this._id }) > 0
  );
});

// Add method to get all products in this category (including subcategories)
categorySchema.methods.getAllProducts = async function (filters = {}) {
  // Get all subcategory IDs recursively
  const subcategories = await this.getAllSubcategories();
  const categoryIds = [this._id, ...subcategories.map((cat) => cat._id)];

  // Find products in any of these categories
  return mongoose.model('product').find({
    category: { $in: categoryIds },
    ...filters,
  });
};

// Get all subcategories recursively
categorySchema.methods.getAllSubcategories = async function () {
  const directSubcategories = await mongoose.model('Category').find({
    parentCategory: this._id,
    active: true,
  });

  let allSubcategories = [...directSubcategories];

  // Get subcategories of each direct subcategory
  for (const subcategory of directSubcategories) {
    const nestedSubcategories = await subcategory.getAllSubcategories();
    allSubcategories = [...allSubcategories, ...nestedSubcategories];
  }

  return allSubcategories;
};

// Add method to get the most popular products in this category
categorySchema.methods.getPopularProducts = async function (limit = 10) {
  const Product = mongoose.model('product');
  const categoryIds = [this._id];

  // Get direct subcategories only for popular products
  const subcategories = await mongoose.model('Category').find({
    parentCategory: this._id,
    active: true,
  });

  categoryIds.push(...subcategories.map((cat) => cat._id));

  return Product.find({
    category: { $in: categoryIds },
    isActive: true,
  })
    .sort({ rating: -1, 'reviews.length': -1 })
    .limit(limit);
};

// Add indexing for better query performance
categorySchema.index({ parentCategory: 1 });
// categorySchema.index({ slug: 1 });
categorySchema.index({ categoryType: 1 });
categorySchema.index({ applicableProductTypes: 1 });
categorySchema.index({ featured: 1, order: 1 });

const categoryModel = mongoose.model('Category', categorySchema);

export default categoryModel;
