import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
import connectCloudinary from './config/cloudinary.js';
import userRouter from './routes/userRoute.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import orderRouter from './routes/orderRoute.js';
import categoryRouter from './routes/categoryRoute.js';
import galleryRouter from './routes/imageRoute.js';
import collectionRouter from './routes/collectionRoutes.js';
import adminRouter from './routes/adminRoute.js';
import authUser from './middleware/auth.js';
import { trackUserActivity } from './middleware/activityTracking.js';
import paymentRouter from './routes/paymentRoute.js';

// App Config
const app = express();
const port = process.env.PORT || 4000;
connectDB();
connectCloudinary();

// middlewares
app.use(express.json());
app.use(express.static('assets'));
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Global activity tracking for authenticated routes
// app.use('/api', authUser, trackUserActivity);

// api endpoints
app.use('/api/v1/user', userRouter);
app.use('/api/v1/product', productRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/order', orderRouter);
app.use('/api/v1/payment', paymentRouter);
app.use('/api/v1/category', categoryRouter);
app.use('/api/v1/gallery', galleryRouter);
app.use('/api/v1/collections', collectionRouter);
app.use('/api/v1/admin', adminRouter);

app.get('/', (req, res) => {
  res.send('API Working');
});

app.listen(port, () => console.log('Server started on PORT : ' + port));
