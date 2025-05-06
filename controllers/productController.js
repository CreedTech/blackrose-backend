import { v2 as cloudinary } from 'cloudinary';
import productModel from '../models/productModel.js';

// function for add product

const addProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      discount,
      category,
      //   subCategory,
      //   sizes,
      bestseller,
      tags,
      digitalDownload,
      stock,
    } = req.body;

    const image1 = req.files.image1 && req.files.image1[0];
    const image2 = req.files.image2 && req.files.image2[0];
    const image3 = req.files.image3 && req.files.image3[0];
    const image4 = req.files.image4 && req.files.image4[0];
    const image5 = req.files.image5 && req.files.image5[0];

    const images = [image1, image2, image3, image4, image5].filter(
      (item) => item !== undefined
    );

    if (images.length < 1 || images.length > 5) {
      return res.json({
        success: false,
        message: 'You must upload between 1 and 5 images.',
      });
    }

    const imagesUrl = await Promise.all(
      images.map(async (item) => {
        let result = await cloudinary.uploader.upload(item.path, {
          resource_type: 'image',
        });
        return result.secure_url;
      })
    );
    const parseTags = (input) => {
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
      //   subCategory,
      price: Number(price),
      discount: Number(discount) || 0,
      bestseller: bestseller === 'true',
      //   sizes: sizes ? JSON.parse(sizes) : [],
      tags: tags ? parseTags(tags) : [],
      digitalDownload: digitalDownload === 'true',
      stock: Number(stock) || 1,
      image: imagesUrl,
      date: Date.now(),
    };

    const product = new productModel(productData);
    await product.save();

    res.json({ success: true, message: 'Product Added' });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

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
    await productModel.findByIdAndDelete(req.body.id);
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
