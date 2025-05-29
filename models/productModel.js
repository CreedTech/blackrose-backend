// import mongoose from 'mongoose';

// const productSchema = new mongoose.Schema({
//   description: { type: String, required: true },
//   price: { type: Number, required: true },
//   image: { type: Array, required: true },
//   category: { type: String, required: true },
// //   subCategory: { type: String, required: true },
// //   sizes: { type: Array, required: true },
//   bestseller: { type: Boolean },
//   date: { type: Number, required: true },
//   title: { type: String, required: true },
//   discount: { type: Number, default: 0 },
//   finalPrice: { type: Number },
//   tags: [{ type: String }],
//   digitalDownload: { type: Boolean, default: false },
//   stock: { type: Number, default: 1 },
//   rating: { type: Number, default: 0 },
//   reviews: [
//     {
//       userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
//       comment: String,
//       rating: Number,
//       date: { type: Date, default: Date.now },
//     },
//   ],
// });

// productSchema.pre('save', function (next) {
//   this.finalPrice = this.price - (this.discount / 100) * this.price;
//   next();
// });

// const productModel =
//   mongoose.models.product || mongoose.model('product', productSchema);

// export default productModel;

// // import mongoose from 'mongoose';

// // const variantSchema = new mongoose.Schema({
// //   color: { type: String, required: true },
// //   size: { type: String, required: true },
// //   stock: { type: Number, default: 0 },
// //   preorder: { type: Boolean, default: false },
// //   dimensions: {
// //     width: Number, // cm
// //     height: Number,
// //     diameter: Number,
// //     length: Number,
// //   },
// //   priceOverride: Number, // optional price for this variant, overrides product.price if set
// // });

// // const productSchema = new mongoose.Schema({
// //   description: { type: String, required: true },
// //   price: { type: Number, required: true }, // base price if variant priceOverride not set
// //   image: { type: [String], required: true }, // array of image URLs
// //   category: { type: String, required: true },
// //   bestseller: { type: Boolean, default: false },
// //   date: { type: Date, default: Date.now },
// //   title: { type: String, required: true },
// //   discount: { type: Number, default: 0 },
// //   finalPrice: { type: Number },
// //   tags: [{ type: String }],
// //   digitalDownload: { type: Boolean, default: false },

// //   // Remove product-level stock to avoid confusion - use variants stock instead
// //   // stock: { type: Number, default: 1 },

// //   rating: { type: Number, default: 0 },
// //   reviews: [
// //     {
// //       userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
// //       comment: String,
// //       rating: Number,
// //       date: { type: Date, default: Date.now },
// //     },
// //   ],

// //   variants: [variantSchema], // <-- embedded variants here

// //   // General product attributes
// //   dimensions: {
// //     width: Number,
// //     height: Number,
// //     diameter: Number,
// //     length: Number,
// //   },
// //   colors: [String],
// //   material: String,
// //   finish: String,
// //   orientation: {
// //     type: String,
// //     enum: ['Horizontal', 'Vertical', 'Square', 'Adjustable'],
// //   },
// //   weightCategory: {
// //     type: String,
// //     enum: ['Lightweight', 'Medium Weight', 'Heavy'],
// //   },
// //   portable: {
// //     foldable: Boolean,
// //     rollable: Boolean,
// //     collapsible: Boolean,
// //   },
// //   usage: [String],
// //   features: [String],
// //   customization: {
// //     customText: Boolean,
// //     customSize: Boolean,
// //     customColor: Boolean,
// //     logoPrinting: Boolean,
// //     addOns: [String],
// //   },
// //   includedItems: [String],
// //   availability: {
// //     type: String,
// //     enum: ['In Stock', 'Made to Order', 'Pre-order', 'Limited Edition'],
// //     default: 'In Stock',
// //   },
// //   shipping: [String],

// //   sku: String,
// //   brand: String,
// //   modelNumber: String,
// //   condition: { type: String, enum: ['New', 'Used', 'Refurbished'] },
// //   warranty: {
// //     available: Boolean,
// //     durationMonths: Number,
// //   },
// //   countryOfOrigin: String,
// //   powerSource: { type: String, enum: ['None', 'Battery', 'USB', 'AC'] },
// //   productVideoDemo: {
// //     available: Boolean,
// //     url: String,
// //   },
// // });

