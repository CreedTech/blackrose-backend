// services/priceDropService.js
import userModel from '../models/userModel.js';
import { sendPriceDropAlert } from '../utils/emailService.js';

export const checkPriceDrops = async (product, oldPrice, newPrice) => {
  try {
    // Only notify if price actually dropped
    if (newPrice >= oldPrice) return;

    const priceDropPercentage = (
      ((oldPrice - newPrice) / oldPrice) *
      100
    ).toFixed(0);

    // Find users who have this product in their wishlist
    const usersWithWishlist = await userModel
      .find({
        'wishlist.productId': product._id,
      })
      .select('email name wishlist');

    if (usersWithWishlist.length === 0) return;

    const notifications = usersWithWishlist.map(async (user) => {
      try {
        // Check if this specific product/variant is in their wishlist
        const wishlistItem = user.wishlist.find(
          (item) => item.productId.toString() === product._id.toString()
        );

        if (!wishlistItem) return;

        await sendPriceDropAlert(product, user.email, user.name, {
          oldPrice,
          newPrice,
          savings: oldPrice - newPrice,
          percentageOff: priceDropPercentage,
          wishlistItem,
        });

        return { success: true, email: user.email };
      } catch (error) {
        console.error(
          `Error sending price drop alert to ${user.email}:`,
          error
        );
        return { success: false, email: user.email };
      }
    });

    const results = await Promise.allSettled(notifications);
    const successful = results.filter(
      (result) => result.status === 'fulfilled' && result.value?.success
    ).length;

    console.log(
      `Price drop alerts sent: ${successful}/${usersWithWishlist.length}`
    );
  } catch (error) {
    console.error('Error checking price drops:', error);
  }
};
