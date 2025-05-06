import productModel from '../models/productModel.js';
import userModel from '../models/userModel.js';


const addToCart = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    const { productId, quantity } = req.body;
    console.log(req.user._id);

    const user = await userModel.findById(req.user._id);
    const product = await productModel.findById(productId);

    if (!user || !product) {
      return res
        .status(404)
        .json({ success: false, message: 'User or product not found' });
    }

    if (quantity > product.stock) {
      return res.json({
        success: false,
        message: `Only ${product.stock} left in stock`,
      });
    }

    // Update or add product in cart
    if (user.cartData[productId]) {
      user.cartData[productId].quantity += quantity;
    } else {
      user.cartData[productId] = {
        quantity,
        title: product.title,
        finalPrice: product.finalPrice,
        image: product.image?.[0] || '',
      };
    }

    user.markModified('cartData'); // Important line for nested object tracking
    await user.save();

    res.json({
      success: true,
      message: 'Item added to cart',
      cart: user.cartData,
    });
  } catch (error) {
    console.log('Add to cart error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    // Find user and product
    const user = await userModel.findById(req.user._id);
    const product = await productModel.findById(productId);

    if (!user || !product) {
      return res.json({ success: false, message: 'User or product not found' });
    }

    // Check stock
    if (quantity > product.stock) {
      return res.json({
        success: false,
        message: `Only ${product.stock} items available in stock.`,
      });
    }

    // If quantity is 0, remove the product
    if (quantity === 0) {
      delete user.cartData[productId];
    } else {
      // Update with new quantity and latest product data
      user.cartData[productId] = {
        quantity,
        title: product.title,
        finalPrice: product.finalPrice,
        image: product.image[0] || '', // handle missing image array
      };
    }

    await user.save();

    res.json({ success: true, cart: user.cartData });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

const getUserCart = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    res.json({ success: true, cart: user.cartData });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;

    const user = await userModel.findById(req.user._id);
    if (!user) return res.json({ success: false, message: 'User not found' });

    delete user.cartData[productId];

    await user.save();

    res.json({ success: true, cart: user.cartData });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
const clearCart = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });

    user.cartData = {}; // Clear all items
    await user.save();

    res.json({ success: true, message: 'Cart cleared', cart: user.cartData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export { addToCart, updateCart, getUserCart, removeFromCart, clearCart };
