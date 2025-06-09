import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    phone: { type: String },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    },
    bio: { type: String, maxlength: 500 },
    profileImage: { type: String },

    // Photography-related user data
    likedPhotos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image',
      },
    ],
    collections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection',
      },
    ],
    uploadedPhotos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image',
      },
    ],
    totalViews: {
      type: Number,
      default: 0,
    },
    totalLikes: {
      type: Number,
      default: 0,
    },

    // Enhanced cart data to support variants
    cartData: {
      type: Map,
      of: {
        productId: { type: String, required: true },
        variantId: { type: String }, // For variant-based products
        quantity: { type: Number, required: true, min: 1 },
        selectedAttributes: {
          color: String,
          size: String,
          material: String,
          finish: String,
          customSize: {
            width: Number,
            height: Number,
            diameter: Number,
            length: Number,
            unit: String,
          },
        },
        // ADD THESE MISSING FIELDS:
        productName: String,
        productImage: String,
        unitPrice: Number,
        isPreorder: { type: Boolean, default: false },
        availabilityType: String,
        estimatedDelivery: String,
        preorderDate: Date,
        updatedAt: Date,
        addedAt: { type: Date, default: Date.now },
      },
      default: {},
    },

    // User preferences for personalized experience
    preferences: {
      favoriteCategories: [String],
      priceRange: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 10000 },
      },
      preferredBrands: [String],
      shippingPreference: {
        type: String,
        enum: ['standard', 'express', 'pickup'],
        default: 'standard',
      },
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false },
      marketingEmails: { type: Boolean, default: true },
    },

    // Saved addresses for faster checkout
    addresses: [
      {
        label: { type: String, required: true }, // e.g., "Home", "Office"
        fullName: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        phone: { type: String, required: true },
        email: String,
        isDefault: { type: Boolean, default: false },
      },
    ],

    // Wishlist with variant support
    wishlist: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'product',
          required: true,
        },
        variantId: String,
        selectedAttributes: {
          color: String,
          size: String,
          material: String,
          finish: String,
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // Recently viewed products
    recentlyViewed: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product' },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'pending'],
      default: 'active',
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { minimize: false },
  { timestamps: true }
);

// Update the addToCart method to handle inventory reservation
userSchema.methods.addToCart = async function (
  productId,
  quantity = 1,
  variantId = null,
  selectedAttributes = {}
) {
  const cartKey = variantId ? `${productId}_${variantId}` : productId;

  // Check if this item already exists in cart
  const existingQuantity = this.cartData.has(cartKey)
    ? this.cartData.get(cartKey).quantity
    : 0;

  // First, check product inventory before adding to cart
  const Product = mongoose.model('product');
  const product = await Product.findById(productId);

  if (!product) {
    throw new Error('Product not found');
  }

  // Check variant inventory if applicable
  if (variantId) {
    const variant = product.variants.id(variantId);
    if (!variant) {
      throw new Error('Variant not found');
    }

    // Check if requested quantity is available
    if (
      variant.inventory?.managed &&
      existingQuantity + quantity > variant.inventory.availableQuantity
    ) {
      throw new Error(
        `Only ${variant.inventory.availableQuantity} items available`
      );
    }

    // Mark some inventory as reserved
    variant.inventory.reservedQuantity += quantity;
    await product.save();
  } else {
    // Check main product inventory
    if (product.stock < existingQuantity + quantity) {
      throw new Error(`Only ${product.stock} items available`);
    }
  }

  // Update cart
  if (this.cartData.has(cartKey)) {
    this.cartData.get(cartKey).quantity += quantity;
  } else {
    this.cartData.set(cartKey, {
      productId,
      variantId,
      quantity,
      selectedAttributes,
      addedAt: new Date(),
    });
  }

  return this.save();
};

// Add method to release reserved inventory when items are removed from cart
userSchema.methods.removeFromCart = async function (cartKey) {
  if (!this.cartData.has(cartKey)) {
    return this;
  }

  const cartItem = this.cartData.get(cartKey);
  const { productId, variantId, quantity } = cartItem;

  // Release reserved inventory
  const Product = mongoose.model('product');
  const product = await Product.findById(productId);

  if (product && variantId) {
    const variant = product.variants.id(variantId);
    if (variant && variant.inventory?.managed) {
      variant.inventory.reservedQuantity = Math.max(
        0,
        variant.inventory.reservedQuantity - quantity
      );
      await product.save();
    }
  }

  this.cartData.delete(cartKey);
  return this.save();
};

// Method to get cart total count
userSchema.methods.getCartItemCount = function () {
  let total = 0;
  for (let [key, item] of this.cartData) {
    total += item.quantity;
  }
  return total;
};

const userModel = mongoose.models.user || mongoose.model('user', userSchema);
export default userModel;
