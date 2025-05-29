// import validator from 'validator';
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken';
// import userModel from '../models/userModel.js';
// import LoginActivity from '../models/loginActivityModel.js';

// const createToken = (id) => {
//   return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
// };

// const getMe = async (req, res) => {
//   try {
//     const user = await userModel.findById(req.user._id).select('-password');
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     res.json(user);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// const loginUser = async (req, res) => {
//   console.log('Request body:', req.body);
//   try {
//     // Extract email and password directly from the request body
//     const { email, password } = req.body;
//     const isAdmin = req.body.isAdmin === true;

//     const user = await userModel.findOne({ email });

//     if (!user) {
//       return res.json({ success: false, message: "User doesn't exist" });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return res.json({ success: false, message: 'Invalid credentials' });
//     }

//     // Admin validation
//     if (isAdmin && !user.isAdmin) {
//       return res.json({
//         success: false,
//         message: 'You do not have administrator privileges',
//       });
//     }

//     const token = createToken(user._id);

//     // Log login activity
//     await LoginActivity.create({
//       user: user._id,
//       action: 'login',
//       ip: req.ip,
//       userAgent: req.headers['user-agent'],
//       loginType: isAdmin ? 'admin' : 'user',
//     });

//     res.json({
//       success: true,
//       token,
//       user: {
//         id: user._id,
//         email: user.email,
//         isAdmin: user.isAdmin,
//         // Include other needed user fields
//       },
//     });
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// // Route for user register
// const registerUser = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     // checking user already exists or not
//     const exists = await userModel.findOne({ email });
//     if (exists) {
//       return res.json({ success: false, message: 'User already exists' });
//     }

//     // validating email format & strong password
//     if (!validator.isEmail(email)) {
//       return res.json({
//         success: false,
//         message: 'Please enter a valid email',
//       });
//     }
//     if (password.length < 8) {
//       return res.json({
//         success: false,
//         message: 'Please enter a strong password',
//       });
//     }

//     // hashing user password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     const newUser = new userModel({
//       name,
//       email,
//       password: hashedPassword,
//     });

//     const user = await newUser.save();

//     const token = createToken(user._id);

//     res.json({ success: true, token });
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// // Route for admin login
// const adminLogin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (
//       email === process.env.ADMIN_EMAIL &&
//       password === process.env.ADMIN_PASSWORD
//     ) {
//       const token = jwt.sign(email + password, process.env.JWT_SECRET);
//       res.json({ success: true, token });
//     } else {
//       res.json({ success: false, message: 'Invalid credentials' });
//     }
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// export { loginUser, registerUser, adminLogin, getMe };

import validator from 'validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import LoginActivity from '../models/loginActivityModel.js';
import mongoose from 'mongoose';

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const getMe = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.user._id)
      .select('-password')
      .populate('likedPhotos')
      .populate('collections')
      .populate('uploadedPhotos')
      .populate('wishlist.productId')
      .populate('recentlyViewed.productId');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
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

// Cart management methods
// const addToCart = async (req, res) => {
//   try {
//     const { productId, quantity = 1, variantId, selectedAttributes } = req.body;
//     const user = await userModel.findById(req.user._id);

//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     await user.addToCart(productId, quantity, variantId, selectedAttributes);

//     res.json({
//       success: true,
//       message: 'Item added to cart',
//       cartItemCount: user.getCartItemCount(),
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, variantId, selectedAttributes } = req.body;

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

      // Check if requested quantity is available
      if (variant.stock < newTotalQuantity) {
        return res.status(400).json({
          message: `Only ${variant.stock} items available. You already have ${currentQuantity} in your cart.`,
          availableStock: variant.stock,
          currentCartQuantity: currentQuantity,
        });
      }
    } else {
      // Check main product stock
      if (product.stock < newTotalQuantity) {
        return res.status(400).json({
          message: `Only ${product.stock} items available. You already have ${currentQuantity} in your cart.`,
          availableStock: product.stock,
          currentCartQuantity: currentQuantity,
        });
      }
    }

    // Add to cart with product details for easier display
    if (user.cartData.has(cartKey)) {
      // Update existing item
      user.cartData.get(cartKey).quantity = newTotalQuantity;
      user.cartData.get(cartKey).updatedAt = new Date();
    } else {
      // Add new item with product details
      user.cartData.set(cartKey, {
        productId,
        variantId,
        quantity: quantityNum,
        selectedAttributes: selectedAttributes || {},
        productName: product.title,
        productImage: product.images[0],
        unitPrice: variantId
          ? product.variants.id(variantId).price
          : product.price,
        addedAt: new Date(),
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Item added to cart',
      cartItemCount: user.getCartItemCount(),
      cartItem: user.cartData.get(cartKey),
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: error.message });
  }
};

// const getCart = async (req, res) => {
//   try {
//     const user = await userModel.findById(req.user._id);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     const cartItems = Array.from(user.cartData.entries()).map(
//       ([key, item]) => ({
//         key,
//         ...item,
//       })
//     );

//     res.json({
//       cartItems,
//       totalItems: user.getCartItemCount(),
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };
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
      // You can add more calculated values here like shipping, tax, etc.
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: error.message });
  }
};

// const removeFromCart = async (req, res) => {
//   try {
//     const { cartKey } = req.body;
//     const user = await userModel.findById(req.user._id);

//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     user.cartData.delete(cartKey);
//     await user.save();

//     res.json({
//       success: true,
//       message: 'Item removed from cart',
//       cartItemCount: user.getCartItemCount(),
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

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

    // Remove item
    user.cartData.delete(cartKey);
    await user.save();

    // Calculate remaining cart totals
    const cartItems = Array.from(user.cartData.values());
    const subtotal = cartItems.reduce((sum, item) => {
      // This is simplified - in a real app you'd fetch current prices
      return sum + (item.unitPrice || 0) * item.quantity;
    }, 0);

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

    // Check inventory before updating
    const cartItem = user.cartData.get(cartKey);
    const { productId, variantId } = cartItem;

    const Product = mongoose.model('product');
    const product = await Product.findById(productId);

    if (!product) {
      // Product no longer exists, remove from cart
      user.cartData.delete(cartKey);
      await user.save();

      return res.status(404).json({ message: 'Product not found' });
    }

    let availableStock;

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
    } else {
      availableStock = product.stock;
    }

    // Check if requested quantity is available
    if (quantityNum > availableStock) {
      return res.status(400).json({
        message: `Only ${availableStock} items available`,
        availableStock,
      });
    }

    // Update quantity
    user.cartData.get(cartKey).quantity = quantityNum;
    user.cartData.get(cartKey).updatedAt = new Date();

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

// const updateCartQuantity = async (req, res) => {
//   try {
//     const { cartKey, quantity } = req.body;
//     const user = await userModel.findById(req.user._id);

//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     if (user.cartData.has(cartKey)) {
//       if (quantity <= 0) {
//         user.cartData.delete(cartKey);
//       } else {
//         user.cartData.get(cartKey).quantity = quantity;
//       }
//       await user.save();
//     }

//     res.json({
//       success: true,
//       message: 'Cart updated',
//       cartItemCount: user.getCartItemCount(),
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// Wishlist management
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
      return res.status(404).json({ message: 'User not found' });
    }

    user.addresses.id(addressId).remove();
    await user.save();

    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
