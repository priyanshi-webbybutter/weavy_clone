const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Replicate = require('replicate');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Replicate for image generation
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// System prompt for Canvas agent
const SYSTEM_PROMPT = `You are 'Canvas', an AI Design Assistant. Your job is simple: DO what the user asks.

RULE #1: JUST DO IT
- When user says "make it blue" → IMMEDIATELY call modify_canvas_element. Don't ask questions.
- When user says "add text" → IMMEDIATELY call add_to_canvas. Don't ask questions.
- When user says "generate a logo" → IMMEDIATELY call call_image_generator. Don't ask questions.
- NEVER ask for Brand Bible, clarification, or additional info for simple tasks.
- NEVER say "to proceed effectively" or "I need more information".

RULE #2: ONLY SUGGEST WHEN ASKED
- If user says "suggest", "recommend", "what do you think", "help me decide" → Give suggestions
- If user says "change color to blue" → Just change it, don't suggest alternatives
- If user asks about a selected element "what should I do with this?" → Give suggestions

DEFAULT COLORS (use these immediately):
- Blue: #3B82F6, Red: #EF4444, Green: #22C55E, Yellow: #EAB308
- Purple: #A855F7, Pink: #EC4899, Orange: #F97316
- Black: #000000, White: #FFFFFF, Gray: #6B7280
- Dark blue: #1E40AF, Light blue: #93C5FD, Navy: #1E3A5A

ACTIONS:
1. modify_canvas_element - Change color, size, position of selected elements
   - Color: {style: {fill: "#hexcode"}}
   - Size: {width: X, height: Y}
   - Position: {x: X, y: Y}
   - Opacity: {style: {opacity: 0.5}}

2. add_to_canvas - Add new text or shapes
3. call_image_generator - Generate images (logos, banners, illustrations)
4. call_content_suggester - Generate text content (taglines, captions)

ELEMENT TYPES:
- rectangle/shape: Can change fill, stroke, size, position
- text: Can change color, font, size, content, position
- image: Can change size, position, opacity (NOT fill color)

RESPONSE STYLE:
- Be brief: "Done! Changed the rectangle to blue." or "Here's your logo:"
- Don't explain what you're about to do, just do it
- Don't ask for confirmation on simple tasks

ONLY create a Brand Bible if user explicitly asks to "start a brand project" or "create brand guidelines".`;

// Tool definitions for Gemini function calling
const tools = [
  {
    functionDeclarations: [
      {
        name: "call_image_generator",
        description: "Generates a high-resolution, custom image asset based on a detailed text prompt. Use this for logos, product scenes, illustrations, banners, posters, and marketing visuals.",
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The detailed, descriptive prompt for the image generator, including all visual styles, colors (HEX codes from the Brand Bible), and composition details."
            },
            aspect_ratio: {
              type: "string",
              description: "The desired aspect ratio: '1:1' (square), '16:9' (wide), '9:16' (portrait), '3:2' (print)."
            }
          },
          required: ["prompt"]
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

// Execute tool calls
async function executeToolCall(toolName, args) {
  switch (toolName) {
    case 'call_image_generator':
      return await generateImage(args.prompt, args.aspect_ratio);

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

// Generate image using Replicate
async function generateImage(prompt, aspectRatio = '1:1') {
  try {
    console.log('Generating image with prompt:', prompt);

    // Map aspect ratio to dimensions
    const dimensions = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '3:2': { width: 1216, height: 832 }
    };

    const size = dimensions[aspectRatio] || dimensions['1:1'];

    const output = await replicate.run(
      "black-forest-labs/flux-1.1-pro",
      {
        input: {
          prompt: prompt,
          width: size.width,
          height: size.height,
          num_outputs: 1,
          output_format: "webp",
          output_quality: 90
        }
      }
    );

    const imageUrl = Array.isArray(output) ? output[0] : output;
    console.log('Image generated:', imageUrl);

    return {
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      aspectRatio: aspectRatio
    };
  } catch (error) {
    console.error('Image generation error:', error);
    return {
      success: false,
      error: error.message
    };
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

// Main chat endpoint
router.post('/', async (req, res) => {
  try {
    const { message, conversationHistory, canvasContext, brandBible } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
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
        { role: 'model', parts: [{ text: 'Ready to help! Tell me what to do - change colors, add shapes, generate images, or anything else.' }] },
        ...history
      ] : [
        { role: 'user', parts: [{ text: systemContext }] },
        { role: 'model', parts: [{ text: 'Ready to help! Tell me what to do - change colors, add shapes, generate images, or anything else.' }] }
      ],
    });

    // Send message
    let result = await chat.sendMessage(message);
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
        const toolResult = await executeToolCall(call.name, call.args);

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
    console.error('AI Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat message'
    });
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
