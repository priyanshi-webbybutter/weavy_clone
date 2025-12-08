const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const generateImageRoute = require('./routes/generate-image');
const describeImageRoute = require('./routes/describe-image');
const generateVideoRoute = require('./routes/generate-video');
const authRoute = require('./routes/auth');
const projectsRoute = require('./routes/projects');
const uploadCanvasImageRoute = require('./routes/upload-canvas-image');
const aiChatRoute = require('./routes/ai-chat');
const extractTextRoute = require('./routes/extract-text');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - CORS with full configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'], // Allow both frontend ports
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', generateImageRoute);
app.use('/api', describeImageRoute);
app.use('/api', generateVideoRoute);
app.use('/api', authRoute);
app.use('/api', projectsRoute);
app.use('/api', uploadCanvasImageRoute);
app.use('/api/ai-chat', aiChatRoute);
app.use('/api', extractTextRoute);

// Test route to verify describe-image is registered
app.get('/api/test-describe', (req, res) => {
  res.json({ message: 'Describe image route is registered' });
});

// Test route to verify auth routes are registered
app.get('/api/test-auth', (req, res) => {
  res.json({ message: 'Auth routes are registered' });
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
  console.log(`🎬 Video generation endpoint (Pixverse v4.5): http://localhost:${PORT}/api/generate-video`);
  console.log(`🔐 Auth endpoints:`);
  console.log(`   - Signup: http://localhost:${PORT}/api/auth/signup`);
  console.log(`   - Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`   - Google OAuth: http://localhost:${PORT}/api/auth/google`);
  console.log(`   - Logout: http://localhost:${PORT}/api/auth/logout`);
  console.log(`   - Session: http://localhost:${PORT}/api/auth/session`);
  console.log(`📂 Project endpoints:`);
  console.log(`   - GET /api/projects - List projects`);
  console.log(`   - POST /api/projects - Create project`);
  console.log(`   - PUT /api/projects/:id - Update project`);
  console.log(`   - DELETE /api/projects/:id - Delete project`);
  console.log(`   - GET /api/workflows/:projectId - Get workflow`);
  console.log(`   - POST /api/workflows/:projectId - Save workflow`);
  console.log(`   - POST /api/generations - Save generation history`);
  console.log(`   - GET /api/generations/:workflowId - Get generation history`);
  console.log(`🖼️ Canvas image upload:`);
  console.log(`   - POST /api/upload-canvas-image - Upload image to Supabase Storage`);
  console.log(`🤖 AI Chat (Canvas Agent):`);
  console.log(`   - POST /api/ai-chat - Chat with Canvas AI Design Agent`);
});
