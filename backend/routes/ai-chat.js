const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

// Configure multer for temporary file storage
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024,    // 10MB for uploaded files
    fieldSize: 50 * 1024 * 1024     // 50MB for field values (base64 images can be large)
  }
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Supabase for image storage
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

/**
 * Get authenticated user for chat persistence
 * Returns user and user-scoped Supabase client for RLS enforcement
 */
const getAuthenticatedUserForChat = async (req) => {
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
    console.error('Exception getting user from token:', error);
    return { user: null, supabaseClient: null };
  }
};

/**
 * Save a chat message to the database
 * @param {Object} supabaseClient - User-scoped Supabase client
 * @param {string} projectId - Project UUID
 * @param {string} userId - User UUID
 * @param {Object} message - Message object { role, content, phase?, images?, actions? }
 * @returns {Promise<Object>} - { success: boolean, data?: object, error?: string }
 */
async function saveChatMessage(supabaseClient, projectId, userId, message) {
  try {
    const { data, error } = await supabaseClient
      .from('chat_messages')
      .insert({
        project_id: projectId,
        user_id: userId,
        role: message.role,
        content: message.content,
        phase: message.phase || null,
        images: message.images || [],
        actions: message.actions || [],
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving chat message:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Chat message saved:', data.id);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Exception saving chat message:', error);
    return { success: false, error: error.message };
  }
}

// System prompt for Canvas agent with visual understanding and IMAGE COMPOSITING
const SYSTEM_PROMPT = `You are 'Canvas', an AI Design Assistant with VISUAL UNDERSTANDING and IMAGE COMPOSITING capabilities.

## ⚡ STRUCTURED PROMPTING FOR IMAGE GENERATION ⚡

When generating images, I will provide a STRUCTURED GENERATION GUIDE with sections:
- COMPOSITION: How to frame and compose the image
- SUBJECT & STYLE: What to create and the aesthetic
- LIGHTING & TECHNICAL: Professional quality standards
- OUTPUT REQUIREMENTS: Aspect ratio and specifications

**FOLLOW THIS GUIDE PRECISELY** - Each section is important for professional results.
If a structured guide is provided, integrate its instructions into your generation prompt.

## CRITICAL: ANALYZE IMAGES FIRST

When the user selects images, you can SEE what's in them. ALWAYS describe what you see:
- "I can see a black wide-brim hat..."
- "I can see a woman's portrait/headshot..."
- "I can see a product photo of..."

## IMAGE COMPOSITING (LIKE LOVART)

When user asks to combine selected images (e.g., "have the character wear the product"):
1. **Identify elements**: What's in each image? (product, person, background, etc.)
2. **Understand intent**: User wants a COMPOSITE - elements combined into ONE new image
3. **Call image generator**: Pass a prompt describing the desired composite
4. **Reference images are auto-included**: The selected images are sent to the generator

Example:
- User selects: [hat image] + [woman portrait]
- User says: "Have the character wear the product"
- You understand: hat = product, woman = character
- You call: call_image_generator with prompt "A woman wearing the black wide-brim hat, portrait style, professional photo"
- Result: New composite image of woman wearing the hat

## AUTOMATIC ASPECT RATIO DETECTION

When generating images with selected reference images:

1. **CALCULATE FROM LARGEST IMAGE**:
   - Each reference image has: { width, height, area, aspectRatio }
   - Find the image with LARGEST area (width × height)
   - Use that image's aspectRatio for generation

2. **CONVERT NUMERIC RATIO TO STRING**:
   - aspectRatio < 0.6 → '9:16' (very tall portrait)
   - aspectRatio 0.6-0.8 → '2:3' (portrait)
   - aspectRatio 0.8-1.2 → '1:1' (square)
   - aspectRatio 1.2-1.4 → '4:3' (slightly wide)
   - aspectRatio 1.4-1.8 → '16:9' (wide landscape)
   - aspectRatio > 1.8 → '21:9' (ultrawide)

3. **MANUAL OVERRIDE DETECTION**:
   - "make it square" → '1:1'
   - "make it vertical/portrait" → '9:16'
   - "make it horizontal/landscape/wide" → '16:9'
   - Explicit ratio mentioned (e.g., "in 16:9") → use that
   - When override detected: IGNORE calculated ratio

4. **NO SELECTION BEHAVIOR**:
   - "banner", "header", "cover" → '16:9'
   - "story", "Instagram story" → '9:16'
   - "post", "profile", "logo" → '1:1'
   - Default if unclear → '1:1'

5. **ALWAYS SPECIFY aspect_ratio**:
   Never rely on default - always calculate and provide aspect_ratio in tool call

Example workflow:
- Reference images: [Image A: 800×600 (area 480,000, ratio 1.33), Image B: 500×700 (area 350,000, ratio 0.71)]
- Largest by area: Image A (480,000 > 350,000)
- Its aspectRatio: 1.33
- Maps to: '4:3' (closest standard ratio)
- Tool call: call_image_generator({ prompt: "...", aspect_ratio: "4:3" })

## RULE #1: JUST DO IT - NO QUESTIONS

When user intent is clear:
- "Have her wear it" → Generate composite immediately
- "Combine these" → Generate composite immediately
- "Put the product on the model" → Generate composite immediately
- "Make it blue" → IMMEDIATELY call modify_canvas_element
- "Add text" → IMMEDIATELY call add_to_canvas

DO NOT ask "which character?" or "which product?" - LOOK at the selected images and figure it out!

## RULE #2: KNOW WHEN TO SUGGEST VS WHEN TO EXECUTE

### SUGGEST ONLY (Don't generate yet):
- User asks for "ideas", "suggestions", "options", "concepts"
- User says "what could I...", "show me some...", "give me examples"
- User is exploring, not ready to commit
- Examples:
  - "Give me logo ideas" → Describe 3 logo concepts (text only)
  - "What colors would work?" → Suggest color palettes (text only)
  - "Show me design options" → Describe options (text only)

### EXECUTE IMMEDIATELY (Generate/modify):
- User confirms previous suggestion: "generate that", "do it", "make option 2", "use that idea"
- User has clear intent with selection: "combine these", "make it blue"
- User gives specific instruction: "create a sunset background", "add text saying..."
- User references YOUR previous suggestion: "the second one", "that gradient idea", "use the concept you mentioned"
- Examples:
  - "Generate option 2" → CALL call_image_generator NOW
  - "Do it" (after suggesting) → CALL the appropriate tool NOW
  - "Combine these images" → CALL call_image_generator NOW
  - "Use that gradient idea" → CALL call_image_generator NOW

### CONTEXT AWARENESS:
- Track conversation: Did you JUST suggest ideas in your last message?
- If YES + user says "generate", "do it", "make it", "that one" → EXECUTE
- If user mentions "option 1/2/3" or "the first/second one" → They're confirming a suggestion → EXECUTE

**CRITICAL:** "Generate" after suggestions = EXECUTE, not more suggestions!

## SELECTION BEHAVIOR

**WHEN IMAGES ARE SELECTED:**
- User may want to COMPOSITE them (combine into one)
- User may want to use them as REFERENCE for generation
- "Combine these", "make them wear", "put together" = COMPOSITE
- ALWAYS describe what you see in the selected images first

**WHEN SHAPES ARE SELECTED (non-images):**
- "Make it blue" = change selected element's color
- "Delete" = remove selected elements
- Use element IDs from selectedShapes

**WHEN NOTHING IS SELECTED:**
- User is asking about overall design
- "Add a title" = create new text element
- "Generate a background" = create image from scratch

## TOOL USAGE

- \`call_image_generator\` - For generating/compositing images
  - prompt: Describe the desired output (reference images are auto-included)
  - aspect_ratio: '1:1', '16:9', '9:16', '3:2'

- \`modify_canvas_element\` - For changing EXISTING elements
- \`add_to_canvas\` - For adding text/shapes
- \`call_content_suggester\` - For text content ideas

## RESPONSE STYLE & FORMATTING

### Markdown Formatting
Use **markdown formatting** in all responses for better readability:
- Use **bold** for emphasis on key terms and features
- Use bullet points for structured information
- Use clear headings when appropriate
- Keep descriptions concise and professional

### Response Structure
When generating images:
1. **Brief description** of what was created (highlighting key elements)
2. **Structured details** with bullet points:
   - **Feature 1:** Description
   - **Feature 2:** Description
   - etc.
3. **Call-to-action** question like "Would you like any adjustments?" or "Would you like me to create variations?"

### General Responses
- First, describe what you SEE in selected images
- Then, take action immediately
- Brief confirmation of what you did

### Example Response Format

For image generation:
"I've created a professional advertisement featuring the product. The image captures elegant composition with cinematic lighting.

The advertisement features:
- **Subject:** Clear product focus
- **Lighting:** Professional studio lighting
- **Composition:** Clean, minimalist background
- **Quality:** High-end marketing ready

Would you like any adjustments to the composition?"

For image compositing:
"I can see a black wide-brim hat and a woman's portrait. Creating a composite image where she's wearing the hat...

The composite features:
- **Subject:** Woman wearing the black wide-brim hat
- **Style:** Portrait photography with professional lighting
- **Integration:** Seamless blend of the hat onto the model

Would you like any adjustments?"

## DEFAULT COLORS
Blue: #3B82F6, Red: #EF4444, Green: #22C55E, Yellow: #EAB308,
Purple: #A855F7, Pink: #EC4899, Orange: #F97316,
Black: #000000, White: #FFFFFF, Gray: #6B7280`;

// Tool definitions for Gemini function calling
const tools = [
  {
    functionDeclarations: [
      {
        name: "call_image_generator",
        description: "Generates or composites images. When images are selected, AUTOMATICALLY CALCULATE aspect ratio from the LARGEST image by area. Use this for: creating new images, combining selected images into composites (e.g., 'have the character wear the hat'), generating variations based on selected images, creating product photos with models.",
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed description of the desired output image. For compositing, describe how to combine the selected images (e.g., 'A woman wearing the black wide-brim hat, portrait style, professional photo'). For generation, describe the image you want to create."
            },
            aspect_ratio: {
              type: "string",
              description: "REQUIRED: '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', or '21:9'. Calculate from largest selected image or detect from user intent. Never use default."
            }
          },
          required: ["prompt", "aspect_ratio"]
        }
      },
      {
        name: "call_content_suggester",
        description: "Generates creative text content like marketing taglines, social media captions, blog post titles, or strategic ideas, maintaining the brand's tone.",
        parameters: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The subject: 'Instagram Captions', 'Marketing Taglines', 'Blog Post Ideas', 'Logo Text', etc."
            },
            goal: {
              type: "string",
              description: "The strategic goal: 'Increase brand awareness', 'Drive sales', 'Establish authority', etc."
            },
            brand_context: {
              type: "string",
              description: "Summary of Brand Bible's Mood, Audience, and Tone to guide the content's style."
            }
          },
          required: ["topic", "goal", "brand_context"]
        }
      },
      {
        name: "add_to_canvas",
        description: "Adds a generated asset (image or text) directly to the user's canvas at the specified position.",
        parameters: {
          type: "object",
          properties: {
            asset_type: {
              type: "string",
              enum: ["image", "text", "shape"],
              description: "The type of asset to add."
            },
            content: {
              type: "string",
              description: "For text: the text content. For image: the image URL. For shape: the shape type (rectangle, circle)."
            },
            style: {
              type: "object",
              description: "Style properties (fill color, font, size, etc.) from Brand Bible.",
              properties: {
                fill: { type: "string" },
                stroke: { type: "string" },
                fontSize: { type: "number" },
                fontFamily: { type: "string" }
              }
            }
          },
          required: ["asset_type", "content"]
        }
      },
      {
        name: "modify_canvas_element",
        description: "Modifies a selected element on the canvas. Use this when user wants to change color, size, position, or other properties of selected elements.",
        parameters: {
          type: "object",
          properties: {
            element_id: {
              type: "string",
              description: "The ID of the selected element to modify (get this from the canvas context selectedShapes array)."
            },
            updates: {
              type: "object",
              description: "The properties to update. For colors use: {style: {fill: '#hexcolor'}}. For size: {width: number, height: number}. For position: {x: number, y: number}. For text content: {text: 'new text'}. For opacity: {style: {opacity: 0.5}}.",
              properties: {
                style: {
                  type: "object",
                  properties: {
                    fill: { type: "string", description: "Fill color as hex code" },
                    stroke: { type: "string", description: "Stroke color as hex code" },
                    strokeWidth: { type: "number" },
                    opacity: { type: "number", description: "Opacity from 0 to 1" },
                    fontSize: { type: "number" },
                    fontFamily: { type: "string" }
                  }
                },
                width: { type: "number" },
                height: { type: "number" },
                x: { type: "number" },
                y: { type: "number" },
                text: { type: "string", description: "New text content for text elements" }
              }
            }
          },
          required: ["element_id", "updates"]
        }
      }
    ]
  }
];

