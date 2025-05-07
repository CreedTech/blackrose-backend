import { v2 as cloudinary } from 'cloudinary';
import productModel from '../models/productModel.js';

const recentSubmissions = new Map();

// function for add product
const addProduct = async (req, res) => {
  try {
    // Get submission ID if provided
    const submissionId = req.body.submissionId || Date.now().toString();

    // Check if this exact submission was recently processed (within last 30 seconds)
    if (recentSubmissions.has(submissionId)) {
      console.log(`Duplicate submission detected: ${submissionId}`);
      const previousResponse = recentSubmissions.get(submissionId);
      return res.status(200).json(previousResponse);
    }

    // Log the incoming request
    console.log('Received product add request');
    console.log('Request body:', req.body);
    console.log(
      'Files received:',
      req.files ? Object.keys(req.files).length : 'No files'
    );

    const {
      title,
      description,
      price,
      discount,
      category,
      bestseller,
      tags,
      digitalDownload,
      stock,
    } = req.body;

    // Check if files exist
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log('No files found in request');
      return res.status(400).json({
        success: false,
        message: 'No files were uploaded. You must upload at least one image.',
      });
    }

    // Get all image files
    const files = req.files;
    console.log('Files object structure:', JSON.stringify(req.files));

    // Safely extract file information with fallbacks
    const image1 =
      files.image1 && files.image1.length > 0 ? files.image1[0] : null;
    const image2 =
      files.image2 && files.image2.length > 0 ? files.image2[0] : null;
    const image3 =
      files.image3 && files.image3.length > 0 ? files.image3[0] : null;
    const image4 =
      files.image4 && files.image4.length > 0 ? files.image4[0] : null;
    const image5 =
      files.image5 && files.image5.length > 0 ? files.image5[0] : null;

    // Log each image status
    console.log('Image1:', image1 ? 'Found' : 'Missing');
    console.log('Image2:', image2 ? 'Found' : 'Missing');
    console.log('Image3:', image3 ? 'Found' : 'Missing');
    console.log('Image4:', image4 ? 'Found' : 'Missing');
    console.log('Image5:', image5 ? 'Found' : 'Missing');

    // Filter out undefined values
    const images = [image1, image2, image3, image4, image5].filter(
      (item) => item !== null && item !== undefined
    );

    console.log('Total valid images found:', images.length);

    if (images.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'You must upload at least one image.',
      });
    }

    // Upload images to Cloudinary
    try {
      const imagesUrl = await Promise.all(
        images.map(async (item) => {
          console.log('Uploading to Cloudinary:', item.path);
          let result = await cloudinary.uploader.upload(item.path, {
            resource_type: 'image',
          });
          console.log('Cloudinary result:', result.secure_url);
          return result.secure_url;
        })
      );

      const parseTags = (input) => {
        if (!input) return [];

        try {
          const parsed = JSON.parse(input);
          if (Array.isArray(parsed)) return parsed;
          return String(input)
            .split(',')
            .map((t) => t.trim());
        } catch {
          return String(input)
            .split(',')
            .map((t) => t.trim());
        }
      };

      const productData = {
        title,
        description,
        category,
        price: Number(price),
        discount: Number(discount) || 0,
        bestseller: bestseller === 'true',
        tags: tags ? parseTags(tags) : [],
        digitalDownload: digitalDownload === 'true',
        stock: Number(stock) || 1,
        image: imagesUrl,
        date: Date.now(),
      };

      console.log('Creating product with data:', productData);

      const product = new productModel(productData);
      await product.save();
      // If successful, store the response for this submission ID
      const response = {
        success: true,
        message: 'Product Added Successfully',
        product: product,
      };
      // Store for 30 seconds to prevent duplicates
      recentSubmissions.set(submissionId, response);
      setTimeout(() => {
        recentSubmissions.delete(submissionId);
      }, 30000);

      return res.status(201).json({
        success: true,
        message: 'Product Added Successfully',
        product: product,
      });
    } catch (cloudinaryError) {
      console.error('Cloudinary error:', cloudinaryError);
      return res.status(500).json({
        success: false,
        message: `Image upload failed: ${cloudinaryError.message}`,
      });
    }
  } catch (error) {
    console.error('Product creation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to add product',
    });
  }
};
// const addProduct = async (req, res) => {
//   try {
//     const {
//       title,
//       description,
//       price,
//       discount,
//       category,
//       //   subCategory,
//       //   sizes,
//       bestseller,
//       tags,
//       digitalDownload,
//       stock,
//     } = req.body;

//     const image1 = req.files.image1 && req.files.image1[0];
//     const image2 = req.files.image2 && req.files.image2[0];
//     const image3 = req.files.image3 && req.files.image3[0];
//     const image4 = req.files.image4 && req.files.image4[0];
//     const image5 = req.files.image5 && req.files.image5[0];

//     const images = [image1, image2, image3, image4, image5].filter(
//       (item) => item !== undefined
//     );

//     if (images.length < 1 || images.length > 5) {
//       return res.json({
//         success: false,
//         message: 'You must upload between 1 and 5 images.',
//       });
//     }

//     const imagesUrl = await Promise.all(
//       images.map(async (item) => {
//         let result = await cloudinary.uploader.upload(item.path, {
//           resource_type: 'image',
//         });
//         return result.secure_url;
//       })
//     );
//     const parseTags = (input) => {
//       try {
//         const parsed = JSON.parse(input);
//         if (Array.isArray(parsed)) return parsed;
//         return String(input)
//           .split(',')
//           .map((t) => t.trim());
//       } catch {
//         return String(input)
//           .split(',')
//           .map((t) => t.trim());
//       }
//     };

//     const productData = {
//       title,
//       description,
//       category,
//       //   subCategory,
//       price: Number(price),
//       discount: Number(discount) || 0,
//       bestseller: bestseller === 'true',
//       //   sizes: sizes ? JSON.parse(sizes) : [],
//       tags: tags ? parseTags(tags) : [],
//       digitalDownload: digitalDownload === 'true',
//       stock: Number(stock) || 1,
//       image: imagesUrl,
//       date: Date.now(),
//     };

//     const product = new productModel(productData);
//     await product.save();

//     res.json({ success: true, message: 'Product Added' });
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// function for list product
const listProducts = async (req, res) => {
  try {
    const products = await productModel.find({});
    res.json({ success: true, products });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// function for removing product
const removeProduct = async (req, res) => {
  try {
    console.log(req.params.id);
    await productModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product Removed' });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// function for single product info
const singleProduct = async (req, res) => {
  //   console.log(req.params);
  try {
    const { productId } = req.params;
    const product = await productModel.findById(productId);
    res.json(product);
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};
const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;

    // Get the current product first
    const product = await productModel.findById(productId);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }

    // Fetch products from same category (or similar tags)
    const similarProducts = await productModel
      .find({
        _id: { $ne: productId }, // exclude current product
        category: product.category,
      })
      .limit(8); // limit to 8 items

    res.json({ success: true, products: similarProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addReview = async (req, res) => {
  try {
    const { productId, comment, rating } = req.body;

    const product = await productModel.findById(productId);
    if (!product)
      return res.json({ success: false, message: 'Product not found' });

    product.reviews.push({ userId: req.user._id, comment, rating });

    // Recalculate average rating
    const ratings = product.reviews.map((r) => r.rating);
    product.rating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    await product.save();

    res.json({ success: true, message: 'Review added' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export {
  listProducts,
  addProduct,
  removeProduct,
  singleProduct,
  addReview,
  getSimilarProducts,
};
