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
    role: {
      type: String,
      enum: [
        'user',
        'admin',
        'super-admin',
        'photographer',
        'marketer',
        'writer',
      ],
      default: 'user',
    },

    // Role permissions (you can expand this later)
    permissions: {
      canManageProducts: { type: Boolean, default: false },
      canManageOrders: { type: Boolean, default: false },
      canManageUsers: { type: Boolean, default: false },
      canViewAnalytics: { type: Boolean, default: false },
      canManageContent: { type: Boolean, default: false },
      canUploadPhotos: { type: Boolean, default: false },
      canManageMarketing: { type: Boolean, default: false },
    },
    // Role-specific metadata
    roleMetadata: {
      // For photographers
      portfolio: { type: String },
      specialization: [String], // e.g., ['wedding', 'portrait', 'landscape']
      yearsOfExperience: { type: Number },

      // For marketers
      products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'product' }],

      // For writers
      articles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost' }],

      // For admins
      adminLevel: { type: Number, default: 1 }, // 1-5 scale
      departmentAccess: [String], // ['sales', 'marketing', 'content']
    },

    // Role assignment tracking
    roleHistory: [
      {
        previousRole: String,
        newRole: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
        changedAt: { type: Date, default: Date.now },
        reason: String,
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
    // Soft delete fields
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletionReason: { type: String },
    canReactivate: { type: Boolean, default: true }, // Allow user to come back
    reactivationToken: { type: String }, // For secure reactivation

    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deactivated', 'pending'],
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
userSchema.methods.hasPermission = function (permission) {
  return this.permissions[permission] || false;
};

// Method to check if user has role
userSchema.methods.hasRole = function (role) {
  if (Array.isArray(role)) {
    return role.includes(this.role);
  }
  return this.role === role;
};

// Method to update user role
userSchema.methods.updateRole = function (newRole, changedBy, reason = '') {
  console.log(newRole);
  // Add to role history
  this.roleHistory.push({
    previousRole: this.role,
    newRole: newRole,
    changedBy: changedBy,
    reason: reason,
  });

  // Update role
  const oldRole = this.role;
  this.role = newRole;

  // Update isAdmin for backward compatibility
  this.isAdmin = ['admin', 'super-admin'].includes(newRole);

  // Set default permissions based on role
  this.setRolePermissions(newRole);

  return this.save();
};

// Method to set default permissions based on role
userSchema.methods.setRolePermissions = function (role) {
  // Reset permissions
  this.permissions = {
    canManageProducts: false,
    canManageOrders: false,
    canManageUsers: false,
    canViewAnalytics: false,
    canManageContent: false,
    canUploadPhotos: false,
    canManageMarketing: false,
  };

  switch (role) {
    case 'super-admin':
      // Super admin has all permissions
      Object.keys(this.permissions).forEach((key) => {
        this.permissions[key] = true;
      });
      break;

    case 'admin':
      this.permissions.canManageProducts = true;
      this.permissions.canManageOrders = true;
      this.permissions.canViewAnalytics = true;
      this.permissions.canManageContent = true;
      break;

    case 'photographer':
      this.permissions.canUploadPhotos = true;
      break;

    case 'marketer':
      this.permissions.canManageMarketing = true;
      break;

    case 'writer':
      this.permissions.canManageContent = true;
      break;

    case 'user':
    default:
      // Users have basic permissions only
      break;
  }
};

// Static method to get role hierarchy
userSchema.statics.getRoleHierarchy = function () {
  return {
    user: 1,
    writer: 2,
    photographer: 3,
    marketer: 4,
    admin: 5,
    'super-admin': 6,
  };
};

// Query helpers
userSchema.query.byRole = function (role) {
  return this.where({ role: role });
};

userSchema.query.withAdminAccess = function () {
  return this.where({ role: { $in: ['admin', 'super-admin'] } });
};

const userModel = mongoose.models.user || mongoose.model('user', userSchema);
export default userModel;
