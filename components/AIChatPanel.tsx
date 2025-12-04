'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Send, Paperclip, Sparkles, RefreshCw } from 'lucide-react';
import { Shape, ImageShape, TextShape } from '@/lib/canvas/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  phase?: 'STRATEGY' | 'EXECUTION' | 'REFINEMENT';
  images?: { url: string; prompt: string }[];
  selectedImages?: { id: string; url: string }[];
  actions?: CanvasAction[];
  timestamp: Date;
}

interface BrandBible {
  industry: string;
  targetAudience: string;
  mood: string[];
  colorPalette: string[];
  typographyStyle: string;
  additionalNotes?: string;
}

interface CanvasAction {
  type: 'add' | 'modify';
  asset_type?: 'image' | 'text' | 'shape';
  content?: string;
  style?: Record<string, any>;
  element_id?: string;
  updates?: Record<string, any>;
}

interface SelectedImageMetadata {
  id: string;
  base64: string;
  description: string;
  width: number;
  height: number;
  area: number;
  aspectRatio: number;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedShapes: Shape[];
  allShapes: Shape[];
  onAddShape: (shape: Shape) => void;
  onUpdateShape: (id: string, updates: Partial<Shape>) => void;
  onGenerateImage: (prompt: string, aspectRatio?: string) => Promise<string>;
  onCaptureCanvas: () => Promise<Blob | null>;
  onFocusShape?: (shapeId: string, keepSelection?: boolean) => void;
  onCenterToShape?: (shapeId: string, animate?: boolean) => void;
  projectId?: string | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Quick template presets
const QUICK_TEMPLATES = [
  {
    id: 'gradient-banner',
    name: 'Gradient hero banner',
    description: 'Colorful gradient background',
    prompt: 'Create a modern gradient hero banner for my brand',
    image: '/templates/gradient.png'
  },
  {
    id: '3d-abstract',
    name: '3D abstract shape',
    description: 'Geometric 3D element',
    prompt: 'Generate a 3D abstract geometric shape for my design',
    image: '/templates/3d-shape.png'
  },
  {
    id: 'botanical',
    name: 'Botanical pattern',
    description: 'Nature/plant pattern',
    prompt: 'Create a botanical leaf pattern design',
    image: '/templates/botanical.png'
  },
  {
    id: 'doodle',
    name: 'Doodle element set',
    description: 'Hand-drawn style elements',
    prompt: 'Generate hand-drawn doodle design elements',
    image: '/templates/doodle.png'
  }
];

const AIChatPanel: React.FC<AIChatPanelProps> = ({
  isOpen,
  onClose,
  selectedShapes,
  allShapes,
  onAddShape,
  onUpdateShape,
  onGenerateImage,
  onCaptureCanvas,
  onFocusShape,
  onCenterToShape,
  projectId,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [brandBible, setBrandBible] = useState<BrandBible | null>(null);
  const [includeSelection, setIncludeSelection] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Load chat history when project changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!projectId || !isOpen) {
        return; // Don't load if no project or panel closed
      }

      // Only load once per project
      if (historyLoaded) {
        return;
      }

      setIsLoadingHistory(true);
      console.log('📜 Loading chat history for project:', projectId);

      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.warn('⚠️ No auth token, skipping chat history load');
          setIsLoadingHistory(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/ai-chat/history/${projectId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load chat history: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.messages) {
          console.log(`✅ Loaded ${data.messages.length} messages from history`);
          // Convert timestamp strings to Date objects
          const messagesWithDates = data.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(messagesWithDates);
          setHistoryLoaded(true);
        }
      } catch (error) {
        console.error('❌ Error loading chat history:', error);
        // Don't show error to user, just start with empty chat
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, [projectId, isOpen, historyLoaded]);

  // Reset history loaded flag when project changes
  useEffect(() => {
    setHistoryLoaded(false);
    setMessages([]); // Clear messages when switching projects
  }, [projectId]);

  // Build canvas context for API - rich metadata based on selection state
  const buildCanvasContext = useCallback(() => {
    const context: any = {
      totalShapes: allShapes.length,
      hasSelection: selectedShapes.length > 0,
      canvasDescription: "User's design canvas"
    };

    // Build shape summaries by type
    const shapeSummary = {
      images: allShapes.filter(s => s.type === 'image').length,
      text: allShapes.filter(s => s.type === 'text').length,
      rectangles: allShapes.filter(s => s.type === 'rectangle').length,
      circles: allShapes.filter(s => s.type === 'circle').length,
      lines: allShapes.filter(s => s.type === 'line').length,
    };
    context.shapeSummary = shapeSummary;

    // SELECTED SHAPES - Detailed metadata for precise actions
    if (selectedShapes.length > 0) {
      context.selectedShapes = selectedShapes.map(s => {
        const base = {
          id: s.id,
          type: s.type,
          x: Math.round(s.x),
          y: Math.round(s.y),
          style: s.style,
        };

        // Type-specific details
        if (s.type === 'image') {
          const img = s as ImageShape;
          return {
            ...base,
            width: Math.round(img.width),
            height: Math.round(img.height),
            src: img.src,
            description: 'Image element - can resize, reposition, adjust opacity, or use as reference'
          };
        }
        if (s.type === 'text') {
          const txt = s as TextShape;
          return {
            ...base,
            width: Math.round(txt.width),
            height: Math.round(txt.height),
            text: txt.text,
            fontSize: txt.style?.fontSize,
            fontFamily: txt.style?.fontFamily,
            description: 'Text element - can edit content, change font, color, size'
          };
        }
        if (s.type === 'rectangle') {
          const rect = s as any;
          return {
            ...base,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fill: rect.style?.fill,
            stroke: rect.style?.stroke,
            description: 'Rectangle shape - can change fill, stroke, size, position'
          };
        }
        return {
          ...base,
          width: (s as any).width ? Math.round((s as any).width) : undefined,
          height: (s as any).height ? Math.round((s as any).height) : undefined,
        };
      });

      context.selectionHint = `User has ${selectedShapes.length} element(s) selected. ` +
        `When user says "this" or "it", they mean the selected element(s). ` +
        `Use modify_canvas_element with the IDs provided to make changes.`;
    } else if (allShapes.length > 0) {
      // NO SELECTION but canvas has content - provide overview
      context.canvasOverview = `Canvas contains ${allShapes.length} elements: ` +
        `${shapeSummary.images} images, ${shapeSummary.text} text, ` +
        `${shapeSummary.rectangles} rectangles, ${shapeSummary.circles} circles.`;

      context.noSelectionHint = `No elements are selected. ` +
        `User is asking about the overall design or wants to add new elements. ` +
        `Use add_to_canvas for new elements, or ask which element to modify if unclear.`;
    } else {
      // EMPTY CANVAS
      context.emptyCanvasHint = `Canvas is empty. User wants to create something from scratch. ` +
        `Use call_image_generator for images or add_to_canvas for shapes/text.`;
    }

    return context;
  }, [allShapes, selectedShapes]);

  // Fetch selected images and convert to base64 for compositing
  const getSelectedImagesBase64 = useCallback(async (): Promise<SelectedImageMetadata[]> => {
    const imageShapes = selectedShapes.filter(s => s.type === 'image') as ImageShape[];

    if (imageShapes.length === 0) return [];

    console.log('📷 Extracting selected images for compositing:', imageShapes.length);

    const results: SelectedImageMetadata[] = [];
    for (const img of imageShapes) {
      if (img.src) {
        try {
          // Try to fetch with CORS mode first
          let response;
          try {
            response = await fetch(img.src, { mode: 'cors' });
          } catch (corsError) {
            // If CORS fails, try no-cors (will give opaque response)
            console.warn('📷 CORS fetch failed, trying alternative method for:', img.src);
            // For cross-origin images, we'll skip them (canvas capture will still include them)
            continue;
          }

          if (!response.ok) {
            console.warn(`📷 Failed to fetch image (${response.status}):`, img.src);
            continue;
          }

          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Calculate dimensions with fallbacks
          const width = Math.round(img.width || 512);
          const height = Math.round(img.height || 512);
          const area = width * height;
          const aspectRatio = width / height;

          results.push({
            id: img.id,
            base64: base64.replace(/^data:image\/\w+;base64,/, ''),
            description: `Image at position (${Math.round(img.x)}, ${Math.round(img.y)}) - ${width}x${height}px`,
            width,
            height,
            area,
            aspectRatio
          });
          console.log(`📷 Extracted image ${img.id}: ${Math.round(blob.size / 1024)}KB, ${width}x${height}px, ratio ${aspectRatio.toFixed(2)}`);
        } catch (e) {
          console.error('📷 Failed to fetch image for compositing:', img.src, e);
          // Continue with other images
        }
      }
    }
    console.log(`📷 Successfully extracted ${results.length} of ${imageShapes.length} images`);
    return results;
  }, [selectedShapes]);

  // Get selected image shapes for thumbnail display
  const getSelectedImageShapes = useCallback((): ImageShape[] => {
    return selectedShapes.filter(shape => {
      if (shape.type !== 'image') return false;
      const imgShape = shape as ImageShape;
      // Only include images with valid, non-empty src URLs
      return imgShape.src && imgShape.src.trim() !== '' && !imgShape.src.includes('uploading');
    }) as ImageShape[];
  }, [selectedShapes]);

  // Handle canvas actions from AI with placeholder system
  const handleCanvasActions = useCallback(async (actions: CanvasAction[], images: { url: string; prompt: string }[]) => {
    // Calculate smart positioning based on existing shapes or selection
    let baseX = 100;
    let baseY = 100;

    // If shapes are selected, position near them
    if (selectedShapes.length > 0) {
      const firstSelected = selectedShapes[0];
      baseX = firstSelected.x + ((firstSelected as any).width || 100) + 50;
      baseY = firstSelected.y;
    } else if (allShapes.length > 0) {
      // Position away from existing shapes
      const maxX = Math.max(...allShapes.map(s => s.x + ((s as any).width || 100)));
      baseX = Math.min(maxX + 50, 500);
    }

    // Handle generated images - load image first to get actual dimensions
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imageId = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log('🎨 Loading generated image to get dimensions:', image.url.substring(0, 50) + '...');

      // Load image to get actual dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve) => {
        img.onload = () => {
          // Calculate display size (max 500px, maintain aspect ratio)
          const maxSize = 500;
          let width = img.naturalWidth;
          let height = img.naturalHeight;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          console.log(`🎨 Image dimensions: ${img.naturalWidth}x${img.naturalHeight} → display: ${Math.round(width)}x${Math.round(height)}`);

          // Create image shape with correct dimensions
          const imageShape: ImageShape = {
            id: imageId,
            type: 'image',
            x: baseX + (i * 50),
            y: baseY + (i * 50),
            width: Math.round(width),
            height: Math.round(height),
            src: image.url,
            style: { opacity: 1 }
          };

          onAddShape(imageShape);
          resolve();
        };

        img.onerror = () => {
          console.error('🎨 Failed to load generated image');
          // Still add with default size if loading fails
          const imageShape: ImageShape = {
            id: imageId,
            type: 'image',
            x: baseX + (i * 50),
            y: baseY + (i * 50),
            width: 400,
            height: 400,
            src: image.url,
            style: { opacity: 1 }
          };
          onAddShape(imageShape);
          resolve();
        };

        img.src = image.url;
      });
    }

