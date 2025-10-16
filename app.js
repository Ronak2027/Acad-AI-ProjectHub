require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const fileUpload = require('express-fileupload');
const setupCronJobs = require('./utils/cron-jobs');
const path = require('path'); // Import path module
const errorHandler = require('./middleware/error');

const app = express();

// Connect Database
connectDB();

// Setup Cron Jobs
setupCronJobs();

// Telegram bot removed

// Middleware
app.use(express.json());

// File Upload Middleware
app.use(fileUpload());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/files', require('./routes/files'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/chat', require('./routes/chat')); // New chat routes
app.use('/api/reminders', require('./routes/reminders'));

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Basic Route
app.get('/', (req, res) => {
  res.send('Acad AI ProjectHub API is running!');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
