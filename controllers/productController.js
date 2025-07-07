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

// Helper function to parse custom size with proper validation
const parseCustomSize = (customSizeStr) => {
  if (!customSizeStr || customSizeStr === '{}' || customSizeStr === '') {
    return undefined;
  }

  try {
    const parsed =
      typeof customSizeStr === 'string'
        ? JSON.parse(customSizeStr)
        : customSizeStr;

    // Check if any meaningful values exist
    const hasValues = Object.entries(parsed).some(([key, value]) => {
      if (key === 'unit') return false; // unit doesn't count as a meaningful value
      return value && value !== '' && value !== '0' && !isNaN(Number(value));
    });

    if (!hasValues) return undefined;

    return {
      width:
        parsed.width && !isNaN(Number(parsed.width))
          ? Number(parsed.width)
          : undefined,
      height:
        parsed.height && !isNaN(Number(parsed.height))
          ? Number(parsed.height)
          : undefined,
      diameter:
        parsed.diameter && !isNaN(Number(parsed.diameter))
          ? Number(parsed.diameter)
          : undefined,
      length:
        parsed.length && !isNaN(Number(parsed.length))
          ? Number(parsed.length)
          : undefined,
      unit: parsed.unit || 'cm',
    };
  } catch (error) {
    console.error('Error parsing customSize:', error);
    return undefined;
  }
};

// Helper function to parse weight object properly
const parseWeightObject = (weightInput) => {
  if (
    !weightInput ||
    weightInput === '[object Object]' ||
    weightInput === '{}'
  ) {
    return { unit: 'kg' };
  }

  try {
    let parsed;
    if (typeof weightInput === 'string') {
      if (weightInput === '[object Object]') {
        return { unit: 'kg' };
      }
      parsed = JSON.parse(weightInput);
    } else if (typeof weightInput === 'object') {
      parsed = weightInput;
    } else {
      return { unit: 'kg' };
    }

    return {
      category: validateEnumField(parsed.category, [
        'Lightweight',
        'Medium Weight',
        'Heavy',
      ]),
      actualWeight:
        parsed.actualWeight && !isNaN(Number(parsed.actualWeight))
          ? Number(parsed.actualWeight)
          : undefined,
      unit: validateEnumField(parsed.unit, ['g', 'kg', 'oz', 'lbs']) || 'kg',
    };
  } catch (error) {
    console.error('Error parsing weight:', error);
    return { unit: 'kg' };
  }
};

// Enhanced enum field validator
const validateEnumField = (value, allowedValues) => {
  if (!value || value === '' || value === 'undefined' || value === 'null') {
    return undefined;
  }
  return allowedValues.includes(value) ? value : undefined;
};

