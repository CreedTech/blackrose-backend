// controllers/orderController.js
import orderModel from '../models/orderModel.js';
import productModel from '../models/productModel.js';
import transactionModel from '../models/transactionModel.js';
import userModel from '../models/userModel.js';
import {
  sendOrderConfirmation,
  sendNewOrderAlert,
  sendPreorderNotification,
  sendPaymentConfirmation,
} from '../utils/emailService.js';

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
    let hasPreorderItems = false;

    // Process each item to check inventory and get current pricing
    for (const item of items) {
      const { productId, variantId, quantity, isPreorder = false } = item;

      // Find product
      const product = await productModel.findById(productId);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${productId} is unavailable`,
          invalidItem: item,
        });
      }

      let finalPrice, currentStock, sku, selectedAttributes, image, itemType;

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

        // Check inventory for variants
        if (variant.stock >= quantity) {
          // Sufficient stock available
          itemType = 'in_stock';
        } else if (
          isPreorder &&
          (variant.inventory?.backorderAllowed || isPreorder)
        ) {
          // Not enough stock but preorder is allowed
          itemType = 'preorder';
          hasPreorderItems = true;
        } else {
          // Not enough stock and no preorder
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.title} (${
              variant.color || ''
            } ${variant.size || ''})`,
            availableStock: variant.stock,
            requestedQuantity: quantity,
            canPreorder: true,
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
        if (product.stock >= quantity) {
          // Sufficient stock available
          itemType = 'in_stock';
        } else if (isPreorder) {
          // Not enough stock but preorder is allowed
          itemType = 'preorder';
          hasPreorderItems = true;
        } else {
          // Not enough stock and no preorder
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.title}`,
            availableStock: product.stock,
            requestedQuantity: quantity,
            canPreorder: true,
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
        // Add preorder information
        isPreorder: itemType === 'preorder',
        stockAvailable: Math.min(currentStock, quantity),
        preorderQuantity:
          itemType === 'preorder' ? Math.max(0, quantity - currentStock) : 0,
        estimatedDelivery:
          itemType === 'preorder'
            ? getEstimatedDelivery(product.availabilityType)
            : null,
        availabilityType: product.availabilityType,
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

    // Determine order status based on preorder items
    const initialStatus = hasPreorderItems ? 'pending' : 'pending';
    const statusNote = hasPreorderItems
      ? 'Order created with preorder items'
      : 'Order created';

    // Calculate estimated delivery date considering preorder items
    let estimatedDeliveryDate = getEstimatedDeliveryDate(shippingMethod);

    if (hasPreorderItems) {
      // Add extra time for preorder items (ensure we have a valid Date object)
      if (
        estimatedDeliveryDate instanceof Date &&
        !isNaN(estimatedDeliveryDate)
      ) {
        estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 7); // Add 7 days for preorder processing
      } else {
        // Fallback: create a new date with preorder processing time
        estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 14); // 14 days for preorder
      }
    }

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
      status: initialStatus,
      paymentMethod,
      paymentStatus: 'pending',
      customerNotes: notes,
      date: Date.now(),
      estimatedDeliveryDate,
      // Add preorder-specific fields
      hasPreorderItems,
      fulfillmentMethod: hasPreorderItems ? 'preorder' : 'standard',
      statusHistory: [
        {
          status: initialStatus,
          timestamp: new Date(),
          note: statusNote,
          updatedBy: 'system',
        },
      ],
    });

    // Save order to database
    const savedOrder = await order.save();

    // Send email notifications
    try {
      // Send order confirmation to customer
      const customerEmail = shippingAddress.email || req.user.email;

      if (hasPreorderItems) {
        await sendPreorderNotification(savedOrder, customerEmail);
      } else {
        await sendOrderConfirmation(savedOrder, customerEmail);
      }

      // Send new order alert to admin
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';
      await sendNewOrderAlert(savedOrder, adminEmail);

      console.log('Order confirmation emails sent successfully');
    } catch (emailError) {
      console.error('Error sending order emails:', emailError);
      // Don't fail the order creation if email fails
    }

    // Prepare response with preorder information
    const response = {
      success: true,
      message: hasPreorderItems
        ? 'Order created successfully with preorder items'
        : 'Order created successfully',
      order: savedOrder,
      hasPreorderItems,
    };

    if (hasPreorderItems) {
      response.preorderInfo = {
        message:
          'Some items in your order are preorders and will require additional processing time',
        estimatedDelivery: estimatedDeliveryDate,
        preorderItems: validatedItems
          .filter((item) => item.isPreorder)
          .map((item) => ({
            title: item.title,
            quantity: item.preorderQuantity,
            estimatedDelivery: item.estimatedDelivery,
          })),
      };
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message,
    });
  }
};

// Helper function for estimated delivery based on availability type
function getEstimatedDelivery(availabilityType) {
  switch (availabilityType) {
    case 'Pre-order':
      return '7-14 days';
    case 'Made to Order':
      return '14-21 days';
    case 'Limited Edition':
      return '3-7 days';
    case 'In Stock':
      return '7-14 days'; // For preorder of normally in-stock items
    default:
      return '7-14 days';
  }
}

async function calculateShippingCost(items, shippingMethod, shippingAddress) {
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
  let deliveryDays;

  switch (shippingMethod) {
    case 'express':
      deliveryDays = 2;
      break;
    case 'pickup':
      deliveryDays = 1;
      break;
    case 'standard':
    default:
      deliveryDays = 5;
      break;
  }

  const deliveryDate = new Date(today);
  deliveryDate.setDate(today.getDate() + deliveryDays);
  return deliveryDate;
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

async function restoreInventory(order) {
  let restoredCount = 0;
  let skippedCount = 0;

  for (const item of order.items) {
    try {
      // Skip inventory restoration for preorder items
      if (item.isPreorder) {
        console.log(
          `Skipping inventory restoration for preorder item: ${item.title} (${item.quantity} units)`
        );
        skippedCount++;
        continue;
      }

      const product = await productModel.findById(item.productId);

      if (!product) {
        console.warn(
          `Product not found for inventory restoration: ${item.productId}`
        );
        continue;
      }

      let restored = false;

      if (item.variantId) {
        // Update variant stock for non-preorder items only
        const variant = product.variants.id(item.variantId);
        if (variant) {
          const oldStock = variant.stock;
          variant.stock += item.quantity;

          // Also update reserved quantity if using inventory management
          if (variant.inventory?.managed) {
            variant.inventory.reservedQuantity = Math.max(
              0,
              variant.inventory.reservedQuantity - item.quantity
            );
          }

          console.log(
            `Variant ${item.variantId}: Stock restored from ${oldStock} to ${variant.stock}`
          );
          restored = true;
        }
      } else {
        // Update main product stock for non-preorder items only
        const oldStock = product.stock;
        product.stock += item.quantity;
        console.log(
          `Product ${item.productId}: Stock restored from ${oldStock} to ${product.stock}`
        );
        restored = true;
      }

      if (restored) {
        await product.save();
        restoredCount++;
      }
    } catch (error) {
      console.error(
        `Error restoring inventory for product ${item.productId}:`,
        error
      );
      // Continue with the next item
    }
  }

  console.log(
    `Inventory restoration complete: ${restoredCount} items restored, ${skippedCount} preorder items skipped`
  );
}
