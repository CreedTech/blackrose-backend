// controllers/ecommerceMetricsController.js
import orderModel from '../models/orderModel.js';
import productModel from '../models/productModel.js';
import { subDays, startOfDay, endOfDay } from 'date-fns';

// Get e-commerce overview statistics
// const getEcommerceOverview = async (req, res) => {
//   try {
//     const { period = '365' } = req.query; // Default to 7 days
//     const days = parseInt(period);
//     const latestOrder = await orderModel.findOne().sort({ date: -1 });

//     if (!latestOrder) {
//       return res.json({
//         success: true,
//         metrics: {
//           totalOrders: 0,
//           pendingOrders: 0,
//           totalRevenue: 0,
//           recentOrders: [],
//           topSellingProducts: [],
//           totalProducts: await productModel.countDocuments(),
//           lowStockProducts: await productModel.countDocuments({
//             stock: { $lt: 5 },
//             digitalDownload: false,
//           }),
//           dailySalesTrend: [],
//         },
//       });
//     }
//     // const endDate = new Date();
//     // const startDate = subDays(endDate, days);
//     const endDate = new Date(latestOrder.date);
//     const startDate = new Date(endDate);
//     startDate.setDate(startDate.getDate() - days);
//     console.log(endDate);

//     // Use timestamps for comparison
//     const startTimestamp = startDate.getTime();
//     const endTimestamp = endDate.getTime();

//     console.log(
//       `Date range: ${new Date(startTimestamp).toISOString()} to ${new Date(
//         endTimestamp
//       ).toISOString()}`
//     );
//     console.log(startTimestamp);
//     const [
//       totalOrders,
//       pendingOrders,
//       processingOrders,
//       completedOrders,
//       cancelledOrders,
//       totalRevenue,
//       recentOrders,
//       topSellingProducts,
//       totalProducts,
//       lowStockProducts,
//     ] = await Promise.all([
//       orderModel.countDocuments({
//         // date: { $gte: startTimestamp },
//       }),

//       orderModel.countDocuments({
//         status: { $in: ['Order Placed'] },
//         date: { $gte: startTimestamp },
//       }),
//       orderModel.countDocuments({
//         status: { $in: ['Processing'] },
//         date: { $gte: startTimestamp },
//       }),
//       orderModel.countDocuments({
//         status: { $in: ['Delivered','delivered'] },
//         date: { $gte: startTimestamp },
//       }),
//       orderModel.countDocuments({
//         status: { $in: ['Cancelled'] },
//         date: { $gte: startTimestamp },
//       }),

//       // Total revenue
//       orderModel.aggregate([
//         {
//           $match: {
//             date: { $gte: startTimestamp },
//             paymentStatus: 'success',
//           },
//         },
//         {
//           $group: {
//             _id: null,
//             total: { $sum: '$amount' },
//           },
//         },
//       ]),

//       // Recent orders
//       orderModel.find({}).sort({ date: -1 }).limit(5),

//       // Top selling products
//       orderModel.aggregate([
//         {
//           $match: {
//             date: { $gte: startTimestamp },
//           },
//         },
//         { $unwind: '$items' },
//         {
//           $group: {
//             _id: '$items.productId',
//             title: { $first: '$items.title' },
//             image: { $first: '$items.image' },
//             totalSold: { $sum: '$items.quantity' },
//             totalRevenue: {
//               $sum: { $multiply: ['$items.price', '$items.quantity'] },
//             },
//           },
//         },
//         { $sort: { totalSold: -1 } },
//         { $limit: 5 },
//       ]),

//       // Total products
//       productModel.countDocuments(),

//       // Low stock products
//       productModel.countDocuments({
//         stock: { $lt: 5 },
//         digitalDownload: false,
//       }),
//     ]);

//     // Daily sales trend
//     const dailySalesTrend = await orderModel.aggregate([
//       {
//         $match: {
//           date: { $gte: startTimestamp },
//           paymentStatus: 'success',
//         },
//       },
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$date' } },
//           },
//           sales: { $sum: '$amount' },
//           orders: { $sum: 1 },
//         },
//       },
//       { $sort: { _id: 1 } },
//     ]);