// Enhanced array field parser
const parseArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field.filter((item) => item && item !== '');
  if (field === '[]' || field === '') return [];
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed)
        ? parsed.filter((item) => item && item !== '')
        : [];
    } catch (error) {
      // If JSON.parse fails, try splitting by comma
      return field
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

// Helper to clean variant data
const cleanVariantData = (variant) => {
  const cleaned = { ...variant };

  // Handle images array - CRITICAL FIX
  if (!cleaned.images || !Array.isArray(cleaned.images)) {
    cleaned.images = [];
  } else {
    // Filter out invalid entries and ensure we have valid URLs or empty array
    cleaned.images = cleaned.images.filter((img) => {
      if (!img) return false;
      if (
        typeof img === 'string' &&
        img.trim() !== '' &&
        img !== '{}' &&
        img !== '[object Object]'
      ) {
        return true;
      }
      return false;
    });
  }

  // Clean enum fields
  cleaned.color = validateEnumField(cleaned.color, [
    'Black',
    'White',
    'Gray',
    'Beige',
    'Brown',
    'Red',
    'Yellow',
    'Blue',
    'Green',
    'Purple',
    'Orange',
    'Pink',
    'Gold',
    'Silver',
    'Transparent',
    'Multi-color',
    'Custom',
  ]);

  cleaned.size = validateEnumField(cleaned.size, [
    'XS',
    'S',
    'M',
    'L',
    'XL',
    'Custom',
  ]);

  cleaned.material = validateEnumField(cleaned.material, [
    'Fabric',
    'Cotton',
    'Muslin',
    'Velvet',
    'Paper',
    'Thick Cardstock',
    'Glossy Paper',
    'Matte Paper',
    'Plastic',
    'PVC',
    'Acrylic',
    'Wood',
    'Natural Wood',
    'Painted Wood',
    'Metal',
    'Aluminum',
    'Steel',
    'Vinyl',
    'Foam',
    'Silicone',
    'Leather',
    'Canvas',
    'Marble Effect',
    'Concrete Effect',
  ]);

  cleaned.finish = validateEnumField(cleaned.finish, [
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
  ]);

  // Handle custom size
  cleaned.customSize = parseCustomSize(cleaned.customSize);

  // Ensure numeric fields
  cleaned.stock = Number(cleaned.stock) || 0;
  cleaned.price = Number(cleaned.price) || 0;
  cleaned.discount = Number(cleaned.discount) || 0;

  // Remove empty/undefined fields
  Object.keys(cleaned).forEach((key) => {
    if (
      cleaned[key] === undefined ||
      cleaned[key] === '' ||
      cleaned[key] === null
    ) {
      delete cleaned[key];
    }
  });

  return cleaned;
};


const addProduct = async (req, res) => {
  try {
    const submissionId = req.body.submissionId || Date.now().toString();

    // Check for duplicate submissions
    if (recentSubmissions.has(submissionId)) {
      console.log(`Duplicate submission detected: ${submissionId}`);
      const previousResponse = recentSubmissions.get(submissionId);
      return res.status(200).json(previousResponse);
    }

    console.log('=== PRODUCT CREATION START ===');
    console.log('Submission ID:', submissionId);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Files received:', req.files?.length || 0);

    // Log all received files
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        console.log(
          `File ${index + 1}: ${file.fieldname} - ${file.originalname}`
        );
      });
    }

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
      size,
      customSize,
      color,
      customColor,
      material,
      finish,
      orientation,
      weightCategory,
      actualWeight,
      weightUnit = 'kg',
      features,
      functionalityTags,
      usageCompatibility,
      portability,
      includedItems,
      customizationOptions,
      cameraAttributes,
      lensAttributes,
      lightingAttributes,
      tripodAttributes,
      backdropAttributes,
      propsAttributes,
      studioKitAttributes,
      availabilityType = 'In Stock',
      shippingOptions,
      seoTitle,
      seoDescription,
      seoKeywords,
      variants,
      discount = 0,
      stock = 1,
      bestseller = false,
      digitalDownload = false,
      tags,
      weight,
    } = req.body;

    // Validate required fields
    if (!title || !description || !price || !category || !productType) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: title, description, price, category, and productType are required.',
      });
    }

    // Validate price
    if (isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid positive number.',
      });
    }

    // Organize uploaded files
    const organizedFiles = {
      mainImages: [],
      variantImages: {},
    };

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        if (
          ['image1', 'image2', 'image3', 'image4', 'image5'].includes(
            file.fieldname
          )
        ) {
          // Main product images
          organizedFiles.mainImages.push({
            fieldname: file.fieldname,
            file: file,
          });
        } else if (
          file.fieldname.startsWith('variant_') &&
          file.fieldname.includes('_image_')
        ) {
          // Variant images
          organizedFiles.variantImages[file.fieldname] = file;
        }
      });
    }

    console.log('Organized files:');
    console.log('- Main images:', organizedFiles.mainImages.length);
    console.log(
      '- Variant images:',
      Object.keys(organizedFiles.variantImages).length
    );

    // Check if we have at least one image
    if (
      organizedFiles.mainImages.length === 0 &&
      Object.keys(organizedFiles.variantImages).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'At least one product image is required.',
      });
    }

    try {
      console.log('=== STARTING IMAGE UPLOADS ===');

      // Upload main product images to Cloudinary
      let mainImagesUrls = [];
      if (organizedFiles.mainImages.length > 0) {
        console.log('Uploading main product images...');
        mainImagesUrls = await Promise.all(
          organizedFiles.mainImages
            .sort((a, b) => a.fieldname.localeCompare(b.fieldname)) // Sort by image1, image2, etc.
            .map(async (imageObj) => {
              console.log(
                `Uploading ${imageObj.fieldname}:`,
                imageObj.file.originalname
              );
              const result = await cloudinary.uploader.upload(
                imageObj.file.path,
                {
                  resource_type: 'image',
                  folder: 'products',
                  transformation: [
                    {
                      width: 1200,
                      height: 1200,
                      crop: 'limit',
                      quality: 'auto',
                      format: 'webp',
                    },
                  ],
                }
              );
              console.log(
                `✅ ${imageObj.fieldname} uploaded:`,
                result.secure_url
              );
              return result.secure_url;
            })
        );
      }

      // Upload variant images to Cloudinary
      const uploadedVariantImages = {};
      if (Object.keys(organizedFiles.variantImages).length > 0) {
        console.log('Uploading variant images...');
        for (const [fieldName, file] of Object.entries(
          organizedFiles.variantImages
        )) {
          console.log(
            `Uploading variant image ${fieldName}:`,
            file.originalname
          );
          const result = await cloudinary.uploader.upload(file.path, {
            resource_type: 'image',
            folder: 'products/variants',
            transformation: [
              {
                width: 1200,
                height: 1200,
                crop: 'limit',
                quality: 'auto',
                format: 'webp',
              },
            ],
          });
          uploadedVariantImages[fieldName] = result.secure_url;
          console.log(
            `✅ Variant image ${fieldName} uploaded:`,
            result.secure_url
          );
        }
      }

      console.log('=== IMAGE UPLOADS COMPLETED ===');

      // Generate SKU if not provided
      const sku = req.body.sku || generateSKU(productType, brand, modelNumber);

      // Process variants with uploaded images
      let processedVariants = [];
      if (variants) {
        try {
          const parsedVariants = Array.isArray(variants)
            ? variants
            : JSON.parse(variants);
          console.log('Processing variants:', parsedVariants.length);

          processedVariants = parsedVariants
            .map((variant, variantIndex) => {
              console.log(`Processing variant ${variantIndex}:`, {
                color: variant.color,
                size: variant.size,
                material: variant.material,
                finish: variant.finish,
                price: variant.price,
              });

              const cleanedVariant = cleanVariantData(variant);

              // Handle variant images
              if (variant.images && Array.isArray(variant.images)) {
                const processedImages = variant.images
                  .map((imageRef) => {
                    // If it's a field name reference, get the uploaded URL
                    if (
                      typeof imageRef === 'string' &&
                      imageRef.startsWith('variant_')
                    ) {
                      const uploadedUrl = uploadedVariantImages[imageRef];
                      if (uploadedUrl) {
                        console.log(`✅ Mapped ${imageRef} to ${uploadedUrl}`);
                        return uploadedUrl;
                      } else {
                        console.log(
                          `⚠️ No uploaded image found for ${imageRef}`
                        );
                        return null;
                      }
                    }
                    // If it's already a URL, keep it
                    if (
                      typeof imageRef === 'string' &&
                      (imageRef.startsWith('http') ||
                        imageRef.startsWith('https'))
                    ) {
                      return imageRef;
                    }
                    return null;
                  })
                  .filter(Boolean);

                cleanedVariant.images = processedImages;
                console.log(
                  `Variant ${variantIndex} final images:`,
                  processedImages.length
                );
              } else {
                cleanedVariant.images = [];
              }

              // Generate SKU for variant if not provided
              cleanedVariant.sku =
                cleanedVariant.sku ||
                generateSKU(
                  productType,
                  brand,
                  `VAR${Date.now()}_${variantIndex}`
                );
              cleanedVariant.isActive = cleanedVariant.isActive !== false;

              return cleanedVariant;
            })
            .filter((variant) => {
              const isValid = variant.price && variant.price > 0;
              if (!isValid) {
                console.log('⚠️ Filtering out invalid variant:', variant);
              }
              return isValid;
            });

          console.log(
            `✅ Processed ${processedVariants.length} valid variants`
          );
        } catch (e) {
          console.error('❌ Error parsing variants:', e);
          processedVariants = [];
        }
      }

      // If no main images but we have variants with images, use first variant image as main
      if (mainImagesUrls.length === 0 && processedVariants.length > 0) {
        const firstVariantWithImages = processedVariants.find(
          (v) => v.images && v.images.length > 0
        );
        if (firstVariantWithImages) {
          mainImagesUrls = [firstVariantWithImages.images[0]];
          console.log('✅ Using variant image as main product image');
        }
      }

      // Final validation - must have at least one image
      if (mainImagesUrls.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one product image is required.',
        });
      }

      console.log('=== BUILDING PRODUCT DATA ===');

      // Build comprehensive product data
      const productData = {
        // Basic information
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        images: mainImagesUrls,
        category,
        productType,
        sku,

        // Optional basic fields
        brand: brand?.trim() || undefined,
        modelNumber: modelNumber?.trim() || undefined,
        condition,

        // Physical attributes with validation
        size: validateEnumField(size, ['XS', 'S', 'M', 'L', 'XL', 'Custom']),
        customSize: parseCustomSize(customSize),
        color: parseArrayField(color),
        customColor: customColor?.trim() || undefined,
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

        // Weight information - FIXED
        weight: weight
          ? parseWeightObject(weight)
          : {
              category: validateEnumField(weightCategory, [
                'Lightweight',
                'Medium Weight',
                'Heavy',
              ]),
              actualWeight:
                actualWeight && !isNaN(Number(actualWeight))
                  ? Number(actualWeight)
                  : undefined,
              unit:
                validateEnumField(weightUnit, ['g', 'kg', 'oz', 'lbs']) || 'kg',
            },

        // Features and functionality
        features: parseArrayField(features),
        functionalityTags: parseArrayField(functionalityTags),
        usageCompatibility: parseArrayField(usageCompatibility),
        portability: parseArrayField(portability),
        includedItems: parseArrayField(includedItems),

        // Customization options
        customizationOptions: customizationOptions
          ? (() => {
              try {
                const parsed =
                  typeof customizationOptions === 'string'
                    ? JSON.parse(customizationOptions)
                    : customizationOptions;
                return {
                  customText:
                    parsed.customText === 'true' || parsed.customText === true,
                  customSize:
                    parsed.customSize === 'true' || parsed.customSize === true,
                  customColor:
                    parsed.customColor === 'true' ||
                    parsed.customColor === true,
                  logoPrinting:
                    parsed.logoPrinting === 'true' ||
                    parsed.logoPrinting === true,
                  addonAccessories:
                    parsed.addonAccessories === 'true' ||
                    parsed.addonAccessories === true,
                };
              } catch (e) {
                return undefined;
              }
            })()
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
        seoTitle: seoTitle?.trim() || title.trim(),
        seoDescription: seoDescription?.trim() || description.trim(),
        seoKeywords: parseArrayField(seoKeywords),

        // Category-specific attributes
        cameraAttributes: cameraAttributes
          ? (() => {
              try {
                return typeof cameraAttributes === 'string'
                  ? JSON.parse(cameraAttributes)
                  : cameraAttributes;
              } catch (e) {
                return undefined;
              }
            })()
          : undefined,

        lensAttributes: lensAttributes
          ? (() => {
              try {
                return typeof lensAttributes === 'string'
                  ? JSON.parse(lensAttributes)
                  : lensAttributes;
              } catch (e) {
                return undefined;
              }
            })()
          : undefined,

        lightingAttributes: lightingAttributes
          ? (() => {
              try {
                return typeof lightingAttributes === 'string'
                  ? JSON.parse(lightingAttributes)
                  : lightingAttributes;
              } catch (e) {
                return undefined;
              }
            })()
          : undefined,

        tripodAttributes: tripodAttributes
          ? (() => {
              try {
                return typeof tripodAttributes === 'string'
                  ? JSON.parse(tripodAttributes)
                  : tripodAttributes;
              } catch (e) {
                return undefined;
              }
            })()
          : undefined,

        backdropAttributes: backdropAttributes
          ? (() => {
              try {
                return typeof backdropAttributes === 'string'
                  ? JSON.parse(backdropAttributes)
                  : backdropAttributes;
              } catch (e) {
                return undefined;
              }
            })()
          : undefined,

        propsAttributes: propsAttributes
          ? (() => {
              try {
                return typeof propsAttributes === 'string'
                  ? JSON.parse(propsAttributes)
                  : propsAttributes;
              } catch (e) {
                return undefined;
              }
            })()
          : undefined,

        studioKitAttributes: studioKitAttributes
          ? (() => {
              try {
                return typeof studioKitAttributes === 'string'
                  ? JSON.parse(studioKitAttributes)
                  : studioKitAttributes;
              } catch (e) {
                return undefined;
              }
            })()
          : undefined,

        // Processed variants with images
        variants: processedVariants,

        // Legacy fields for backward compatibility
        discount: Number(discount) || 0,
        stock: Number(stock) || 1,
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
        if (
          productData[key] === undefined ||
          (Array.isArray(productData[key]) &&
            productData[key].length === 0 &&
            !['variants', 'images'].includes(key))
        ) {
          delete productData[key];
        }
      });

      console.log('=== CREATING PRODUCT ===');
      console.log('Product data summary:');
      console.log('- Title:', productData.title);
      console.log('- Main images:', productData.images?.length || 0);
      console.log('- Variants:', productData.variants?.length || 0);
      console.log(
        '- Total variant images:',
        productData.variants?.reduce(
          (sum, v) => sum + (v.images?.length || 0),
          0
        ) || 0
      );

      const product = new productModel(productData);
      await product.save();

      console.log('✅ Product created successfully:', product._id);

      // Send admin notification (optional)
      try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';
        if (adminEmail) {
          await sendNewProductAlert(product, adminEmail);
          console.log('✅ Admin notification sent');
        }
      } catch (emailError) {
        console.error(
          '⚠️ Failed to send admin notification:',
          emailError.message
        );
        // Don't fail the request if email fails
      }

      // Store successful response to prevent duplicates
      const response = {
        success: true,
        message: 'Product Added Successfully',
        product: {
          _id: product._id,
          title: product.title,
          sku: product.sku,
          price: product.price,
          images: product.images,
          variants: product.variants?.length || 0,
          totalImages:
            (product.images?.length || 0) +
            (product.variants?.reduce(
              (sum, v) => sum + (v.images?.length || 0),
              0
            ) || 0),
        },
      };

      recentSubmissions.set(submissionId, response);
      setTimeout(() => {
        recentSubmissions.delete(submissionId);
      }, 30000);

      console.log('=== PRODUCT CREATION COMPLETED ===');
      return res.status(201).json(response);
    } catch (uploadError) {
      console.error('❌ Upload/Processing error:', uploadError);
      return res.status(500).json({
        success: false,
        message: `Upload failed: ${uploadError.message}`,
      });
    }
  } catch (error) {
    console.error('❌ Product creation error:', error);
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

    // 🆕 DATA CLEANING SECTION - FIX ALL VALIDATION ISSUES

    // 1. Fix weight field (convert "[object Object]" back to object)
    if (updateData.weight) {
      if (typeof updateData.weight === 'string') {
        if (updateData.weight === '[object Object]') {
          // If it's the stringified object, create a default weight object
          updateData.weight = {
            category: undefined,
            actualWeight: undefined,
            unit: 'kg',
          };
        } else {
          try {
            updateData.weight = JSON.parse(updateData.weight);
          } catch (e) {
            console.log('Failed to parse weight, using default');
            updateData.weight = {
              category: undefined,
              actualWeight: undefined,
              unit: 'kg',
            };
          }
        }
      }
      // Ensure weight object has proper structure
      if (updateData.weight && typeof updateData.weight === 'object') {
        const validWeightCategories = ['Lightweight', 'Medium Weight', 'Heavy'];
        const validUnits = ['g', 'kg', 'oz', 'lbs'];

        if (
          updateData.weight.category &&
          !validWeightCategories.includes(updateData.weight.category)
        ) {
          updateData.weight.category = undefined;
        }
        if (
          updateData.weight.unit &&
          !validUnits.includes(updateData.weight.unit)
        ) {
          updateData.weight.unit = 'kg';
        }
      }
    }

    // 2. Fix orientation field (remove empty array string)
    if (updateData.orientation) {
      if (typeof updateData.orientation === 'string') {
        if (updateData.orientation === '[]' || updateData.orientation === '') {
          updateData.orientation = []; // Set to empty array
        } else {
          updateData.orientation = parseArrayField(updateData.orientation);
        }
      }
      // Filter out invalid values
      if (Array.isArray(updateData.orientation)) {
        const validOrientations = [
          'Horizontal',
          'Vertical',
          'Square',
          'Adjustable',
        ];
        updateData.orientation = updateData.orientation.filter((o) =>
          validOrientations.includes(o)
        );
      }
    }

    // 3. Clean up variants using your existing helper function
    if (updateData.variants && Array.isArray(updateData.variants)) {
      updateData.variants = updateData.variants.map((variant, index) => {
        // 🎯 Use your existing cleanVariantData helper
        const cleanedVariant = cleanVariantData(variant);

        // Generate SKU if missing (your helper might not handle this)
        if (!cleanedVariant.sku || cleanedVariant.sku === '') {
          const productTypePrefix = updateData.productType
            ? updateData.productType
                .substring(0, 3)
                .toUpperCase()
                .replace(/[^A-Z]/g, '')
            : 'PRD';
          cleanedVariant.sku = `${productTypePrefix}-VAR-${Date.now()}-${index}`;
        }

        // Ensure required nested objects exist (your helper might not handle these)
        if (
          !cleanedVariant.inventory ||
          typeof cleanedVariant.inventory !== 'object'
        ) {
          cleanedVariant.inventory = {
            managed: true,
            availableQuantity: cleanedVariant.stock || 0,
            reservedQuantity: 0,
            lowStockThreshold: 5,
            backorderAllowed: false,
            backorderLimit: 0,
          };
        }

        if (
          !cleanedVariant.shipping ||
          typeof cleanedVariant.shipping !== 'object'
        ) {
          cleanedVariant.shipping = {
            dimensions: { unit: 'cm' },
            requiresSpecialHandling: false,
            additionalCost: 0,
          };
        }

        if (!cleanedVariant.variantAttributes) {
          cleanedVariant.variantAttributes = {};
        }

        // Ensure boolean fields are actually boolean
        cleanedVariant.isActive =
          cleanedVariant.isActive === true ||
          cleanedVariant.isActive === 'true';

        // Remove fields that shouldn't be in the schema
        delete cleanedVariant.tempId;

        return cleanedVariant;
      });

      // Filter out any completely invalid variants
      updateData.variants = updateData.variants.filter(
        (variant) =>
          variant.sku && typeof variant.price === 'number' && variant.price > 0
      );
    }

    // Remove undefined/null fields that might cause issues
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key];
      }
    });

    console.log('Cleaned update data:', JSON.stringify(updateData, null, 2));

    // Use manual update approach for better control
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Set each field individually, excluding variants first
    Object.keys(updateData).forEach((key) => {
      if (key !== 'variants') {
        product[key] = updateData[key];
      }
    });

    // Handle variants separately for better control
    if (updateData.variants && Array.isArray(updateData.variants)) {
      product.variants = updateData.variants;
    }

    // Validate before saving
    try {
      await product.validate();
    } catch (validationError) {
      console.error('Validation error before save:', validationError);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationError.errors,
      });
    }

    // Save with validation
    const updatedProduct = await product.save();

    // Handle price drop notifications
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
  } catch (error) {
    console.error('Update product error:', error);

    // More detailed error response
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
        value: error.errors[key].value,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};



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

   
    let exactMatch = null;

    // 🎯 SMART EXACT MATCH LOGIC
    if (Object.keys(selectedAttributes).length > 0) {
      // User has made selections - find exact match
      exactMatch = filteredVariants.find((variant) => {
        return Object.entries(selectedAttributes).every(([key, value]) => {
          return variant[key] === value;
        });
      });
    } else if (activeVariants.length === 1) {
      // 🚀 Only 1 variant - auto-select it
      exactMatch = activeVariants[0];
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
      autoSelected: activeVariants.length === 1,
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