// // productSchema.pre('save', function (next) {
// //   // Calculate finalPrice based on product price and discount only
// //   this.finalPrice = this.price - (this.discount / 100) * this.price;
// //   next();
// // });

// // const productModel =
// //   mongoose.models.product || mongoose.model('product', productSchema);

// // export default productModel;

import mongoose from 'mongoose';

// Define enums for consistent values
const PRODUCT_TYPES = [
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
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'Custom'];

const COLORS = [
  'Black',
  'White',
  'Gray',
  'Beige',
  'Brown',
  'Red',
  'Yellow',
  'Blue',
  'Green',
  'Purple',
  'Orange',
  'Pink',
  'Gold',
  'Silver',
  'Transparent',
  'Multi-color',
  'Custom',
];

const MATERIALS = [
  'Fabric',
  'Cotton',
  'Muslin',
  'Velvet',
  'Paper',
  'Thick Cardstock',
  'Glossy Paper',
  'Matte Paper',
  'Plastic',
  'PVC',
  'Acrylic',
  'Wood',
  'Natural Wood',
  'Painted Wood',
  'Metal',
  'Aluminum',
  'Steel',
  'Vinyl',
  'Foam',
  'Silicone',
  'Leather',
  'Canvas',
  'Marble Effect',
  'Concrete Effect',
];

const FINISHES = [
  'Matte',
  'Glossy',
  'Satin',
  'Textured',
  'Reflective',
  'Frosted',
  'Rustic',
  'Modern',
  'Vintage',
  'Patterned',
  'Gradient',
  'Solid Color',
];

const ORIENTATIONS = ['Horizontal', 'Vertical', 'Square', 'Adjustable'];

const WEIGHT_CATEGORIES = ['Lightweight', 'Medium Weight', 'Heavy'];

const PORTABILITY = ['Foldable', 'Rollable', 'Collapsible', 'Fixed'];

const USAGE_COMPATIBILITY = [
  'Indoor',
  'Outdoor',
  'Studio',
  'Tabletop',
  'Wall-mounted',
  'Floor-standing',
  'Portable setup',
];

const AVAILABILITY_TYPES = [
  'In Stock',
  'Made to Order',
  'Pre-order',
  'Limited Edition',
];

const SHIPPING_OPTIONS = [
  'Flat Shipping',
  'Free Shipping',
  'Express Only',
  'Pickup Only',
  'Fragile / Special Handling',
];

// Variant Schema for product variations
const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  color: { type: String, enum: COLORS },
  size: { type: String, enum: SIZES },
  material: { type: String, enum: MATERIALS },
  finish: { type: String, enum: FINISHES },
  customSize: {
    width: { type: Number },
    height: { type: Number },
    diameter: { type: Number },
    length: { type: Number },
    unit: { type: String, enum: ['cm', 'm', 'inches', 'feet'], default: 'cm' },
  },
  stock: { type: Number, required: true, default: 0 },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  finalPrice: { type: Number },
  images: [{ type: String }],
  isActive: { type: Boolean, default: true },
  // Enhanced inventory tracking
  inventory: {
    managed: { type: Boolean, default: true },
    availableQuantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 }, // For items in carts but not yet purchased
    lowStockThreshold: { type: Number, default: 5 },
    backorderAllowed: { type: Boolean, default: false },
    backorderLimit: { type: Number, default: 0 },
  },
  // Variant-specific shipping overrides
  shipping: {
    requiresSpecialHandling: { type: Boolean, default: false },
    weight: { type: Number },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: { type: String, enum: ['cm', 'in'], default: 'cm' },
    },
    additionalCost: { type: Number, default: 0 },
  },

  // Track which options were selected to create this variant
  variantAttributes: {
    type: Map,
    of: String,
    default: {},
  },
});

