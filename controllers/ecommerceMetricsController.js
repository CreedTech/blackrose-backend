// controllers/ecommerceMetricsController.js
import orderModel from '../models/orderModel.js';
import productModel from '../models/productModel.js';
import { subDays, startOfDay, endOfDay } from 'date-fns';

// Get e-commerce overview statistics
const getEcommerceOverview = async (req, res) => {
  try {
    const { period = '7' } = req.query; // Default to 7 days
    const days = parseInt(period);

    const endDate = new Date();
    const startDate = subDays(endDate, days);

    const [
      totalOrders,
      pendingOrders,
      totalRevenue,
      recentOrders,
      topSellingProducts,
      totalProducts,
      lowStockProducts,
    ] = await Promise.all([
      // Total orders in period
      orderModel.countDocuments({
        date: { $gte: startDate.getTime() },
      }),

      // Pending orders
      orderModel.countDocuments({
        status: { $in: ['Order Placed', 'Processing'] },
        date: { $gte: startDate.getTime() },
      }),

      // Total revenue
      orderModel.aggregate([
        {
          $match: {
            date: { $gte: startDate.getTime() },
            paymentStatus: 'success',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]),

      // Recent orders
      orderModel.find({}).sort({ date: -1 }).limit(5),

      // Top selling products
      orderModel.aggregate([
        {
          $match: {
            date: { $gte: startDate.getTime() },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            title: { $first: '$items.title' },
            image: { $first: '$items.image' },
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: {
              $sum: { $multiply: ['$items.price', '$items.quantity'] },
            },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
      ]),

      // Total products
      productModel.countDocuments(),

      // Low stock products
      productModel.countDocuments({
        stock: { $lt: 5 },
        digitalDownload: false,
      }),
    ]);

    // Daily sales trend
    const dailySalesTrend = await orderModel.aggregate([
      {
        $match: {
          date: { $gte: startDate.getTime() },
          paymentStatus: 'success',
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$date' } },
          },
          sales: { $sum: '$amount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      metrics: {
        totalOrders,
        pendingOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        recentOrders,
        topSellingProducts,
        totalProducts,
        lowStockProducts,
        dailySalesTrend,
      },
    });
  } catch (error) {
    console.error('Error fetching e-commerce metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch e-commerce metrics',
    });
  }
};

// Get orders with pagination and filtering

const getOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      paymentStatus,
      search,
    } = req.query;

    const query = {};

    // Apply filters
    if (status) {
      query.status = status;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // Date range
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate).getTime(),
        $lte: new Date(endDate).getTime(),
      };
    }

    // Search by order ID or customer name/email
    if (search) {
      query.$or = [
        { _id: { $regex: search, $options: 'i' } },
        { 'address.fullName': { $regex: search, $options: 'i' } },
        { 'address.email': { $regex: search, $options: 'i' } },
      ];
    }

    // Implement pagination manually
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination info
    const total = await orderModel.countDocuments(query);

    // Get the orders with pagination
    const orders = await orderModel
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum);

    // Calculate total pages
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      orders: orders,
      pagination: {
        total: total,
        limit: limitNum,
        page: pageNum,
        pages: totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
    });
  }
};
// const getOrders = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       status,
//       startDate,
//       endDate,
//       paymentStatus,
//       search,
//     } = req.query;

//     const query = {};

//     // Apply filters
//     if (status) {
//       query.status = status;
//     }

//     if (paymentStatus) {
//       query.paymentStatus = paymentStatus;
//     }

//     // Date range
//     if (startDate && endDate) {
//       query.date = {
//         $gte: new Date(startDate).getTime(),
//         $lte: new Date(endDate).getTime(),
//       };
//     }

//     // Search by order ID or customer name/email
//     if (search) {
//       query.$or = [
//         { _id: { $regex: search, $options: 'i' } },
//         { 'address.fullName': { $regex: search, $options: 'i' } },
//         { 'address.email': { $regex: search, $options: 'i' } },
//       ];
//     }

//     const options = {
//       page: parseInt(page),
//       limit: parseInt(limit),
//       sort: { date: -1 },
//     };

//     const orders = await orderModel.paginate(query, options);

//     res.json({
//       success: true,
//       orders: orders.docs,
//       pagination: {
//         total: orders.totalDocs,
//         limit: orders.limit,
//         page: orders.page,
//         pages: orders.totalPages,
//       },
//     });
//   } catch (error) {
//     console.error('Error fetching orders:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch orders',
//     });
//   }
// };

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await orderModel.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
    });
  }
};

// Get product metrics
const getProductMetrics = async (req, res) => {
  try {
    const { period = '30' } = req.query; // Default to 30 days
    const days = parseInt(period);

    const endDate = new Date();
    const startDate = subDays(endDate, days);

    // Top selling categories
    const topCategories = await orderModel.aggregate([
      {
        $match: {
          date: { $gte: startDate.getTime() },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
    ]);

    // Product sales trend
    const productSalesTrend = await orderModel.aggregate([
      {
        $match: {
          date: { $gte: startDate.getTime() },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$date' } },
            },
            productId: '$items.productId',
          },
          quantity: { $sum: '$items.quantity' },
          product: { $first: '$items.title' },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          products: {
            $push: {
              id: '$_id.productId',
              title: '$product',
              quantity: '$quantity',
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      metrics: {
        topCategories,
        productSalesTrend,
      },
    });
  } catch (error) {
    console.error('Error fetching product metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product metrics',
    });
  }
};

export {
  getEcommerceOverview,
  getOrders,
  updateOrderStatus,
  getProductMetrics,
};
