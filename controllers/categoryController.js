// import Category from '../models/categoryModel.js';
// import { v2 as cloudinary } from 'cloudinary';

// const getCategories = async (req, res) => {
//   try {
//     const categories = await Category.find({ active: true }).sort({
//       order: 1,
//       title: 1,
//     });
//     res.json(categories);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// const getCategoryBySlug = async (req, res) => {
//   try {
//     const category = await Category.findOne({
//       slug: req.params.slug,
//       active: true,
//     });

//     if (!category) {
//       return res.status(404).json({ message: 'Category not found' });
//     }

//     res.json(category);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// const createCategory = async (req, res) => {
//   try {
//     let imageUrl = await cloudinary.uploader.upload(req.body.image, {
//       folder: 'categories',
//       resource_type: 'image',
//       allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
//     });
//     const category = new Category({
//       title: req.body.title,
//       description: req.body.description,
//       image: imageUrl.url,
//       order: req.body.order,
//     });

//     const newCategory = await category.save();
//     res.status(201).json(newCategory);
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// const updateCategory = async (req, res) => {
//   try {
//     const category = await Category.findById(req.params.id);
//     if (!category) {
//       return res.status(404).json({ message: 'Category not found' });
//     }

//     Object.keys(req.body).forEach((key) => {
//       if (req.body[key] !== undefined) {
//         category[key] = req.body[key];
//       }
//     });

//     const updatedCategory = await category.save();
//     res.json(updatedCategory);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// // Delete category (soft delete)
// const deleteCategory = async (req, res) => {
//   try {
//     console.log('Deleting category with ID:', req.params.id);

//     // Use findByIdAndDelete to directly remove the document
//     const deletedCategory = await Category.findByIdAndDelete(req.params.id);

//     if (!deletedCategory) {
//       return res.status(404).json({ message: 'Category not found' });
//     }

//     res.json({
//       message: 'Category deleted successfully',
//       deletedCategory: {
//         name: deletedCategory.name,
//         id: deletedCategory._id,
//       },
//     });
//   } catch (error) {
//     console.error('Error deleting category:', error);
//     res.status(500).json({ message: error.message });
//   }
// };

// export {
//   getCategories,
//   getCategoryBySlug,
//   createCategory,
//   updateCategory,
//   deleteCategory,
// };

import Category from '../models/categoryModel.js';
import { v2 as cloudinary } from 'cloudinary';

