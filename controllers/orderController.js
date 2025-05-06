// import orderModel from '../models/orderModel.js';
// import userModel from '../models/userModel.js';
// import Stripe from 'stripe';

// // global variables
// const currency = 'NGN';
// const deliveryCharge = 0;

// // gateway initialize
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// // Placing orders using COD Method
// const placeOrder = async (req, res) => {
//   try {
//     const { items, amount, address } = req.body;

//     const orderData = {
//       userId: req.user._id,
//       items,
//       address,
//       amount,
//       paymentMethod: 'COD',
//       payment: false,
//       date: Date.now(),
//     };

//     const newOrder = new orderModel(orderData);
//     await newOrder.save();

//     await userModel.findByIdAndUpdate(req.user._id, { cartData: {} });

//     res.json({ success: true, message: 'Order Placed' });
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// // Placing orders using Stripe Method
// const placeOrderStripe = async (req, res) => {
//   try {
//     const { items, amount, address } = req.body;
//     const { origin } = req.headers;

//     const orderData = {
//       userId: req.user._id,
//       items,
//       address,
//       amount,
//       paymentMethod: 'Stripe',
//       payment: false,
//       date: Date.now(),
//     };

//     const newOrder = new orderModel(orderData);
//     await newOrder.save();

//     const line_items = items.map((item) => ({
//       price_data: {
//         currency: currency,
//         product_data: {
//           name: item.name,
//         },
//         unit_amount: item.price * 100,
//       },
//       quantity: item.quantity,
//     }));

//     line_items.push({
//       price_data: {
//         currency: currency,
//         product_data: {
//           name: 'Delivery Charges',
//         },
//         unit_amount: deliveryCharge * 100,
//       },
//       quantity: 1,
//     });

//     const session = await stripe.checkout.sessions.create({
//       success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
//       cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
//       line_items,
//       mode: 'payment',
//     });

//     res.json({ success: true, session_url: session.url });
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// // Verify Stripe
// const verifyStripe = async (req, res) => {
//   const { orderId, success } = req.body;

//   try {
//     if (success === 'true') {
//       await orderModel.findByIdAndUpdate(orderId, { payment: true });
//       await userModel.findByIdAndUpdate(req.user._id, { cartData: {} });
//       res.json({ success: true });
//     } else {
//       await orderModel.findByIdAndDelete(orderId);
//       res.json({ success: false });
//     }
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// // All Orders data for Admin Panel
// const allOrders = async (req, res) => {
//   try {
//     const orders = await orderModel.find({});
//     res.json({ success: true, orders });
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// // User Order Data For Forntend
// const userOrders = async (req, res) => {
//   try {
//     // const { userId } = req.body;

//     const orders = await orderModel.find({ userId: req.user._id });
//     res.json({ success: true, orders });
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// // update order status from Admin Panel
// const updateStatus = async (req, res) => {
//   try {
//     const { orderId, status } = req.body;

//     await orderModel.findByIdAndUpdate(orderId, { status });
//     res.json({ success: true, message: 'Status Updated' });
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// export {
//   verifyStripe,
//   placeOrder,
//   placeOrderStripe,
//   allOrders,
//   userOrders,
//   updateStatus,
// };

// controllers/orderController.js
import orderModel from '../models/orderModel.js';
import productModel from '../models/productModel.js';
import userModel from '../models/userModel.js';

export const createOrder = async (req, res) => {
  try {
    const { items, amount, address, paymentMethod } = req.body;

    // Validate order data
    if (!items || !amount || !address || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order information',
      });
    }

    // Create new order
    const order = new orderModel({
      userId: req.user._id,
      items: items,
      amount: amount,
      address: address,
      status: 'Order Placed',
      paymentMethod: paymentMethod,
      payment: false,
      date: Date.now(),
      paymentStatus: 'pending',
    });

    // Save order to database
    await order.save();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: order,
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

export const getOrderById = async (req, res) => {
  try {
    const order = await orderModel.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if user is authorized to access this order
    if (
      order.userId.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order',
      });
    }

    res.json({
      success: true,
      order: order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order',
      error: error.message,
    });
  }
};
