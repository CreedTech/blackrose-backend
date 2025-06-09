// services/emailTemplates.js
const baseTemplate = (content, title = 'BlackRose Store') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .order-summary {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .order-item {
            display: flex;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #e9ecef;
        }
        
        .order-item:last-child {
            border-bottom: none;
        }
        
        .item-image {
            width: 60px;
            height: 60px;
            border-radius: 6px;
            margin-right: 15px;
            object-fit: cover;
        }
        
        .item-details {
            flex: 1;
        }
        
        .item-title {
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .item-attributes {
            font-size: 14px;
            color: #6c757d;
            margin-bottom: 4px;
        }
        
        .item-price {
            font-weight: 600;
            color: #28a745;
        }
        
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        
        .button:hover {
            transform: translateY(-2px);
        }
        
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-pending { background: #ffc107; color: #000; }
        .status-confirmed { background: #17a2b8; color: #fff; }
        .status-processing { background: #fd7e14; color: #fff; }
        .status-shipped { background: #6f42c1; color: #fff; }
        .status-delivered { background: #28a745; color: #fff; }
        .status-cancelled { background: #dc3545; color: #fff; }
        
        .total-section {
            border-top: 2px solid #e9ecef;
            padding-top: 20px;
            margin-top: 20px;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        
        .total-final {
            font-size: 18px;
            font-weight: 700;
            border-top: 1px solid #e9ecef;
            padding-top: 12px;
            margin-top: 12px;
        }
        
        .address-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        
        .footer p {
            color: #6c757d;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #6c757d;
            text-decoration: none;
        }
        
        .preorder-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
        }
        
        .tracking-info {
            background: #e3f2fd;
            border: 1px solid #bbdefb;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        
        @media only screen and (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            
            .header, .content, .footer {
                padding: 20px;
            }
            
            .order-item {
                flex-direction: column;
                text-align: center;
            }
            
            .item-image {
                margin: 0 0 15px 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
        <div class="footer">
            <p>© 2025 BlackRose Store. All rights reserved.</p>
            <p>If you have any questions, contact us at support@dblackrose.com</p>
            <div class="social-links">
                <a href="#">Facebook</a>
                <a href="#">Instagram</a>
                <a href="#">Twitter</a>
            </div>
        </div>
    </div>
</body>
</html>
`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getStatusBadge = (status) => {
  return `<span class="status-badge status-${status}">${status.replace(
    '_',
    ' '
  )}</span>`;
};

const renderOrderItems = (items) => {
  return items
    .map((item) => {
      const attributes = [];
      if (item.selectedAttributes?.color)
        attributes.push(`Color: ${item.selectedAttributes.color}`);
      if (item.selectedAttributes?.size)
        attributes.push(`Size: ${item.selectedAttributes.size}`);
      if (item.selectedAttributes?.material)
        attributes.push(`Material: ${item.selectedAttributes.material}`);

      return `
      <div class="order-item">
        ${
          item.image
            ? `<img src="${item.image}" alt="${item.title}" class="item-image">`
            : ''
        }
        <div class="item-details">
          <div class="item-title">${item.title}</div>
          ${
            attributes.length
              ? `<div class="item-attributes">${attributes.join(', ')}</div>`
              : ''
          }
          <div class="item-attributes">Quantity: ${item.quantity}</div>
          ${
            item.isPreorder
              ? '<div class="item-attributes" style="color: #ff6b35;">⏰ Preorder Item</div>'
              : ''
          }
          <div class="item-price">${formatCurrency(item.finalPrice)} each</div>
        </div>
      </div>
    `;
    })
    .join('');
};

const renderOrderSummary = (order) => {
  return `
    <div class="order-summary">
      <h3 style="margin-bottom: 20px;">Order Summary</h3>
      ${renderOrderItems(order.items)}
      
      <div class="total-section">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(order.subtotal)}</span>
        </div>
      
        <div class="total-row">
          <span>Shipping:</span>
          <span>${formatCurrency(order.shipping.cost)}</span>
        </div>
        ${
          order.tax.amount > 0
            ? `
          <div class="total-row">
            <span>Tax:</span>
            <span>${formatCurrency(order.tax.amount)}</span>
          </div>
        `
            : ''
        }
        <div class="total-row total-final">
          <span>Total:</span>
          <span>${formatCurrency(order.amount)}</span>
        </div>
      </div>
    </div>
  `;
};

export const emailTemplates = {
  orderConfirmation: (data) => {
    const { order } = data;
    const content = `
      <div class="header">
        <h1>Order Confirmed!</h1>
        <p>Thank you for your order. We're preparing it for you.</p>
      </div>
      <div class="content">
        <h2>Order #${order.orderNumber}</h2>
        <p>Order Date: ${formatDate(order.date)}</p>
        <p>Status: ${getStatusBadge(order.status)}</p>
        
        ${
          order.hasPreorderItems
            ? `
          <div class="preorder-notice">
            <strong>⏰ Preorder Notice:</strong> Your order contains preorder items that require additional processing time. 
            Estimated delivery: ${
              order.estimatedDeliveryDate
                ? formatDate(order.estimatedDeliveryDate)
                : 'TBD'
            }
          </div>
        `
            : ''
        }
        
        ${renderOrderSummary(order)}
        
        <div class="address-section">
          <h3>Shipping Address</h3>
          <p>
            ${order.shippingAddress.fullName}<br>
            ${order.shippingAddress.address}<br>
            ${order.shippingAddress.city}, ${
      order.shippingAddress.state
    }            ${order.shippingAddress.zipCode}<br>
            ${order.shippingAddress.phone}
          </p>
        </div>
        
        <a href="#" class="button">Track Your Order</a>
        
        <p>We'll send you another email when your order ships. If you have any questions, feel free to contact us.</p>
      </div>
    `;
    return baseTemplate(content, 'Order Confirmation');
  },

  orderStatusUpdate: (data) => {
    const { order, oldStatus } = data;
    const content = `
      <div class="header">
        <h1>Order Update</h1>
        <p>Your order status has been updated</p>
      </div>
      <div class="content">
        <h2>Order #${order.orderNumber}</h2>
        <p>Status changed from ${getStatusBadge(oldStatus)} to ${getStatusBadge(
      order.status
    )}</p>
        
        ${
          order.status === 'processing'
            ? `
          <p>Great news! We're now processing your order and getting it ready for shipment.</p>
        `
            : ''
        }
        
        ${
          order.status === 'shipped'
            ? `
          <div class="tracking-info">
            <h3>📦 Your order is on the way!</h3>
            ${
              order.tracking?.trackingNumber
                ? `
              <p><strong>Tracking Number:</strong> ${
                order.tracking.trackingNumber
              }</p>
              <p><strong>Carrier:</strong> ${order.tracking.carrier}</p>
              ${
                order.tracking.trackingUrl
                  ? `<a href="${order.tracking.trackingUrl}" class="button">Track Package</a>`
                  : ''
              }
            `
                : ''
            }
          </div>
        `
            : ''
        }
        
        ${renderOrderSummary(order)}
        
        <a href="#" class="button">View Order Details</a>
      </div>
    `;
    return baseTemplate(content, 'Order Update');
  },

  paymentConfirmation: (data) => {
    const { order, transaction } = data;
    const content = `
      <div class="header">
        <h1>Payment Confirmed</h1>
        <p>Your payment has been successfully processed</p>
      </div>
      <div class="content">
        <h2>Payment Receipt</h2>
        <p>Order #${order.orderNumber}</p>
        <p>Payment Date: ${formatDate(new Date())}</p>
        
        <div class="order-summary">
          <h3>Payment Details</h3>
          <div class="total-row">
            <span>Payment Method:</span>
            <span>${order.paymentMethod}</span>
          </div>
          ${
            transaction?.reference
              ? `
            <div class="total-row">
              <span>Transaction Reference:</span>
              <span>${transaction.reference}</span>
            </div>
          `
              : ''
          }
          <div class="total-row total-final">
            <span>Amount Paid:</span>
            <span>${formatCurrency(order.amount)}</span>
          </div>
        </div>
        
        <p>Your order is now confirmed and will be processed shortly.</p>
        
        <a href="#" class="button">View Order Details</a>
      </div>
    `;
    return baseTemplate(content, 'Payment Confirmation');
  },

  orderShipped: (data) => {
    const { order } = data;
    const content = `
      <div class="header">
        <h1>📦 Your Order Has Shipped!</h1>
        <p>Your package is on its way to you</p>
      </div>
      <div class="content">
        <h2>Order #${order.orderNumber}</h2>
        <p>Shipped on: ${formatDate(new Date())}</p>
        
        ${
          order.tracking?.trackingNumber
            ? `
          <div class="tracking-info">
            <h3>Tracking Information</h3>
            <p><strong>Tracking Number:</strong> ${
              order.tracking.trackingNumber
            }</p>
            <p><strong>Carrier:</strong> ${
              order.tracking.carrier || 'Standard Delivery'
            }</p>
            <p><strong>Estimated Delivery:</strong> ${
              order.tracking.estimatedDelivery
                ? formatDate(order.tracking.estimatedDelivery)
                : 'TBD'
            }</p>
            ${
              order.tracking.trackingUrl
                ? `<a href="${order.tracking.trackingUrl}" class="button">Track Your Package</a>`
                : ''
            }
          </div>
        `
            : ''
        }
        
        ${renderOrderSummary(order)}
        
        <div class="address-section">
          <h3>Shipping To:</h3>
          <p>
            ${order.shippingAddress.fullName}<br>
            ${order.shippingAddress.address}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state} ${
      order.shippingAddress.zipCode
    }
          </p>
        </div>
        
        <p>You'll receive another email confirmation once your package is delivered.</p>
      </div>
    `;
    return baseTemplate(content, 'Order Shipped');
  },

  orderDelivered: (data) => {
    const { order } = data;
    const content = `
      <div class="header">
        <h1>✅ Order Delivered!</h1>
        <p>Your package has been successfully delivered</p>
      </div>
      <div class="content">
        <h2>Order #${order.orderNumber}</h2>
        <p>Delivered on: ${formatDate(
          order.actualDeliveryDate || new Date()
        )}</p>
        
        <p>We hope you love your purchase! If you have any issues with your order, please don't hesitate to contact us.</p>
        
        ${renderOrderSummary(order)}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" class="button">Leave a Review</a>
          <a href="#" class="button" style="margin-left: 10px;">Shop Again</a>
        </div>
        
        <p style="text-align: center; margin-top: 20px;">
          <strong>Need help?</strong> Contact our customer service team at support@dblackrose.com
        </p>
      </div>
    `;
    return baseTemplate(content, 'Order Delivered');
  },

  orderCancelled: (data) => {
    const { order, reason } = data;
    const content = `
      <div class="header">
        <h1>Order Cancelled</h1>
        <p>Your order has been cancelled as requested</p>
      </div>
      <div class="content">
        <h2>Order #${order.orderNumber}</h2>
        <p>Cancelled on: ${formatDate(new Date())}</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        
        ${
          order.paymentStatus === 'success'
            ? `
          <div class="preorder-notice">
            <strong>Refund Information:</strong> Your refund is being processed and will be credited back to your original payment method within 3-5 business days.
          </div>
        `
            : ''
        }
        
        ${renderOrderSummary(order)}
        
        <p>We're sorry to see this order cancelled. If you need any assistance or want to place a new order, we're here to help!</p>
        
        <a href="#" class="button">Shop Again</a>
      </div>
    `;
    return baseTemplate(content, 'Order Cancelled');
  },

  preorderConfirmation: (data) => {
    const { order } = data;
    const preorderItems = order.items.filter((item) => item.isPreorder);

    const content = `
      <div class="header">
        <h1>⏰ Preorder Confirmed!</h1>
        <p>Thank you for your preorder. We'll notify you when it's ready.</p>
      </div>
      <div class="content">
        <h2>Preorder #${order.orderNumber}</h2>
        <p>Order Date: ${formatDate(order.date)}</p>
        
        <div class="preorder-notice">
          <strong>Preorder Information:</strong><br>
          Your order contains ${
            preorderItems.length
          } preorder item(s). These items are not yet in stock but will be fulfilled as soon as they become available.
          <br><br>
          <strong>Estimated Availability:</strong> ${
            order.estimatedDeliveryDate
              ? formatDate(order.estimatedDeliveryDate)
              : 'We will notify you when available'
          }
        </div>
        
        <div class="order-summary">
          <h3>Preorder Items</h3>
          ${preorderItems
            .map(
              (item) => `
            <div class="order-item">
              ${
                item.image
                  ? `<img src="${item.image}" alt="${item.title}" class="item-image">`
                  : ''
              }
              <div class="item-details">
                <div class="item-title">${item.title}</div>
                <div class="item-attributes">Quantity: ${item.quantity}</div>
                <div class="item-attributes">Estimated: ${
                  item.estimatedDelivery || 'TBD'
                }</div>
                <div class="item-price">${formatCurrency(
                  item.finalPrice
                )} each</div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        
        ${renderOrderSummary(order)}
        
        <p>We'll send you an email notification as soon as your preorder items are ready to ship!</p>
        
        <a href="#" class="button">View Preorder Status</a>
      </div>
    `;
    return baseTemplate(content, 'Preorder Confirmation');
  },

  digitalDownload: (data) => {
    const { order } = data;
    const digitalItems = order.items.filter((item) => item.isDigitalDownload);

    const content = `
      <div class="header">
        <h1>📥 Your Digital Downloads</h1>
        <p>Your digital products are ready for download</p>
      </div>
      <div class="content">
        <h2>Order #${order.orderNumber}</h2>
        <p>Download available until: ${
          digitalItems[0]?.downloadExpiry
            ? formatDate(digitalItems[0].downloadExpiry)
            : '30 days from now'
        }</p>
        
        <div class="order-summary">
          <h3>Digital Products</h3>
          ${digitalItems
            .map(
              (item) => `
            <div class="order-item">
              <div class="item-details">
                <div class="item-title">${item.title}</div>
                <div class="item-attributes">Quantity: ${item.quantity}</div>
                ${
                  item.downloadLinks
                    ? item.downloadLinks
                        .map(
                          (link) => `
                  <a href="${link}" class="button" style="margin: 5px 0; display: block;">Download Now</a>
                `
                        )
                        .join('')
                    : ''
                }
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        
        <div class="preorder-notice">
          <strong>Important:</strong> Please download your files within the specified time limit. After expiration, you may need to contact support for re-access.
        </div>
        
        <p>Need help with your downloads? Contact us at support@dblackrose.com</p>
      </div>
    `;
    return baseTemplate(content, 'Digital Downloads Ready');
  },

  // Admin Email Templates
  newOrderAlert: (data) => {
    const { order } = data;
    const content = `
      <div class="header">
        <h1>🔔 New Order Received</h1>
        <p>A new order has been placed on your store</p>
      </div>
      <div class="content">
        <h2>Order #${order.orderNumber}</h2>
        <p><strong>Customer:</strong> ${order.shippingAddress.fullName}</p>
        <p><strong>Email:</strong> ${order.shippingAddress.email}</p>
        <p><strong>Order Date:</strong> ${formatDate(order.date)}</p>
        <p><strong>Total Amount:</strong> ${formatCurrency(order.amount)}</p>
        <p><strong>Payment Status:</strong> ${getStatusBadge(
          order.paymentStatus
        )}</p>
        
        ${
          order.hasPreorderItems
            ? `
          <div class="preorder-notice">
            <strong>⚠️ Contains Preorder Items:</strong> This order includes preorder items that may require special handling.
          </div>
        `
            : ''
        }
        
        ${renderOrderSummary(order)}
        
        <div class="address-section">
          <h3>Shipping Address</h3>
          <p>
            ${order.shippingAddress.fullName}<br>
            ${order.shippingAddress.address}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state} ${
      order.shippingAddress.zipCode
    }<br>
            ${order.shippingAddress.phone}
          </p>
        </div>
        
        <a href="#" class="button">Process Order</a>
      </div>
    `;
    return baseTemplate(content, 'New Order Alert');
  },

  lowStockAlert: (data) => {
    const { product } = data;
    const content = `
      <div class="header">
        <h1>⚠️ Low Stock Alert</h1>
        <p>Product inventory is running low</p>
      </div>
      <div class="content">
        <h2>${product.title}</h2>
        <p><strong>SKU:</strong> ${product.sku}</p>
        <p><strong>Current Stock:</strong> ${product.stock} units</p>
        <p><strong>Alert Threshold:</strong> ${
          product.lowStockThreshold || 10
        } units</p>
        
        ${
          product.variants && product.variants.length > 0
            ? `
          <div class="order-summary">
            <h3>Variant Stock Levels</h3>
            ${product.variants
              .map(
                (variant) => `
              <div class="order-item">
                <div class="item-details">
                  <div class="item-title">${variant.color || ''} ${
                  variant.size || ''
                }</div>
                  <div class="item-attributes">SKU: ${variant.sku}</div>
                  <div class="item-attributes">Stock: ${
                    variant.stock
                  } units</div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }
        
        <p>Consider restocking this product to avoid stockouts.</p>
        
        <a href="#" class="button">Manage Inventory</a>
      </div>
    `;
    return baseTemplate(content, 'Low Stock Alert');
  },

  outOfStockAlert: (data) => {
    const { product } = data;
    const content = `
      <div class="header">
        <h1>🚨 Out of Stock Alert</h1>
        <p>Product is now out of stock</p>
      </div>
      <div class="content">
        <h2>${product.title}</h2>
        <p><strong>SKU:</strong> ${product.sku}</p>
        <p><strong>Current Stock:</strong> 0 units</p>
        
        <div class="preorder-notice">
          <strong>Action Required:</strong> This product is now out of stock. Consider:
          <ul style="margin-top: 10px;">
            <li>Restocking the product</li>
            <li>Enabling preorders</li>
            <li>Temporarily disabling the product</li>
          </ul>
        </div>
        
        <a href="#" class="button">Restock Product</a>
      </div>
    `;
    return baseTemplate(content, 'Out of Stock Alert');
  },
  paymentFailed: (data) => {
    const { order, paymentData } = data;
    const content = `
    <div class="header">
      <h1>Payment Failed</h1>
      <p>We couldn't process your payment for order ${order.orderNumber}</p>
    </div>
    <div class="content">
      <h2>Order #${order.orderNumber}</h2>
      <p>Unfortunately, your payment could not be processed.</p>
      
      <div class="preorder-notice">
        <strong>What happened?</strong><br>
        ${
          paymentData.gateway_response ||
          'Your payment was declined by your bank or card issuer.'
        }
      </div>
      
      <div class="order-summary">
        <h3>Order Details</h3>
        <div class="total-row">
          <span>Order Total:</span>
          <span>${formatCurrency(order.amount)}</span>
        </div>
        <div class="total-row">
          <span>Payment Method:</span>
          <span>${order.paymentMethod}</span>
        </div>
        <div class="total-row">
          <span>Status:</span>
          <span>${getStatusBadge(order.status)}</span>
        </div>
      </div>
      
      <div style="margin: 30px 0;">
        <h3>What can you do?</h3>
        <ul style="margin-left: 20px;">
          <li>Check your card details and try again</li>
          <li>Try a different payment method</li>
          <li>Contact your bank if the issue persists</li>
          <li>Contact our support team for assistance</li>
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="#" class="button">Try Payment Again</a>
        <a href="mailto:support@dblackrose.com" class="button" style="margin-left: 10px; background: #6c757d;">Contact Support</a>
      </div>
      
      <p style="margin-top: 30px;">
        <strong>Note:</strong> Your order is still saved and can be completed once payment is successful. 
        No items have been reserved in your cart.
      </p>
    </div>
  `;
    return baseTemplate(content, 'Payment Failed');
  },
  refundNotification: (data) => {
    const { order } = data;
    const isPartialRefund = order.status === 'partially_refunded';

    const content = `
    <div class="header">
      <h1>${isPartialRefund ? 'Partial Refund' : 'Refund'} Processed</h1>
      <p>Your ${
        isPartialRefund ? 'partial refund' : 'refund'
      } has been processed successfully</p>
    </div>
    <div class="content">
      <h2>Order #${order.orderNumber}</h2>
      <p>Refund processed on: ${formatDate(new Date())}</p>
      
      <div class="order-summary">
        <h3>Refund Details</h3>
        <div class="total-row">
          <span>Original Order Amount:</span>
          <span>${formatCurrency(order.amount)}</span>
        </div>
        <div class="total-row total-final">
          <span>Refund Amount:</span>
          <span>${formatCurrency(order.refundAmount)}</span>
        </div>
        ${
          order.refundReason
            ? `
          <div class="total-row">
            <span>Reason:</span>
            <span>${order.refundReason}</span>
          </div>
        `
            : ''
        }
      </div>
      
      <div class="preorder-notice">
        <strong>Processing Time:</strong> Your refund will appear in your original payment method within 3-5 business days.
      </div>
      
      ${renderOrderSummary(order)}
      
      <p>If you have any questions about your refund, please don't hesitate to contact our customer service team.</p>
      
            <a href="mailto:support@dblackrose.com" class="button">Contact Support</a>
    </div>
  `;
    return baseTemplate(content, 'Refund Processed');
  },
  dailyOrderSummary: (data) => {
    const { date, ordersCount, revenue, pendingOrders, orders } = data;

    const content = `
    <div class="header">
      <h1>📊 Daily Order Summary</h1>
      <p>${formatDate(date)}</p>
    </div>
    <div class="content">
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
        <div style="text-align: center; flex: 1;">
          <h3 style="color: #2c3e50; margin-bottom: 10px;">${ordersCount}</h3>
          <p style="color: #6c757d;">New Orders</p>
        </div>
        <div style="text-align: center; flex: 1;">
          <h3 style="color: #28a745; margin-bottom: 10px;">${formatCurrency(
            revenue
          )}</h3>
          <p style="color: #6c757d;">Revenue</p>
        </div>
        <div style="text-align: center; flex: 1;">
          <h3 style="color: #ffc107; margin-bottom: 10px;">${pendingOrders}</h3>
          <p style="color: #6c757d;">Pending Orders</p>
        </div>
      </div>
      
      ${
        orders.length > 0
          ? `
        <div class="order-summary">
          <h3>Today's Orders</h3>
          ${orders
            .map(
              (order) => `
            <div class="order-item">
              <div class="item-details">
                <div class="item-title">Order #${order.orderNumber}</div>
                <div class="item-attributes">
                  Customer: ${order.shippingAddress.fullName} | 
                  Amount: ${formatCurrency(order.amount)} | 
                  Status: ${getStatusBadge(order.status)}
                </div>
                <div class="item-attributes">
                  Items: ${order.items.length} | 
                  Payment: ${getStatusBadge(order.paymentStatus)}
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : '<p>No orders received today.</p>'
      }
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="#" class="button">View Admin Dashboard</a>
      </div>
    </div>
  `;
    return baseTemplate(content, 'Daily Order Summary');
  },
  // Add these to your emailTemplates.js

  newProductAlert: (data) => {
    const { product } = data;
    const content = `
    <div class="header">
      <h1>🆕 New Product Added</h1>
      <p>A new product has been added to your store</p>
    </div>
    <div class="content">
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        ${
          product.images[0]
            ? `<img src="${product.images[0]}" alt="${product.title}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin-right: 20px;">`
            : ''
        }
        <div>
          <h2>${product.title}</h2>
          <p><strong>SKU:</strong> ${product.sku}</p>
          <p><strong>Category:</strong> ${product.productType}</p>
          <p><strong>Price:</strong> ${formatCurrency(product.price)}</p>
        </div>
      </div>
      
      <div class="order-summary">
        <h3>Product Details</h3>
        <div class="total-row">
          <span>Stock:</span>
          <span>${product.stock} units</span>
        </div>
        <div class="total-row">
          <span>Variants:</span>
          <span>${product.variants?.length || 0}</span>
        </div>
        <div class="total-row">
          <span>Status:</span>
          <span>${product.isActive ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      
      <p>${product.description.substring(0, 200)}${
      product.description.length > 200 ? '...' : ''
    }</p>
      
      <a href="#" class="button">View Product</a>
    </div>
  `;
    return baseTemplate(content, 'New Product Added');
  },

  productReviewAlert: (data) => {
    const { product, customerName, rating, comment } = data;
    const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);

    const content = `
    <div class="header">
      <h1>⭐ New Product Review</h1>
      <p>A customer has left a review for one of your products</p>
    </div>
    <div class="content">
      <h2>${product.title}</h2>
      
      <div class="order-summary">
        <h3>Review Details</h3>
        <div class="total-row">
          <span>Customer:</span>
          <span>${customerName}</span>
        </div>
        <div class="total-row">
          <span>Rating:</span>
          <span>${stars} (${rating}/5)</span>
        </div>
        ${
          comment
            ? `
          <div style="margin-top: 15px;">
            <strong>Comment:</strong>
            <p style="font-style: italic; margin-top: 10px;">"${comment}"</p>
          </div>
        `
            : ''
        }
      </div>
      
      <div style="display: flex; align-items: center; margin: 20px 0;">
        ${
          product.images[0]
            ? `<img src="${product.images[0]}" alt="${product.title}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-right: 15px;">`
            : ''
        }
        <div>
          <p><strong>SKU:</strong> ${product.sku}</p>
          <p><strong>Current Rating:</strong> ${
            product.rating ? product.rating.toFixed(1) : 'N/A'
          }/5</p>
        </div>
      </div>
      
      <a href="#" class="button">View All Reviews</a>
    </div>
  `;
    return baseTemplate(content, 'New Product Review');
  },

  backInStockAlert: (data) => {
    const { product, customerName, variantInfo } = data;
    const content = `
    <div class="header">
      <h1>🎉 Back in Stock!</h1>
      <p>Good news! The item you were interested in is now available</p>
    </div>
    <div class="content">
      <h2>${product.title}</h2>
      
      ${
        variantInfo
          ? `
        <div class="preorder-notice">
          <strong>Variant Details:</strong><br>
          ${variantInfo.color ? `Color: ${variantInfo.color}<br>` : ''}
          ${variantInfo.size ? `Size: ${variantInfo.size}<br>` : ''}
          ${variantInfo.material ? `Material: ${variantInfo.material}<br>` : ''}
        </div>
      `
          : ''
      }
      
      <div style="display: flex; align-items: center; margin: 20px 0;">
        ${
          product.images[0]
            ? `<img src="${product.images[0]}" alt="${product.title}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; margin-right: 20px;">`
            : ''
        }
        <div>
          <p style="font-size: 18px; color: #28a745; font-weight: 600;">Now Available!</p>
          <p><strong>Price:</strong> ${formatCurrency(product.price)}</p>
          ${
            product.discount > 0
              ? `<p><strong>Special Price:</strong> ${formatCurrency(
                  product.finalPrice
                )}</p>`
              : ''
          }
        </div>
      </div>
      
      <p>Don't wait too long - popular items sell out fast!</p>
      
      <div style="text-align: center;">
        <a href="#" class="button">Shop Now</a>
        <a href="#" class="button" style="margin-left: 10px; background: #6c757d;">Add to Wishlist</a>
      </div>
    </div>
  `;
    return baseTemplate(content, 'Back in Stock Alert');
  },

  reviewConfirmation: (data) => {
    const { product, customerName } = data;
    const content = `
    <div class="header">
      <h1>Thank You for Your Review!</h1>
      <p>Your feedback helps other customers make informed decisions</p>
    </div>
    <div class="content">
      <h2>Review Submitted Successfully</h2>
      
      <p>Hi ${customerName},</p>
      <p>Thank you for taking the time to review <strong>${
        product.title
      }</strong>. Your honest feedback is invaluable to us and helps other customers make informed purchasing decisions.</p>
      
      <div style="display: flex; align-items: center; margin: 20px 0;">
        ${
          product.images[0]
            ? `<img src="${product.images[0]}" alt="${product.title}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-right: 15px;">`
            : ''
        }
        <div>
          <p><strong>Product:</strong> ${product.title}</p>
          <p><strong>SKU:</strong> ${product.sku}</p>
        </div>
      </div>
      
      <div class="preorder-notice">
        <strong>What's Next?</strong><br>
        Your review will be published on our website after a brief moderation process. 
        You'll receive bonus loyalty points as a thank you for your feedback!
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" class="button">View Product</a>
        <a href="#" class="button" style="margin-left: 10px; background: #28a745;">Shop Similar Items</a>
      </div>
      
      <p>Keep an eye out for our upcoming products - we'd love to hear your thoughts on those too!</p>
    </div>
  `;
    return baseTemplate(content, 'Review Confirmation');
  },
  priceDropAlert: (data) => {
    const {
      product,
      customerName,
      oldPrice,
      newPrice,
      savings,
      percentageOff,
      wishlistItem,
    } = data;

    const content = `
    <div class="header">
      <h1>💰 Price Drop Alert!</h1>
      <p>Great news! An item in your wishlist is now on sale</p>
    </div>
    <div class="content">
      <h2>${product.title}</h2>
      <p>Hi ${customerName},</p>
      
      <div style="display: flex; align-items: center; margin: 20px 0;">
        ${
          product.images[0]
            ? `<img src="${product.images[0]}" alt="${product.title}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; margin-right: 20px;">`
            : ''
        }
        <div>
          <p style="text-decoration: line-through; color: #6c757d; font-size: 18px;">${formatCurrency(
            oldPrice
          )}</p>
          <p style="color: #dc3545; font-size: 24px; font-weight: 700; margin: 5px 0;">${formatCurrency(
            newPrice
          )}</p>
          <p style="color: #28a745; font-weight: 600;">Save ${formatCurrency(
            savings
          )} (${percentageOff}% off)!</p>
        </div>
      </div>
      
      ${
        wishlistItem.selectedAttributes &&
        Object.keys(wishlistItem.selectedAttributes).length > 0
          ? `
        <div class="preorder-notice">
          <strong>Your Selected Options:</strong><br>
          ${
            wishlistItem.selectedAttributes.color
              ? `Color: ${wishlistItem.selectedAttributes.color}<br>`
              : ''
          }
          ${
            wishlistItem.selectedAttributes.size
              ? `Size: ${wishlistItem.selectedAttributes.size}<br>`
              : ''
          }
          ${
            wishlistItem.selectedAttributes.material
              ? `Material: ${wishlistItem.selectedAttributes.material}<br>`
              : ''
          }
        </div>
      `
          : ''
      }
      
      <div class="order-summary">
        <h3>Limited Time Offer</h3>
        <p>This price drop might not last long. Popular items at discounted prices tend to sell out quickly!</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" class="button">Buy Now at Sale Price</a>
        <a href="#" class="button" style="margin-left: 10px; background: #6c757d;">View All Sale Items</a>
      </div>
      
      <p style="font-size: 14px; color: #6c757d;">
        You're receiving this because "${product.title}" is in your wishlist. 
        <a href="#" style="color: #007bff;">Manage your wishlist preferences</a>
      </p>
    </div>
  `;
    return baseTemplate(content, 'Price Drop Alert');
  },
  reviewNeedsModeration: (data) => {
    const { product, review, totalPendingReviews } = data;

    const content = `
    <div class="header">
      <h1>📝 Review Pending Moderation</h1>
      <p>A new customer review needs your attention</p>
    </div>
    <div class="content">
      <h2>${product.title}</h2>
      
      <div class="order-summary">
        <h3>Review Details</h3>
        <div class="total-row">
          <span>Customer:</span>
          <span>${review.user?.name || 'Anonymous'}</span>
        </div>
        <div class="total-row">
          <span>Rating:</span>
          <span>${'⭐'.repeat(review.rating)}${'☆'.repeat(
      5 - review.rating
    )} (${review.rating}/5)</span>
        </div>
        <div class="total-row">
          <span>Date:</span>
          <span>${formatDate(review.createdAt)}</span>
        </div>
      </div>
      
      ${
        review.comment
          ? `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <strong>Review Comment:</strong>
          <p style="font-style: italic; margin-top: 10px;">"${review.comment}"</p>
        </div>
      `
          : ''
      }
      
      ${
        totalPendingReviews > 1
          ? `
        <div class="preorder-notice">
          <strong>Notice:</strong> You have ${totalPendingReviews} reviews pending moderation in total.
        </div>
      `
          : ''
      }
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" class="button">Approve Review</a>
        <a href="#" class="button" style="margin-left: 10px; background: #dc3545;">Reject Review</a>
      </div>
      
      <a href="#" class="button" style="background: #6c757d;">View All Pending Reviews</a>
    </div>
  `;
    return baseTemplate(content, 'Review Moderation Required');
  },
  forgotPasswordEmail: (data) => {
    const { user, resetToken, resetUrl } = data;
    const content = `
    <div class="header">
      <h1>🔐 Password Reset Request</h1>
      <p>We received a request to reset your password</p>
    </div>
    <div class="content">
      <h2>Hello ${user.name},</h2>
      
      <p>You recently requested to reset your password for your BlackRose account. Click the button below to reset it.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" class="button" style="background: #dc3545;">Reset Your Password</a>
      </div>
      
      <div class="preorder-notice">
        <strong>Important Security Information:</strong><br>
        • This link will expire in 1 hour for security reasons<br>
        • If you didn't request this reset, please ignore this email<br>
        • Your password will remain unchanged until you create a new one
      </div>
      
      <p><strong>Having trouble with the button?</strong> Copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
        <p style="color: #6c757d; font-size: 14px;">
          <strong>Security Tips:</strong><br>
          • Never share your password with anyone<br>
          • Use a strong, unique password<br>
          • Enable two-factor authentication when available
        </p>
      </div>
    </div>
  `;
    return baseTemplate(content, 'Password Reset Request');
  },

  passwordResetSuccess: (data) => {
    const { user } = data;
    const content = `
    <div class="header">
      <h1>✅ Password Reset Successful</h1>
      <p>Your password has been successfully changed</p>
    </div>
    <div class="content">
      <h2>Hello ${user.name},</h2>
      
      <p>This email confirms that your password has been successfully reset for your BlackRose account.</p>
      
      <div class="order-summary">
        <h3>Reset Details</h3>
        <div class="total-row">
          <span>Account:</span>
          <span>${user.email}</span>
        </div>
        <div class="total-row">
          <span>Reset Time:</span>
          <span>${formatDate(new Date())}</span>
        </div>
      </div>
      
      <div class="preorder-notice">
        <strong>What's Next?</strong><br>
        You can now use your new password to sign in to your account. 
        Make sure to keep it secure and don't share it with anyone.
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" class="button">Sign In to Your Account</a>
      </div>
      
      <p><strong>Didn't make this change?</strong> If you didn't reset your password, please contact our support team immediately at support@dblackrose.com</p>
    </div>
  `;
    return baseTemplate(content, 'Password Reset Successful');
  },

  passwordResetAlert: (data) => {
    const { user, ipAddress, userAgent, timestamp } = data;
    const content = `
    <div class="header">
      <h1>🚨 Password Reset Alert</h1>
      <p>Someone requested a password reset for your account</p>
    </div>
    <div class="content">
      <h2>Hello ${user.name},</h2>
      
      <p>We wanted to let you know that a password reset was requested for your BlackRose account.</p>
      
      <div class="order-summary">
        <h3>Reset Request Details</h3>
        <div class="total-row">
          <span>Account:</span>
          <span>${user.email}</span>
        </div>
        <div class="total-row">
          <span>Time:</span>
          <span>${formatDate(timestamp)}</span>
        </div>
        <div class="total-row">
          <span>IP Address:</span>
          <span>${ipAddress}</span>
        </div>
        <div class="total-row">
          <span>Device/Browser:</span>
          <span>${userAgent.substring(0, 50)}...</span>
        </div>
      </div>
      
      <div class="preorder-notice">
        <strong>If this was you:</strong> You can safely ignore this email.<br>
        <strong>If this wasn't you:</strong> Your account may be at risk. Please secure your account immediately.
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" class="button" style="background: #dc3545;">Secure My Account</a>
        <a href="mailto:support@dblackrose.com" class="button" style="margin-left: 10px; background: #6c757d;">Contact Support</a>
      </div>
      
      <p style="color: #6c757d; font-size: 14px;">
        This alert helps keep your account secure. We send these notifications for all password-related activities.
      </p>
    </div>
  `;
    return baseTemplate(content, 'Password Reset Alert');
  },
};