// Camera-specific attributes schema
const cameraAttributesSchema = new mongoose.Schema({
  cameraType: {
    type: String,
    enum: ['DSLR', 'Mirrorless', 'Point & Shoot', 'Film'],
  },
  sensorType: { type: String, enum: ['CMOS', 'CCD', 'Full-frame', 'APS-C'] },
  megapixels: { type: Number },
  isoRange: { type: String },
  lensMountType: { type: String },
  videoResolution: { type: String },
  frameRate: { type: Number },
  touchscreen: { type: Boolean, default: false },
  wifiBluetoothEnabled: { type: Boolean, default: false },
  batteryLife: { type: Number },
});

// Lens-specific attributes schema
const lensAttributesSchema = new mongoose.Schema({
  lensType: {
    type: String,
    enum: ['Prime', 'Zoom', 'Macro', 'Telephoto', 'Wide'],
  },
  focalLength: { type: String },
  apertureRange: { type: String },
  lensMountCompatibility: [{ type: String }],
  stabilization: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: true },
  filterThreadSize: { type: String },
});

// Lighting gear-specific attributes schema
const lightingAttributesSchema = new mongoose.Schema({
  lightType: { type: String, enum: ['LED', 'Flash', 'Softbox', 'Ring Light'] },
  colorTemperature: { type: String },
  dimmable: { type: Boolean, default: false },
  powerSource: { type: String, enum: ['Battery', 'AC', 'USB'] },
  remoteControlSupport: { type: Boolean, default: false },
  mountType: { type: String, enum: ['Tripod', 'Hot Shoe', 'Stand'] },
  batteryIncluded: { type: Boolean, default: false },
});

// Tripod/Stand-specific attributes schema
const tripodAttributesSchema = new mongoose.Schema({
  maxHeight: { type: Number },
  minHeight: { type: Number },
  weightSupport: { type: Number },
  foldedLength: { type: Number },
  tripodHeadType: { type: String, enum: ['Ball', 'Pan-Tilt', 'Fluid'] },
  material: { type: String, enum: ['Carbon Fiber', 'Aluminum'] },
  legLockType: { type: String },
  mountType: { type: String, enum: ['1/4"', '3/8"'] },
});

// Backdrop-specific attributes schema
const backdropAttributesSchema = new mongoose.Schema({
  material: {
    type: String,
    enum: ['Vinyl', 'Canvas', 'Paper', 'Cloth', 'Muslin', 'Seamless Paper'],
  },
  mountType: { type: String, enum: ['Pole Pocket', 'Clamp-On', 'Wall Stick'] },
  rollableFoldable: { type: String, enum: ['Rollable', 'Foldable', 'Fixed'] },
  colorAccuracy: { type: Boolean, default: false },
  texture: {
    type: String,
    enum: ['Marble', 'Concrete', 'Wood', 'Gradient', 'Plain'],
  },
});

// Props-specific attributes schema
const propsAttributesSchema = new mongoose.Schema({
  style: { type: String, enum: ['Modern', 'Rustic', 'Elegant', 'Minimalist'] },
  propType: {
    type: String,
    enum: ['Flatlay Base', 'Background Object', 'Elevated Surface'],
  },
  reversible: { type: Boolean, default: false },
  colorVariant: [{ type: String }],
  handmade: { type: Boolean, default: false },
});

// Studio Kit-specific attributes schema
const studioKitAttributesSchema = new mongoose.Schema({
  numberOfItems: { type: Number },
  whatsIncluded: [{ type: String }],
  skillLevel: { type: String, enum: ['Starter', 'Pro', 'Advanced'] },
  setupTime: { type: String, enum: ['Quick', 'Medium', 'Long'] },
  totalWeight: { type: Number },
  shippingSize: { type: String },
  manualIncluded: { type: Boolean, default: true },
});