    // Handle other actions (text, shapes, modifications)
    let actionOffset = 0;
    for (const action of actions) {
      if (action.type === 'add') {
        if (action.asset_type === 'text' && action.content) {
          const newShape: TextShape = {
            id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'text',
            x: baseX + actionOffset,
            y: baseY + actionOffset + (images.length * 50), // Offset from images
            width: 300,
            height: 50,
            text: action.content,
            style: {
              fill: action.style?.fill || '#ffffff',
              fontSize: action.style?.fontSize || 24,
              fontFamily: action.style?.fontFamily || 'Inter',
              opacity: 1
            }
          };
          onAddShape(newShape);
          actionOffset += 30;
        }
      } else if (action.type === 'modify' && action.element_id && action.updates) {
        console.log('🔧 Modifying element:', action.element_id, action.updates);
        onUpdateShape(action.element_id, action.updates as Partial<Shape>);
      }
    }
  }, [onAddShape, onUpdateShape, selectedShapes, allShapes]);

  // === LOADING PLACEHOLDER HELPERS ===

  // Track active placeholder animations
  const placeholderAnimationRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      placeholderAnimationRef.current.forEach((interval) => clearInterval(interval));
      placeholderAnimationRef.current.clear();
    };
  }, []);

  /**
   * Detects if the user message will trigger image generation
   * Based on keywords and context
   */
  const detectImageGeneration = useCallback((message: string, shapes: Shape[]): boolean => {
    const lowerMessage = message.toLowerCase();

    // Keywords that indicate image generation
    const generationKeywords = [
      'generate', 'create', 'make', 'design', 'paint', 'draw',
      'image', 'photo', 'picture', 'visual', 'illustration',
      'combine', 'composite', 'merge', 'blend'
    ];

    // Check for generation keywords
    const hasGenerationKeyword = generationKeywords.some(keyword =>
      lowerMessage.includes(keyword)
    );

    // Check if modifying existing image (reference images selected)
    const hasReferenceImages = shapes.some(s => s.type === 'image');
    const hasModificationKeyword = ['change', 'modify', 'edit', 'adjust', 'vibrant', 'brighter'].some(k =>
      lowerMessage.includes(k)
    );

    return hasGenerationKeyword || (hasReferenceImages && hasModificationKeyword);
  }, []);

  /**
   * Creates an animated loading placeholder SVG frame
   * @param frame - Current frame number (0-11) for 12-frame animation cycle
   */
  const createLoadingPlaceholderSVG = useCallback((frame: number = 0): string => {
    // Calculate rotation based on frame (30 degrees per frame for smooth rotation)
    const rotation = (frame * 30) % 360;

    // Calculate dot opacities for animated dots effect
    const dotOpacities = [
      frame % 4 === 0 ? 1 : 0.3,
      frame % 4 === 1 ? 1 : 0.3,
      frame % 4 === 2 ? 1 : 0.3,
    ];

    const svg = `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:0.3" />
          </linearGradient>
        </defs>

        <!-- Background -->
        <rect width="400" height="400" fill="url(#grad)" />

        <!-- Static dashed border -->
        <rect x="2" y="2" width="396" height="396" fill="none" stroke="#6366f1"
              stroke-width="3" stroke-dasharray="10,5" opacity="0.5"/>

        <!-- Loading spinner - animated rotation -->
        <g transform="rotate(${rotation}, 200, 200)">
          <circle cx="200" cy="200" r="40" fill="none" stroke="#ffffff"
                  stroke-width="4" stroke-dasharray="60,200" opacity="0.8"/>
        </g>

        <!-- Text -->
        <text x="200" y="260" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif"
              font-size="18" fill="#ffffff" font-weight="500">
          Generating
        </text>

        <!-- Animated dots -->
        <text x="200" y="285" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif"
              font-size="24" fill="#ffffff">
          <tspan opacity="${dotOpacities[0]}">.</tspan>
          <tspan opacity="${dotOpacities[1]}">.</tspan>
          <tspan opacity="${dotOpacities[2]}">.</tspan>
        </text>
      </svg>
    `;

    // Convert SVG to data URL
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }, []);

  /**
   * Creates an error placeholder SVG
   */
  const createErrorPlaceholderSVG = useCallback((errorMessage: string): string => {
    const svg = `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <!-- Background -->
        <rect width="400" height="400" fill="#1f2937" />

        <!-- Error icon (X) -->
        <circle cx="200" cy="180" r="40" fill="none" stroke="#ef4444" stroke-width="3" />
        <line x1="180" y1="160" x2="220" y2="200" stroke="#ef4444" stroke-width="3" />
        <line x1="220" y1="160" x2="180" y2="200" stroke="#ef4444" stroke-width="3" />

        <!-- Text -->
        <text x="200" y="250" text-anchor="middle" font-family="system-ui"
              font-size="16" fill="#ef4444" font-weight="500">
          Generation Failed
        </text>

        <text x="200" y="275" text-anchor="middle" font-family="system-ui"
              font-size="12" fill="#9ca3af">
          ${errorMessage.substring(0, 40)}
        </text>
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }, []);

  /**
   * Adds a loading placeholder to the canvas with animation
   * Returns the placeholder ID for later replacement
   */
  const addGenerationPlaceholder = useCallback((): string => {
    const placeholderId = `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate position (same logic as handleCanvasActions)
    let baseX = 100;
    let baseY = 100;

    if (selectedShapes.length > 0) {
      const firstSelected = selectedShapes[0];
      baseX = firstSelected.x + ((firstSelected as any).width || 100) + 50;
      baseY = firstSelected.y;
    } else if (allShapes.length > 0) {
      const maxX = Math.max(...allShapes.map(s => s.x + ((s as any).width || 100)));
      baseX = Math.min(maxX + 50, 500);
    }

    // Create placeholder image shape with SVG data URL (initial frame)
    const placeholderShape: ImageShape = {
      id: placeholderId,
      type: 'image',
      x: baseX,
      y: baseY,
      width: 400,
      height: 400,
      src: createLoadingPlaceholderSVG(0),
      style: { opacity: 0.8 }
    };

    // Add to canvas immediately
    onAddShape(placeholderShape);
    console.log('🎨 Added loading placeholder:', placeholderId);

    // Start animation loop - update every 100ms for smooth animation
    let frame = 0;
    const animationInterval = setInterval(() => {
      frame = (frame + 1) % 12; // 12 frames in the animation cycle
      const newSvg = createLoadingPlaceholderSVG(frame);
      onUpdateShape(placeholderId, { src: newSvg });
    }, 100);

    // Store the interval for cleanup
    placeholderAnimationRef.current.set(placeholderId, animationInterval);
    console.log('🎬 Started placeholder animation:', placeholderId);

    // Center canvas to show the placeholder
    if (onCenterToShape) {
      // Use setTimeout to ensure shape is added before centering
      setTimeout(() => {
        onCenterToShape(placeholderId, true);
        console.log('🎯 Centered canvas to placeholder:', placeholderId);
      }, 50);
    }

    return placeholderId;
  }, [selectedShapes, allShapes, onAddShape, onUpdateShape, createLoadingPlaceholderSVG, onCenterToShape]);

  /**
   * Stops the animation for a placeholder
   */
  const stopPlaceholderAnimation = useCallback((placeholderId: string) => {
    const interval = placeholderAnimationRef.current.get(placeholderId);
    if (interval) {
      clearInterval(interval);
      placeholderAnimationRef.current.delete(placeholderId);
      console.log('🛑 Stopped placeholder animation:', placeholderId);
    }
  }, []);

  /**
   * Replaces the loading placeholder with the actual generated image
   */
  const replacePlaceholderWithImage = useCallback(async (
    placeholderId: string,
    generatedImage: { url: string; prompt: string; aspectRatio?: string }
  ): Promise<void> => {
    console.log('🔄 Replacing placeholder with actual image:', placeholderId);

    // Stop the animation first
    stopPlaceholderAnimation(placeholderId);

    // Load the actual image to get dimensions
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = generatedImage.url;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        // Calculate display size (max 500px, maintain aspect ratio)
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > 500 || height > 500) {
          if (width > height) {
            height = (height / width) * 500;
            width = 500;
          } else {
            width = (width / height) * 500;
            height = 500;
          }
        }

        // Update the placeholder shape with actual image
        onUpdateShape(placeholderId, {
          src: generatedImage.url,
          width: Math.round(width),
          height: Math.round(height),
          style: { opacity: 1 }
        });

        console.log('✅ Placeholder replaced successfully');
        resolve();
      };

      img.onerror = () => {
        console.error('❌ Failed to load generated image:', generatedImage.url);
        reject(new Error('Failed to load image'));
      };
    });
  }, [onUpdateShape, stopPlaceholderAnimation]);

  // Send message to AI with canvas screenshot
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    // Get selected images to include in the message
    const selectedImageShapes = getSelectedImageShapes();
    const selectedImagesData = selectedImageShapes.map(img => ({
      id: img.id,
      url: img.src
    }));

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      selectedImages: selectedImagesData.length > 0 ? selectedImagesData : undefined,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // === PLACEHOLDER LOGIC: Detect if image generation expected ===
    // Declare outside try block so it's accessible in catch
    const willGenerateImage = detectImageGeneration(messageText, selectedShapes);
    let placeholderId: string | null = null;

    if (willGenerateImage) {
      console.log('🎨 Image generation detected - adding placeholder');
      placeholderId = addGenerationPlaceholder();
    }

    try {
      // Capture canvas as PNG Blob (not base64)
      console.log('📸 Capturing canvas for AI analysis...');
      const canvasBlob = await onCaptureCanvas();

      // Extract selected images for compositing (base64)
      console.log('📷 Getting selected images for compositing...');
      const selectedImages = await getSelectedImagesBase64();

      // Build FormData for multipart upload
      const formData = new FormData();
      formData.append('message', messageText);
      formData.append('conversationHistory', JSON.stringify(
        messages.map(m => ({ role: m.role, content: m.content }))
      ));
      formData.append('canvasContext', JSON.stringify(buildCanvasContext()));

      if (brandBible) {
        formData.append('brandBible', JSON.stringify(brandBible));
      }

      // Include projectId for image upload
      if (projectId) {
        formData.append('projectId', projectId);
      }

      // Append selected images for compositing
      if (selectedImages.length > 0) {
        formData.append('selectedImages', JSON.stringify(selectedImages));
        console.log(`📷 Attached ${selectedImages.length} selected images for compositing`);
      }

      // Append PNG file if canvas has content
      if (canvasBlob) {
        formData.append('canvasImage', canvasBlob, 'canvas-capture.png');
        console.log(`📸 Attached canvas image: ${canvasBlob.size} bytes`);
      } else {
        console.log('📸 No canvas content to attach (empty canvas or capture failed)');
      }

      // Get auth token for image upload authorization
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/ai-chat`, {
        method: 'POST',
        headers: headers,
        // NO Content-Type header - browser sets it with boundary for FormData
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Update brand bible if returned
        if (data.brandBible) {
          setBrandBible(data.brandBible);
        }

        // Handle canvas actions
        if ((data.actions && data.actions.length > 0) || (data.generatedImages && data.generatedImages.length > 0)) {
          // === PLACEHOLDER LOGIC: Replace placeholder with actual image ===
          if (placeholderId && data.generatedImages && data.generatedImages.length > 0) {
            console.log('🔄 Replacing placeholder with generated image');
            try {
              await replacePlaceholderWithImage(placeholderId, data.generatedImages[0]);
              // Remove the generated image from the list since we already handled it via placeholder
              const remainingImages = data.generatedImages.slice(1);
              if (remainingImages.length > 0) {
                await handleCanvasActions(data.actions || [], remainingImages);
              } else {
                // Only handle non-image actions if we replaced the placeholder
                await handleCanvasActions(data.actions || [], []);
              }
            } catch (replaceError) {
              console.error('❌ Failed to replace placeholder:', replaceError);
              // Fallback: use normal handling if replacement fails
              await handleCanvasActions(data.actions || [], data.generatedImages || []);
            }
          } else {
            // Normal handling when no placeholder
            await handleCanvasActions(data.actions || [], data.generatedImages || []);
          }
        }

        // Add assistant message
        const assistantMessage: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          phase: data.phase,
          images: data.generatedImages,
          actions: data.actions,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('AI Chat error:', error);

      // === PLACEHOLDER LOGIC: Show error state on placeholder ===
      if (placeholderId) {
        console.log('⚠️ Updating placeholder with error state');
        // Stop the animation first
        stopPlaceholderAnimation(placeholderId);
        try {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          onUpdateShape(placeholderId, {
            src: createErrorPlaceholderSVG(errorMsg),
            style: { opacity: 0.5 }
          });
        } catch (updateError) {
          console.error('❌ Failed to update placeholder with error:', updateError);
        }
      }

      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, buildCanvasContext, brandBible, handleCanvasActions, onCaptureCanvas, getSelectedImagesBase64, getSelectedImageShapes, selectedShapes, detectImageGeneration, addGenerationPlaceholder, replacePlaceholderWithImage, onUpdateShape, createErrorPlaceholderSVG, stopPlaceholderAnimation]);

  // Handle template click
  const handleTemplateClick = (template: typeof QUICK_TEMPLATES[0]) => {
    sendMessage(template.prompt);
  };

  // Handle new chat
  const handleNewChat = () => {
    setMessages([]);
    setBrandBible(null);
    setInputValue('');
    setHistoryLoaded(false); // Allow reloading history
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // Render phase badge
  const renderPhaseBadge = (phase?: string) => {
    if (!phase) return null;

    const colors = {
      STRATEGY: 'bg-blue-500/20 text-blue-400',
      EXECUTION: 'bg-purple-500/20 text-purple-400',
      REFINEMENT: 'bg-green-500/20 text-green-400'
    };

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors[phase as keyof typeof colors] || 'bg-gray-500/20 text-gray-400'}`}>
        {phase}
      </span>
    );
  };

  if (!isOpen) return null;

  const hasMessages = messages.length > 0;

  return (
    <div
      className="fixed left-[68px] top-0 h-screen w-[320px] bg-[#0a0a0a] border-r border-[#2a2a2a] z-50 flex flex-col"
      style={{ fontWeight: 200 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">Canvas</span>
          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded">Beta</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Brand Bible Card (if established) */}
      {brandBible && (
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
            <div className="text-xs text-gray-400 mb-2 font-medium">Brand Bible</div>
            <div className="space-y-1.5">
              <div className="text-xs text-gray-500">
                <span className="text-gray-400">Industry:</span> {brandBible.industry}
              </div>
              <div className="text-xs text-gray-500">
                <span className="text-gray-400">Mood:</span> {brandBible.mood.join(', ')}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">Colors:</span>
                {brandBible.colorPalette.map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded border border-[#3a3a3a]"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Welcome Screen */
          <div className="p-4">
            {isLoadingHistory ? (
              // Loading state
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                <p className="text-gray-400 text-sm">Loading chat history...</p>
              </div>
            ) : (
              <>
                {/* Rotating Icon */}
                <div className="flex justify-center py-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-blue-400" />
                  </div>
                </div>

                {/* Welcome Text */}
                <div className="text-center mb-6">
                  <h2 className="text-white text-lg font-medium mb-2">What do you want to create?</h2>
                  <p className="text-gray-500 text-sm">
                    Generate images, edit them, or add one from your canvas to customize it
                  </p>
                </div>

                {/* Quick Templates */}
                <div className="mb-4">
                  <div className="text-gray-400 text-xs mb-3">Create a</div>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateClick(template)}
                        className="bg-[#1a1a1a] rounded-lg p-3 text-left hover:bg-[#2a2a2a] transition-colors border border-[#2a2a2a] hover:border-[#3a3a3a]"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/30 to-blue-500/30 mb-2 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="text-white text-xs font-medium">{template.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Chat Messages */
          <div className="p-4 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`${message.role === 'user' ? 'ml-8' : 'mr-4'}`}
              >
                {/* Phase Badge for assistant messages */}
                {message.role === 'assistant' && message.phase && (
                  <div className="mb-1">
                    {renderPhaseBadge(message.phase)}
                  </div>
                )}

                {/* Message Content */}
                <div
                  className={`rounded-lg p-3 text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#1a1a1a] text-gray-200 border border-[#2a2a2a]'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>

                  {/* Selected Images Thumbnails */}
                  {message.selectedImages && message.selectedImages.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {message.selectedImages.map((img) => (
                        <button
                          key={img.id}
                          onClick={() => onFocusShape?.(img.id)}
                          className="relative w-12 h-12 rounded overflow-hidden border border-[#3a3a3a] hover:border-blue-500 transition-colors flex-shrink-0"
                          title="Click to focus on canvas"
                        >
                          <img
                            src={img.url}
                            alt="Selected"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Generated Images */}
                  {message.images && message.images.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.images.map((img, i) => (
                        <div key={i} className="rounded-lg overflow-hidden border border-[#3a3a3a]">
                          <img
                            src={img.url}
                            alt={img.prompt}
                            className="w-full h-auto"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className="text-[10px] text-gray-600 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Canvas is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[#2a2a2a]">
        {/* Selected Image Thumbnails */}
        {getSelectedImageShapes().length > 0 && (
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            {getSelectedImageShapes().map((img) => (
              <button
                key={img.id}
                onClick={() => onFocusShape?.(img.id, true)}
                className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-[#3a3a3a] hover:border-blue-500 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                title="Click to center this image on canvas"
              >
                <img
                  src={img.src}
                  alt="Selected"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="What can I help you create?"
            rows={2}
            className="w-full bg-transparent px-4 py-3 text-white text-sm resize-none focus:outline-none placeholder:text-gray-500"
            disabled={isLoading}
          />
          <div className="flex items-center justify-end px-3 py-2 border-t border-[#2a2a2a]">
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