const getCategories = async (req, res) => {
  try {
    const {
      featured,
      categoryType,
      level,
      parentCategory,
      active = true,
      sortBy = 'order',
      sortOrder = 'asc',
    } = req.query;

    let query = { active: active === true };

    if (featured !== undefined) {
      query.featured = featured === true;
    }

    if (categoryType) {
      query.categoryType = categoryType;
    }

    if (level !== undefined) {
      query.level = parseInt(level);
    }

    if (parentCategory) {
      query.parentCategory = parentCategory === 'null' ? null : parentCategory;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;


    const categories = await Category.find(query)
      .populate('parentCategory', 'title slug')
      .sort(sortOptions);

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// const getCategoryBySlug = async (req, res) => {
//   try {
//     const category = await Category.findOne({
//       slug: req.params.slug,
//       active: true,
//     }).populate('parentCategory', 'title slug');

//     if (!category) {
//       return res.status(404).json({ message: 'Category not found' });
//     }

//     // Get subcategories
//     const subcategories = await category.getSubcategories();

//     // Get category path for breadcrumbs
//     const categoryPath = await category.getCategoryPath();

//     res.json({
//       ...category.toObject(),
//       subcategories,
//       categoryPath,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

const getCategoryBySlug = async (req, res) => {
  try {
    const { filters } = req.query;

    const category = await Category.findOne({
      slug: req.params.slug,
      active: true,
    }).populate('parentCategory', 'title slug');

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Get subcategories
    const subcategories = await category.getSubcategories();

    // Get category path for breadcrumbs
    const categoryPath = await category.getCategoryPath();

    // Get available filters for this category
    const availableFilters = await getAvailableFiltersForCategory(category._id);

    // Get featured products from this category (limit to 4)
    const featuredProducts = await getFeaturedProductsFromCategory(
      category._id,
      4
    );

    // Count total products in this category (including subcategories)
    const totalProducts = await countProductsInCategory(category._id);

    res.json({
      ...category.toObject(),
      subcategories,
      categoryPath,
      availableFilters,
      featuredProducts,
      totalProducts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      'parentCategory',
      'title slug'
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const subcategories = await category.getSubcategories();
    const categoryPath = await category.getCategoryPath();

    res.json({
      ...category.toObject(),
      subcategories,
      categoryPath,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSubcategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    const subcategories = await Category.find({
      parentCategory: parentId,
      active: true,
    }).sort({ order: 1, title: 1 });

    res.json(subcategories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFeaturedCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      featured: true,
      active: true,
    })
      .populate('parentCategory', 'title slug')
      .sort({ order: 1, title: 1 });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// const getCategoryHierarchy = async (req, res) => {
//   try {
//     const mainCategories = await Category.find({
//       parentCategory: null,
//       active: true,
//     }).sort({ order: 1, title: 1 });

//     const hierarchy = await Promise.all(
//       mainCategories.map(async (category) => {
//         const subcategories = await category.getSubcategories();
//         return {
//           ...category.toObject(),
//           subcategories,
//         };
//       })
//     );

//     res.json(hierarchy);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

const getCategoryHierarchy = async (req, res) => {
  try {
    const { includeProductCounts = false, activeOnly = true } = req.query;

    const query =
      activeOnly === 'true'
        ? { parentCategory: null, active: true }
        : { parentCategory: null };

    const mainCategories = await Category.find(query).sort({
      order: 1,
      title: 1,
    });

    const hierarchy = await Promise.all(
      mainCategories.map(async (category) => {
        const subcategories = await getSubcategoriesWithProductCounts(
          category,
          includeProductCounts === 'true'
        );

        const categoryData = {
          ...category.toObject(),
          subcategories,
        };

        // Add product count if requested
        if (includeProductCounts === 'true') {
          categoryData.productCount = await countProductsInCategory(
            category._id
          );
        }

        return categoryData;
      })
    );

    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

async function getSubcategoriesWithProductCounts(
  parentCategory,
  includeProductCounts
) {
  const subcategories = await Category.find({
    parentCategory: parentCategory._id,
    active: true,
  }).sort({ order: 1, title: 1 });

  return Promise.all(
    subcategories.map(async (subcategory) => {
      const nestedSubcategories = await getSubcategoriesWithProductCounts(
        subcategory,
        includeProductCounts
      );

      const subcategoryData = {
        ...subcategory.toObject(),
        subcategories: nestedSubcategories,
      };

      if (includeProductCounts) {
        subcategoryData.productCount = await countProductsInCategory(
          subcategory._id
        );
      }

      return subcategoryData;
    })
  );
}

const createCategory = async (req, res) => {
  try {
    const {
      title,
      description,
      image,
      parentCategory,
      level,
      categoryType,
      applicableProductTypes,
      featured,
      order,
      active,
      seoTitle,
      seoDescription,
      seoKeywords,
      availableFilters,
    } = req.body;

    let imageUrl;
    if (image) {
      const uploadResult = await cloudinary.uploader.upload(image, {
        folder: 'categories',
        resource_type: 'image',
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
      });
      imageUrl = uploadResult.url;
    }

    // Calculate level based on parent
    let calculatedLevel = 0;
    if (parentCategory) {
      const parent = await Category.findById(parentCategory);
      if (parent) {
        calculatedLevel = parent.level + 1;
      }
    }

    const category = new Category({
      title,
      description,
      image: imageUrl,
      parentCategory: parentCategory || null,
      level: level !== undefined ? level : calculatedLevel,
      categoryType,
      applicableProductTypes,
      featured: featured || false,
      order: order || 0,
      active: active !== undefined ? active : true,
      seoTitle,
      seoDescription,
      seoKeywords,
      availableFilters,
    });

    const newCategory = await category.save();
    await newCategory.populate('parentCategory', 'title slug');

    res.status(201).json(newCategory);
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Handle image update
    if (req.body.image && req.body.image !== category.image) {
      const uploadResult = await cloudinary.uploader.upload(req.body.image, {
        folder: 'categories',
        resource_type: 'image',
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
      });
      req.body.image = uploadResult.url;
    }

    // Handle parent category change and level recalculation
    if (req.body.parentCategory !== undefined) {
      if (req.body.parentCategory) {
        const parent = await Category.findById(req.body.parentCategory);
        if (parent) {
          req.body.level = parent.level + 1;
        }
      } else {
        req.body.level = 0;
      }
    }

    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined) {
        category[key] = req.body[key];
      }
    });

    const updatedCategory = await category.save();
    await updatedCategory.populate('parentCategory', 'title slug');

    res.json(updatedCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    console.log('Deleting category with ID:', req.params.id);

    // Check if category has subcategories
    const hasSubcategories = await Category.findOne({
      parentCategory: req.params.id,
    });

    if (hasSubcategories) {
      return res.status(400).json({
        message: 'Cannot delete category with subcategories',
      });
    }

    const deletedCategory = await Category.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({
      message: 'Category deleted successfully',
      deletedCategory: {
        title: deletedCategory.title,
        id: deletedCategory._id,
      },
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: error.message });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    category.active = !category.active;
    await category.save();

    res.json({
      message: `Category ${
        category.active ? 'activated' : 'deactivated'
      } successfully`,
      category,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleFeaturedStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    category.featured = !category.featured;
    await category.save();

    res.json({
      message: `Category ${
        category.featured ? 'featured' : 'unfeatured'
      } successfully`,
      category,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const reorderCategories = async (req, res) => {
  try {
    const { categories } = req.body; // Array of { id, order }

    const updatePromises = categories.map(({ id, order }) =>
      Category.findByIdAndUpdate(id, { order }, { new: true })
    );

    await Promise.all(updatePromises);

    res.json({ message: 'Categories reordered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCategoriesByType = async (req, res) => {
  try {
    const { categoryType } = req.params;
    const categories = await Category.find({
      categoryType,
      active: true,
    })
      .populate('parentCategory', 'title slug')
      .sort({ order: 1, title: 1 });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const searchCategories = async (req, res) => {
  try {
    const { q, categoryType, level, featured } = req.query;

    let query = { active: true };

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { seoKeywords: { $in: [new RegExp(q, 'i')] } },
      ];
    }

    if (categoryType) {
      query.categoryType = categoryType;
    }

    if (level !== undefined) {
      query.level = parseInt(level);
    }

    if (featured !== undefined) {
      query.featured = featured === 'true';
    }

    const categories = await Category.find(query)
      .populate('parentCategory', 'title slug')
      .sort({ order: 1, title: 1 })
      .limit(20);

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

async function getAvailableFiltersForCategory(categoryId) {
  try {
    // Find the category to get its availableFilters setting
    const category = await Category.findById(categoryId);
    if (!category) {
      return {};
    }

    // Get all subcategory IDs
    const subcategories = await category.getAllSubcategories();
    const categoryIds = [categoryId, ...subcategories.map((c) => c._id)];

    // Get all products in these categories
    const Product = mongoose.model('product');
    const products = await Product.find({
      category: { $in: categoryIds },
      isActive: true,
    });

    // Initialize filters object
    const filters = {};

    // Only include filters that are allowed for this category
    const allowedFilters = category.availableFilters || [];

    // Process colors if allowed
    if (allowedFilters.includes('color')) {
      const colors = new Set();

      // Collect colors from main products
      products.forEach((product) => {
        if (product.color && product.color.length) {
          product.color.forEach((c) => colors.add(c));
        }
      });

      // Collect colors from variants
      products.forEach((product) => {
        if (product.variants && product.variants.length) {
          product.variants.forEach((variant) => {
            if (variant.isActive && variant.color) {
              colors.add(variant.color);
            }
          });
        }
      });

      if (colors.size > 0) {
        filters.colors = Array.from(colors);
      }
    }

    // Process sizes if allowed
    if (allowedFilters.includes('size')) {
      const sizes = new Set();

      // Collect sizes from main products
      products.forEach((product) => {
        if (product.size) {
          sizes.add(product.size);
        }
      });

      // Collect sizes from variants
      products.forEach((product) => {
        if (product.variants && product.variants.length) {
          product.variants.forEach((variant) => {
            if (variant.isActive && variant.size) {
              sizes.add(variant.size);
            }
          });
        }
      });

      if (sizes.size > 0) {
        filters.sizes = Array.from(sizes);
      }
    }

    // Process materials if allowed
    if (allowedFilters.includes('material')) {
      const materials = new Set();

      // Collect materials from main products
      products.forEach((product) => {
        if (product.material && product.material.length) {
          product.material.forEach((m) => materials.add(m));
        }
      });

      // Collect materials from variants
      products.forEach((product) => {
        if (product.variants && product.variants.length) {
          product.variants.forEach((variant) => {
            if (variant.isActive && variant.material) {
              materials.add(variant.material);
            }
          });
        }
      });

      if (materials.size > 0) {
        filters.materials = Array.from(materials);
      }
    }

    // Process finishes if allowed
    if (allowedFilters.includes('finish')) {
      const finishes = new Set();

      // Collect finishes from main products
      products.forEach((product) => {
        if (product.finish) {
          finishes.add(product.finish);
        }
      });

      // Collect finishes from variants
      products.forEach((product) => {
        if (product.variants && product.variants.length) {
          product.variants.forEach((variant) => {
            if (variant.isActive && variant.finish) {
              finishes.add(variant.finish);
            }
          });
        }
      });

      if (finishes.size > 0) {
        filters.finishes = Array.from(finishes);
      }
    }

    // Process brands if allowed
    if (allowedFilters.includes('brand')) {
      const brands = new Set();

      products.forEach((product) => {
        if (product.brand) {
          brands.add(product.brand);
        }
      });

      if (brands.size > 0) {
        filters.brands = Array.from(brands);
      }
    }

    // Process features if allowed
    if (allowedFilters.includes('features')) {
      const features = new Set();

      products.forEach((product) => {
        if (product.features && product.features.length) {
          product.features.forEach((f) => features.add(f));
        }
      });

      if (features.size > 0) {
        filters.features = Array.from(features);
      }
    }

    // Process price ranges if allowed
    if (allowedFilters.includes('price')) {
      // Find min and max prices
      let minPrice = Number.MAX_VALUE;
      let maxPrice = 0;

      products.forEach((product) => {
        // Check main product price
        const mainPrice =
          product.price - (product.price * (product.discount || 0)) / 100;

        if (mainPrice < minPrice) minPrice = mainPrice;
        if (mainPrice > maxPrice) maxPrice = mainPrice;

        // Check variant prices
        if (product.variants && product.variants.length) {
          product.variants.forEach((variant) => {
            if (variant.isActive) {
              const variantPrice =
                variant.price - (variant.price * (variant.discount || 0)) / 100;

              if (variantPrice < minPrice) minPrice = variantPrice;
              if (variantPrice > maxPrice) maxPrice = variantPrice;
            }
          });
        }
      });

      if (minPrice !== Number.MAX_VALUE && maxPrice > 0) {
        filters.priceRange = {
          min: Math.floor(minPrice),
          max: Math.ceil(maxPrice),
        };
      }
    }

    return filters;
  } catch (error) {
    console.error('Error getting category filters:', error);
    return {};
  }
}

async function getFeaturedProductsFromCategory(categoryId, limit = 4) {
  try {
    const Product = mongoose.model('product');

    // Get category and subcategories
    const category = await Category.findById(categoryId);
    if (!category) return [];

    const subcategories = await category.getAllSubcategories();
    const categoryIds = [categoryId, ...subcategories.map((c) => c._id)];

    // Find featured products
    const products = await Product.find({
      category: { $in: categoryIds },
      isActive: true,
      $or: [{ featured: true }, { bestseller: true }],
    })
      .sort({ featured: -1, rating: -1 })
      .limit(limit)
      .select(
        'title price discount images variants category productType featured bestseller rating'
      )
      .lean();

    // Process products to include variant info
    const processedProducts = products.map((product) => {
      // Check if product has active variants
      const hasVariants = product.variants && product.variants.length > 0;
      const activeVariants = hasVariants
        ? product.variants.filter((v) => v.isActive)
        : [];

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
        finalPrice,
        priceRange:
          hasVariants && minPrice !== maxPrice
            ? { min: minPrice, max: maxPrice }
            : null,
      };
    });

    return processedProducts;
  } catch (error) {
    console.error('Error getting featured products:', error);
    return [];
  }
}
async function countProductsInCategory(categoryId) {
  try {
    const Product = mongoose.model('product');

    // Get category and subcategories
    const category = await Category.findById(categoryId);
    if (!category) return 0;

    const subcategories = await category.getAllSubcategories();
    const categoryIds = [categoryId, ...subcategories.map((c) => c._id)];

    // Count active products
    return await Product.countDocuments({
      category: { $in: categoryIds },
      isActive: true,
    });
  } catch (error) {
    console.error('Error counting products:', error);
    return 0;
  }
}
const getCategoryStatistics = async (req, res) => {
  try {
    const { isAdmin } = req.user;

    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: 'Not authorized to access this resource' });
    }

    const Product = mongoose.model('product');

    // Get all categories
    const categories = await Category.find().sort({ title: 1 });

    // Calculate statistics for each category
    const statistics = await Promise.all(
      categories.map(async (category) => {
        // Get products in this category
        const products = await Product.find({ category: category._id });

        // Count active products
        const activeProductCount = products.filter((p) => p.isActive).length;

        // Count products with variants
        const productsWithVariants = products.filter(
          (p) => p.variants && p.variants.length > 0
        ).length;

        // Count total variants
        const totalVariants = products.reduce((total, product) => {
          return total + (product.variants ? product.variants.length : 0);
        }, 0);

        // Count out of stock products
        const outOfStockProducts = products.filter((p) => {
          if (!p.isActive) return false;

          if (p.variants && p.variants.length > 0) {
            // Check if all variants are out of stock
            return !p.variants.some((v) => v.isActive && v.stock > 0);
          }

          return p.stock <= 0;
        }).length;

        // Calculate average price
        let totalPrice = 0;
        let priceCount = 0;

        products.forEach((product) => {
          if (product.isActive) {
            totalPrice += product.price;
            priceCount++;

            if (product.variants) {
              product.variants.forEach((variant) => {
                if (variant.isActive) {
                  totalPrice += variant.price;
                  priceCount++;
                }
              });
            }
          }
        });

        const avgPrice = priceCount > 0 ? totalPrice / priceCount : 0;

        return {
          _id: category._id,
          title: category.title,
          slug: category.slug,
          level: category.level,
          productCount: products.length,
          activeProductCount,
          productsWithVariants,
          totalVariants,
          outOfStockProducts,
          avgPrice,
        };
      })
    );

    res.json(statistics);
  } catch (error) {
    console.error('Get category statistics error:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateCategoryFilters = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { availableFilters } = req.body;

    if (!req.user.isAdmin) {
      return res
        .status(403)
        .json({ message: 'Only administrators can update category filters' });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Validate filters
    const validFilters = [
      'color',
      'size',
      'material',
      'finish',
      'brand',
      'price',
      'features',
      'compatibility',
      'weight',
      'portability',
    ];

    const filteredFilters = availableFilters.filter((filter) =>
      validFilters.includes(filter)
    );

    category.availableFilters = filteredFilters;
    await category.save();

    res.json({
      message: 'Category filters updated successfully',
      category,
    });
  } catch (error) {
    console.error('Update category filters error:', error);
    res.status(500).json({ message: error.message });
  }
};
const generateCategoryReport = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { timeframe = '30days' } = req.query;

    if (!req.user.isAdmin) {
      return res
        .status(403)
        .json({ message: 'Only administrators can generate reports' });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Get subcategories
    const subcategories = await category.getAllSubcategories();
    const categoryIds = [categoryId, ...subcategories.map((c) => c._id)];

    // Get time range
    const endDate = new Date();
    let startDate;

    switch (timeframe) {
      case '7days':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30days':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90days':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1year':
        startDate = new Date(endDate);
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get products
    const Product = mongoose.model('product');
    const products = await Product.find({
      category: { $in: categoryIds },
      isActive: true,
    }).select('title price discount variants rating reviews date');

    // Get orders with products from this category
    const Order = mongoose.model('order');
    const orders = await Order.find({
      'items.productId': { $in: products.map((p) => p._id) },
      date: { $gte: startDate.getTime(), $lte: endDate.getTime() },
      status: { $nin: ['cancelled', 'payment_failed'] },
    });

    // Calculate sales metrics
    let totalSales = 0;
    let totalItemsSold = 0;
    let productSales = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        // Check if this item belongs to our category
        const product = products.find(
          (p) => p._id.toString() === item.productId
        );
        if (product) {
          const salesAmount = item.finalPrice * item.quantity;
          totalSales += salesAmount;
          totalItemsSold += item.quantity;

          // Track sales by product
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              productId: item.productId,
              title: item.title,
              quantity: 0,
              sales: 0,
            };
          }

          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].sales += salesAmount;
        }
      });
    });

    // Convert product sales to array and sort by sales amount
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // Calculate variant metrics
    const variantMetrics = {
      totalVariants: 0,
      activeVariants: 0,
      outOfStockVariants: 0,
      topSellingVariants: [],
    };

    products.forEach((product) => {
      if (product.variants && product.variants.length > 0) {
        variantMetrics.totalVariants += product.variants.length;
        variantMetrics.activeVariants += product.variants.filter(
          (v) => v.isActive
        ).length;
        variantMetrics.outOfStockVariants += product.variants.filter(
          (v) => v.isActive && v.stock <= 0
        ).length;
      }
    });

    res.json({
      category: {
        _id: category._id,
        title: category.title,
        subcategoryCount: subcategories.length,
      },
      timeframe,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      sales: {
        totalSales,
        totalItemsSold,
        topProducts,
      },
      products: {
        totalProducts: products.length,
        newProducts: products.filter((p) => new Date(p.date) >= startDate)
          .length,
        outOfStockProducts: products.filter((p) => {
          if (p.variants && p.variants.length > 0) {
            return !p.variants.some((v) => v.isActive && v.stock > 0);
          }
          return p.stock <= 0;
        }).length,
      },
      variants: variantMetrics,
    });
  } catch (error) {
    console.error('Generate category report error:', error);
    res.status(500).json({ message: error.message });
  }
};
export {
  getCategories,
  getCategoryBySlug,
  getCategoryById,
  getSubcategories,
  getFeaturedCategories,
  getCategoryHierarchy,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  toggleFeaturedStatus,
  reorderCategories,
  getCategoriesByType,
  searchCategories,
  getCategoryStatistics,
  updateCategoryFilters,
  generateCategoryReport,
};