// Main Product Schema
const productSchema = new mongoose.Schema({
  // Basic Product Information
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  images: [{ type: String, required: true }],

  // Product Classification
  category: { type: String, required: true },
  productType: { type: String, enum: PRODUCT_TYPES, required: true },

  // General Attributes
  sku: { type: String, required: true, unique: true },
  brand: { type: String },
  modelNumber: { type: String },
  condition: {
    type: String,
    enum: ['New', 'Used', 'Refurbished'],
    default: 'New',
  },
  warranty: {
    hasWarranty: { type: Boolean, default: false },
    duration: { type: String },
  },
  countryOfOrigin: { type: String },
  powerSource: {
    type: String,
    enum: ['None', 'Battery', 'USB', 'AC'],
    default: 'None',
  },
  productVideoDemo: {
    hasVideo: { type: Boolean, default: false },
    videoUrl: { type: String },
  },

  // Physical Attributes
  size: { type: String, enum: SIZES },
  customSize: {
    width: { type: Number },
    height: { type: Number },
    diameter: { type: Number },
    length: { type: Number },
    unit: { type: String, enum: ['cm', 'm', 'inches', 'feet'], default: 'cm' },
  },
  color: [{ type: String, enum: COLORS }],
  customColor: { type: String },
  material: [{ type: String, enum: MATERIALS }],
  finish: { type: String, enum: FINISHES },
  orientation: [{ type: String, enum: ORIENTATIONS }],
  weight: {
    category: { type: String, enum: WEIGHT_CATEGORIES },
    actualWeight: { type: Number },
    unit: { type: String, enum: ['g', 'kg', 'oz', 'lbs'], default: 'kg' },
  },
  portability: [{ type: String, enum: PORTABILITY }],

  // Usage & Compatibility
  usageCompatibility: [{ type: String, enum: USAGE_COMPATIBILITY }],

  // Product Features (multi-select tags)
  features: [
    {
      type: String,
      enum: [
        'Waterproof',
        'Heat Resistant',
        'Wrinkle-free',
        'Scratch-resistant',
        'Magnetic',
        'Adhesive Back',
        'Easy to Clean',
        'UV Resistant',
        'Foldable',
        'Reusable',
        'Non-reflective',
        'Color Accurate',
        'Travel-friendly',
        'Includes Carrying Case',
      ],
    },
  ],

  // Customization Options
  customizationOptions: {
    customText: { type: Boolean, default: false },
    customSize: { type: Boolean, default: false },
    customColor: { type: Boolean, default: false },
    logoPrinting: { type: Boolean, default: false },
    addonAccessories: { type: Boolean, default: false },
  },

  // Included Items
  includedItems: [
    {
      type: String,
      enum: [
        'Includes Stand',
        'Includes Carry Bag',
        'With Clips',
        'With Setup Manual',
        'Extra Panels / Props',
      ],
    },
  ],

  // Availability & Shipping
  availabilityType: {
    type: String,
    enum: AVAILABILITY_TYPES,
    default: 'In Stock',
  },
  shippingOptions: [{ type: String, enum: SHIPPING_OPTIONS }],

  // Variants (for different combinations of attributes)
  variants: [variantSchema],

  // Category-specific attributes (conditional based on productType)
  cameraAttributes: { type: cameraAttributesSchema },
  lensAttributes: { type: lensAttributesSchema },
  lightingAttributes: { type: lightingAttributesSchema },
  tripodAttributes: { type: tripodAttributesSchema },
  backdropAttributes: { type: backdropAttributesSchema },
  propsAttributes: { type: propsAttributesSchema },
  studioKitAttributes: { type: studioKitAttributesSchema },

  // Extra Functionality Tags
  functionalityTags: [
    {
      type: String,
      enum: [
        'Beginner-friendly',
        'Travel-size',
        'Studio Essential',
        'Budget-friendly',
        'Professional Grade',
        'Best for Flatlays',
        'Best for Portrait',
        'Best for Fashion',
        'Best for Product',
        'Best for Food',
        'Eco-Friendly',
        'Recyclable',
        'Bestseller',
        'Limited Stock',
      ],
    },
  ],

  // Legacy fields (kept for backward compatibility)
  discount: { type: Number, default: 0 },
  finalPrice: { type: Number },
  tags: [{ type: String }],
  digitalDownload: { type: Boolean, default: false },
  stock: { type: Number, default: 1 }, // Overall stock, calculated from variants
  bestseller: { type: Boolean, default: false },

  // Reviews & Ratings
  rating: { type: Number, default: 0 },
  reviews: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
      comment: String,
      rating: Number,
      date: { type: Date, default: Date.now },
      verifiedPurchase: { type: Boolean, default: false },
    },
  ],

  // Metadata
  date: { type: Number, required: true, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },

  // SEO fields
  seoTitle: { type: String },
  seoDescription: { type: String },
  seoKeywords: [{ type: String }],
});

