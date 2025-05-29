import mongoose from 'mongoose';

// const orderSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: String,
//       required: true,
//     },
//     items: [
//       {
//         productId: String,
//         title: String,
//         price: Number,
//         quantity: Number,
//         image: String,
//       },
//     ],
//     amount: {
//       type: Number,
//       required: true,
//     },
//     address: {
//       fullName: String,
//       address: String,
//       city: String,
//       state: String,
//       zipCode: String,
//       phone: String,
//       email: String,
//     },
//     status: {
//       type: String,
//       required: true,
//       default: 'Order Placed',
//     },
//     paymentMethod: {
//       type: String,
//       required: true,
//     },
//     payment: {
//       type: Boolean,
//       default: false,
//     },
//     date: {
//       type: Number,
//       required: true,
//     },
//     paymentReference: String,
//     paymentStatus: {
//       type: String,
//       enum: ['pending', 'success', 'failed'],
//       default: 'pending',
//     },
//     paymentDetails: Object,
//     discount: {
//       code: String,
//       amount: Number,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// const orderModel =
//   mongoose.models.order || mongoose.model('order', orderSchema);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },

    // Enhanced items array to support variants
    items: [
      {
        productId: { type: String, required: true },
        variantId: String, // For products with variants
        title: { type: String, required: true },
        sku: String, // Product or variant SKU

        // Variant details (if applicable)
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

        price: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        finalPrice: { type: Number, required: true },
        quantity: { type: Number, required: true },
        image: String,

        // Digital download info
        isDigitalDownload: { type: Boolean, default: false },
        downloadLinks: [String],
        downloadExpiry: Date,

        // Fulfillment tracking per item
        itemStatus: {
          type: String,
          enum: [
            'pending',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'returned',
          ],
          default: 'pending',
        },
        trackingNumber: String,
        shippedAt: Date,
        deliveredAt: Date,
      },
    ],

    // Order totals
    subtotal: { type: Number, required: true },
    discount: {
      code: String,
      type: { type: String, enum: ['percentage', 'fixed'] },
      amount: Number,
      appliedAmount: Number,
    },
    shipping: {
      method: String,
      cost: { type: Number, default: 0 },
      estimatedDelivery: String,
    },
    tax: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
    amount: {
      type: Number,
      required: true,
    },

    // Enhanced address with billing/shipping separation
    shippingAddress: {
      fullName: String,
      address: String,
      city: String,
      state: String,
      zipCode: String,
      phone: String,
      email: String,
    },
    billingAddress: {
      fullName: String,
      address: String,
      city: String,
      state: String,
      zipCode: String,
      phone: String,
      email: String,
      sameAsShipping: { type: Boolean, default: true },
    },

    // Order status and tracking
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'returned',
        'refunded',
      ],
      default: 'pending',
    },

    // Status history for tracking
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
        updatedBy: String, // userId or system
      },
    ],

    // Payment information
    paymentMethod: {
      type: String,
      required: true,
    },
    payment: {
      type: Boolean,
      default: false,
    },
    paymentReference: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentDetails: Object,

    // Shipping tracking
    tracking: {
      carrier: String,
      trackingNumber: String,
      trackingUrl: String,
      estimatedDelivery: Date,
      actualDelivery: Date,
    },

    // Order notes and communication
    customerNotes: String,
    adminNotes: String,

    // Fulfillment details
    fulfillmentMethod: {
      type: String,
      enum: ['standard', 'express', 'pickup', 'digital'],
      default: 'standard',
    },

    // Dates
    date: {
      type: Date,
      required: true,
    },
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,

    // Returns and refunds
    returnRequested: { type: Boolean, default: false },
    returnReason: String,
    returnStatus: {
      type: String,
      enum: ['none', 'requested', 'approved', 'denied', 'completed'],
      default: 'none',
    },
    refundAmount: Number,
    refundReason: String,
  },
  {
    timestamps: true,
  }
);

// Auto-generate order number
orderSchema.pre('save', function (next) {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    this.orderNumber = `ORD-${timestamp.slice(-6)}${random}`;
  }
  next();
});

// Method to add status history
orderSchema.methods.updateStatus = function (
  newStatus,
  note = '',
  updatedBy = 'system'
) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note,
    updatedBy,
  });
  return this.save();
};

