import BackInStockRequest from "../models/backInStockReequest.js";
import userModel from "../models/userModel.js";
import { sendProductBackInStockAlert } from "../utils/emailService.js";



export const addBackInStockRequest = async (email, productId, variantId = null, userId = null) => {
  try {
    // Check if request already exists
    const existingRequest = await BackInStockRequest.findOne({
      email,
      productId,
      variantId,
      notified: false
    });

    if (existingRequest) {
      return { success: false, message: 'You are already subscribed to notifications for this item' };
    }

    const request = new BackInStockRequest({
      userId,
      email,
      productId,
      variantId
    });

    await request.save();
    
    return { success: true, message: 'You will be notified when this item is back in stock' };
  } catch (error) {
    console.error('Error adding back-in-stock request:', error);
    return { success: false, message: 'Failed to add notification request' };
  }
};

export const notifyBackInStock = async (product, variantId = null) => {
  try {
    const query = {
      productId: product._id,
      notified: false
    };

    if (variantId) {
      query.variantId = variantId;
    }

    const requests = await BackInStockRequest.find(query);
    
    if (requests.length === 0) {
      console.log('No back-in-stock requests found');
      return;
    }

    let variantInfo = null;
    if (variantId) {
      const variant = product.variants.id(variantId);
      if (variant) {
        variantInfo = {
          color: variant.color,
          size: variant.size,
          material: variant.material,
          finish: variant.finish
        };
      }
    }

    // Send notifications to all subscribers
    const notifications = requests.map(async (request) => {
      try {
        // Get customer name if available
        let customerName = 'Valued Customer';
        if (request.userId) {
          const user = await userModel.findById(request.userId);
          if (user) customerName = user.name;
        }

        await sendProductBackInStockAlert(product, request.email, customerName, variantInfo);
        
        // Mark as notified
        request.notified = true;
        request.notifiedAt = new Date();
        await request.save();
        
        return { success: true, email: request.email };
      } catch (error) {
        console.error(`Error sending notification to ${request.email}:`, error);
        return { success: false, email: request.email, error: error.message };
      }
    });

    const results = await Promise.allSettled(notifications);
    const successful = results.filter(result => result.status === 'fulfilled' && result.value.success).length;
    
    console.log(`Back-in-stock notifications sent: ${successful}/${requests.length}`);
    
  } catch (error) {
    console.error('Error in notifyBackInStock:', error);
  }
};

export { BackInStockRequest };