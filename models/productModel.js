import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: Array, required: true },
  category: { type: String, required: true },
//   subCategory: { type: String, required: true },
//   sizes: { type: Array, required: true },
  bestseller: { type: Boolean },
  date: { type: Number, required: true },
  title: { type: String, required: true },
  discount: { type: Number, default: 0 },
  finalPrice: { type: Number },
  tags: [{ type: String }],
  digitalDownload: { type: Boolean, default: false },
  stock: { type: Number, default: 1 },
  rating: { type: Number, default: 0 },
  reviews: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
      comment: String,
      rating: Number,
      date: { type: Date, default: Date.now },
    },
  ],
});

productSchema.pre('save', function (next) {
  this.finalPrice = this.price - (this.discount / 100) * this.price;
  next();
});

const productModel =
  mongoose.models.product || mongoose.model('product', productSchema);

export default productModel;
