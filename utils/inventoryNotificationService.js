// services/inventoryNotificationService.js
import { sendLowStockAlert, sendOutOfStockAlert } from './emailService.js';

export const checkAndNotifyInventory = async (product) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@dblackrose.com';
  const lowStockThreshold = product.lowStockThreshold || 10;

  try {
    // Check main product stock
    if (product.stock === 0) {
      await sendOutOfStockAlert(product, adminEmail);
    } else if (product.stock <= lowStockThreshold) {
      await sendLowStockAlert(product, adminEmail);
    }

    // Check variant stock if variants exist
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (variant.stock === 0) {
          await sendOutOfStockAlert(
            {
              ...product.toObject(),
              title: `${product.title} (${variant.color || ''} ${
                variant.size || ''
              })`,
            },
            adminEmail
          );
        } else if (variant.stock <= lowStockThreshold) {
          await sendLowStockAlert(
            {
              ...product.toObject(),
              title: `${product.title} (${variant.color || ''} ${
                variant.size || ''
              })`,
            },
            adminEmail
          );
        }
      }
    }
  } catch (error) {
    console.error('Error checking inventory notifications:', error);
  }
};
