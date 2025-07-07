
import {
  sendOrderStatusUpdate,
  sendShippingNotification,
  sendDeliveryConfirmation,
  sendOrderCancellation,
  sendDigitalDownload,
  sendRefundNotification,
} from './emailService.js';

export const notifyOrderStatusChange = async (order, oldStatus, userEmail) => {
  try {
    switch (order.status) {
      case 'processing':
        await sendOrderStatusUpdate(order, userEmail, oldStatus);
        break;

      case 'shipped':
        await sendShippingNotification(order, userEmail);
        break;

      case 'delivered':
        await sendDeliveryConfirmation(order, userEmail);

        // Send digital download links if applicable
        const digitalItems = order.items.filter(
          (item) => item.isDigitalDownload
        );
        if (digitalItems.length > 0) {
          await sendDigitalDownload(order, userEmail);
        }
        break;

      case 'cancelled':
        await sendOrderCancellation(order, userEmail, 'Order cancelled');
        break;

      case 'refunded':
      case 'partially_refunded':
        await sendRefundNotification(order, userEmail);
        break;

      default:
        // Send generic status update
        await sendOrderStatusUpdate(order, userEmail, oldStatus);
    }

    console.log(
      `Order status notification sent for order ${order.orderNumber}`
    );
  } catch (error) {
    console.error('Error sending order status notification:', error);
  }
};

export const notifyPaymentSuccess = async (order, transaction, userEmail) => {
  try {
    const { sendPaymentConfirmation } = await import('./emailService.js');
    await sendPaymentConfirmation(order, userEmail, transaction);
    console.log(`Payment confirmation sent for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Error sending payment confirmation:', error);
  }
};