//     res.json({
//       success: true,
//       metrics: {
//         totalOrders,
//         pendingOrders,
//         processingOrders,
//         completedOrders,
//         cancelledOrders,
//         totalRevenue: totalRevenue[0]?.total || 0,
//         recentOrders,
//         topSellingProducts,
//         totalProducts,
//         lowStockProducts,
//         dailySalesTrend,
//       },
//     });
//   } catch (error) {
//     console.error('Error fetching e-commerce metrics:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch e-commerce metrics',
//     });
//   }
// };

const getEcommerceOverview = async (req, res) => {
  try {
    const { period = '365' } = req.query;
    const days = parseInt(period);
    const latestOrder = await orderModel.findOne().sort({ date: -1 });

    if (!latestOrder) {
      return res.json({
        success: true,
        metrics: {
          totalOrders: 0,
          pendingOrders: 0,
          processingOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          totalRevenue: 0,
          recentOrders: [],
          topSellingProducts: [],
          totalProducts: await productModel.countDocuments(),
          lowStockProducts: await productModel.countDocuments({
            stock: { $lt: 5 },
            digitalDownload: false,
          }),
          dailySalesTrend: [],
        },
      });
    }

    // Handle both timestamp and Date formats
    const getTimestamp = (dateValue) => {
      if (typeof dateValue === 'number') {
        return dateValue; // Already a timestamp
      }
      if (dateValue instanceof Date) {
        return dateValue.getTime();
      }
      if (typeof dateValue === 'string') {
        return new Date(dateValue).getTime();
      }
      return Date.now(); // Fallback
    };

    // Calculate date range
    const endTimestamp = getTimestamp(latestOrder.date);
    const startTimestamp = endTimestamp - days * 24 * 60 * 60 * 1000;

    // For display purposes
    const endDate = new Date(endTimestamp);
    const startDate = new Date(startTimestamp);

    console.log(
      `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );
    console.log(`Timestamps: ${startTimestamp} to ${endTimestamp}`);

    // Since your date field appears to be consistently stored as timestamps,
    // we can use simple numeric comparison
    const dateFilter = { date: { $gte: startTimestamp } };

    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      recentOrders,
      topSellingProducts,
      totalProducts,
      lowStockProducts,
    ] = await Promise.all([
      // Total orders (all time)
      orderModel.countDocuments({}),

      // Orders by status within date range
      orderModel.countDocuments({
        status: { $in: ['Order Placed', 'Pending'] },
        // ...dateFilter,
      }),

      orderModel.countDocuments({
        status: { $in: ['Processing'] },
        // ...dateFilter,
      }),

      orderModel.countDocuments({
        status: { $in: ['Delivered', 'delivered'] },
        // ...dateFilter,
      }),

      orderModel.countDocuments({
        status: { $in: ['Cancelled'] },
        // ...dateFilter,
      }),

      // Total revenue within date range
      orderModel.aggregate([
        {
          $match: {
            ...dateFilter,
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

      // Recent orders (latest 5)
      orderModel.find({}).sort({ date: -1 }).limit(5),

      // Top selling products within date range
      orderModel.aggregate([
        {
          $match: dateFilter,
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

    // Daily sales trend - convert timestamp to date for grouping
    const dailySalesTrend = await orderModel.aggregate([
      {
        $match: {
          ...dateFilter,
          paymentStatus: 'success',
        },
      },
      {
        $addFields: {
          // Convert timestamp to date for grouping
          dateOnly: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $toDate: '$date' }, // Convert timestamp to Date
            },
          },
        },
      },
      {
        $group: {
          _id: '$dateOnly',
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
        processingOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        recentOrders,
        topSellingProducts,
        totalProducts,
        lowStockProducts,
        dailySalesTrend,
        // Add some debug info
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          startTimestamp,
          endTimestamp,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching e-commerce metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch e-commerce metrics',
      error: error.message,
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
        // { _id: { $regex: search, $options: 'i' } },
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

        totalPages,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
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
    await order.updateStatus(status, note, req.user._id);

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
