const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const generateImageRoute = require('./routes/generate-image');
const describeImageRoute = require('./routes/describe-image');
const generateVideoRoute = require('./routes/generate-video');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - CORS with full configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'], // Allow both frontend ports
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', generateImageRoute);
app.use('/api', describeImageRoute);
app.use('/api', generateVideoRoute);

// Test route to verify describe-image is registered
app.get('/api/test-describe', (req, res) => {
  res.json({ message: 'Describe image route is registered' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Weavy Backend Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`🎨 Image generation endpoint: http://localhost:${PORT}/api/generate-image`);
  console.log(`🖼️ Image description endpoint: http://localhost:${PORT}/api/describe-image`);
  console.log(`🎬 Video generation endpoint: http://localhost:${PORT}/api/generate-video`);
});
