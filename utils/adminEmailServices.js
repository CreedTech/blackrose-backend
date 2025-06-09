// services/adminEmailService.js
import {
  sendLowStockAlert,
  sendOutOfStockAlert,
  sendNewOrderAlert,
  sendDailyOrderSummary,
//   sendWeeklyReport,
} from './emailService.js';

export const checkInventoryAlerts = async () => {
  try {
    const productModel = (await import('../models/productModel.js')).default;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';

    // Find products with low stock
    const lowStockProducts = await productModel.find({
      isActive: true,
      stock: { $lte: 5, $gt: 0 },
    });

    // Find out of stock products
    const outOfStockProducts = await productModel.find({
      isActive: true,
      stock: 0,
    });

    // Send alerts
    for (const product of lowStockProducts) {
      await sendLowStockAlert(product, adminEmail);
    }

    for (const product of outOfStockProducts) {
      await sendOutOfStockAlert(product, adminEmail);
    }

    console.log(
      `Inventory alerts sent: ${lowStockProducts.length} low stock, ${outOfStockProducts.length} out of stock`
    );
  } catch (error) {
    console.error('Error checking inventory alerts:', error);
  }
};

export const sendDailyAdminSummary = async () => {
  try {
    const orderModel = (await import('../models/orderModel.js')).default;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get today's orders
    const todaysOrders = await orderModel.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    // Get pending orders
    const pendingOrders = await orderModel.find({
      status: { $in: ['pending', 'confirmed'] },
    });

    // Calculate revenue
    const todaysRevenue = todaysOrders
      .filter((order) => order.paymentStatus === 'success')
      .reduce((sum, order) => sum + order.amount, 0);

    const summaryData = {
      date: today,
      ordersCount: todaysOrders.length,
      revenue: todaysRevenue,
      pendingOrders: pendingOrders.length,
      orders: todaysOrders,
    };

    await sendDailyOrderSummary(summaryData, adminEmail);
    console.log('Daily admin summary sent');
  } catch (error) {
    console.error('Error sending daily summary:', error);
  }
};