// Execute tool calls - accepts reference images for compositing
async function executeToolCall(toolName, args, referenceImages = [], projectId = null, token = null) {
  switch (toolName) {
    case 'call_image_generator':
      // Pass reference images for compositing
      return await generateImage(args.prompt, args.aspect_ratio, referenceImages, projectId, token);

    case 'call_content_suggester':
      return await generateContent(args.topic, args.goal, args.brand_context);

    case 'add_to_canvas':
      return {
        success: true,
        action: {
          type: 'add',
          asset_type: args.asset_type,
          content: args.content,
          style: args.style || {}
        }
      };

    case 'modify_canvas_element':
      return {
        success: true,
        action: {
          type: 'modify',
          element_id: args.element_id,
          updates: args.updates
        }
      };

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

// Generate image using Gemini 2.5 Flash Image Preview (native generation with compositing)
async function generateImage(prompt, aspectRatio = '1:1', referenceImages = [], projectId = null, token = null) {
  try {
    // Validate aspect ratio
    const validRatios = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '21:9'];
    if (!validRatios.includes(aspectRatio)) {
      console.warn(`⚠️ Invalid aspect ratio "${aspectRatio}", defaulting to '1:1'`);
      aspectRatio = '1:1';
    }

    console.log('🎨 Generating image with Gemini:', prompt);
    console.log('🎨 Aspect ratio:', aspectRatio);
    console.log('🎨 Reference images for compositing:', referenceImages.length);

    // Build request parts - REFERENCE IMAGES FIRST (important for Gemini)
    const parts = [];

    // Add all reference images first (for compositing)
    for (const refImg of referenceImages) {
      if (refImg.base64) {
        parts.push({
          inline_data: {
            mime_type: 'image/png',
            data: refImg.base64
          }
        });
        console.log(`🎨 Added reference image: ${refImg.description || 'unknown'}`);
      }
    }

    // Build the prompt based on whether we have reference images
    let enhancedPrompt;
    if (referenceImages.length > 0) {
      // COMPOSITING MODE - combining reference images
      enhancedPrompt = `Using the ${referenceImages.length} reference image(s) provided above, ${prompt}.

IMPORTANT: Combine elements from these reference images as described in the prompt.
Create a seamless, natural composite that looks professionally photographed.
Maintain the style, lighting, and quality of the original images.
Output: ONE high-quality composite image.`;
    } else {
      // GENERATION MODE - creating from scratch
      const aspectHints = {
        '1:1': 'square format, 1:1 aspect ratio',
        '16:9': 'widescreen format, 16:9 aspect ratio, landscape orientation',
        '9:16': 'portrait format, 9:16 aspect ratio, vertical orientation',
        '3:2': 'print format, 3:2 aspect ratio',
        '4:3': 'standard format, 4:3 aspect ratio, slightly landscape',
        '2:3': 'portrait format, 2:3 aspect ratio, vertical orientation',
        '21:9': 'ultrawide format, 21:9 aspect ratio, cinematic landscape'
      };

      enhancedPrompt = `Generate a high-quality image: ${prompt}.
Output format: ${aspectHints[aspectRatio] || aspectHints['1:1']}.
Style: Professional, detailed, clean design.
Output: ONE image.`;
    }

    parts.push({ text: enhancedPrompt });

    // Call Gemini 2.5 Flash Image Preview API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"]
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Extract image from response
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      p => p.inlineData?.data
    );

    if (!imagePart) {
      // Model returned text instead of image
      const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text);
      console.log('🎨 Gemini returned text instead of image:', textPart?.text);
      throw new Error(textPart?.text || 'No image generated - model returned text response');
    }

    console.log('🎨 Image generated successfully, uploading via API...');

    // Upload using the existing /api/upload-canvas-image endpoint
    const imageUrl = await uploadViaAPI(imagePart.inlineData.data, projectId, token);
    console.log('🎨 Image uploaded:', imageUrl);

    return {
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      aspectRatio: aspectRatio,
      wasComposite: referenceImages.length > 0
    };

  } catch (error) {
    console.error('🎨 Gemini image generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper: Upload generated image using the existing /api/upload-canvas-image endpoint
async function uploadViaAPI(base64Data, projectId, token) {
  // Remove data URL prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  // If no projectId or token, use data URL fallback
  if (!projectId || !token) {
    console.warn('⚠️ No projectId or token provided, using data URL fallback');
    return `data:image/png;base64,${cleanBase64}`;
  }

  try {
    // Format as data URL (expected by upload-canvas-image endpoint)
    const dataUrl = `data:image/png;base64,${cleanBase64}`;

    // Call the existing upload-canvas-image endpoint
    const uploadResponse = await fetch(`http://localhost:3001/api/upload-canvas-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        imageData: dataUrl,
        projectId: projectId
      })
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(errorData.message || `Upload failed with status ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('🎨 Image uploaded via /api/upload-canvas-image:', uploadData.url);
    return uploadData.url;

  } catch (error) {
    // Fallback to data URL if API upload fails
    console.warn('⚠️ API upload failed, using data URL fallback:', error.message);
    return `data:image/png;base64,${cleanBase64}`;
  }
}

// Generate content using Gemini
async function generateContent(topic, goal, brandContext) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const contentPrompt = `You are a creative copywriter. Generate ${topic} with the goal to ${goal}.

Brand Context: ${brandContext}

Provide 5 creative options, each on a new line. Be concise, catchy, and aligned with the brand's tone.`;

    const result = await model.generateContent(contentPrompt);
    const response = await result.response;
    const content = response.text();

    return {
      success: true,
      content: content,
      topic: topic,
      goal: goal
    };
  } catch (error) {
    console.error('Content generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Maps numeric aspect ratio to standard string format
 * @param {number} ratio - Numeric aspect ratio (width/height)
 * @returns {string} - Standard aspect ratio string
 */
function mapNumericRatioToString(ratio) {
  if (ratio < 0.6) return '9:16';        // Very tall
  if (ratio < 0.8) return '2:3';         // Portrait
  if (ratio >= 0.8 && ratio <= 1.2) return '1:1';  // Square
  if (ratio > 1.2 && ratio <= 1.4) return '4:3';   // Slightly wide
  if (ratio > 1.4 && ratio <= 1.8) return '16:9';  // Wide
  return '21:9';                         // Ultrawide
}

/**
 * Detects if user is confirming/accepting a previous suggestion
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Chat history
 * @returns {{ isConfirmation: boolean, reason?: string }} - Confirmation detection result
 */
function detectConfirmationIntent(userMessage, conversationHistory) {
  const lowerMessage = userMessage.toLowerCase().trim();

  // Strong confirmation phrases - user wants to execute
  const confirmationPhrases = [
    'generate that',
    'generate it',
    'do it',
    'make it',
    'create it',
    'use that',
    'use this',
    'go with',
    'let\'s do',
    'proceed',
    'yes, generate',
    'yes generate',
    'generate option',
    'make option',
    'use option',
    'the first one',
    'the second one',
    'the third one',
    'option 1',
    'option 2',
    'option 3',
    'that idea',
    'that concept',
    'that design',
    'this one',
    'that one'
  ];

  const hasConfirmation = confirmationPhrases.some(phrase =>
    lowerMessage.includes(phrase)
  );

  if (hasConfirmation) {
    // Check if AI recently gave suggestions (last message was model/assistant)
    const lastMessages = conversationHistory.slice(-3); // Last 3 messages
    const aiRecentlySuggested = lastMessages.some(msg =>
      msg.role === 'model' &&
      msg.parts?.[0]?.text &&
      !msg.parts?.[0]?.functionCall // Was text suggestion, not a tool call
    );

    if (aiRecentlySuggested) {
      return {
        isConfirmation: true,
        reason: 'User confirming previous suggestion with phrase: ' +
                confirmationPhrases.find(p => lowerMessage.includes(p))
      };
    }
  }

  // Direct generation commands (even without prior suggestion)
  const directCommands = [
    'generate a',
    'generate an',
    'create a',
    'create an',
    'make a',
    'make an',
    'combine these',
    'merge these',
    'composite these'
  ];

  const isDirect = directCommands.some(cmd => lowerMessage.includes(cmd));

  if (isDirect) {
    return {
      isConfirmation: true,
      reason: 'Direct generation command: ' + directCommands.find(c => lowerMessage.includes(c))
    };
  }

  return { isConfirmation: false };
}

/**
 * Maps numeric aspect ratio to standard format
 * From walk-through.md Step 4
 * @param {number} ratio - Numeric aspect ratio (width/height)
 * @returns {string} - Standard aspect ratio string (e.g., "16:9")
 */
function mapAspectRatio(ratio) {
  if (ratio < 0.6) return '9:16'; // Very tall portrait
  if (ratio >= 0.6 && ratio < 0.8) return '2:3'; // Portrait
  if (ratio >= 0.8 && ratio <= 1.2) return '1:1'; // Square
  if (ratio > 1.2 && ratio <= 1.4) return '4:3'; // Slightly wide
  if (ratio > 1.4 && ratio <= 1.8) return '16:9'; // Wide landscape
  if (ratio > 1.8) return '21:9'; // Ultrawide
  return '1:1'; // Default
}

/**
 * Detects if user is requesting suggestions/ideas (not execution)
 * @param {string} userMessage - The user's message
 * @returns {{ isSuggestionRequest: boolean, keyword?: string }} - Suggestion detection result
 */
function detectSuggestionRequest(userMessage) {
  const lowerMessage = userMessage.toLowerCase();

  const suggestionKeywords = [
    'ideas for',
    'suggestions for',
    'options for',
    'concepts for',
    'what could',
    'what would',
    'show me some',
    'give me some',
    'examples of',
    'inspire me',
    'brainstorm'
  ];

  const isSuggestionRequest = suggestionKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );

  if (isSuggestionRequest) {
    return {
      isSuggestionRequest: true,
      keyword: suggestionKeywords.find(k => lowerMessage.includes(k))
    };
  }

  return { isSuggestionRequest: false };
}

// === 9-STEP DECISION PIPELINE ===
// These functions implement the systematic approach from walk-through.md

/**
 * Step 1: Read and understand user input
 * Analyzes message, context, and references
 * @param {string} message - User's message
 * @param {object} canvasContext - Canvas state
 * @param {array} selectedImages - Selected images for reference
 * @param {array} conversationHistory - Chat history
 * @returns {object} - Analysis of user intent
 */
function analyzeUserInput(message, canvasContext, selectedImages, conversationHistory) {
  return {
    userIntent: {
      message: message,
      hasSelection: canvasContext?.selectedShapes?.length > 0,
      hasImages: selectedImages.length > 0,
      conversationLength: conversationHistory.length
    }
  };
}

/**
 * Step 2: Identify key elements from input
 * Based on training-data.md patterns
 * @param {string} message - User's message
 * @param {object} analysis - Analysis from Step 1
 * @returns {object} - Identified elements (action, subject, etc.)
 */
function identifyKeyElements(message, analysis) {
  const lowerMessage = message.toLowerCase();

  // Extract action verbs (from training-data.md)
  const actionVerbs = {
    generate: ['generate', 'create', 'make', 'design', 'paint', 'draw'],
    edit: ['edit', 'change', 'modify', 'replace', 'update', 'adjust'],
    suggest: ['suggest', 'recommend', 'advise', 'help', 'what should', 'how can'],
    analyze: ['analyze', 'examine', 'study', 'describe', 'what is']
  };

  let primaryAction = 'unknown';
  for (const [action, verbs] of Object.entries(actionVerbs)) {
    if (verbs.some(verb => lowerMessage.includes(verb))) {
      primaryAction = action;
      break;
    }
  }

  // Extract subject
  const subjects = {
    shape: ['shape', 'rectangle', 'circle', 'square', 'triangle'],
    image: ['image', 'photo', 'picture', 'visual'],
    text: ['text', 'label', 'caption', 'title', 'heading'],
    color: ['color', 'fill', 'background', 'foreground']
  };

  let primarySubject = 'unknown';
  for (const [subject, keywords] of Object.entries(subjects)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      primarySubject = subject;
      break;
    }
  }

  return {
    primaryAction,
    primarySubject,
    rawMessage: message,
    hasSelection: analysis.userIntent.hasSelection,
    hasReferenceImages: analysis.userIntent.hasImages
  };
}

/**
 * Step 3: Determine task type
 * Maps to our tools: call_image_generator, modify_canvas_element, add_to_canvas
 * @param {object} elements - Elements from Step 2
 * @returns {object} - Task type and recommended tool
 */
function determineTaskType(elements) {
  // PRIORITY 1: Reference images with edit/generate action
  // When user selects reference images and wants to modify/enhance them
  if (elements.hasReferenceImages && (elements.primaryAction === 'edit' || elements.primaryAction === 'generate')) {
    return {
      taskType: 'image_generation',
      tool: 'call_image_generator',
      confidence: 'high'
    };
  }

  // PRIORITY 2: Explicit image generation
  if (elements.primaryAction === 'generate' && elements.primarySubject === 'image') {
    return {
      taskType: 'image_generation',
      tool: 'call_image_generator',
      confidence: 'high'
    };
  }

  // PRIORITY 3: Canvas shape modification (when canvas shapes are selected, not images)
  if (elements.primaryAction === 'edit' && elements.hasSelection) {
    return {
      taskType: 'shape_modification',
      tool: 'modify_canvas_element',
      confidence: 'high'
    };
  }

  // PRIORITY 4: Color changes (likely on canvas shapes)
  if (elements.primarySubject === 'color' && elements.hasSelection) {
    return {
      taskType: 'shape_modification',
      tool: 'modify_canvas_element',
      confidence: 'high'
    };
  }

  // PRIORITY 5: Shape addition
  if (elements.primaryAction === 'generate' && elements.primarySubject === 'shape') {
    return {
      taskType: 'shape_addition',
      tool: 'add_to_canvas',
      confidence: 'medium'
    };
  }

  // PRIORITY 6: Suggestion request
  if (elements.primaryAction === 'suggest') {
    return {
      taskType: 'suggestion',
      tool: null,
      confidence: 'high'
    };
  }

  // Default to letting Gemini decide
  return {
    taskType: 'complex',
    tool: null,
    confidence: 'low'
  };
}

/**
 * Step 4: Check and analyze reference material
 * @param {array} selectedImages - Selected images
 * @param {object} canvasContext - Canvas state
 * @returns {object} - Reference analysis
 */
function analyzeReferenceMaterial(selectedImages, canvasContext) {
  if (selectedImages.length === 0) {
    return { hasReferences: false };
  }

  // Calculate aspect ratio from largest image (from walk-through.md)
  const largestImage = selectedImages.reduce((max, img) =>
    img.area > max.area ? img : max
  );

  const suggestedAspectRatio = mapAspectRatio(largestImage.aspectRatio);

  return {
    hasReferences: true,
    count: selectedImages.length,
    largestImage,
    suggestedAspectRatio,
    purpose: 'compositing' // For combining reference images
  };
}

/**
 * Step 5: Match to available tools (already done - we have 4 tools)
 * Just log the decision
 * @param {object} taskType - Task type from Step 3
 */
function logToolSelection(taskType) {
  console.log('🎯 Step 5: Tool Selection:', {
    taskType: taskType.taskType,
    selectedTool: taskType.tool,
    confidence: taskType.confidence
  });
}

/**
 * Step 6: Structure the prompt (CRITICAL - from complete-example.md)
 * This is the NEW structured prompting approach
 * @param {object} taskType - Task type from Step 3
 * @param {object} elements - Elements from Step 2
 * @param {object} referenceMaterial - Reference analysis from Step 4
 * @returns {object|null} - Structured prompt or null
 */
function structurePrompt(taskType, elements, referenceMaterial) {
  if (taskType.taskType !== 'image_generation') {
    return null; // Only structure prompts for image generation
  }

  // Build structured prompt sections (from complete-example.md)
  const sections = [];

  // COMPOSITION section
  sections.push('COMPOSITION:');
  if (referenceMaterial.hasReferences) {
    sections.push(`- Use the ${referenceMaterial.count} reference image(s) as the basis`);
    sections.push('- Seamlessly integrate elements from reference images');
  } else {
    sections.push('- Center the main subject with balanced framing');
    sections.push('- Clean, professional composition');
  }
  sections.push('- Clear focal point with intentional visual hierarchy');
  sections.push('');

  // SUBJECT & STYLE section
  sections.push('SUBJECT & STYLE:');
  sections.push(`- ${elements.rawMessage}`);
  sections.push('- Professional, polished aesthetic');
  sections.push('- Attention to detail and quality');
  sections.push('');

  // LIGHTING section
  sections.push('LIGHTING & TECHNICAL:');
  sections.push('- Professional studio-quality lighting');
  sections.push('- Proper exposure and color balance');
  sections.push('- Sharp focus with appropriate depth');
  sections.push('');

  // TECHNICAL SPECS
  sections.push('OUTPUT REQUIREMENTS:');
  if (referenceMaterial.hasReferences) {
    sections.push(`- Aspect ratio: ${referenceMaterial.suggestedAspectRatio} (from reference image)`);
    sections.push('- Maintain style consistency with reference');
  } else {
    sections.push('- Aspect ratio: 1:1 (default)');
  }
  sections.push('- High quality, professional result');
  sections.push('- ONE final image output');

  return {
    isStructured: true,
    structuredPrompt: sections.join('\n'),
    originalMessage: elements.rawMessage
  };
}

// Import design types library
const { detectDesignType, fillPromptTemplate } = require('../lib/design-types');

// Main chat endpoint - handles multipart FormData with optional canvas image
router.post('/', upload.single('canvasImage'), async (req, res) => {
  let tempFilePath = null;

  try {
    // Parse FormData fields (multer puts them in req.body as strings)
    const message = req.body.message;
    const conversationHistory = req.body.conversationHistory ? JSON.parse(req.body.conversationHistory) : [];
    const canvasContext = req.body.canvasContext ? JSON.parse(req.body.canvasContext) : null;
    const brandBible = req.body.brandBible ? JSON.parse(req.body.brandBible) : null;
    const projectId = req.body.projectId || null;

    // === GET AUTHENTICATED USER FOR PERSISTENCE ===
    const { user, supabaseClient } = await getAuthenticatedUserForChat(req);

    // Extract auth token for image upload
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Parse selected images for compositing
    let selectedImages = [];
    try {
      if (req.body.selectedImages) {
        selectedImages = JSON.parse(req.body.selectedImages);
        console.log(`📷 Received ${selectedImages.length} selected images for compositing`);
        // Log size of each image for debugging
        selectedImages.forEach((img, i) => {
          console.log(`📷 Image ${i + 1}: ${img.base64 ? Math.round(img.base64.length / 1024) : 0}KB base64`);
        });
      }
    } catch (parseError) {
      console.error('❌ Failed to parse selectedImages:', parseError.message);
      // Continue without selected images
      selectedImages = [];
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // === SAVE USER MESSAGE TO DATABASE ===
    if (projectId && user && supabaseClient) {
      const userMessage = {
        role: 'user',
        content: message,
      };
      const saveResult = await saveChatMessage(supabaseClient, projectId, user.id, userMessage);
      if (!saveResult.success) {
        console.warn('⚠️ Failed to save user message:', saveResult.error);
        // Continue anyway - don't fail the request
      }
    }
    // ===============================================

    /**
     * Formats the AI response with markdown syntax
     * Injects generated images into the response text
     */
    function formatMarkdownResponse(textResponse, generatedImages) {
      let formattedResponse = textResponse;

      // If there are generated images, inject them at the beginning
      if (generatedImages && generatedImages.length > 0) {
        const imageMarkdown = generatedImages.map((img, index) => {
          const title = img.prompt ? img.prompt.substring(0, 80) : `Generated Image ${index + 1}`;
          return `![${title}](${img.url})`;
        }).join('\n\n');

        // Inject images at the beginning of the response
        formattedResponse = `${imageMarkdown}\n\n${formattedResponse}`;
      }

      return formattedResponse;
    }

    // Check if canvas image was uploaded
    let canvasImageData = null;
    if (req.file) {
      tempFilePath = req.file.path;
      console.log(`📷 Canvas image received: ${req.file.size} bytes at ${tempFilePath}`);

      // Read file as base64 for Gemini vision (conversion happens server-side only)
      const imageBuffer = fs.readFileSync(tempFilePath);
      canvasImageData = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: req.file.mimetype || 'image/png'
        }
      };
    }

    // Initialize the model with function calling
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      tools: tools,
    });

    // Build conversation history for Gemini
    const history = [];

    // Add system context as first user message
    let systemContext = SYSTEM_PROMPT;

    // Add visual analysis instructions if image is attached
    if (canvasImageData) {
      systemContext += `\n\nVISUAL ANALYSIS MODE:
You have received a screenshot of the user's canvas. LOOK at the image to understand:
1. What elements are present (shapes, text, images, colors)
2. The overall design style and composition
3. What the user might be trying to create
4. Any issues with the design (poor contrast, alignment, etc.)

When responding, reference what you SEE in the image. For example:
- "I can see a blue rectangle with white text..."
- "The design appears to be a logo with..."
- "I notice the colors are..."

Use your visual understanding to give better, more contextual help.\n`;
    }

    // Add canvas context if available
    if (canvasContext) {
      systemContext += `\n\nCANVAS STATE:\n`;
      systemContext += `Total shapes: ${canvasContext.totalShapes || 0}\n`;
      if (canvasContext.selectedShapes && canvasContext.selectedShapes.length > 0) {
        systemContext += `\nSELECTED ELEMENTS (use these IDs with modify_canvas_element):\n`;
        for (const shape of canvasContext.selectedShapes) {
          systemContext += `- ID: "${shape.id}", Type: ${shape.type}`;
          if (shape.style?.fill) systemContext += `, Current fill: ${shape.style.fill}`;
          if (shape.text) systemContext += `, Text: "${shape.text}"`;
          systemContext += `\n`;
        }
        systemContext += `\nUser has elements selected. If they ask to change something, use modify_canvas_element with the ID above.\n`;
      }
    }

    // === DETECT DESIGN TYPE ===
    const detectedDesignType = detectDesignType(message, canvasContext?.selectedShapes || []);
    if (detectedDesignType) {
      console.log(`🎨 Detected design type: ${detectedDesignType.name}`);

      // Enhance system prompt with design-specific guidelines
      systemContext += `\n\n## 🎨 DESIGN TYPE DETECTED: ${detectedDesignType.name.toUpperCase()}

You are creating a **${detectedDesignType.name}** design. Follow these specific guidelines:

**Default Aspect Ratio:** ${detectedDesignType.defaultAspectRatio}

**Design Guidelines:**
${Object.entries(detectedDesignType.guidelines).map(([key, value]) =>
  `- ${key.toUpperCase()}: ${value}`
).join('\n')}

**Prompt Structure Template:**
${detectedDesignType.promptTemplate}

IMPORTANT: When generating the image, structure your prompt following the template above.
Fill in the {{variables}} with information from the user's request.\n`;
    }

    // IMPORTANT: Inform AI about available reference images for compositing
    if (selectedImages.length > 0) {
      systemContext += `\n\n🖼️ REFERENCE IMAGES FOR COMPOSITING:\n`;
      systemContext += `${selectedImages.length} selected image(s) with metadata:\n`;

      // Show structured metadata for AI
      for (let i = 0; i < selectedImages.length; i++) {
        const img = selectedImages[i];
        const orientation = img.aspectRatio > 1 ? 'landscape' : img.aspectRatio < 1 ? 'portrait' : 'square';
        systemContext += `  ${i + 1}. Size: ${img.width}×${img.height}px, Area: ${img.area}px², Ratio: ${img.aspectRatio.toFixed(2)} (${orientation})\n`;
      }

      // Calculate suggested ratio from largest image
      const largestImage = selectedImages.reduce((max, img) =>
        img.area > max.area ? img : max
      );
      const suggestedRatio = mapNumericRatioToString(largestImage.aspectRatio);

      systemContext += `\n📊 LARGEST IMAGE: #${selectedImages.indexOf(largestImage) + 1} with area ${largestImage.area}px²\n`;
      systemContext += `📐 CALCULATED ASPECT RATIO: "${suggestedRatio}" (from ratio ${largestImage.aspectRatio.toFixed(2)})\n`;
      systemContext += `\n⚠️ USE aspect_ratio="${suggestedRatio}" in call_image_generator UNLESS user explicitly requests different ratio.\n`;
      systemContext += `These images will be automatically sent for compositing when you call call_image_generator.\n`;
    }

    // Add brand bible ONLY if established (don't require it)
    if (brandBible) {
      systemContext += `\nBrand guidelines available: ${JSON.stringify(brandBible)}\n`;
    }

    // Convert conversation history to Gemini format
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        history.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    // Start chat
    const chat = model.startChat({
      history: history.length > 0 ? [
        { role: 'user', parts: [{ text: systemContext }] },
        { role: 'model', parts: [{ text: 'Ready to help! I can see your canvas and am ready to assist. Tell me what you\'d like to do - change colors, add shapes, generate images, or anything else.' }] },
        ...history
      ] : [
        { role: 'user', parts: [{ text: systemContext }] },
        { role: 'model', parts: [{ text: 'Ready to help! I can see your canvas and am ready to assist. Tell me what you\'d like to do - change colors, add shapes, generate images, or anything else.' }] }
      ],
    });

    // === APPLY 9-STEP DECISION PIPELINE ===
    console.log('🚀 Starting 9-step decision process...');

    // Step 1: Read and understand
    const analysis = analyzeUserInput(message, canvasContext, selectedImages, conversationHistory);
    console.log('📖 Step 1: Analyzed input');

    // Step 2: Identify key elements
    const elements = identifyKeyElements(message, analysis);
    console.log('🔍 Step 2: Key elements:', elements);

    // Step 3: Determine task type
    const taskType = determineTaskType(elements);
    console.log('🎯 Step 3: Task type:', taskType.taskType, '→ Tool:', taskType.tool);

    // Step 4: Check reference material
    const referenceMaterial = analyzeReferenceMaterial(selectedImages, canvasContext);
    console.log('🖼️ Step 4: Reference analysis:', referenceMaterial.hasReferences ?
      `${referenceMaterial.count} images` : 'No references');

    // Step 5: Match to tools (logging only)
    logToolSelection(taskType);

    // Step 6: Structure the prompt
    const structuredPrompt = structurePrompt(taskType, elements, referenceMaterial);
    if (structuredPrompt) {
      console.log('📝 Step 6: Created structured prompt');
      console.log('Structured prompt preview:', structuredPrompt.structuredPrompt.substring(0, 200) + '...');
    }

    // Step 7: Execute (existing Gemini call)
    // Add structured prompt to system context if available
    if (structuredPrompt) {
      systemContext += `\n\n🎨 STRUCTURED GENERATION GUIDE:\n${structuredPrompt.structuredPrompt}\n`;
    }

    // Modify user message based on task type and confidence
    let userMessageText = message;

    if (taskType.confidence === 'high' && taskType.tool) {
      // High confidence - tell Gemini exactly which tool to use
      let instruction = `[SYSTEM INSTRUCTION: This is a ${taskType.taskType}. Use the ${taskType.tool} tool. ${structuredPrompt ? 'Follow the structured generation guide above.' : 'Execute immediately.'}`;

      // Add design type specific instructions for image generation
      if (taskType.tool === 'call_image_generator' && detectedDesignType) {
        instruction += `\n\nDESIGN TYPE: ${detectedDesignType.name}
When calling call_image_generator, structure your prompt following the ${detectedDesignType.name} template provided in the system context.
Use the proper COMPOSITION, STYLE, LIGHTING, and TECHNICAL sections.
Default aspect ratio: ${detectedDesignType.defaultAspectRatio} (unless user specifies different).
Follow the design guidelines provided above.`;
      }

      instruction += `]`;
      userMessageText = `${message}\n\n${instruction}`;
      console.log('⚡ Step 7: Added high-confidence execution instruction');
    } else if (taskType.taskType === 'suggestion') {
      // Suggestion mode
      userMessageText = `${message}

[SYSTEM INSTRUCTION: User wants IDEAS/SUGGESTIONS only. Provide 2-3 options in text. DO NOT execute tools.]`;
      console.log('💡 Step 7: Suggestion mode activated');
    } else {
      // Low confidence - let Gemini decide but encourage execution
      userMessageText = `${message}

[SYSTEM INSTRUCTION: DIRECT COMMAND - analyze the request and call the appropriate tool if applicable.]`;
      console.log('🤔 Step 7: Letting Gemini decide (low confidence)');
    }

    // Build message parts - include image if available
    const messageParts = [];
    if (canvasImageData) {
      messageParts.push(canvasImageData);
      messageParts.push({ text: `[CANVAS SCREENSHOT ATTACHED - Analyze this design]\n\nUser message: ${userMessageText}` });
      console.log('📷 Sending message with canvas image to Gemini');
    } else {
      messageParts.push({ text: userMessageText });
      console.log('📝 Sending text-only message to Gemini');
    }

    // Send message with optional image
    let result = await chat.sendMessage(messageParts);
    let response = result.response;

    // Check for function calls
    const functionCalls = response.functionCalls();
    const actions = [];
    let generatedImages = [];
    let generatedContent = [];

    if (functionCalls && functionCalls.length > 0) {
      // Execute each function call
      for (const call of functionCalls) {
        console.log(`Executing tool: ${call.name}`, call.args);
        // Pass selected images for compositing when calling image generator
        const toolResult = await executeToolCall(call.name, call.args, selectedImages, projectId, token);

        if (toolResult.success) {
          if (toolResult.imageUrl) {
            generatedImages.push({
              url: toolResult.imageUrl,
              prompt: toolResult.prompt,
              aspectRatio: toolResult.aspectRatio
            });
          }
          if (toolResult.content) {
            generatedContent.push({
              content: toolResult.content,
              topic: toolResult.topic,
              goal: toolResult.goal
            });
          }
          if (toolResult.action) {
            actions.push(toolResult.action);
          }
        }

        // Send function result back to model
        result = await chat.sendMessage([{
          functionResponse: {
            name: call.name,
            response: toolResult
          }
        }]);
        response = result.response;
      }
    }

    // Get the final text response
    const textResponse = response.text();

    // Parse brand bible from response if present
    let parsedBrandBible = null;
    const brandBibleMatch = textResponse.match(/<!--BRAND_BIBLE_JSON:(.+?)-->/);
    if (brandBibleMatch) {
      try {
        parsedBrandBible = JSON.parse(brandBibleMatch[1]);
      } catch (e) {
        console.log('Failed to parse brand bible JSON');
      }
    }

    // Clean the response (remove the JSON marker)
    const cleanResponse = textResponse.replace(/<!--BRAND_BIBLE_JSON:.+?-->/g, '').trim();

    // === SAVE ASSISTANT MESSAGE TO DATABASE ===
    if (projectId && user && supabaseClient) {
      const assistantMessage = {
        role: 'assistant',
        content: cleanResponse,
        phase: detectPhase(cleanResponse, actions, generatedImages),
        images: generatedImages,
        actions: actions,
      };
      const saveResult = await saveChatMessage(supabaseClient, projectId, user.id, assistantMessage);
      if (!saveResult.success) {
        console.warn('⚠️ Failed to save assistant message:', saveResult.error);
        // Continue anyway - still return response
      }

      // Log design type metadata if detected
      if (detectedDesignType) {
        console.log(`💾 Saved message with design type: ${detectedDesignType.id} (${detectedDesignType.name})`);
      }
    }
    // ===============================================

    // === STEP 8: REVIEW OUTPUT ===
    console.log('👀 Step 8: Reviewing output...');

    // Validate generated images
    if (generatedImages.length > 0) {
      for (const img of generatedImages) {
        if (!img.url || !img.url.startsWith('http')) {
          console.warn('⚠️ Generated image has invalid URL:', img.url);
        } else {
          console.log('✅ Valid image URL:', img.url.substring(0, 50) + '...');
        }
      }
    }

    // Validate actions
    if (actions.length > 0) {
      for (const action of actions) {
        if (!action.type || (!action.element_id && action.type === 'modify')) {
          console.warn('⚠️ Invalid action structure:', action);
        } else {
          console.log('✅ Valid action:', action.type);
        }
      }
    }

    // Step 9: Deliver (log delivery summary)
    console.log('📦 Step 9: Delivering response with', {
      responseLength: cleanResponse.length,
      imagesGenerated: generatedImages.length,
      actionsExecuted: actions.length
    });

    // Format response with markdown and inject images
    const markdownResponse = formatMarkdownResponse(cleanResponse, generatedImages);

    res.json({
      success: true,
      response: markdownResponse,
      actions: actions,
      generatedImages: generatedImages,
      generatedContent: generatedContent,
      brandBible: parsedBrandBible,
      phase: detectPhase(cleanResponse, actions, generatedImages)
    });

  } catch (error) {
    console.error('❌ AI Chat error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat message'
    });
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('📷 Cleaned up temporary canvas image file');
      } catch (e) {
        console.log('Failed to clean up temp file:', e.message);
      }
    }
  }
});