// Method to calculate order totals
orderSchema.methods.calculateTotals = function () {
  this.subtotal = this.items.reduce(
    (sum, item) => sum + item.finalPrice * item.quantity,
    0
  );

  let discountAmount = 0;
  if (this.discount && this.discount.amount) {
    if (this.discount.type === 'percentage') {
      discountAmount = (this.subtotal * this.discount.amount) / 100;
    } else {
      discountAmount = this.discount.amount;
    }
    this.discount.appliedAmount = discountAmount;
  }

  this.amount =
    this.subtotal -
    discountAmount +
    (this.shipping?.cost || 0) +
    (this.tax?.amount || 0);

  return this;
};
// Add to the order schema
orderSchema.pre('save', async function (next) {
  // If status changing to 'confirmed', decrement inventory
  if (this.isModified('status') && this.status === 'confirmed') {
    try {
      await this.decrementInventory();
    } catch (error) {
      return next(error);
    }
  }

  // If status changing to 'cancelled' or 'returned', increment inventory
  if (
    this.isModified('status') &&
    (this.status === 'cancelled' || this.status === 'returned')
  ) {
    try {
      await this.incrementInventory();
    } catch (error) {
      return next(error);
    }
  }

  next();
});

// Method to decrement inventory after order confirmation
orderSchema.methods.decrementInventory = async function () {
  const Product = mongoose.model('product');

  for (const item of this.items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    if (item.variantId) {
      await product.updateVariantStock(item.variantId, -item.quantity);
    } else {
      product.stock -= item.quantity;
      await product.save();
    }
  }
};

// Method to increment inventory after cancellation/return
orderSchema.methods.incrementInventory = async function () {
  const Product = mongoose.model('product');

  for (const item of this.items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    if (item.variantId) {
      await product.updateVariantStock(item.variantId, item.quantity);
    } else {
      product.stock += item.quantity;
      await product.save();
    }
  }
};
// Add method to calculate shipping cost based on items and address
orderSchema.methods.calculateShippingCost = function (shippingAddress) {
  // Basic calculation - can be expanded with shipping zone logic
  let baseCost = 0;
  let weightBasedCost = 0;
  let specialHandlingCost = 0;

  // Sum up weights and check for special handling
  this.items.forEach((item) => {
    // Weight-based calculations would go here
    // Special handling checks would go here
  });

  this.shipping.cost = baseCost + weightBasedCost + specialHandlingCost;
  return this.shipping.cost;
};

// Add methods for order lifecycle transitions
orderSchema.methods.confirmOrder = async function (userId = 'system') {
  if (this.status !== 'pending') {
    throw new Error(`Cannot confirm order in ${this.status} status`);
  }

  await this.updateStatus('confirmed', 'Order confirmed', userId);

  // Additional actions upon confirmation:
  // 1. Send confirmation email
  // 2. Decrement inventory (handled by pre-save hook)
  // 3. Process payment if not already processed

  return this;
};

orderSchema.methods.processOrder = async function (userId = 'system') {
  if (this.status !== 'confirmed') {
    throw new Error(`Cannot process order in ${this.status} status`);
  }

  await this.updateStatus('processing', 'Order processing started', userId);

  // Set estimated delivery date based on shipping method
  const processingDays = 1; // Base processing time
  const shippingDays = this.shipping.method === 'express' ? 2 : 5;

  const estimatedDate = new Date();
  estimatedDate.setDate(
    estimatedDate.getDate() + processingDays + shippingDays
  );
  this.estimatedDeliveryDate = estimatedDate;

  return this.save();
};

orderSchema.methods.shipOrder = async function (
  trackingInfo,
  userId = 'system'
) {
  if (this.status !== 'processing') {
    throw new Error(`Cannot ship order in ${this.status} status`);
  }

  // Update tracking information
  this.tracking = {
    ...this.tracking,
    ...trackingInfo,
    trackingUrl: generateTrackingUrl(
      trackingInfo.carrier,
      trackingInfo.trackingNumber
    ),
  };

  // Update all items to shipped status
  this.items.forEach((item) => {
    item.itemStatus = 'shipped';
    item.shippedAt = new Date();
  });

  await this.updateStatus(
    'shipped',
    `Order shipped via ${trackingInfo.carrier}`,
    userId
  );

  // Additional actions:
  // 1. Send shipping notification email with tracking info

  return this;
};

// Helper function for tracking URL generation
function generateTrackingUrl(carrier, trackingNumber) {
  // Logic to generate carrier-specific tracking URLs
  const carrierUrls = {
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    fedex: `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNumber}`,
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    // Add more carriers as needed
  };

  return carrierUrls[carrier.toLowerCase()] || '';
}
orderSchema.index({ userId: 1, date: -1 });
// orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1, date: -1 });
orderSchema.index({ 'items.productId': 1 });

const orderModel =
  mongoose.models.order || mongoose.model('order', orderSchema);
export default orderModel;