// Pre-save middleware to calculate final price and total stock
productSchema.pre('save', function (next) {
  // Calculate final price for main product
  this.finalPrice = this.price - (this.discount / 100) * this.price;

  // Calculate final price for each variant
  if (this.variants && this.variants.length > 0) {
    this.variants.forEach((variant) => {
      variant.finalPrice =
        variant.price - (variant.discount / 100) * variant.price;
    });

    // Calculate total stock from variants
    this.stock = this.variants.reduce((total, variant) => {
      return total + (variant.isActive ? variant.stock : 0);
    }, 0);
  }

  // Update lastUpdated timestamp
  this.lastUpdated = new Date();

  next();
});

// Indexes for better query performance
productSchema.index({ productType: 1, category: 1 });
// productSchema.index({ 'variants.sku': 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ date: -1 });
productSchema.index({ bestseller: -1 });
productSchema.index({ availabilityType: 1 });
productSchema.index({ functionalityTags: 1 });
productSchema.index({ features: 1 });
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ 'variants.color': 1, 'variants.size': 1 });
productSchema.index({ date: -1, featured: -1 });

// Virtual for calculating average rating
productSchema.virtual('averageRating').get(function () {
  if (this.reviews.length === 0) return 0;
  const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
  return (sum / this.reviews.length).toFixed(1);
});

// Virtual for getting total review count
productSchema.virtual('reviewCount').get(function () {
  return this.reviews.length;
});
productSchema.methods.checkInventory = async function (
  variantId,
  quantity = 1
) {
  if (variantId) {
    const variant = this.variants.id(variantId);
    if (!variant) {
      throw new Error('Variant not found');
    }

    return {
      available: variant.stock >= quantity,
      currentStock: variant.stock,
      requested: quantity,
      remaining: variant.stock - quantity,
    };
  } else {
    return {
      available: this.stock >= quantity,
      currentStock: this.stock,
      requested: quantity,
      remaining: this.stock - quantity,
    };
  }
};

// Method to check if product has variants
productSchema.methods.hasVariants = function () {
  return this.variants && this.variants.length > 0;
};
productSchema.methods.getLowStockVariants = function (threshold = 5) {
  return this.variants.filter(
    (variant) => variant.isActive && variant.stock <= threshold
  );
};

// Method to get available variants (in stock and active)
productSchema.methods.getAvailableVariants = function () {
  return this.variants.filter(
    (variant) => variant.isActive && variant.stock > 0
  );
};
productSchema.methods.getAvailableOptions = function () {
  // For each variant type, collect all possible values
  const options = {
    colors: new Set(),
    sizes: new Set(),
    materials: new Set(),
    finishes: new Set(),
  };

  this.variants.forEach((variant) => {
    if (variant.color) options.colors.add(variant.color);
    if (variant.size) options.sizes.add(variant.size);
    if (variant.material) options.materials.add(variant.material);
    if (variant.finish) options.finishes.add(variant.finish);
  });

  return {
    colors: Array.from(options.colors),
    sizes: Array.from(options.sizes),
    materials: Array.from(options.materials),
    finishes: Array.from(options.finishes),
  };
};
productSchema.methods.getOutOfStockAttributes = function () {
  const outOfStockAttributes = {
    colors: new Set(),
    sizes: new Set(),
    materials: new Set(),
    finishes: new Set(),
  };

  // Get all attribute combinations
  const activeVariants = this.variants.filter((v) => v.isActive);
  const inStockVariants = activeVariants.filter((v) => v.stock > 0);

  // Find attributes that exist in active variants but not in in-stock variants
  activeVariants.forEach((variant) => {
    let hasInStockMatch = false;

    // For each attribute, check if there's an in-stock variant with that attribute
    if (variant.color) {
      hasInStockMatch = inStockVariants.some((v) => v.color === variant.color);
      if (!hasInStockMatch) outOfStockAttributes.colors.add(variant.color);
    }

    // Repeat for other attributes
    if (variant.size) {
      hasInStockMatch = inStockVariants.some((v) => v.size === variant.size);
      if (!hasInStockMatch) outOfStockAttributes.sizes.add(variant.size);
    }

    // And so on for materials and finishes
  });

  return {
    colors: Array.from(outOfStockAttributes.colors),
    sizes: Array.from(outOfStockAttributes.sizes),
    materials: Array.from(outOfStockAttributes.materials),
    finishes: Array.from(outOfStockAttributes.finishes),
  };
};

