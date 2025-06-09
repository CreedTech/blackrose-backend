import { v2 as cloudinary } from 'cloudinary';
import productModel from '../models/productModel.js';
import categoryModel from '../models/categoryModel.js';
import mongoose from 'mongoose';
import {
  sendNewProductAlert,
  sendProductReviewAlert,
  sendReviewConfirmation,
} from '../utils/emailService.js';

const recentSubmissions = new Map();

// Helper function to generate SKU
const generateSKU = (productType, brand = '', modelNumber = '') => {
  const prefix = productType.substring(0, 3).toUpperCase();
  const brandCode = brand ? brand.substring(0, 2).toUpperCase() : 'XX';
  const modelCode = modelNumber
    ? modelNumber.substring(0, 3).toUpperCase()
    : '';
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${brandCode}${modelCode}-${timestamp}`;
};

// Helper function to parse and validate enum values
const validateEnumField = (value, enumArray, fieldName) => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.filter((v) => enumArray.includes(v));
  }
  return enumArray.includes(value) ? value : undefined;
};

// Helper function to parse JSON or comma-separated strings
const parseArrayField = (input) => {
  if (!input) return [];

  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed;
    return String(input)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return String(input)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
};

// Helper function to parse custom size
const parseCustomSize = (sizeData) => {
  if (!sizeData) return undefined;

  try {
    const parsed =
      typeof sizeData === 'string' ? JSON.parse(sizeData) : sizeData;
    return {
      width: parsed.width ? Number(parsed.width) : undefined,
      height: parsed.height ? Number(parsed.height) : undefined,
      diameter: parsed.diameter ? Number(parsed.diameter) : undefined,
      length: parsed.length ? Number(parsed.length) : undefined,
      unit: ['cm', 'm', 'inches', 'feet'].includes(parsed.unit)
        ? parsed.unit
        : 'cm',
    };
  } catch {
    return undefined;
  }
};

// Enhanced add product function
const addProduct = async (req, res) => {
  try {
    const submissionId = req.body.submissionId || Date.now().toString();

    // Check for duplicate submissions
    if (recentSubmissions.has(submissionId)) {
      console.log(`Duplicate submission detected: ${submissionId}`);
      const previousResponse = recentSubmissions.get(submissionId);
      return res.status(200).json(previousResponse);
    }

    console.log('Received product add request');
    console.log('Request body:', req.body);

    // Extract and validate basic fields
    const {
      title,
      description,
      price,
      category,
      productType,
      brand,
      modelNumber,
      condition = 'New',

      // Physical attributes
      size,
      customSize,
      color,
      customColor,
      material,
      finish,
      orientation,

      // Weight information
      weightCategory,
      actualWeight,
      weightUnit = 'kg',

      // Features and compatibility
      features,
      functionalityTags,
      usageCompatibility,
      portability,
      includedItems,

      // Customization options
      customizationOptions,

      // Category-specific attributes
      cameraAttributes,
      lensAttributes,
      lightingAttributes,
      tripodAttributes,
      backdropAttributes,
      propsAttributes,
      studioKitAttributes,

      // Availability and shipping
      availabilityType = 'In Stock',
      shippingOptions,

      // SEO fields
      seoTitle,
      seoDescription,
      seoKeywords,

      // Variants
      variants,

      // Legacy fields for backward compatibility
      discount = 0,
      stock = 1,
      bestseller = false,
      digitalDownload = false,
      tags,
    } = req.body;

    // Validate required fields
    if (!title || !description || !price || !category || !productType) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: title, description, price, category, and productType are required.',
      });
    }

    // Check if files exist
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files were uploaded. You must upload at least one image.',
      });
    }

    // Process uploaded images
    const files = req.files;
    const imageFiles = [
      files.image1?.[0],
      files.image2?.[0],
      files.image3?.[0],
      files.image4?.[0],
      files.image5?.[0],
    ].filter(Boolean);

    if (imageFiles.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'You must upload at least one image.',
      });
    }

    // Upload images to Cloudinary
    try {
      const imagesUrl = await Promise.all(
        imageFiles.map(async (item) => {
          console.log('Uploading to Cloudinary:', item.path);
          const result = await cloudinary.uploader.upload(item.path, {
            resource_type: 'image',
            folder: 'products',
            transformation: [
              { width: 800, height: 800, crop: 'limit', quality: 'auto' },
            ],
          });
          console.log('Cloudinary result:', result.secure_url);
          return result.secure_url;
        })
      );

      // Generate SKU if not provided
      const sku = req.body.sku || generateSKU(productType, brand, modelNumber);

      // Build product data with enhanced validation
      const productData = {
        // Basic information
        title,
        description,
        price: Number(price),
        images: imagesUrl,
        category,
        productType,
        sku,

        // Optional basic fields
        brand: brand || undefined,
        modelNumber: modelNumber || undefined,
        condition,

        // Physical attributes with validation
        size: validateEnumField(size, ['XS', 'S', 'M', 'L', 'XL', 'Custom']),
        customSize: parseCustomSize(customSize),
        color: parseArrayField(color),
        customColor: customColor || undefined,
        material: parseArrayField(material),
        finish: validateEnumField(finish, [
          'Matte',
          'Glossy',
          'Satin',
          'Textured',
          'Reflective',
          'Frosted',
          'Rustic',
          'Modern',
          'Vintage',
          'Patterned',
          'Gradient',
          'Solid Color',
        ]),
        orientation: parseArrayField(orientation),

        // Weight information
        weight: {
          category: validateEnumField(weightCategory, [
            'Lightweight',
            'Medium Weight',
            'Heavy',
          ]),
          actualWeight: actualWeight ? Number(actualWeight) : undefined,
          unit: validateEnumField(weightUnit, ['g', 'kg', 'oz', 'lbs']) || 'kg',
        },

        // Features and functionality
        features: parseArrayField(features),
        functionalityTags: parseArrayField(functionalityTags),
        usageCompatibility: parseArrayField(usageCompatibility),
        portability: parseArrayField(portability),
        includedItems: parseArrayField(includedItems),

        // Customization options
        customizationOptions: customizationOptions
          ? {
              customText:
                customizationOptions.customText === 'true' ||
                customizationOptions.customText === true,
              customSize:
                customizationOptions.customSize === 'true' ||
                customizationOptions.customSize === true,
              customColor:
                customizationOptions.customColor === 'true' ||
                customizationOptions.customColor === true,
              logoPrinting:
                customizationOptions.logoPrinting === 'true' ||
                customizationOptions.logoPrinting === true,
              addonAccessories:
                customizationOptions.addonAccessories === 'true' ||
                customizationOptions.addonAccessories === true,
            }
          : undefined,

        // Availability and shipping
        availabilityType:
          validateEnumField(availabilityType, [
            'In Stock',
            'Made to Order',
            'Pre-order',
            'Limited Edition',
          ]) || 'In Stock',
        shippingOptions: parseArrayField(shippingOptions),

        // SEO fields
        seoTitle: seoTitle || title,
        seoDescription: seoDescription || description,
        seoKeywords: parseArrayField(seoKeywords),

        // Category-specific attributes (parse JSON if provided)
        cameraAttributes: cameraAttributes
          ? typeof cameraAttributes === 'string'
            ? JSON.parse(cameraAttributes)
            : cameraAttributes
          : undefined,
        lensAttributes: lensAttributes
          ? typeof lensAttributes === 'string'
            ? JSON.parse(lensAttributes)
            : lensAttributes
          : undefined,
        lightingAttributes: lightingAttributes
          ? typeof lightingAttributes === 'string'
            ? JSON.parse(lightingAttributes)
            : lightingAttributes
          : undefined,
        tripodAttributes: tripodAttributes
          ? typeof tripodAttributes === 'string'
            ? JSON.parse(tripodAttributes)
            : tripodAttributes
          : undefined,
        backdropAttributes: backdropAttributes
          ? typeof backdropAttributes === 'string'
            ? JSON.parse(backdropAttributes)
            : backdropAttributes
          : undefined,
        propsAttributes: propsAttributes
          ? typeof propsAttributes === 'string'
            ? JSON.parse(propsAttributes)
            : propsAttributes
          : undefined,
        studioKitAttributes: studioKitAttributes
          ? typeof studioKitAttributes === 'string'
            ? JSON.parse(studioKitAttributes)
            : studioKitAttributes
          : undefined,

        // Process variants if provided
        variants: variants
          ? (Array.isArray(variants) ? variants : JSON.parse(variants)).map(
              (variant) => ({
                ...variant,
                sku:
                  variant.sku ||
                  generateSKU(productType, brand, `VAR${Date.now()}`),
                stock: Number(variant.stock) || 0,
                price: Number(variant.price),
                discount: Number(variant.discount) || 0,
                isActive: variant.isActive !== false,
              })
            )
          : [],

        // Legacy fields for backward compatibility
        discount: Number(discount),
        stock: Number(stock),
        bestseller: bestseller === 'true' || bestseller === true,
        digitalDownload: digitalDownload === 'true' || digitalDownload === true,
        tags: parseArrayField(tags),

        // Metadata
        date: Date.now(),
        isActive: true,
        featured: false,
      };

      // Remove undefined fields to keep the document clean
      Object.keys(productData).forEach((key) => {
        if (productData[key] === undefined) {
          delete productData[key];
        }
      });

      console.log('Creating product with data:', productData);

      const product = new productModel(productData);
      await product.save();
      try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';
        await sendNewProductAlert(product, adminEmail);
        console.log('New product alert sent to admin');
      } catch (emailError) {
        console.error('Error sending new product alert:', emailError);
      }

      // Store successful response to prevent duplicates
      const response = {
        success: true,
        message: 'Product Added Successfully',
        product: product,
      };

      recentSubmissions.set(submissionId, response);
      setTimeout(() => {
        recentSubmissions.delete(submissionId);
      }, 30000);

      return res.status(201).json(response);
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

// Enhanced list products with advanced filtering
const listProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      productType,
      brand,
      priceMin,
      priceMax,
      features,
      functionalityTags,
      color,
      size,
      material,
      inStock,
      sortBy = 'newest',
      search,
    } = req.query;

    // Build filter object
    const filters = {};

    // Basic filters
    if (category) filters.category = category;
    if (productType) filters.productType = productType;
    if (brand) filters.brand = new RegExp(brand, 'i');

    // Price filter - use finalPrice
    // if (priceMin || priceMax) {
    //   filters.finalPrice = {};
    //   if (priceMin) filters.finalPrice.$gte = Number(priceMin);
    //   if (priceMax) filters.finalPrice.$lte = Number(priceMax);
    // }
    if (
      (priceMin !== undefined && priceMin !== '') ||
      (priceMax !== undefined && priceMax !== '')
    ) {
      filters.finalPrice = {};
      if (priceMin !== undefined && priceMin !== '') {
        filters.finalPrice.$gte = Number(priceMin);
      }
      if (priceMax !== undefined && priceMax !== '') {
        filters.finalPrice.$lte = Number(priceMax);
      }
    }

    // Debug log
    console.log('Price filter:', filters.finalPrice);

    // Array filters - these are arrays in your schema
    if (features && features.length > 0) {
      const featuresArray = features.split(',').filter((f) => f);
      filters.features = { $in: featuresArray };
    }

    if (functionalityTags && functionalityTags.length > 0) {
      const tagsArray = functionalityTags.split(',').filter((t) => t);
      filters.functionalityTags = { $in: tagsArray };
    }

    // Color is an array in your schema
    if (color && color.length > 0) {
      const colorsArray = color.split(',').filter((c) => c);
      filters.color = { $in: colorsArray };
    }

    // Size is a single value in your schema, not an array
    if (size && size.length > 0) {
      const sizesArray = size.split(',').filter((s) => s);
      filters.size = { $in: sizesArray };
    }

    // Material is an array in your schema
    if (material && material.length > 0) {
      const materialsArray = material.split(',').filter((m) => m);
      filters.material = { $in: materialsArray };
    }

    // Stock filter
    if (inStock === 'true' || inStock === true) {
      filters.stock = { $gt: 0 };
    }

    // Search filter
    if (search) {
      filters.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') },
      ];
    }

    // Only show active products
    filters.isActive = true;

    // Sort mapping
    let sortObj = {};
    switch (sortBy) {
      case 'newest':
        sortObj = { date: -1 };
        break;
      case 'price_low':
        sortObj = { finalPrice: 1 };
        break;
      case 'price_high':
        sortObj = { finalPrice: -1 };
        break;
      case 'popular':
        sortObj = { bestseller: -1, rating: -1 }; // Sort by bestseller then rating
        break;
      case 'rating':
        sortObj = { rating: -1 };
        break;
      default:
        sortObj = { date: -1 };
    }
    // updateAllProductPrices();

    // Execute query with pagination
    const skip = (Number(page) - 1) * Number(limit);
    // Add this to debug your products
    const debugProduct = await productModel.findOne({ title: 'Testing' });
    console.log('Product price info:', {
      price: debugProduct.price,
      discount: debugProduct.discount,
      finalPrice: debugProduct.finalPrice,
      calculatedFinalPrice:
        debugProduct.price - (debugProduct.discount / 100) * debugProduct.price,
    });
    const products = await productModel
      .find(filters)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .populate('category')
      .lean();

    // Get total count for pagination
    const totalProducts = await productModel.countDocuments(filters);
    const totalPages = Math.ceil(totalProducts / Number(limit));

    res.json({
      success: true,
      products,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalProducts,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// Run this once to update all products
const updateAllProductPrices = async () => {
  const products = await productModel.find({});

  for (const product of products) {
    product.finalPrice =
      product.price - (product.discount / 100) * product.price;
    await product.save();
  }
};
// const listProducts = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 12,
//       category,
//       productType,
//       brand,
//       priceMin,
//       priceMax,
//       features,
//       functionalityTags,
//       color,
//       material,
//       inStock,
//       sortBy = 'date',
//       sortOrder = 'desc',
//       search,
//     } = req.query;

//     // Build filter object
//     const filters = {};

//     if (category) filters.category = category;
//     if (productType) filters.productType = productType;
//     if (brand) filters.brand = new RegExp(brand, 'i');
//     if (priceMin || priceMax) {
//       filters.price = {};
//       if (priceMin) filters.price.$gte = Number(priceMin);
//       if (priceMax) filters.price.$lte = Number(priceMax);
//     }
//     if (features) filters.features = { $in: features.split(',') };
//     if (functionalityTags)
//       filters.functionalityTags = { $in: functionalityTags.split(',') };
//     if (color) filters.color = { $in: color.split(',') };
//     if (material) filters.material = { $in: material.split(',') };
//     if (inStock === 'true') filters.stock = { $gt: 0 };
//     if (search) {
//       filters.$or = [
//         { title: new RegExp(search, 'i') },
//         { description: new RegExp(search, 'i') },
//         { tags: new RegExp(search, 'i') },
//       ];
//     }

//     // Only show active products
//     filters.isActive = true;

//     // Build sort object
//     const sortObj = {};
//     sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

//     // Execute query with pagination
//     const skip = (Number(page) - 1) * Number(limit);
//     const products = await productModel
//       .find(filters)
//       .sort(sortObj)
//       .skip(skip)
//       .limit(Number(limit))
//       .populate('category')
//       .lean();

//     // Get total count for pagination
//     const totalProducts = await productModel.countDocuments(filters);
//     const totalPages = Math.ceil(totalProducts / Number(limit));

//     res.json({
//       success: true,
//       products,
//       pagination: {
//         currentPage: Number(page),
//         totalPages,
//         totalProducts,
//         hasNextPage: Number(page) < totalPages,
//         hasPrevPage: Number(page) > 1,
//       },
//     });
//   } catch (error) {
//     console.error('List products error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = { ...req.body };
    const currentProduct = await productModel.findById(productId);
    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const oldPrice = currentProduct.price;
    const newPrice = updateData.price ? Number(updateData.price) : oldPrice;

    // Handle image updates if new files are uploaded
    if (req.files && Object.keys(req.files).length > 0) {
      const imageFiles = [
        req.files.image1?.[0],
        req.files.image2?.[0],
        req.files.image3?.[0],
        req.files.image4?.[0],
        req.files.image5?.[0],
      ].filter(Boolean);

      if (imageFiles.length > 0) {
        const newImages = await Promise.all(
          imageFiles.map(async (item) => {
            const result = await cloudinary.uploader.upload(item.path, {
              resource_type: 'image',
              folder: 'products',
              transformation: [
                { width: 800, height: 800, crop: 'limit', quality: 'auto' },
              ],
            });
            return result.secure_url;
          })
        );
        updateData.images = newImages;
      }
    }

    // Handle variants specifically
    if (updateData.variants) {
      // Check if variants is a string and try to parse it
      if (typeof updateData.variants === 'string') {
        try {
          updateData.variants = JSON.parse(updateData.variants);

          // After parsing, make sure it's an array
          if (!Array.isArray(updateData.variants)) {
            delete updateData.variants;
            console.log(
              'Variants is not an array after parsing, removing from update'
            );
          }
        } catch (e) {
          // If parsing fails, delete the field to avoid errors
          delete updateData.variants;
          console.log(
            'Failed to parse variants JSON, removing from update:',
            e
          );
        }
      } else if (!Array.isArray(updateData.variants)) {
        // If it's not a string and not an array, delete it
        delete updateData.variants;
        console.log('Variants is not an array, removing from update');
      }
    }

    // Parse array fields
    [
      'color',
      'material',
      'features',
      'functionalityTags',
      'usageCompatibility',
      'portability',
      'includedItems',
      'shippingOptions',
      'tags',
      'seoKeywords',
    ].forEach((field) => {
      if (updateData[field]) {
        updateData[field] = parseArrayField(updateData[field]);
      }
    });

    // Parse numeric fields
    ['price', 'discount', 'stock', 'actualWeight'].forEach((field) => {
      if (updateData[field]) {
        updateData[field] = Number(updateData[field]);
      }
    });

    // Parse boolean fields
    ['bestseller', 'digitalDownload', 'featured', 'isActive'].forEach(
      (field) => {
        if (updateData[field] !== undefined) {
          updateData[field] =
            updateData[field] === 'true' || updateData[field] === true;
        }
      }
    );

    // Parse custom size if provided
    if (updateData.customSize) {
      updateData.customSize = parseCustomSize(updateData.customSize);
    }

    // Parse category-specific attributes
    [
      'cameraAttributes',
      'lensAttributes',
      'lightingAttributes',
      'tripodAttributes',
      'backdropAttributes',
      'propsAttributes',
      'studioKitAttributes',
    ].forEach((field) => {
      if (updateData[field] && typeof updateData[field] === 'string') {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (e) {
          console.error(`Error parsing ${field}:`, e);
          delete updateData[field];
        }
      }
    });

    console.log('Final update data:', JSON.stringify(updateData, null, 2));

    // If the variants field might cause problems, consider using a different approach
    // Option 1: Use findById and manual updates for better control
    if (updateData.variants) {
      const product = await productModel.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      // Set each field individually, carefully handling variants
      Object.keys(updateData).forEach((key) => {
        if (key !== 'variants') {
          product[key] = updateData[key];
        }
      });

      // Handle variants separately
      if (Array.isArray(updateData.variants)) {
        product.variants = updateData.variants;
      }

      const updatedProduct = await product.save();

      if (newPrice < oldPrice) {
        try {
          const { checkPriceDrops } = await import(
            '../services/priceDropService.js'
          );
          await checkPriceDrops(updatedProduct, oldPrice, newPrice);
        } catch (emailError) {
          console.error('Error sending price drop notifications:', emailError);
        }
      }

      return res.json({
        success: true,
        message: 'Product updated successfully',
        product: updatedProduct,
      });
    } else {
      // If no variants to update, use the standard findByIdAndUpdate
      const updatedProduct = await productModel.findByIdAndUpdate(
        productId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }
      if (newPrice < oldPrice) {
        try {
          const { checkPriceDrops } = await import(
            '../services/priceDropService.js'
          );
          await checkPriceDrops(updatedProduct, oldPrice, newPrice);
        } catch (emailError) {
          console.error('Error sending price drop notifications:', emailError);
        }
      }

      return res.json({
        success: true,
        message: 'Product updated successfully',
        product: updatedProduct,
      });
    }
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// Remove product function
const removeProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Removing product:', id);

    const deletedProduct = await productModel.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json({ success: true, message: 'Product Removed Successfully' });
  } catch (error) {
    console.error('Remove product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const singleProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await productModel
      .findById(productId)
      .populate('reviews.userId', 'name email')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if product has variants
    const hasVariants = product.variants && product.variants.length > 0;

    // Filter active variants only
    const activeVariants = hasVariants
      ? product.variants.filter((v) => v.isActive)
      : [];

    // Calculate variant availability
    const variantsInStock = activeVariants.filter((v) => v.stock > 0);

    // Add calculated fields
    product.averageRating =
      product.reviews.length > 0
        ? (
            product.reviews.reduce((acc, review) => acc + review.rating, 0) /
            product.reviews.length
          ).toFixed(1)
        : '0.0';

    product.reviewCount = product.reviews.length;
    product.hasVariants = hasVariants;
    product.availableVariantCount = activeVariants.length;
    product.inStockVariantCount = variantsInStock.length;

    // Check if completely out of stock
    product.isAvailable = hasVariants
      ? variantsInStock.length > 0
      : product.stock > 0;

    // Get variant options if product has variants
    if (hasVariants) {
      const variantOptions = {
        colors: [
          ...new Set(activeVariants.map((v) => v.color).filter(Boolean)),
        ],
        sizes: [...new Set(activeVariants.map((v) => v.size).filter(Boolean))],
        materials: [
          ...new Set(activeVariants.map((v) => v.material).filter(Boolean)),
        ],
        finishes: [
          ...new Set(activeVariants.map((v) => v.finish).filter(Boolean)),
        ],
      };

      product.variantOptions = variantOptions;
    }

    // Get category path for breadcrumbs
    if (product.category) {
      try {
        const Category = mongoose.model('Category');
        const category = await Category.findById(product.category);
        if (category) {
          product.categoryPath = await category.getCategoryPath();
        }
      } catch (err) {
        console.error('Error getting category path:', err);
      }
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Single product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get similar products with enhanced matching
const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 8 } = req.query;

    const product = await productModel.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }

    // Build similarity query
    const similarityQuery = {
      _id: { $ne: productId },
      isActive: true,
    };

    // Primary match: same category and product type
    const primaryMatches = await productModel
      .find({
        ...similarityQuery,
        category: product.category,
        productType: product.productType,
      })
      .limit(Number(limit))
      .lean();

    // If we don't have enough primary matches, get secondary matches
    let similarProducts = primaryMatches;
    if (primaryMatches.length < Number(limit)) {
      const remaining = Number(limit) - primaryMatches.length;
      const primaryIds = primaryMatches.map((p) => p._id);

      const secondaryMatches = await productModel
        .find({
          ...similarityQuery,
          _id: { $nin: [productId, ...primaryIds] },
          $or: [
            { category: product.category },
            { productType: product.productType },
            { functionalityTags: { $in: product.functionalityTags || [] } },
            { features: { $in: product.features || [] } },
          ],
        })
        .limit(remaining)
        .lean();

      similarProducts = [...primaryMatches, ...secondaryMatches];
    }

    res.json({ success: true, products: similarProducts });
  } catch (error) {
    console.error('Similar products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Enhanced add review function
const addReview = async (req, res) => {
  try {
    const { productId, comment, rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    const product = await productModel.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }

    // Check if user already reviewed this product
    const existingReview = product.reviews.find(
      (r) => r.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }

    // Add new review
    product.reviews.push({
      userId: req.user._id,
      comment: comment || '',
      rating: Number(rating),
      date: new Date(),
      verifiedPurchase: false, // You can implement purchase verification logic
    });

    // Recalculate average rating
    const ratings = product.reviews.map((r) => r.rating);
    product.rating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    await product.save();

    try {
      // Thank customer for review
      await sendReviewConfirmation(product, req.user.email, req.user.name);

      // Alert admin about new review
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';
      await sendProductReviewAlert(product, adminEmail, {
        customerName: req.user.name,
        rating: Number(rating),
        comment: comment || '',
      });

      console.log('Review notifications sent');
    } catch (emailError) {
      console.error('Error sending review notifications:', emailError);
    }

    res.json({ success: true, message: 'Review added successfully' });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getProductVariants = async (req, res) => {
  try {
    const { productId } = req.params;
    const { color, size, material, finish } = req.query;

    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (!product.variants || product.variants.length === 0) {
      return res.json({
        success: true,
        hasVariants: false,
        message: 'This product does not have variants',
      });
    }

    // Get only active variants
    const activeVariants = product.variants.filter((v) => v.isActive);

    // Collect all available variant attributes
    const availableOptions = {
      colors: new Set(),
      sizes: new Set(),
      materials: new Set(),
      finishes: new Set(),
    };

    activeVariants.forEach((variant) => {
      if (variant.color) availableOptions.colors.add(variant.color);
      if (variant.size) availableOptions.sizes.add(variant.size);
      if (variant.material) availableOptions.materials.add(variant.material);
      if (variant.finish) availableOptions.finishes.add(variant.finish);
    });

    // Filter variants based on selected attributes
    const selectedAttributes = {};
    if (color) selectedAttributes.color = color;
    if (size) selectedAttributes.size = size;
    if (material) selectedAttributes.material = material;
    if (finish) selectedAttributes.finish = finish;

    // Find matching variants
    const filteredVariants = activeVariants.filter((variant) => {
      return Object.entries(selectedAttributes).every(([key, value]) => {
        return !value || variant[key] === value;
      });
    });

    // Determine next available options based on current selection
    const nextOptions = {
      colors: new Set(),
      sizes: new Set(),
      materials: new Set(),
      finishes: new Set(),
    };

    filteredVariants.forEach((variant) => {
      if (variant.color) nextOptions.colors.add(variant.color);
      if (variant.size) nextOptions.sizes.add(variant.size);
      if (variant.material) nextOptions.materials.add(variant.material);
      if (variant.finish) nextOptions.finishes.add(variant.finish);
    });

    // Find exact variant match if all attributes are selected
    let exactMatch = null;
    if (
      color &&
      size &&
      (material || !activeVariants.some((v) => v.material)) &&
      (finish || !activeVariants.some((v) => v.finish))
    ) {
      exactMatch = filteredVariants.find(
        (variant) =>
          variant.color === color &&
          variant.size === size &&
          (!material || variant.material === material) &&
          (!finish || variant.finish === finish)
      );
    }

    res.json({
      success: true,
      hasVariants: true,
      availableOptions: {
        colors: Array.from(availableOptions.colors),
        sizes: Array.from(availableOptions.sizes),
        materials: Array.from(availableOptions.materials),
        finishes: Array.from(availableOptions.finishes),
      },
      nextAvailableOptions: {
        colors: Array.from(nextOptions.colors),
        sizes: Array.from(nextOptions.sizes),
        materials: Array.from(nextOptions.materials),
        finishes: Array.from(nextOptions.finishes),
      },
      filteredVariants,
      exactMatch,
      totalVariants: activeVariants.length,
    });
  } catch (error) {
    console.error('Get product variants error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const checkVariantAvailability = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variantId, quantity = 1 } = req.query;

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: 'Product ID is required' });
    }

    const product = await productModel.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }

    const quantityNum = Number(quantity);
    if (isNaN(quantityNum) || quantityNum < 1) {
      return res
        .status(400)
        .json({ success: false, message: 'Quantity must be at least 1' });
    }

    let availabilityInfo;

    if (variantId) {
      const variant = product.variants.id(variantId);

      if (!variant) {
        return res
          .status(404)
          .json({ success: false, message: 'Variant not found' });
      }

      availabilityInfo = {
        isAvailable: variant.isActive && variant.stock >= quantityNum,
        currentStock: variant.stock,
        requestedQuantity: quantityNum,
        price: variant.price,
        discount: variant.discount || 0,
        finalPrice:
          variant.price - ((variant.discount || 0) / 100) * variant.price,
      };
    } else {
      availabilityInfo = {
        isAvailable: product.isActive && product.stock >= quantityNum,
        currentStock: product.stock,
        requestedQuantity: quantityNum,
        price: product.price,
        discount: product.discount || 0,
        finalPrice:
          product.price - ((product.discount || 0) / 100) * product.price,
      };
    }

    res.json({
      success: true,
      availability: availabilityInfo,
    });
  } catch (error) {
    console.error('Check variant availability error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a method to search for products by SKU (useful for admin)
const findProductBySku = async (req, res) => {
  try {
    const { sku } = req.params;

    if (!sku) {
      return res
        .status(400)
        .json({ success: false, message: 'SKU is required' });
    }

    // Search for product with matching SKU
    const productWithSku = await productModel.findOne({ sku });

    if (productWithSku) {
      return res.json({
        success: true,
        product: productWithSku,
        matchType: 'mainProduct',
      });
    }

    // If not found, search for variants with matching SKU
    const productWithVariantSku = await productModel.findOne({
      'variants.sku': sku,
    });

    if (productWithVariantSku) {
      const variant = productWithVariantSku.variants.find((v) => v.sku === sku);

      return res.json({
        success: true,
        product: productWithVariantSku,
        variant,
        matchType: 'variant',
      });
    }

    return res.status(404).json({
      success: false,
      message: 'No product found with the provided SKU',
    });
  } catch (error) {
    console.error('Find product by SKU error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a method to get inventory status
const getInventoryStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await productModel.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }

    // Gather inventory information
    const inventoryInfo = {
      productId: product._id,
      sku: product.sku,
      mainProductStock: product.stock,
      hasVariants: product.variants && product.variants.length > 0,
      lowStockThreshold: 5, // You could make this configurable
      variants: [],
    };

    if (inventoryInfo.hasVariants) {
      // Add variant inventory details
      inventoryInfo.variants = product.variants.map((variant) => ({
        variantId: variant._id,
        sku: variant.sku,
        attributes: {
          color: variant.color,
          size: variant.size,
          material: variant.material,
          finish: variant.finish,
        },
        stock: variant.stock,
        isLowStock: variant.stock <= inventoryInfo.lowStockThreshold,
        isOutOfStock: variant.stock <= 0,
        isActive: variant.isActive,
      }));

      // Calculate aggregated stats
      inventoryInfo.totalVariants = inventoryInfo.variants.length;
      inventoryInfo.activeVariants = inventoryInfo.variants.filter(
        (v) => v.isActive
      ).length;
      inventoryInfo.outOfStockVariants = inventoryInfo.variants.filter(
        (v) => v.isOutOfStock
      ).length;
      inventoryInfo.lowStockVariants = inventoryInfo.variants.filter(
        (v) => v.isLowStock && !v.isOutOfStock
      ).length;
      inventoryInfo.totalStock = inventoryInfo.variants.reduce(
        (sum, v) => sum + v.stock,
        0
      );
    }

    inventoryInfo.isLowStock = inventoryInfo.hasVariants
      ? inventoryInfo.totalStock <= inventoryInfo.lowStockThreshold
      : product.stock <= inventoryInfo.lowStockThreshold;

    inventoryInfo.isOutOfStock = inventoryInfo.hasVariants
      ? inventoryInfo.totalStock <= 0
      : product.stock <= 0;

    res.json({
      success: true,
      inventory: inventoryInfo,
    });
  } catch (error) {
    console.error('Get inventory status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a method to update variant stock
// const updateVariantStock = async (req, res) => {
//   try {
//     const { productId, variantId } = req.params;
//     const { stock } = req.body;

//     if (stock === undefined || isNaN(Number(stock))) {
//       return res
//         .status(400)
//         .json({ success: false, message: 'Valid stock quantity is required' });
//     }

//     const stockNum = Number(stock);

//     const product = await productModel.findById(productId);
//     if (!product) {
//       return res
//         .status(404)
//         .json({ success: false, message: 'Product not found' });
//     }

//     if (variantId) {
//       const variant = product.variants.id(variantId);

//       if (!variant) {
//         return res
//           .status(404)
//           .json({ success: false, message: 'Variant not found' });
//       }

//       // Update variant stock
//       variant.stock = stockNum;

//       // Recalculate total product stock
//       product.stock = product.variants.reduce((total, v) => {
//         return total + (v.isActive ? v.stock : 0);
//       }, 0);
//     } else {
//       // Update main product stock
//       product.stock = stockNum;
//     }

//     await product.save();
//     const wasOutOfStock = stockNum === 0;
//     const nowHasStock = stockNum > 0;

//     if (!wasOutOfStock && nowHasStock) {
//       // Send back-in-stock notifications to interested customers
//       try {
//         await notifyBackInStock(product, variantId);
//       } catch (emailError) {
//         console.error('Error sending back-in-stock notifications:', emailError);
//       }
//     }

//     res.json({
//       success: true,
//       message: 'Stock updated successfully',
//       currentStock: variantId
//         ? product.variants.id(variantId).stock
//         : product.stock,
//       totalProductStock: product.stock,
//     });
//   } catch (error) {
//     console.error('Update variant stock error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
const updateVariantStock = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { stock } = req.body;

    if (stock === undefined || isNaN(Number(stock))) {
      return res.status(400).json({
        success: false,
        message: 'Valid stock quantity is required',
      });
    }

    const stockNum = Number(stock);
    const product = await productModel.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    let wasOutOfStock = false;
    let previousStock = 0;

    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant) {
        return res.status(404).json({
          success: false,
          message: 'Variant not found',
        });
      }

      previousStock = variant.stock;
      wasOutOfStock = previousStock <= 0;

      // Update variant stock
      variant.stock = stockNum;

      // Recalculate total product stock
      product.stock = product.variants.reduce((total, v) => {
        return total + (v.isActive ? v.stock : 0);
      }, 0);
    } else {
      previousStock = product.stock;
      wasOutOfStock = previousStock <= 0;

      // Update main product stock
      product.stock = stockNum;
    }

    await product.save();

    // Send back-in-stock notifications if item was out of stock and now has stock
    if (wasOutOfStock && stockNum > 0) {
      try {
        const { notifyBackInStock } = await import(
          '../services/backInStockService.js'
        );
        await notifyBackInStock(product, variantId);
        console.log('Back-in-stock notifications sent');
      } catch (emailError) {
        console.error('Error sending back-in-stock notifications:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Stock updated successfully',
      currentStock: variantId
        ? product.variants.id(variantId).stock
        : product.stock,
      totalProductStock: product.stock,
      notificationsSent: wasOutOfStock && stockNum > 0,
    });
  } catch (error) {
    console.error('Update variant stock error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a method to add a new variant to an existing product
const addProductVariant = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await productModel.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }

    // Extract variant data
    const {
      color,
      size,
      material,
      finish,
      customSize,
      stock = 0,
      price,
      discount = 0,
      sku,
    } = req.body;

    // Validate required fields
    if (!price) {
      return res
        .status(400)
        .json({ success: false, message: 'Price is required for variant' });
    }

    // Check for duplicate variant
    const isDuplicate = product.variants.some(
      (variant) =>
        variant.color === color &&
        variant.size === size &&
        variant.material === material &&
        variant.finish === finish
    );

    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: 'A variant with these attributes already exists',
      });
    }

    // Generate SKU if not provided
    const variantSku =
      sku || generateSKU(product.productType, product.brand, `V${Date.now()}`);

    // Handle image uploads if included
    let variantImages = [];

    if (req.files && Object.keys(req.files).length > 0) {
      const imageFiles = [
        req.files.variantImage1?.[0],
        req.files.variantImage2?.[0],
        req.files.variantImage3?.[0],
      ].filter(Boolean);

      if (imageFiles.length > 0) {
        variantImages = await Promise.all(
          imageFiles.map(async (item) => {
            const result = await cloudinary.uploader.upload(item.path, {
              resource_type: 'image',
              folder: 'products/variants',
              transformation: [
                { width: 800, height: 800, crop: 'limit', quality: 'auto' },
              ],
            });
            return result.secure_url;
          })
        );
      }
    }

    // If no variant images provided, use main product images
    if (variantImages.length === 0) {
      variantImages = product.images.slice(0, 1);
    }

    // Create new variant
    const newVariant = {
      sku: variantSku,
      color,
      size,
      material,
      finish,
      customSize: parseCustomSize(customSize),
      stock: Number(stock),
      price: Number(price),
      discount: Number(discount),
      images: variantImages,
      isActive: true,
    };

    // Add to product
    product.variants.push(newVariant);

    // Recalculate total product stock
    product.stock = product.variants.reduce((total, v) => {
      return total + (v.isActive ? v.stock : 0);
    }, 0);

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Variant added successfully',
      variant: product.variants[product.variants.length - 1],
      totalVariants: product.variants.length,
    });
  } catch (error) {
    console.error('Add product variant error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a method to get products by filters (for faceted search)
const getProductsByFilters = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      productType,
      brand,
      priceMin,
      priceMax,
      color,
      size,
      material,
      finish,
      features,
      functionalityTags,
      inStock = 'true',
      sortBy = 'date',
      sortOrder = 'desc',
      search,
    } = req.query;

    // Build filter object
    const filters = { isActive: true };

    // Apply category filter
    if (category) {
      // Check if we need to include subcategories
      const Category = mongoose.model('Category');
      const categoryObj = await Category.findById(category);

      if (categoryObj) {
        const subcategories = await categoryObj.getAllSubcategories();
        const categoryIds = [category, ...subcategories.map((c) => c._id)];
        filters.category = { $in: categoryIds };
      } else {
        filters.category = category;
      }
    }

    // Basic filters
    if (productType) filters.productType = productType;
    if (brand) filters.brand = new RegExp(brand, 'i');

    // Price range
    if (priceMin || priceMax) {
      filters.price = {};
      if (priceMin) filters.price.$gte = Number(priceMin);
      if (priceMax) filters.price.$lte = Number(priceMax);
    }

    // Array filters
    if (features) filters.features = { $in: features.split(',') };
    if (functionalityTags)
      filters.functionalityTags = { $in: functionalityTags.split(',') };

    // Text search
    if (search) {
      filters.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') },
        { sku: new RegExp(search, 'i') },
      ];
    }

    // Variant-specific filters (more complex)
    const variantFilters = [];

    if (color) {
      const colors = color.split(',');
      variantFilters.push({
        $or: [
          { color: { $in: colors } },
          { 'variants.color': { $in: colors } },
        ],
      });
    }

    if (size) {
      const sizes = size.split(',');
      variantFilters.push({
        $or: [{ size: { $in: sizes } }, { 'variants.size': { $in: sizes } }],
      });
    }

    if (material) {
      const materials = material.split(',');
      variantFilters.push({
        $or: [
          { material: { $in: materials } },
          { 'variants.material': { $in: materials } },
        ],
      });
    }

    if (finish) {
      const finishes = finish.split(',');
      variantFilters.push({
        $or: [
          { finish: { $in: finishes } },
          { 'variants.finish': { $in: finishes } },
        ],
      });
    }

    // Stock availability
    if (inStock === 'true') {
      variantFilters.push({
        $or: [{ stock: { $gt: 0 } }, { 'variants.stock': { $gt: 0 } }],
      });
    }

    // Add variant filters to main filters if any exist
    if (variantFilters.length > 0) {
      filters.$and = variantFilters;
    }

    // Build sort object
    const sortObj = {};

    // Handle special sort cases
    if (sortBy === 'price') {
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'popular') {
      sortObj['rating'] = -1;
      sortObj['reviews.length'] = -1;
    } else if (sortBy === 'newest') {
      sortObj['date'] = -1;
    } else {
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Execute query with pagination
    const skip = (Number(page) - 1) * Number(limit);

    const products = await productModel
      .find(filters)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .select(
        'title description price discount images category productType brand color size material finish variants stock rating reviews'
      )
      .lean();

    // Get total count for pagination
    const totalProducts = await productModel.countDocuments(filters);
    const totalPages = Math.ceil(totalProducts / Number(limit));

    // Process products to add variant info and availability
    const processedProducts = products.map((product) => {
      // Check if product has active variants
      const hasVariants = product.variants && product.variants.length > 0;
      const activeVariants = hasVariants
        ? product.variants.filter((v) => v.isActive)
        : [];

      // Check stock status
      const isAvailable = hasVariants
        ? activeVariants.some((v) => v.stock > 0)
        : product.stock > 0;

      // Calculate price range if product has variants
      let minPrice = product.price;
      let maxPrice = product.price;

      if (hasVariants && activeVariants.length > 0) {
        const prices = activeVariants.map((v) => {
          const finalPrice = v.price - ((v.discount || 0) / 100) * v.price;
          return finalPrice;
        });

        minPrice = Math.min(...prices);
        maxPrice = Math.max(...prices);
      }

      // Calculate main product final price
      const finalPrice =
        product.price - ((product.discount || 0) / 100) * product.price;

      return {
        ...product,
        hasVariants,
        variantCount: activeVariants.length,
        isAvailable,
        finalPrice,
        priceRange:
          hasVariants && minPrice !== maxPrice
            ? { min: minPrice, max: maxPrice }
            : null,
        averageRating:
          product.reviews && product.reviews.length > 0
            ? (
                product.reviews.reduce(
                  (acc, review) => acc + review.rating,
                  0
                ) / product.reviews.length
              ).toFixed(1)
            : '0.0',
        reviewCount: product.reviews ? product.reviews.length : 0,
      };
    });

    res.json({
      success: true,
      products: processedProducts,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalProducts,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get products by filters error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get products by category with filters
const getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      page = 1,
      limit = 12,
      sortBy = 'date',
      sortOrder = 'desc',
      ...filters
    } = req.query;

    // Build query
    const query = { category: categoryId, isActive: true };

    // Apply additional filters
    Object.keys(filters).forEach((key) => {
      if (
        filters[key] &&
        key !== 'page' &&
        key !== 'limit' &&
        key !== 'sortBy' &&
        key !== 'sortOrder'
      ) {
        if (key === 'priceMin') {
          query.price = { ...query.price, $gte: Number(filters[key]) };
        } else if (key === 'priceMax') {
          query.price = { ...query.price, $lte: Number(filters[key]) };
        } else if (
          ['features', 'functionalityTags', 'color', 'material'].includes(key)
        ) {
          query[key] = { $in: filters[key].split(',') };
        } else {
          query[key] = filters[key];
        }
      }
    });

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);
    const products = await productModel
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const totalProducts = await productModel.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / Number(limit));

    res.json({
      success: true,
      products,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalProducts,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const requestBackInStockNotification = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variantId, email } = req.body;

    // Use logged-in user email if available, otherwise use provided email
    const notificationEmail = req.user?.email || email;
    const userId = req.user?._id || null;

    if (!notificationEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required for notifications',
      });
    }

    // Verify product exists
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if item is actually out of stock
    let isOutOfStock = false;

    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant) {
        return res.status(404).json({
          success: false,
          message: 'Variant not found',
        });
      }
      isOutOfStock = variant.stock <= 0;
    } else {
      isOutOfStock = product.stock <= 0;
    }

    if (!isOutOfStock) {
      return res.status(400).json({
        success: false,
        message: 'This item is currently in stock',
      });
    }

    const { addBackInStockRequest } = await import(
      '../services/backInStockService.js'
    );
    const result = await addBackInStockRequest(
      notificationEmail,
      productId,
      variantId,
      userId
    );

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Request back-in-stock notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process notification request',
    });
  }
};

export {
  addProduct,
  listProducts,
  updateProduct,
  removeProduct,
  singleProduct,
  getSimilarProducts,
  addReview,
  getProductVariants,
  getProductsByCategory,
  checkVariantAvailability,
  findProductBySku,
  getInventoryStatus,
  updateVariantStock,
  addProductVariant,
  getProductsByFilters,
};
