// services/scheduledTasks.js
import cron from 'node-cron';
import {
  sendDailyAdminSummary,
  checkInventoryAlerts,
} from '../utils/adminEmailServices.js';
// import { checkInventoryAlerts, sendDailyAdminSummary } from './adminEmailService.js';

export const startScheduledTasks = () => {
  // Check inventory alerts every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running inventory alerts check...');
    await checkInventoryAlerts();
  });

  // Send daily summary at 11 PM
  cron.schedule('0 23 * * *', async () => {
    console.log('Sending daily admin summary...');
    await sendDailyAdminSummary();
  });

  console.log('Scheduled tasks started');
};