// Method to find variant by attributes
productSchema.methods.findVariant = function (attributes) {
  return this.variants.find((variant) => {
    return Object.keys(attributes).every((key) => {
      return variant[key] === attributes[key];
    });
  });
};

// Static method to find products by multiple filters
productSchema.statics.findByFilters = function (filters) {
  const query = {};

  if (filters.productType) query.productType = filters.productType;
  if (filters.category) query.category = filters.category;
  if (filters.brand) query.brand = new RegExp(filters.brand, 'i');
  if (filters.priceMin || filters.priceMax) {
    query.price = {};
    if (filters.priceMin) query.price.$gte = filters.priceMin;
    if (filters.priceMax) query.price.$lte = filters.priceMax;
  }
  if (filters.features) query.features = { $in: filters.features };
  if (filters.functionalityTags)
    query.functionalityTags = { $in: filters.functionalityTags };
  if (filters.color) query.color = { $in: filters.color };
  if (filters.material) query.material = { $in: filters.material };
  if (filters.inStock) query.stock = { $gt: 0 };

  return this.find(query);
};
// Add to the Product model
productSchema.methods.updateVariantStock = async function (
  variantId,
  quantityChange
) {
  const variant = this.variants.id(variantId);
  if (!variant) {
    throw new Error('Variant not found');
  }

  // Update the stock
  variant.stock += quantityChange;

  // If we have inventory management fields
  if (variant.inventory && variant.inventory.managed) {
    variant.inventory.availableQuantity += quantityChange;

    // Check if we need to update any alerts
    if (
      variant.inventory.availableQuantity <= variant.inventory.lowStockThreshold
    ) {
      // You could trigger alerts or notifications here
      console.log(`Low stock alert for variant ${variantId}`);
    }
  }

  // Recalculate the overall product stock
  this.stock = this.variants.reduce((total, v) => {
    return total + (v.isActive ? v.stock : 0);
  }, 0);

  return this.save();
};
// Find available variants based on partial selection
productSchema.methods.getFilteredVariants = function (selectedAttributes) {
  return this.variants.filter((variant) => {
    // Check if variant matches all selected attributes
    return Object.entries(selectedAttributes).every(([key, value]) => {
      return !value || variant[key] === value;
    });
  });
};

// Add to the product schema
productSchema.methods.getBreadcrumbPath = async function () {
  const Category = mongoose.model('Category');
  const category = await Category.findById(this.category);

  if (!category) return [];

  return category.getCategoryPath();
};

// Get related products in the same category
productSchema.methods.getRelatedProducts = async function (limit = 4) {
  return mongoose
    .model('product')
    .find({
      _id: { $ne: this._id },
      category: this.category,
      isActive: true,
    })
    .limit(limit);
};

// Get complementary products (often bought together)
productSchema.methods.getComplementaryProducts = async function (limit = 4) {
  // You can implement this based on order history or product relationships
  // For now, a simple implementation might be products from related categories
  const Category = mongoose.model('Category');
  const currentCategory = await Category.findById(this.category);

  if (!currentCategory || !currentCategory.parentCategory) {
    return this.getRelatedProducts(limit);
  }

  // Get sibling categories
  const siblingCategories = await Category.find({
    parentCategory: currentCategory.parentCategory,
    _id: { $ne: currentCategory._id },
  });

  const siblingCategoryIds = siblingCategories.map((cat) => cat._id);

  return mongoose
    .model('product')
    .find({
      category: { $in: siblingCategoryIds },
      isActive: true,
    })
    .limit(limit);
};

const productModel =
  mongoose.models.product || mongoose.model('product', productSchema);

export default productModel;
