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
import { trackUserActivity } from './middleware/activityTracking.js';
import paymentRouter from './routes/paymentRoute.js';
import blogRouter from './routes/blogRoutes.js';
import { startScheduledTasks } from './jobs/scheduledTasks.js';
import contactRouter from './routes/contactRoute.js';

// App Config
const app = express();
const port = process.env.PORT || 4000;
connectDB();
connectCloudinary();

// middlewares
const corsOptions = {
  origin: [
    'https://dblackrose.com',
    'https://blackrose-admin.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://blackrose-gray.vercel.app',
    'http://192.168.0.75:5174',
    'https://192.168.0.75:5174',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
  credentials: true,
};

app.use(cors(corsOptions));

// ✅ Make sure preflight (OPTIONS) requests use the same config
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.static('assets'));
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
app.use('/api/v1/blog', blogRouter);
app.use('/api/v1/contact', contactRouter);

app.get('/', (req, res) => {
  res.send('API Working');
});

if (process.env.NODE_ENV === 'production') {
  startScheduledTasks();
}


app.listen(port, () => console.log('Server started on PORT : ' + port));