// Detect which phase the conversation is in
function detectPhase(response, actions, images) {
  const lowerResponse = response.toLowerCase();

  // Priority 1: If tools were actually executed or images generated → EXECUTION
  if (images.length > 0 || actions.length > 0) {
    return 'EXECUTION';
  }

  // Priority 2: Check for execution keywords in response
  const executionKeywords = [
    'here\'s', 'generated', 'created', 'i\'ll create', 'i\'ll generate',
    'creating', 'generating', 'i\'ve created', 'i\'ve generated',
    'compositing', 'adding', 'i\'ve added'
  ];
  if (executionKeywords.some(keyword => lowerResponse.includes(keyword))) {
    return 'EXECUTION';
  }

  // Priority 3: Check for refinement keywords
  if (lowerResponse.includes('refined') || lowerResponse.includes('updated') ||
      lowerResponse.includes('modified') || lowerResponse.includes('adjusted')) {
    return 'REFINEMENT';
  }

  // Priority 4: Check for strategy keywords
  if (lowerResponse.includes('brand bible') || lowerResponse.includes('target audience') ||
      lowerResponse.includes('color palette') || lowerResponse.includes('let me analyze') ||
      lowerResponse.includes('first, let\'s')) {
    return 'STRATEGY';
  }

  // Default: EXECUTION (most user prompts are execution requests)
  return 'EXECUTION';
}

/**
 * GET /api/ai-chat/history/:projectId
 * Fetch last 50 chat messages for a project
 */
router.get('/history/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        error: 'projectId is required',
      });
    }

    // Get authenticated user
    const { user, supabaseClient } = await getAuthenticatedUserForChat(req);

    if (!user || !supabaseClient) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    console.log('📜 Fetching chat history for project:', projectId, 'user:', user.id);

    // Verify project belongs to user
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

    // Fetch last 50 messages (RLS ensures user can only see their own)
    const { data: messages, error } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }) // Oldest first for chat UI
      .limit(50);

    if (error) {
      console.error('❌ Error fetching chat history:', error);
      return res.status(500).json({
        error: 'Failed to fetch chat history',
        message: error.message,
      });
    }

    console.log(`✅ Found ${messages?.length || 0} messages`);

    // Transform database format to frontend Message format
    const formattedMessages = (messages || []).map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      phase: msg.phase,
      images: msg.images || [],
      actions: msg.actions || [],
      timestamp: new Date(msg.created_at),
    }));

    res.json({
      success: true,
      messages: formattedMessages,
    });

  } catch (error) {
    console.error('❌ Error in GET /api/ai-chat/history/:projectId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;
