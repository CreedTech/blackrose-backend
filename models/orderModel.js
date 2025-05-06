// import mongoose from 'mongoose'

// const orderSchema = new mongoose.Schema({
//     userId: { type: String, required: true },
//     items: { type: Array, required: true },
//     amount: { type: Number, required: true },
//     address: { type: Object, required: true },
//     status: { type: String, required: true, default:'Order Placed' },
//     paymentMethod: { type: String, required: true },
//     payment: { type: Boolean, required: true , default: false },
//     date: {type: Number, required:true}
// })

// const orderModel = mongoose.models.order || mongoose.model('order',orderSchema)
// export default orderModel;

// models/couponModel.js
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    items: [
      {
        productId: String,
        title: String,
        price: Number,
        quantity: Number,
        image: String,
      },
    ],
    amount: {
      type: Number,
      required: true,
    },
    address: {
      fullName: String,
      address: String,
      city: String,
      state: String,
      zipCode: String,
      phone: String,
      email: String,
    },
    status: {
      type: String,
      required: true,
      default: 'Order Placed',
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    payment: {
      type: Boolean,
      default: false,
    },
    date: {
      type: Number,
      required: true,
    },
    paymentReference: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    paymentDetails: Object,
    discount: {
      code: String,
      amount: Number,
    },
  },
  {
    timestamps: true,
  }
);

const orderModel =
  mongoose.models.order || mongoose.model('order', orderSchema);
export default orderModel;
