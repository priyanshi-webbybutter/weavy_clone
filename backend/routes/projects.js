const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// Helper function to get authenticated user from token and create a user-scoped Supabase client
const getAuthenticatedUser = async (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('⚠️ No authorization header or invalid format');
    return { user: null, supabaseClient: null };
  }

  const token = authHeader.substring(7);
  
  if (!token || token.length === 0) {
    console.log('⚠️ Empty token after Bearer prefix');
    return { user: null, supabaseClient: null };
  }
  
  try {
    console.log('🔐 Attempting to authenticate user with token (length:', token.length, ')');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('❌ Supabase auth error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return { user: null, supabaseClient: null };
    }
    
    if (!user) {
      console.log('⚠️ No user returned from Supabase');
      return { user: null, supabaseClient: null };
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Create a Supabase client with the user's access token for RLS
    const { createClient } = require('@supabase/supabase-js');
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
    console.error('❌ Exception getting user from token:', error);
    console.error('❌ Error stack:', error.stack);
    return { user: null, supabaseClient: null };
  }
};

// GET /api/projects - Fetch all projects for authenticated user
router.get('/projects', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    console.log('📂 Fetching projects for user:', user.id);

    const { data, error } = await supabaseClient
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching projects:', error);
      return res.status(500).json({
        error: 'Failed to fetch projects',
        message: error.message,
      });
    }

    console.log(`✅ Found ${data.length} projects for user`);

    res.json({
      success: true,
      projects: data || [],
    });
  } catch (error) {
    console.error('❌ Error in GET /api/projects:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// POST /api/projects - Create new project
router.post('/projects', async (req, res) => {
  try {
    console.log('📝 POST /api/projects - Request received');
    console.log('📦 Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      console.error('❌ No authenticated user found');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    console.log('✅ Authenticated user:', user.id);

    const { name, description, type } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Project name is required',
      });
    }

    // Validate type if provided
    const projectType = type === 'canvas' ? 'canvas' : 'workflow';

    console.log('📝 Creating project for user:', user.id, 'Name:', name, 'Type:', projectType);

    const { data, error } = await supabaseClient
      .from('projects')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        type: projectType,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error creating project:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return res.status(500).json({
        error: 'Failed to create project',
        message: error.message,
        details: error,
      });
    }

    console.log('✅ Project created:', data.id);

    res.json({
      success: true,
      project: data,
    });
  } catch (error) {
    console.error('❌ Error in POST /api/projects:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// GET /api/projects/:id - Fetch a single project by ID
router.get('/projects/:id', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { id } = req.params;

    console.log('📂 Fetching project:', id, 'for user:', user.id);

    const { data, error } = await supabaseClient
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching project:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Project not found or access denied',
        });
      }
      return res.status(500).json({
        error: 'Failed to fetch project',
        message: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        error: 'Project not found or access denied',
      });
    }

    console.log('✅ Project fetched:', data.id);

    res.json({
      success: true,
      project: data,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/projects/:id:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// PUT /api/projects/:id - Update project (full update)
router.put('/projects/:id', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    // Validate at least one field to update
    if (!name && description === undefined) {
      return res.status(400).json({
        error: 'At least one field (name or description) must be provided',
      });
    }

    if (name && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({
        error: 'Project name must be a non-empty string',
      });
    }

    console.log('✏️ Updating project:', id, 'for user:', user.id);

    const updateData = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    const { data, error } = await supabaseClient
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating project:', error);
      return res.status(500).json({
        error: 'Failed to update project',
        message: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        error: 'Project not found or access denied',
      });
    }

    console.log('✅ Project updated:', data.id);

    res.json({
      success: true,
      project: data,
    });
  } catch (error) {
    console.error('❌ Error in PUT /api/projects/:id:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// PATCH /api/projects/:id - Partially update project
router.patch('/projects/:id', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { id } = req.params;
    const { name, description, preview_images } = req.body;

    // Validate at least one field to update
    if (name === undefined && description === undefined && preview_images === undefined) {
      return res.status(400).json({
        error: 'At least one field (name, description, or preview_images) must be provided',
      });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({
        error: 'Project name must be a non-empty string',
      });
    }

    if (preview_images !== undefined && !Array.isArray(preview_images)) {
      return res.status(400).json({
        error: 'preview_images must be an array',
      });
    }

    console.log('✏️ Partially updating project:', id, 'for user:', user.id);

    const updateData = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    if (preview_images !== undefined) {
      updateData.preview_images = preview_images;
    }

    const { data, error } = await supabaseClient
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating project:', error);
      return res.status(500).json({
        error: 'Failed to update project',
        message: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        error: 'Project not found or access denied',
      });
    }

    console.log('✅ Project updated:', data.id);

    res.json({
      success: true,
      project: data,
    });
  } catch (error) {
    console.error('❌ Error in PATCH /api/projects/:id:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { id } = req.params;

    console.log('🗑️ Deleting project:', id, 'for user:', user.id);

    const { data, error } = await supabaseClient
      .from('projects')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error deleting project:', error);
      return res.status(500).json({
        error: 'Failed to delete project',
        message: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        error: 'Project not found or access denied',
      });
    }

    console.log('✅ Project deleted:', id);

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error in DELETE /api/projects/:id:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// GET /api/workflows/:projectId - Fetch workflow for a project
router.get('/workflows/:projectId', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { projectId } = req.params;

    console.log('📋 Fetching workflow for project:', projectId, 'user:', user.id);

    // First verify the project belongs to the user (RLS will handle this)
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({
        error: 'Project not found or access denied',
      });
    }

    // Fetch workflow (RLS will ensure user can only access their own workflows)
    const { data, error } = await supabaseClient
      .from('workflows')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error fetching workflow:', error);
      return res.status(500).json({
        error: 'Failed to fetch workflow',
        message: error.message,
      });
    }

    if (!data) {
      // No workflow exists yet, return empty workflow
      console.log('📋 No workflow found, returning empty workflow');
      return res.json({
        success: true,
        workflow: {
          nodes: [],
          edges: [],
          node_settings: {},
          canvas_state: null,
        },
      });
    }

    console.log('✅ Workflow fetched successfully');
    console.log('📦 Workflow data:', {
      id: data.id,
      nodesCount: Array.isArray(data.nodes) ? data.nodes.length : 0,
      edgesCount: Array.isArray(data.edges) ? data.edges.length : 0,
      hasSettings: !!data.node_settings,
      hasCanvasState: !!data.canvas_state,
      nodesPreview: Array.isArray(data.nodes) ? data.nodes.slice(0, 2).map(n => ({
        id: n?.id,
        type: n?.type,
        position: n?.position,
      })) : null,
    });

    res.json({
      success: true,
      workflow: {
        id: data.id, // Include workflow ID for generation history
        nodes: data.nodes || [],
        edges: data.edges || [],
        node_settings: data.node_settings || {},
        canvas_state: data.canvas_state || null,
      },
    });
  } catch (error) {
    console.error('❌ Error in GET /api/workflows/:projectId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// POST /api/workflows/:projectId - Save/update workflow
router.post('/workflows/:projectId', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { projectId } = req.params;
    const { nodes, edges, node_settings, canvas_state } = req.body;

    console.log('📥 Received workflow save request:', {
      hasNodes: nodes !== undefined,
      hasEdges: edges !== undefined,
      hasNodeSettings: node_settings !== undefined,
      hasCanvasState: canvas_state !== undefined,
    });

    // Validate input - nodes and edges can be optional if only saving canvas_state
    if (nodes !== undefined && !Array.isArray(nodes)) {
      return res.status(400).json({
        error: 'nodes must be an array',
      });
    }

    if (edges !== undefined && !Array.isArray(edges)) {
      return res.status(400).json({
        error: 'edges must be an array',
      });
    }

    // Ensure at least one field is provided
    if (nodes === undefined && edges === undefined && node_settings === undefined && canvas_state === undefined) {
      return res.status(400).json({
        error: 'At least one field (nodes, edges, node_settings, or canvas_state) must be provided',
      });
    }

    console.log('💾 Saving workflow for project:', projectId, 'user:', user.id);
    if (nodes) {
      console.log(`   Nodes: ${nodes.length}, Edges: ${edges?.length || 0}`);

      // Log image/video counts for debugging
      const imageNodes = nodes.filter(n => n.data?.imageUrls?.length || n.data?.imageUrl);
      const videoNodes = nodes.filter(n => n.data?.videoUrls?.length || n.data?.videoUrl);
      console.log(`   Image nodes: ${imageNodes.length}, Video nodes: ${videoNodes.length}`);
    }
    if (canvas_state) {
      console.log(`   Canvas state: present`);
    }

    // Check payload size
    const payloadSize = JSON.stringify({ nodes, edges, node_settings, canvas_state }).length;
    console.log(`   Payload size: ${(payloadSize / 1024).toFixed(2)} KB`);

    // First verify the project belongs to the user (RLS will handle this)
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({
        error: 'Project not found or access denied',
      });
    }

    // Check if workflow exists
    const { data: existingWorkflow } = await supabaseClient
      .from('workflows')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (existingWorkflow) {
      // Update existing workflow - only update fields that are provided
      const updateData = {};
      if (nodes !== undefined) updateData.nodes = nodes;
      if (edges !== undefined) updateData.edges = edges;
      if (node_settings !== undefined) updateData.node_settings = node_settings;
      if (canvas_state !== undefined) updateData.canvas_state = canvas_state;

      const { data, error } = await supabaseClient
        .from('workflows')
        .update(updateData)
        .eq('id', existingWorkflow.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating workflow:', error);
        return res.status(500).json({
          error: 'Failed to update workflow',
          message: error.message,
        });
      }

      console.log('✅ Workflow updated:', data.id);
    } else {
      // Create new workflow
      const { data, error } = await supabaseClient
        .from('workflows')
        .insert({
          project_id: projectId,
          user_id: user.id,
          nodes: nodes || [],
          edges: edges || [],
          node_settings: node_settings || {},
          canvas_state: canvas_state || null,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating workflow:', error);
        return res.status(500).json({
          error: 'Failed to create workflow',
          message: error.message,
        });
      }

      console.log('✅ Workflow created:', data.id);
    }

    res.json({
      success: true,
      message: 'Workflow saved successfully',
    });
  } catch (error) {
    console.error('❌ Error in POST /api/workflows/:projectId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// POST /api/generations - Save generation history entry
router.post('/generations', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { workflow_id, node_id, node_type, generation_type, data } = req.body;

    // Validate input
    if (!workflow_id || !node_id || !node_type || !generation_type || !data) {
      return res.status(400).json({
        error: 'All fields are required: workflow_id, node_id, node_type, generation_type, data',
      });
    }

    console.log('📝 Saving generation history:', {
      workflow_id,
      node_id,
      node_type,
      generation_type,
    });

    // Verify workflow belongs to user (RLS will handle this)
    const { data: workflow, error: workflowError } = await supabaseClient
      .from('workflows')
      .select('id')
      .eq('id', workflow_id)
      .single();

    if (workflowError || !workflow) {
      return res.status(404).json({
        error: 'Workflow not found or access denied',
      });
    }

    const { data: generationData, error } = await supabaseClient
      .from('generation_history')
      .insert({
        workflow_id: workflow_id,
        node_id: node_id,
        node_type: node_type,
        generation_type: generation_type,
        data: data,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving generation history:', error);
      return res.status(500).json({
        error: 'Failed to save generation history',
        message: error.message,
      });
    }

    console.log('✅ Generation history saved:', generationData.id);

    res.json({
      success: true,
      generation: generationData,
    });
  } catch (error) {
    console.error('❌ Error in POST /api/generations:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// GET /api/generations/:workflowId - Fetch generation history for a workflow
router.get('/generations/:workflowId', async (req, res) => {
  try {
    const { user, supabaseClient } = await getAuthenticatedUser(req);
    
    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { workflowId } = req.params;

    console.log('📜 Fetching generation history for workflow:', workflowId);

    // Verify workflow belongs to user (RLS will handle this)
    const { data: workflow, error: workflowError } = await supabaseClient
      .from('workflows')
      .select('id')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      return res.status(404).json({
        error: 'Workflow not found or access denied',
      });
    }

    const { data, error } = await supabaseClient
      .from('generation_history')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching generation history:', error);
      return res.status(500).json({
        error: 'Failed to fetch generation history',
        message: error.message,
      });
    }

    console.log(`✅ Found ${data.length} generation history entries`);

    res.json({
      success: true,
      generations: data || [],
    });
  } catch (error) {
    console.error('❌ Error in GET /api/generations/:workflowId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;

