import PhotographyCategory from '../models/photographyCategoryModel.js';
import { v2 as cloudinary } from 'cloudinary';

const getCategories = async (req, res) => {
  try {
    const categories = await PhotographyCategory.find({ active: true }).sort({
      order: 1,
      title: 1,
    });
    res.json(categories);
  } catch (error) {
      console.error(error);
    res.status(500).json({ message: error.message });
  }
};

const getCategoryBySlug = async (req, res) => {
  try {
    const category = await PhotographyCategory.findOne({
      slug: req.params.slug,
      active: true,
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    let imageUrl = await cloudinary.uploader.upload(req.body.image, {
      folder: 'categories',
      resource_type: 'image',
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    });
    const category = new PhotographyCategory({
      title: req.body.title,
      description: req.body.description,
      image: imageUrl.url,
      order: req.body.order,
    });

    const newCategory = await PhotographyCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const category = await PhotographyCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined) {
        category[key] = req.body[key];
      }
    });

    const updatedCategory = await PhotographyCategory.save();
    res.json(updatedCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete category (soft delete)
const deleteCategory = async (req, res) => {
  try {
    console.log('Deleting category with ID:', req.params.id);

    // Use findByIdAndDelete to directly remove the document
    const deletedCategory = await PhotographyCategory.findByIdAndDelete(
      req.params.id
    );

    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({
      message: 'Category deleted successfully',
      deletedCategory,
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: error.message });
  }
};

export {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
};
