// controllers/orderController.js
import orderModel from '../models/orderModel.js';
import productModel from '../models/productModel.js';
import transactionModel from '../models/transactionModel.js';
import userModel from '../models/userModel.js';

export const createOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      paymentMethod,
      shippingMethod,
      discount,
      notes,
    } = req.body;

    // Validate order data
    if (!items || !items.length || !shippingAddress || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order information',
      });
    }

    // Prepare billing address (use shipping address if not provided)
    const finalBillingAddress = billingAddress || {
      ...shippingAddress,
      sameAsShipping: true,
    };

    // Validate inventory and get current product data
    const validatedItems = [];
    let subtotal = 0;

    // Process each item to check inventory and get current pricing
    for (const item of items) {
      const { productId, variantId, quantity } = item;

      // Find product
      const product = await productModel.findById(productId);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${productId} is unavailable`,
          invalidItem: item,
        });
      }

      let finalPrice, currentStock, sku, selectedAttributes, image;

      // Check variant if specified
      if (variantId) {
        const variant = product.variants.id(variantId);
        if (!variant || !variant.isActive) {
          return res.status(400).json({
            success: false,
            message: `Product variant ${variantId} is unavailable`,
            invalidItem: item,
          });
        }

        // Check inventory
        if (variant.stock < quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.title} (${
              variant.color || ''
            } ${variant.size || ''})`,
            availableStock: variant.stock,
            requestedQuantity: quantity,
            invalidItem: item,
          });
        }

        // Get variant details
        finalPrice =
          variant.price - ((variant.discount || 0) / 100) * variant.price;
        currentStock = variant.stock;
        sku = variant.sku;
        selectedAttributes = {
          color: variant.color,
          size: variant.size,
          material: variant.material,
          finish: variant.finish,
          customSize: variant.customSize,
        };
        image =
          variant.images && variant.images.length > 0
            ? variant.images[0]
            : product.images[0];
      } else {
        // Check main product inventory
        if (product.stock < quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.title}`,
            availableStock: product.stock,
            requestedQuantity: quantity,
            invalidItem: item,
          });
        }

        // Get product details
        finalPrice =
          product.price - ((product.discount || 0) / 100) * product.price;
        currentStock = product.stock;
        sku = product.sku;
        selectedAttributes = {};
        image = product.images[0];
      }

      // Add validated item with current details
      const itemSubtotal = finalPrice * quantity;
      subtotal += itemSubtotal;

      validatedItems.push({
        productId,
        variantId,
        title: product.title,
        sku,
        selectedAttributes,
        price: product.price,
        discount: variantId
          ? product.variants.id(variantId).discount || 0
          : product.discount || 0,
        finalPrice,
        quantity,
        image,
        isDigitalDownload: product.digitalDownload || false,
        itemStatus: 'pending',
      });
    }

    // Calculate shipping cost
    const shippingCost = await calculateShippingCost(
      validatedItems,
      shippingMethod,
      shippingAddress
    );

    // Calculate tax
    const taxRate = 0; // You can implement tax calculations based on location
    const taxAmount = (subtotal * taxRate) / 100;

    // Apply discount if provided
    let discountAmount = 0;
    if (discount && discount.code) {
      // You could implement discount validation here
      if (discount.type === 'percentage') {
        discountAmount = (subtotal * discount.amount) / 100;
      } else {
        discountAmount = discount.amount;
      }
    }

    // Calculate final amount
    const totalAmount = subtotal - discountAmount + shippingCost + taxAmount;

    // Generate unique order number
    const orderNumber = generateOrderNumber();

    // Create new order
    const order = new orderModel({
      userId: req.user._id,
      orderNumber,
      items: validatedItems,
      subtotal,
      discount: discount
        ? {
            code: discount.code,
            type: discount.type,
            amount: discount.amount,
            appliedAmount: discountAmount,
          }
        : undefined,
      shipping: {
        method: shippingMethod,
        cost: shippingCost,
        estimatedDelivery: getEstimatedDeliveryDate(shippingMethod),
      },
      tax: {
        rate: taxRate,
        amount: taxAmount,
      },
      amount: totalAmount,
      shippingAddress,
      billingAddress: finalBillingAddress,
      status: 'pending',
      paymentMethod,
      paymentStatus: 'pending',
      customerNotes: notes,
      date: Date.now(),
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date(),
          note: 'Order created',
          updatedBy: 'system',
        },
      ],
    });

    // Save order to database
    const savedOrder = await order.save();

    // Return the created order
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: savedOrder,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message,
    });
  }
};

// Helper function to calculate shipping cost
async function calculateShippingCost(items, shippingMethod, shippingAddress) {
  // Basic shipping cost calculation
  // You could implement more complex logic based on weight, dimensions, location, etc.
  let baseCost = 0;

  switch (shippingMethod) {
    case 'express':
      baseCost = 2000; // ₦2000 for express shipping
      break;
    case 'standard':
      baseCost = 1000; // ₦1000 for standard shipping
      break;
    case 'economy':
      baseCost = 500; // ₦500 for economy shipping
      break;
    case 'pickup':
      baseCost = 0; // Free for pickup
      break;
    default:
      baseCost = 1000; // Default to standard
  }

  // You could add location-based adjustments here

  return baseCost;
}

// Helper function to generate estimated delivery date
function getEstimatedDeliveryDate(shippingMethod) {
  const today = new Date();
  let days = 0;

  switch (shippingMethod) {
    case 'express':
      days = 2;
      break;
    case 'standard':
      days = 5;
      break;
    case 'economy':
      days = 10;
      break;
    case 'pickup':
      days = 1;
      break;
    default:
      days = 5;
  }

  today.setDate(today.getDate() + days);
  return `${days} days (${today.toLocaleDateString()})`;
}

// Helper function to generate unique order number
function generateOrderNumber() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `ORD-${timestamp.slice(-6)}${random}`;
}

// Enhanced getMyOrders function with better details
export const getMyOrders = async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;

    // Build query
    const query = { userId: req.user._id };
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Find orders with pagination
    const orders = await orderModel
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-__v -adminNotes');

    // Get total count for pagination
    const totalOrders = await orderModel.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / Number(limit));

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalOrders,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
      error: error.message,
    });
  }
};

// Add new method to get order details
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order
    const order = await orderModel.findById(orderId);

    // Check if order exists and belongs to the user
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.userId !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this order',
      });
    }

    // Find associated transaction for payment details
    const transaction = await transactionModel
      .findOne({ orderId })
      .select('-__v');

    res.json({
      success: true,
      order,
      transaction,
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order details',
      error: error.message,
    });
  }
};

// Add method to cancel order
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    // Find order
    const order = await orderModel.findById(orderId);

    // Check if order exists and belongs to the user
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.userId !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this order',
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in ${order.status} status`,
      });
    }

    // Update order status
    await order.updateStatus(
      'cancelled',
      reason || 'Cancelled by user',
      req.user._id
    );

    // If payment was successful, initiate refund
    if (order.paymentStatus === 'success') {
      // You would implement the refund logic here
      // For now, just update the status
      order.paymentStatus = 'refund_pending';
      await order.save();
    }

    // Return restored inventory
    try {
      await restoreInventory(order);
    } catch (invError) {
      console.error('Error restoring inventory:', invError);
      // Continue with cancellation even if inventory restoration fails
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message,
    });
  }
};

// Helper function to restore inventory after cancellation
async function restoreInventory(order) {
  for (const item of order.items) {
    try {
      const product = await productModel.findById(item.productId);

      if (!product) continue;

      if (item.variantId) {
        // Update variant stock
        const variant = product.variants.id(item.variantId);
        if (variant) {
          variant.stock += item.quantity;
        }
      } else {
        // Update main product stock
        product.stock += item.quantity;
      }

      await product.save();
    } catch (error) {
      console.error(
        `Error restoring inventory for product ${item.productId}:`,
        error
      );
      // Continue with the next item
    }
  }
}
