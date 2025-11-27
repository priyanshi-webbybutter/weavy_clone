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

// System prompt for Canvas agent with visual understanding and IMAGE COMPOSITING
const SYSTEM_PROMPT = `You are 'Canvas', an AI Design Assistant with VISUAL UNDERSTANDING and IMAGE COMPOSITING capabilities.

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

## RESPONSE STYLE

- First, describe what you SEE in selected images
- Then, take action immediately
- Brief confirmation of what you did

Example response:
"I can see a black wide-brim hat and a woman's portrait. Creating a composite image where she's wearing the hat..."

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

    // Build message parts - include image if available
    const messageParts = [];
    if (canvasImageData) {
      messageParts.push(canvasImageData);
      messageParts.push({ text: `[CANVAS SCREENSHOT ATTACHED - Analyze this design]\n\nUser message: ${message}` });
      console.log('📷 Sending message with canvas image to Gemini');
    } else {
      messageParts.push({ text: message });
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

    res.json({
      success: true,
      response: cleanResponse,
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

  if (lowerResponse.includes('brand bible') || lowerResponse.includes('target audience') || lowerResponse.includes('color palette')) {
    return 'STRATEGY';
  }
  if (images.length > 0 || actions.length > 0 || lowerResponse.includes('here\'s') || lowerResponse.includes('generated')) {
    return 'EXECUTION';
  }
  if (lowerResponse.includes('refined') || lowerResponse.includes('updated') || lowerResponse.includes('modified')) {
    return 'REFINEMENT';
  }

  return 'STRATEGY';
}

module.exports = router;
