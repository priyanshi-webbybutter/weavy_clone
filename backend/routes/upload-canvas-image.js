const express = require('express');
const supabase = require('../lib/supabase');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Helper function to get authenticated user (same pattern as projects.js)
const getAuthenticatedUser = async (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, supabaseClient: null };
  }

  const token = authHeader.substring(7);

  if (!token || token.length === 0) {
    return { user: null, supabaseClient: null };
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { user: null, supabaseClient: null };
    }

    // Create a Supabase client with the user's access token for RLS
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    return { user, supabaseClient: userSupabase };
  } catch (error) {
    console.error('Error getting user from token:', error);
    return { user: null, supabaseClient: null };
  }
};

// POST /api/upload-canvas-image - Upload image to Supabase Storage
router.post('/upload-canvas-image', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);

    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { imageData, projectId } = req.body;

    // Validate input
    if (!imageData) {
      return res.status(400).json({
        error: 'imageData is required',
      });
    }

    if (!projectId) {
      return res.status(400).json({
        error: 'projectId is required',
      });
    }

    // Parse base64 data - handle various formats like image/png, image/jpeg, image/svg+xml
    const matches = imageData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches) {
      console.error('Invalid base64 format. First 100 chars:', imageData.substring(0, 100));
      return res.status(400).json({
        error: 'Invalid base64 image format',
        message: 'Expected format: data:image/{type};base64,{data}',
      });
    }

    let [, extension, base64Data] = matches;
    // Normalize extension (jpeg -> jpg, svg+xml -> svg)
    if (extension === 'jpeg') extension = 'jpg';
    if (extension === 'svg+xml') extension = 'svg';

    // Normalize MIME type for Supabase (jpg -> jpeg for contentType)
    const mimeType = extension === 'jpg' ? 'jpeg' : extension;

    const buffer = Buffer.from(base64Data, 'base64');

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      return res.status(400).json({
        error: 'Image too large',
        message: 'Maximum file size is 10MB',
      });
    }

    // Generate unique filename: userId/projectId/timestamp-uuid.extension
    const uniqueFileName = `${Date.now()}-${uuidv4()}.${extension}`;
    const filePath = `${user.id}/${projectId}/${uniqueFileName}`;

    console.log(`Uploading canvas image: ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabaseClient.storage
      .from('client-images')
      .upload(filePath, buffer, {
        contentType: `image/${mimeType}`,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({
        error: 'Failed to upload image',
        message: uploadError.message,
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('client-images')
      .getPublicUrl(filePath);

    console.log('Image uploaded successfully:', publicUrl);

    res.json({
      success: true,
      url: publicUrl,
      path: filePath,
    });

  } catch (error) {
    console.error('Error uploading canvas image:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;
