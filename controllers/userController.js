import validator from 'validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import LoginActivity from '../models/loginActivityModel.js';
import mongoose from 'mongoose';
import orderModel from '../models/orderModel.js';
import {
  sendPasswordResetEmail,
  sendPasswordResetSuccess,
  sendPasswordResetAlert,
} from '../utils/emailService.js';
import PasswordReset from '../models/passwordResetModel.js';
import crypto from 'crypto';

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const getMe = async (req, res) => {
  try {
    const userId = req.user._id;

    // Run multiple queries in parallel for better performance
    const [user, orderCount, orderStats, recentOrders] = await Promise.all([
      // Get user data
      userModel
        .findById(userId)
        .select('-password')
        .populate('likedPhotos')
        .populate('collections')
        .populate('uploadedPhotos')
        .populate('wishlist.productId')
        .populate('recentlyViewed.productId'),

      // Get order count
      orderModel.countDocuments({ userId }),

      // Get order statistics
      orderModel.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$amount' },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            processingOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] },
            },
            shippedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] },
            },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            averageOrderValue: { $avg: '$amount' },
          },
        },
      ]),

      // Get recent orders
      orderModel
        .find({ userId })
        .sort({ date: -1 })
        .limit(5)
        .select('orderNumber status amount date items.productName'),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Combine all data
    const userWithCompleteStats = {
      ...user.toObject(),
      orderCount,
      orderStats: orderStats[0] || {
        totalOrders: 0,
        totalSpent: 0,
        pendingOrders: 0,
        processingOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: 0,
      },
      recentOrders,
      // Additional computed fields
      completionRate: orderStats[0]
        ? (
            (orderStats[0].deliveredOrders / orderStats[0].totalOrders) *
            100
          ).toFixed(1)
        : 0,
      membershipDuration: Math.floor(
        (Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)
      ), // Days since registration
    };

    res.json(userWithCompleteStats);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    const { email, password } = req.body;
    const isAdmin = req.body.isAdmin === true;

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    if (isAdmin && !user.isAdmin) {
      return res.json({
        success: false,
        message: 'You do not have administrator privileges',
      });
    }

    const token = createToken(user._id);

    await LoginActivity.create({
      user: user._id,
      action: 'login',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      loginType: isAdmin ? 'admin' : 'user',
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        totalViews: user.totalViews,
        totalLikes: user.totalLikes,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: 'User already exists' });
    }

    if (!validator.isEmail(email)) {
      return res.json({
        success: false,
        message: 'Please enter a valid email',
      });
    }
    if (password.length < 8) {
      return res.json({
        success: false,
        message: 'Please enter a strong password',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
    });

    const user = await newUser.save();
    const token = createToken(user._id);

    res.json({ success: true, token });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(email + password, process.env.JWT_SECRET);
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const addToCart = async (req, res) => {
  try {
    const {
      productId,
      quantity = 1,
      variantId,
      selectedAttributes,
      isPreorder = false,
    } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Validate quantity
    const quantityNum = Number(quantity);
    if (isNaN(quantityNum) || quantityNum < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    // Get product to check inventory
    const Product = mongoose.model('product');
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product is active
    if (!product.isActive) {
      return res
        .status(400)
        .json({ message: 'This product is currently unavailable' });
    }

    // Prepare cart key based on product and variant
    const cartKey = variantId ? `${productId}_${variantId}` : productId;

    // Check current cart quantity
    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingItem = user.cartData.get(cartKey);
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentQuantity + quantityNum;

    // Check inventory availability
    let inventoryCheck;
    let availableStock = 0;
    let allowPreorder = false;

    if (variantId) {
      // Find the specific variant
      const variant = product.variants.id(variantId);

      if (!variant) {
        return res.status(404).json({ message: 'Product variant not found' });
      }

      if (!variant.isActive) {
        return res
          .status(400)
          .json({ message: 'This product variant is currently unavailable' });
      }

      availableStock = variant.stock;

      // For variants: check backorderAllowed OR allow preorder if user explicitly requests it
      allowPreorder = variant.inventory?.backorderAllowed || isPreorder;
    } else {
      // Check main product stock
      availableStock = product.stock;

      // For main product: allow preorder if user explicitly requests it
      // OR if the product is specifically set up for preorder/made to order
      allowPreorder =
        isPreorder ||
        product.availabilityType === 'Pre-order' ||
        product.availabilityType === 'Made to Order';
    }

    // Stock validation logic
    if (availableStock >= newTotalQuantity) {
      // Normal case: enough stock available
      inventoryCheck = {
        available: true,
        type: 'in_stock',
        message: 'Item available in stock',
      };
    } else if (isPreorder && allowPreorder) {
      // Preorder case: out of stock but preorder allowed
      const preorderType =
        product.availabilityType === 'In Stock'
          ? 'preorder'
          : product.availabilityType.toLowerCase();
      inventoryCheck = {
        available: true,
        type: 'preorder',
        message: `Item will be available for ${preorderType} (7-14 days delivery)`,
        estimatedDelivery: '7-14 days',
        availabilityType: product.availabilityType,
      };
    } else if (availableStock > 0 && availableStock < newTotalQuantity) {
      // Partial stock available
      if (isPreorder && allowPreorder) {
        const preorderType =
          product.availabilityType === 'In Stock'
            ? 'preorder'
            : product.availabilityType.toLowerCase();
        inventoryCheck = {
          available: true,
          type: 'partial_preorder',
          message: `${availableStock} items in stock, ${
            newTotalQuantity - availableStock
          } items as ${preorderType}`,
          inStock: availableStock,
          preorderQuantity: newTotalQuantity - availableStock,
          availabilityType: product.availabilityType,
        };
      } else {
        return res.status(400).json({
          message: `Only ${availableStock} items available. You already have ${currentQuantity} in your cart.`,
          availableStock: availableStock,
          currentCartQuantity: currentQuantity,
          canPreorder: true, // Always allow preorder when out of stock
          availabilityType: product.availabilityType,
        });
      }
    } else {
      // No stock available
      if (isPreorder && allowPreorder) {
        const preorderType =
          product.availabilityType === 'In Stock'
            ? 'preorder'
            : product.availabilityType.toLowerCase();
        inventoryCheck = {
          available: true,
          type: 'preorder',
          message: `Item out of stock - available for ${preorderType}`,
          estimatedDelivery: getEstimatedDelivery(product.availabilityType),
          availabilityType: product.availabilityType,
        };
      } else {
        return res.status(400).json({
          message: 'Item is currently out of stock',
          availableStock: 0,
          currentCartQuantity: currentQuantity,
          canPreorder: true, // Always allow preorder when out of stock
          availabilityType: product.availabilityType,
        });
      }
    }

    // Calculate pricing
    let unitPrice = variantId
      ? product.variants.id(variantId).finalPrice ||
        product.variants.id(variantId).price
      : product.finalPrice || product.price;

    // Add to cart with product details
    if (user.cartData.has(cartKey)) {
      // Update existing item
      const existingCartItem = user.cartData.get(cartKey);
      existingCartItem.quantity = newTotalQuantity;
      existingCartItem.updatedAt = new Date();

      // Update preorder status if applicable
      if (inventoryCheck.type.includes('preorder')) {
        existingCartItem.isPreorder = true;
        existingCartItem.estimatedDelivery = inventoryCheck.estimatedDelivery;
        existingCartItem.availabilityType = product.availabilityType;
      }
    } else {
      // Add new item with product details
      const cartItem = {
        productId,
        variantId,
        quantity: quantityNum,
        selectedAttributes: selectedAttributes || {},
        productName: product.title,
        productImage: product.images[0],
        unitPrice: unitPrice,
        addedAt: new Date(),
        isPreorder: inventoryCheck.type.includes('preorder'),
        availabilityType: product.availabilityType,
      };

      // Add preorder specific data
      if (inventoryCheck.type.includes('preorder')) {
        cartItem.estimatedDelivery =
          inventoryCheck.estimatedDelivery ||
          getEstimatedDelivery(product.availabilityType);
        cartItem.preorderDate = new Date();
      }

      user.cartData.set(cartKey, cartItem);
    }

    await user.save();

    // Prepare response message
    let responseMessage = 'Item added to cart';
    if (inventoryCheck.type === 'preorder') {
      const preorderType =
        product.availabilityType === 'In Stock'
          ? 'preorder'
          : product.availabilityType.toLowerCase();
      responseMessage = `Item added to cart as ${preorderType}`;
    } else if (inventoryCheck.type === 'partial_preorder') {
      const preorderType =
        product.availabilityType === 'In Stock'
          ? 'preorder'
          : product.availabilityType.toLowerCase();
      responseMessage = `Item added to cart (partial ${preorderType})`;
    }

    res.json({
      success: true,
      message: responseMessage,
      inventoryStatus: inventoryCheck,
      cartItemCount: user.getCartItemCount(),
      cartItem: user.cartData.get(cartKey),
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Updated helper function
function getEstimatedDelivery(availabilityType) {
  switch (availabilityType) {
    case 'Pre-order':
      return '7-14 days';
    case 'Made to Order':
      return '14-21 days';
    case 'Limited Edition':
      return '3-7 days';
    case 'In Stock':
      return '7-14 days'; // Default preorder delivery for normally in-stock items
    default:
      return '7-14 days';
  }
}

const getCart = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const Product = mongoose.model('product');
    const cartItems = [];

    // Process each cart item with current product details
    for (const [key, item] of user.cartData.entries()) {
      try {
        const product = await Product.findById(item.productId);

        if (!product) {
          // Product no longer exists, remove from cart
          user.cartData.delete(key);
          continue;
        }

        let variant = null;
        let currentPrice = product.price;
        let currentDiscount = product.discount || 0;
        let isAvailable = product.isActive && product.stock > 0;
        let availableStock = product.stock;
        let productImage = product.images[0];

        // Check variant if specified
        if (item.variantId) {
          variant = product.variants.id(item.variantId);

          if (!variant) {
            // Variant no longer exists, remove from cart
            user.cartData.delete(key);
            continue;
          }

          currentPrice = variant.price;
          currentDiscount = variant.discount || 0;
          isAvailable = variant.isActive && variant.stock > 0;
          availableStock = variant.stock;

          // Use variant image if available
          if (variant.images && variant.images.length > 0) {
            productImage = variant.images[0];
          }
        }

        const finalPrice =
          currentPrice - currentPrice * (currentDiscount / 100);

        cartItems.push({
          key,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          selectedAttributes: item.selectedAttributes || {},
          // ADD PREORDER INFORMATION:
          isPreorder: item.isPreorder || false,
          estimatedDelivery: item.estimatedDelivery,
          availabilityType: item.availabilityType,
          preorderDate: item.preorderDate,
          product: {
            title: product.title,
            image: productImage,
            price: currentPrice,
            discount: currentDiscount,
            finalPrice,
            isAvailable,
            availableStock,
          },
          total: finalPrice * item.quantity,
          addedAt: item.addedAt,
        });
      } catch (error) {
        console.error(`Error processing cart item ${key}:`, error);
      }
    }

    // Save user if we removed any invalid items
    if (cartItems.length !== user.cartData.size) {
      await user.save();
    }

    // Calculate cart totals
    const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);

    res.json({
      cartItems,
      totalItems: user.getCartItemCount(),
      subtotal,
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: error.message });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { cartKey } = req.body;

    if (!cartKey) {
      return res.status(400).json({ message: 'Cart item key is required' });
    }

    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if item exists in cart
    if (!user.cartData.has(cartKey)) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    const cartItem = user.cartData.get(cartKey);

    // Release reserved inventory if applicable
    if (!cartItem.isPreorder) {
      const { productId, variantId, quantity } = cartItem;

      try {
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
      } catch (error) {
        console.warn('Failed to release reserved inventory:', error);
        // Don't fail the cart removal if inventory update fails
      }
    }

    // Remove item
    user.cartData.delete(cartKey);
    await user.save();

    // Calculate remaining cart totals with current prices
    const Product = mongoose.model('product');
    let subtotal = 0;

    for (const [key, item] of user.cartData.entries()) {
      try {
        const product = await Product.findById(item.productId);
        if (product) {
          let currentPrice;

          if (item.variantId) {
            const variant = product.variants.id(item.variantId);
            currentPrice = variant
              ? variant.finalPrice || variant.price
              : product.finalPrice || product.price;
          } else {
            currentPrice = product.finalPrice || product.price;
          }

          subtotal += currentPrice * item.quantity;
        }
      } catch (error) {
        console.warn(`Failed to calculate price for cart item ${key}:`, error);
        // Fallback to stored price
        subtotal += (item.unitPrice || 0) * item.quantity;
      }
    }

    res.json({
      success: true,
      message: 'Item removed from cart',
      cartItemCount: user.getCartItemCount(),
      subtotal,
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: error.message });
  }
};
const updateCartQuantity = async (req, res) => {
  try {
    const { cartKey, quantity } = req.body;

    if (!cartKey) {
      return res.status(400).json({ message: 'Cart item key is required' });
    }

    const quantityNum = Number(quantity);
    if (isNaN(quantityNum)) {
      return res.status(400).json({ message: 'Quantity must be a number' });
    }

    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if item exists in cart
    if (!user.cartData.has(cartKey)) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    const cartItem = user.cartData.get(cartKey);

    // Handle removal if quantity is 0 or negative
    if (quantityNum <= 0) {
      user.cartData.delete(cartKey);
      await user.save();

      return res.json({
        success: true,
        message: 'Item removed from cart',
        cartItemCount: user.getCartItemCount(),
      });
    }

    // Check inventory before updating (unless it's a preorder item)
    const { productId, variantId, isPreorder } = cartItem;

    const Product = mongoose.model('product');
    const product = await Product.findById(productId);

    if (!product) {
      // Product no longer exists, remove from cart
      user.cartData.delete(cartKey);
      await user.save();

      return res.status(404).json({ message: 'Product not found' });
    }

    let availableStock;
    let allowPreorder = false;

    if (variantId) {
      const variant = product.variants.id(variantId);

      if (!variant) {
        // Variant no longer exists, remove from cart
        user.cartData.delete(cartKey);
        await user.save();

        return res.status(404).json({ message: 'Product variant not found' });
      }

      if (!variant.isActive) {
        return res
          .status(400)
          .json({ message: 'This product variant is currently unavailable' });
      }

      availableStock = variant.stock;
      allowPreorder = variant.inventory?.backorderAllowed || false;
    } else {
      availableStock = product.stock;
      allowPreorder =
        product.availabilityType === 'Pre-order' ||
        product.availabilityType === 'Made to Order';
    }

    // Stock validation - different logic for preorder vs regular items
    if (!isPreorder && quantityNum > availableStock) {
      return res.status(400).json({
        message: `Only ${availableStock} items available`,
        availableStock,
        canPreorder: allowPreorder,
        currentIsPreorder: isPreorder,
      });
    }

    // For preorder items, we allow any quantity (within reason)
    if (isPreorder && quantityNum > 100) {
      // Reasonable limit for preorders
      return res.status(400).json({
        message: 'Quantity too large for preorder',
        maxQuantity: 100,
      });
    }

    // Update quantity
    const oldQuantity = cartItem.quantity;
    user.cartData.get(cartKey).quantity = quantityNum;
    user.cartData.get(cartKey).updatedAt = new Date();

    // Update inventory reservation for non-preorder items
    if (!isPreorder && variantId) {
      try {
        const variant = product.variants.id(variantId);
        if (variant && variant.inventory?.managed) {
          const quantityDiff = quantityNum - oldQuantity;
          variant.inventory.reservedQuantity = Math.max(
            0,
            variant.inventory.reservedQuantity + quantityDiff
          );
          await product.save();
        }
      } catch (error) {
        console.warn('Failed to update reserved inventory:', error);
        // Continue with cart update even if inventory update fails
      }
    }

    await user.save();

    res.json({
      success: true,
      message: 'Cart updated',
      cartItemCount: user.getCartItemCount(),
      item: {
        key: cartKey,
        ...user.cartData.get(cartKey),
      },
    });
  } catch (error) {
    console.error('Update cart quantity error:', error);
    res.status(500).json({ message: error.message });
  }
};

const clearCart = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Release all reserved inventory for non-preorder items
    const Product = mongoose.model('product');

    for (const [cartKey, cartItem] of user.cartData.entries()) {
      if (!cartItem.isPreorder && cartItem.variantId) {
        try {
          const product = await Product.findById(cartItem.productId);
          if (product) {
            const variant = product.variants.id(cartItem.variantId);
            if (variant && variant.inventory?.managed) {
              variant.inventory.reservedQuantity = Math.max(
                0,
                variant.inventory.reservedQuantity - cartItem.quantity
              );
              await product.save();
            }
          }
        } catch (error) {
          console.warn(`Failed to release inventory for ${cartKey}:`, error);
        }
      }
    }

    // Clear cart
    user.cartData.clear();
    await user.save();

    res.json({
      success: true,
      message: 'Cart cleared',
      cartItemCount: 0,
      subtotal: 0,
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: error.message });
  }
};

const addToWishlist = async (req, res) => {
  try {
    const { productId, variantId, selectedAttributes } = req.body;
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingItem = user.wishlist.find(
      (item) =>
        item.productId.toString() === productId &&
        (item.variantId === variantId || (!item.variantId && !variantId))
    );

    if (!existingItem) {
      user.wishlist.push({
        productId,
        variantId,
        selectedAttributes,
      });
      await user.save();
    }

    res.json({ success: true, message: 'Added to wishlist' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId, variantId } = req.body;
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.wishlist = user.wishlist.filter(
      (item) =>
        !(
          item.productId.toString() === productId &&
          (item.variantId === variantId || (!item.variantId && !variantId))
        )
    );

    await user.save();
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getWishlist = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.user._id)
      .populate('wishlist.productId');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Address management
const addAddress = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { isDefault, ...addressData } = req.body;

    if (isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    user.addresses.push({ ...addressData, isDefault });
    await user.save();

    res.json({ success: true, message: 'Address added successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const { isDefault, ...addressData } = req.body;

    if (isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    Object.assign(address, addressData);
    await user.save();

    res.json({ success: true, message: 'Address updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if address exists
    const addressExists = user.addresses.id(addressId);
    if (!addressExists) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    // Remove the address using pull()
    user.addresses.pull(addressId);
    await user.save();

    res.json({
      success: true,
      message: 'Address deleted successfully',
      addressCount: user.addresses.length,
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Recently viewed
const addToRecentlyViewed = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove if already exists
    user.recentlyViewed = user.recentlyViewed.filter(
      (item) => item.productId.toString() !== productId
    );

    // Add to beginning
    user.recentlyViewed.unshift({ productId });

    // Keep only last 20 items
    user.recentlyViewed = user.recentlyViewed.slice(0, 20);

    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user preferences
const updatePreferences = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.preferences = { ...user.preferences, ...req.body };
    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated',
      preferences: user.preferences,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Photography-related methods
const likePhoto = async (req, res) => {
  try {
    const { photoId } = req.body;
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.likedPhotos.includes(photoId)) {
      user.likedPhotos.push(photoId);
      await user.save();
    }

    res.json({ success: true, message: 'Photo liked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const unlikePhoto = async (req, res) => {
  try {
    const { photoId } = req.body;
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.likedPhotos = user.likedPhotos.filter(
      (id) => id.toString() !== photoId
    );
    await user.save();

    res.json({ success: true, message: 'Photo unliked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, dateOfBirth, gender, bio, preferences } = req.body;

    // Find user
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Validate inputs
    if (name && (name.length < 2 || name.length > 50)) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 50 characters',
      });
    }

    if (phone && !validator.isMobilePhone(phone, 'any')) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number',
      });
    }

    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();

      if (age < 13 || age > 120) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid date of birth',
        });
      }
    }

    if (bio && bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Bio must be less than 500 characters',
      });
    }

    if (
      gender &&
      !['male', 'female', 'other', 'prefer-not-to-say'].includes(gender)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid gender option',
      });
    }

    // Update user fields
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (phone) updateData.phone = phone.trim();
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
    if (gender) updateData.gender = gender;
    if (bio !== undefined) updateData.bio = bio.trim();

    // Update preferences if provided
    if (preferences) {
      updateData.preferences = {
        ...user.preferences,
        ...preferences,
      };
    }

    // Update user
    const updatedUser = await userModel
      .findByIdAndUpdate(userId, updateData, { new: true, runValidators: true })
      .select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

// Change password
// export const changePassword = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { currentPassword, newPassword } = req.body;

//     // Validate inputs
//     if (!currentPassword || !newPassword) {
//       return res.status(400).json({
//         success: false,
//         message: 'Current password and new password are required',
//       });
//     }

//     if (newPassword.length < 6) {
//       return res.status(400).json({
//         success: false,
//         message: 'New password must be at least 6 characters long',
//       });
//     }

//     // Find user
//     const user = await userModel.findById(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found',
//       });
//     }

//     // Verify current password
//     const isValidPassword = await bcrypt.compare(
//       currentPassword,
//       user.password
//     );
//     if (!isValidPassword) {
//       return res.status(400).json({
//         success: false,
//         message: 'Current password is incorrect',
//       });
//     }

//     // Hash new password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(newPassword, salt);

//     // Update password
//     await userModel.findByIdAndUpdate(userId, {
//       password: hashedPassword,
//     });

//     res.json({
//       success: true,
//       message: 'Password changed successfully',
//     });
//   } catch (error) {
//     console.error('Change password error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to change password',
//       error: error.message,
//     });
//   }
// };

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // Check if user exists
    const user = await userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message:
          'If an account with that email exists, we have sent a password reset link',
      });
    }

    // Check for recent reset requests (rate limiting)
    const recentRequest = await PasswordReset.findOne({
      email: email.toLowerCase(),
      createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutes
      used: false,
    });

    if (recentRequest) {
      return res.status(429).json({
        success: false,
        message:
          'Password reset already requested. Please check your email or wait 5 minutes before trying again.',
      });
    }

    // Generate secure reset token
    const resetToken =crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Save reset request
    await PasswordReset.create({
      userId: user._id,
      email: email.toLowerCase(),
      token: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send emails
    try {
      // Send reset email to user
      await sendPasswordResetEmail(user, resetToken, resetUrl);

      // Send security alert (optional - some services do this)
      await sendPasswordResetAlert(
        user,
        req.ip || req.connection.remoteAddress,
        req.headers['user-agent'],
        new Date()
      );

      console.log(`Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message:
        'If an account with that email exists, we have sent a password reset link',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request',
    });
  }
};

// Reset password with token
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // Hash the token to match stored version
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset request
    const resetRequest = await PasswordReset.findOne({
      token: hashedToken,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRequest) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Get user
    const user = await userModel.findById(resetRequest.userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Mark reset request as used
    resetRequest.used = true;
    await resetRequest.save();

    // Invalidate all other pending reset requests for this user
    await PasswordReset.updateMany(
      {
        userId: user._id,
        used: false,
        _id: { $ne: resetRequest._id },
      },
      { used: true }
    );

    // Log the password reset activity
    try {
      await LoginActivity.create({
        user: user._id,
        action: 'password_reset',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        loginType: 'password_reset',
      });
    } catch (logError) {
      console.error('Error logging password reset activity:', logError);
    }

    // Send confirmation email
    try {
      await sendPasswordResetSuccess(user);
      console.log(`Password reset confirmation sent to ${user.email}`);
    } catch (emailError) {
      console.error('Error sending password reset confirmation:', emailError);
    }

    res.json({
      success: true,
      message:
        'Password has been reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting your password',
    });
  }
};

// Verify reset token (for frontend validation)
export const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required',
      });
    }

    // Hash the token to match stored version
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset request
    const resetRequest = await PasswordReset.findOne({
      token: hashedToken,
      used: false,
      expiresAt: { $gt: new Date() },
    }).populate('userId', 'name email');

    if (!resetRequest) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    res.json({
      success: true,
      message: 'Token is valid',
      user: {
        name: resetRequest.userId.name,
        email: resetRequest.userId.email,
      },
    });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while verifying the token',
    });
  }
};

// Change password for logged-in users
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user._id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long',
      });
    }

    // Get user with password
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as current password',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Log the activity
    try {
      await LoginActivity.create({
        user: user._id,
        action: 'password_change',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        loginType: 'password_change',
      });
    } catch (logError) {
      console.error('Error logging password change activity:', logError);
    }

    // Send confirmation email
    try {
      await sendPasswordResetSuccess(user);
    } catch (emailError) {
      console.error('Error sending password change confirmation:', emailError);
    }

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while changing your password',
    });
  }
};

export {
  loginUser,
  registerUser,
  adminLogin,
  getMe,
  addToCart,
  getCart,
  removeFromCart,
  updateCartQuantity,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  addAddress,
  updateAddress,
  deleteAddress,
  addToRecentlyViewed,
  updatePreferences,
  likePhoto,
  unlikePhoto,
};
