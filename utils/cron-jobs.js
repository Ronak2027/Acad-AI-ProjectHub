const cron = require('node-cron');
const Task = require('../models/Task');

const setupCronJobs = () => {
  // Schedule to run every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Running daily task reminder check...');
    const now = new Date();
    const threeDaysFromNow = new Date(now.setDate(now.getDate() + 3));

    try {
      const approachingTasks = await Task.find({
        dueDate: { $lte: threeDaysFromNow, $gte: new Date() },
        status: { $in: ['pending', 'in-progress'] },
      }).populate('assignedTo', 'email');

      if (approachingTasks.length > 0) {
        console.log(`Found ${approachingTasks.length} tasks with approaching deadlines:`);
        approachingTasks.forEach(task => {
          console.log(`Task: ${task.name}, Due: ${task.dueDate}, Assigned To: ${task.assignedTo ? task.assignedTo.email : 'Unassigned'}`);
          // In a real application, send notifications here (e.g., email, push notification)
        });
      } else {
        console.log('No tasks with approaching deadlines found.');
      }

    } catch (err) {
      console.error('Error running cron job:', err.message);
    }
  });
  console.log('Cron jobs scheduled.');
};

module.exports = setupCronJobs;




