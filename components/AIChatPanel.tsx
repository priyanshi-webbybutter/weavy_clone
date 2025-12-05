'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Send, Paperclip, Sparkles, RefreshCw } from 'lucide-react';
import { Shape, ImageShape, TextShape, ArrowShape, Point } from '@/lib/canvas/types';
import { findOptimalPlacement, findMultiPlacement } from '@/lib/canvas/placementUtils';
import MarkdownMessage from './MarkdownMessage';

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
  onRemovePlaceholder?: (placeholderId: string) => void;
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
  onRemovePlaceholder,
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
  const [activePlaceholders, setActivePlaceholders] = useState<string[]>([]);
  const [currentReferenceIds, setCurrentReferenceIds] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<{ id: string; url: string; file: File }[]>([]);
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activePlaceholdersRef = useRef<string[]>([]);
  const currentReferenceIdsRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /**
   * Fixes malformed markdown image syntax where alt text contains newlines
   * Converts: ![multi\nline\nalt](url) → ![Image](url)
   */
  const cleanMarkdownImages = useCallback((content: string): string => {
    // Pattern to match markdown images with potentially multi-line alt text
    // Matches: ![anything including newlines](url)
    const imagePattern = /!\[([^\]]*(?:\n[^\]]*)*)\]\((https?:\/\/[^\s)]+)\)/g;

    return content.replace(imagePattern, (match, altText, url) => {
      // Clean alt text: remove newlines, extra spaces, and truncate if too long
      const cleanAlt = altText
        .replace(/\n/g, ' ')  // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim()
        .substring(0, 100);   // Limit to 100 chars

      // Return properly formatted markdown
      return `![${cleanAlt || 'Generated Image'}](${url})`;
    });
  }, []);

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
    const selectedIds: string[] = [];
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
          selectedIds.push(img.id);
          console.log(`📷 Extracted image ${img.id}: ${Math.round(blob.size / 1024)}KB, ${width}x${height}px, ratio ${aspectRatio.toFixed(2)}`);
        } catch (e) {
          console.error('📷 Failed to fetch image for compositing:', img.src, e);
          // Continue with other images
        }
      }
    }
    console.log(`📷 Successfully extracted ${results.length} of ${imageShapes.length} images`);

    // Store reference IDs for arrow creation after generation
    console.log('🔵 SETTING currentReferenceIds:', selectedIds);
    setCurrentReferenceIds(selectedIds);
    currentReferenceIdsRef.current = selectedIds;

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

  // Handle file upload from user's device
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(file => {
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) {
        console.error('Invalid file type:', file.type);
        return false;
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        console.error('File too large:', file.size);
        return false;
      }

      return true;
    });

    for (const file of validFiles) {
      const tempId = `uploading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Add to uploading set
      setUploadingImages(prev => new Set(prev).add(tempId));

      try {
        // Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Upload to backend
        const token = localStorage.getItem('auth_token');

        // Prepare request body as JSON
        const requestBody: { imageData: string; projectId?: string } = {
          imageData: base64,
        };

        if (projectId) {
          requestBody.projectId = projectId;
        }

        const response = await fetch(`${API_BASE_URL}/upload-canvas-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (data.success && data.url) {
          // Add uploaded image to state
          setUploadedImages(prev => [...prev, {
            id: tempId,
            url: data.url,
            file: file,
          }]);
          console.log('✅ Image uploaded successfully:', data.url);
        } else {
          console.error('Upload failed:', data.error);
        }
      } catch (error) {
        console.error('Error uploading image:', error);
      } finally {
        // Remove from uploading set
        setUploadingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
      }
    }

    // Clear file input
    if (e.currentTarget) {
      e.currentTarget.value = '';
    }
  }, [projectId]);

  // Remove uploaded image from state
  const removeUploadedImage = useCallback((imageId: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  }, []);

  // Handle canvas actions from AI with placeholder system
  const handleCanvasActions = useCallback(async (actions: CanvasAction[], images: { url: string; prompt: string }[]) => {
    // Handle generated images with smart placement
    if (images.length > 0) {
      console.log(`🎨 Loading ${images.length} generated images to get dimensions...`);

      // Load all images first to get actual dimensions
      const imageData: Array<{
        url: string;
        prompt: string;
        width: number;
        height: number;
      }> = [];

      for (const image of images) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = image.url;

        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
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
            resolve({ width: Math.round(width), height: Math.round(height) });
          };

          img.onerror = () => {
            console.error('🎨 Failed to load generated image, using default size');
            resolve({ width: 400, height: 400 }); // Fallback
          };
        });

        imageData.push({
          url: image.url,
          prompt: image.prompt,
          width: dimensions.width,
          height: dimensions.height,
        });
      }

      // Get placeholder IDs to exclude (they'll be removed)
      const placeholderIds = allShapes
        .filter(s => s.id.startsWith('placeholder-'))
        .map(s => s.id);

      // Find optimal positions for all images at once using smart placement
      const positions = findMultiPlacement(
        imageData.map(img => ({ width: img.width, height: img.height })),
        allShapes,
        selectedShapes, // Reference shapes
        placeholderIds,
        {
          minGap: 50,
          preferredGap: 80,
          maxIterations: 50,
          spiralStep: 100,
        }
      );

      // Create image shapes with calculated positions
      for (let i = 0; i < imageData.length; i++) {
        const imgData = imageData[i];
        const position = positions[i];
        const imageId = `image-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;

        console.log(`🎨 Placing image ${i + 1}/${imageData.length} at (${position.x}, ${position.y})`);

        const imageShape: ImageShape = {
          id: imageId,
          type: 'image',
          x: position.x,
          y: position.y,
          width: imgData.width,
          height: imgData.height,
          src: imgData.url,
          style: { opacity: 1 },
          generationMetadata: {
            referenceImageIds: currentReferenceIds.length > 0
              ? [...currentReferenceIds]
              : undefined,
            generatedAt: new Date(),
            prompt: imgData.prompt
          }
        };

        onAddShape(imageShape);

        // Arrows now render automatically from CanvasArrows component based on generationMetadata.referenceImageIds
      }
    }

    // Handle other actions (text, shapes, modifications)
    for (const action of actions) {
      if (action.type === 'add') {
        if (action.asset_type === 'text' && action.content) {
          // Use smart placement for text as well
          const placeholderIds = allShapes
            .filter(s => s.id.startsWith('placeholder-'))
            .map(s => s.id);

          const position = findOptimalPlacement(
            300, // Default text width
            50,  // Default text height
            allShapes,
            selectedShapes,
            placeholderIds,
            { minGap: 50, preferredGap: 80 }
          );

          const newShape: TextShape = {
            id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'text',
            x: position.x,
            y: position.y,
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
        }
      } else if (action.type === 'modify' && action.element_id && action.updates) {
        console.log('🔧 Modifying element:', action.element_id, action.updates);
        onUpdateShape(action.element_id, action.updates as Partial<Shape>);
      }
    }

    // Clear reference tracking after all images and actions processed
    setCurrentReferenceIds([]);
    currentReferenceIdsRef.current = [];
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

    // HIGH CONFIDENCE ONLY - explicit generation commands
    const explicitGenerationCommands = [
      'generate image', 'create image', 'generate a', 'create a',
      'paint', 'draw', 'composite', 'merge images', 'blend images',
      'combine images'
    ];

    // Check for explicit phrases first
    if (explicitGenerationCommands.some(cmd => lowerMessage.includes(cmd))) {
      return true;
    }

    // Single words only if with "image/photo/picture"
    const singleWords = ['generate', 'create', 'make'];
    const imageNouns = ['image', 'photo', 'picture', 'visual', 'illustration'];

    const hasSingleWord = singleWords.some(w => lowerMessage.includes(w));
    const hasImageNoun = imageNouns.some(n => lowerMessage.includes(n));

    if (hasSingleWord && hasImageNoun) {
      return true;
    }

    // Don't create placeholder for low-confidence cases
    // Let backend decide without optimistic placeholder
    return false;
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

    // Smart placement using collision detection
    const PLACEHOLDER_SIZE = 400;

    // Get IDs of existing placeholders to exclude from collision
    const existingPlaceholderIds = allShapes
      .filter(s => s.id.startsWith('placeholder-'))
      .map(s => s.id);

    // Find optimal placement using smart algorithm
    const position = findOptimalPlacement(
      PLACEHOLDER_SIZE,
      PLACEHOLDER_SIZE,
      allShapes,
      selectedShapes, // Reference shapes
      existingPlaceholderIds,
      {
        minGap: 50,
        preferredGap: 80,
        maxIterations: 50,
        spiralStep: 100,
      }
    );

    console.log(`🎯 Smart placement for placeholder at (${position.x}, ${position.y})`);

    // Create placeholder image shape with SVG data URL (initial frame)
    const placeholderShape: ImageShape = {
      id: placeholderId,
      type: 'image',
      x: position.x,
      y: position.y,
      width: PLACEHOLDER_SIZE,
      height: PLACEHOLDER_SIZE,
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

    // Track placeholder ID for later removal
    setActivePlaceholders(prev => [...prev, placeholderId]);
    activePlaceholdersRef.current = [...activePlaceholdersRef.current, placeholderId];
    console.log('📝 Tracked placeholder for removal:', placeholderId);

    // ADD: Auto-cleanup after 60 seconds as safety measure
    setTimeout(() => {
      // Check if placeholder still exists
      if (activePlaceholdersRef.current.includes(placeholderId)) {
        console.warn('⚠️ Placeholder timeout - removing orphaned placeholder:', placeholderId);
        stopPlaceholderAnimation(placeholderId);
        onRemovePlaceholder?.(placeholderId);
        setActivePlaceholders(prev => prev.filter(id => id !== placeholderId));
        activePlaceholdersRef.current = activePlaceholdersRef.current.filter(id => id !== placeholderId);
      }
    }, 60000); // 60 second timeout

    return placeholderId;
  }, [selectedShapes, allShapes, onAddShape, onUpdateShape, createLoadingPlaceholderSVG, onCenterToShape, onRemovePlaceholder]);

  /**
   * Calculates edge-to-edge arrow points between two images
   */
  const calculateEdgeToEdgePoints = useCallback((
    sourceImage: ImageShape,
    targetImage: ImageShape,
    arrowIndex: number
  ): { startPoint: Point; endPoint: Point } => {
    // Calculate bounding boxes
    const sourceBounds = {
      left: sourceImage.x,
      right: sourceImage.x + sourceImage.width,
      top: sourceImage.y,
      bottom: sourceImage.y + sourceImage.height,
      centerX: sourceImage.x + sourceImage.width / 2,
      centerY: sourceImage.y + sourceImage.height / 2
    };

    const targetBounds = {
      left: targetImage.x,
      right: targetImage.x + targetImage.width,
      top: targetImage.y,
      bottom: targetImage.y + targetImage.height,
      centerX: targetImage.x + targetImage.width / 2,
      centerY: targetImage.y + targetImage.height / 2
    };

    // Calculate center-to-center direction
    const dx = targetBounds.centerX - sourceBounds.centerX;
    const dy = targetBounds.centerY - sourceBounds.centerY;

    let startPoint: Point, endPoint: Point;

    // Determine primary direction (which edges should connect)
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal separation is greater - use left/right edges
      if (dx > 0) {
        // Target is to the RIGHT of source
        startPoint = {
          x: sourceBounds.right,
          y: sourceBounds.centerY + (arrowIndex * 15) // Vertical offset for multiple arrows
        };
        endPoint = {
          x: targetBounds.left,
          y: targetBounds.centerY + (arrowIndex * 15)
        };
      } else {
        // Target is to the LEFT of source
        startPoint = {
          x: sourceBounds.left,
          y: sourceBounds.centerY + (arrowIndex * 15)
        };
        endPoint = {
          x: targetBounds.right,
          y: targetBounds.centerY + (arrowIndex * 15)
        };
      }
    } else {
      // Vertical separation is greater - use top/bottom edges
      if (dy > 0) {
        // Target is BELOW source
        startPoint = {
          x: sourceBounds.centerX + (arrowIndex * 15), // Horizontal offset for multiple arrows
          y: sourceBounds.bottom
        };
        endPoint = {
          x: targetBounds.centerX + (arrowIndex * 15),
          y: targetBounds.top
        };
      } else {
        // Target is ABOVE source
        startPoint = {
          x: sourceBounds.centerX + (arrowIndex * 15),
          y: sourceBounds.top
        };
        endPoint = {
          x: targetBounds.centerX + (arrowIndex * 15),
          y: targetBounds.bottom
        };
      }
    }

    return { startPoint, endPoint };
  }, []);

  /**
   * Creates reference arrows from reference images to generated image
   */
  // DEPRECATED: Arrows now rendered by CanvasArrows React component (SVG overlay)
  // Arrows automatically render from generationMetadata.referenceImageIds
  /*
  const createReferenceArrows = useCallback((
    generatedImage: ImageShape,
    referenceImageIds: string[]
  ) => {
    console.log('🎯 Creating reference arrows:', {
      from: referenceImageIds.length,
      to: generatedImage.id,
      referenceIds: referenceImageIds
    });

    console.log('🔍 DEBUG: allShapes available:', allShapes.length);
    console.log('🔍 DEBUG: Looking for IDs:', referenceImageIds);

    // Find reference shapes on canvas
    const referenceShapes = allShapes.filter(
      shape => shape.type === 'image' && referenceImageIds.includes(shape.id)
    ) as ImageShape[];

    console.log('🔍 DEBUG: Found reference shapes:', referenceShapes.length, referenceShapes.map(s => s.id));

    if (referenceShapes.length === 0) {
      console.warn('⚠️ Reference images not found - may have been deleted');
      console.warn('⚠️ Available image shapes:', allShapes.filter(s => s.type === 'image').map(s => s.id));
      return;
    }

    // Create arrow from each reference image
    referenceShapes.forEach((refImage, index) => {
      // Calculate edge-to-edge points using helper function
      const { startPoint, endPoint } = calculateEdgeToEdgePoints(refImage, generatedImage, index);

      // Create arrow with custom styling
      const arrowId = `arrow-ref-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;

      const arrowShape: ArrowShape = {
        id: arrowId,
        type: 'arrow',
        x: startPoint.x,
        y: startPoint.y,
        points: [startPoint, endPoint],
        rotation: 0,
        style: {
          stroke: '#ff6b6b',
          strokeWidth: 3,
          opacity: 0.6,
          lineDash: [10, 5],
          fill: '#ff6b6b'
        },
        locked: false,
        visible: true,
        connectionMetadata: {
          sourceImageId: refImage.id,
          targetImageId: generatedImage.id,
          arrowIndex: index
        }
      };

      onAddShape(arrowShape);
      console.log(`✅ Created reference arrow ${index + 1}/${referenceShapes.length}`);
    });

    console.log(`🎯 Created ${referenceShapes.length} reference arrows`);
  }, [allShapes, onAddShape, calculateEdgeToEdgePoints]);
  */

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

    // Merge with uploaded images
    const allImages = [...selectedImagesData, ...uploadedImages.map(img => ({
      id: img.id,
      url: img.url
    }))];

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      selectedImages: allImages.length > 0 ? allImages : undefined,
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

      // Also convert uploaded images to base64 metadata
      const uploadedImagesBase64: SelectedImageMetadata[] = [];
      for (const uploaded of uploadedImages) {
        try {
          const response = await fetch(uploaded.url);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Get image dimensions
          const img = new Image();
          img.src = uploaded.url;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });

          uploadedImagesBase64.push({
            id: uploaded.id,
            base64: base64.replace(/^data:image\/\w+;base64,/, ''),
            description: `Uploaded image - ${img.naturalWidth}x${img.naturalHeight}px`,
            width: img.naturalWidth || 512,
            height: img.naturalHeight || 512,
            area: (img.naturalWidth || 512) * (img.naturalHeight || 512),
            aspectRatio: (img.naturalWidth || 512) / (img.naturalHeight || 512)
          });
          console.log(`📷 Processed uploaded image: ${uploaded.url}`);
        } catch (error) {
          console.error('Failed to process uploaded image:', error);
        }
      }

      // Combine all images for compositing
      const allImagesForCompositing = [...selectedImages, ...uploadedImagesBase64];

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

      // Append all images for compositing (selected + uploaded)
      if (allImagesForCompositing.length > 0) {
        formData.append('selectedImages', JSON.stringify(allImagesForCompositing));
        console.log(`📷 Attached ${allImagesForCompositing.length} images for compositing (${selectedImages.length} selected + ${uploadedImagesBase64.length} uploaded)`);
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
          // === DEBUG: Check placeholder state before removal ===
          console.log('🔍 DEBUG: Checking placeholders for removal:', {
            activePlaceholdersLength: activePlaceholders.length,
            activePlaceholdersRef: activePlaceholdersRef.current,
            hasGeneratedImages: data.generatedImages?.length > 0,
            onRemovePlaceholderDefined: !!onRemovePlaceholder
          });

          // === REMOVE PLACEHOLDERS BEFORE ADDING REAL IMAGES ===
          const currentPlaceholders = activePlaceholdersRef.current;
          if (currentPlaceholders.length > 0 && data.generatedImages && data.generatedImages.length > 0) {
            console.log('🗑️ Removing placeholders before adding real images:', currentPlaceholders);

            // Stop animations and remove all active placeholders
            currentPlaceholders.forEach(placeholderId => {
              stopPlaceholderAnimation(placeholderId);
              onRemovePlaceholder?.(placeholderId);
            });

            // Clear the placeholder tracking
            setActivePlaceholders([]);
            activePlaceholdersRef.current = [];
            console.log('✅ All placeholders removed');
          }

          // Handle canvas actions with real images
          await handleCanvasActions(data.actions || [], data.generatedImages || []);
        }

        // === NEW: Cleanup orphaned placeholders ===
        // If placeholder was created but no images generated (AI returned text instead)
        if (placeholderId && (!data.generatedImages || data.generatedImages.length === 0)) {
          console.log('🗑️ Removing orphaned placeholder - no images generated:', placeholderId);
          stopPlaceholderAnimation(placeholderId);
          onRemovePlaceholder?.(placeholderId);
          setActivePlaceholders(prev => prev.filter(id => id !== placeholderId));
          activePlaceholdersRef.current = activePlaceholdersRef.current.filter(id => id !== placeholderId);
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

        // Clear uploaded images after successful send
        setUploadedImages([]);
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
  }, [messages, isLoading, buildCanvasContext, brandBible, handleCanvasActions, onCaptureCanvas, getSelectedImagesBase64, getSelectedImageShapes, selectedShapes, detectImageGeneration, addGenerationPlaceholder, replacePlaceholderWithImage, onUpdateShape, createErrorPlaceholderSVG, stopPlaceholderAnimation, uploadedImages]);

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
      className="fixed left-[68px] top-0 h-screen w-[380px] bg-[#0a0a0a] border-r border-[#2a2a2a] z-50 flex flex-col"
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
                className={`${message.role === 'user' ? 'flex justify-end items-end gap-2' : 'mr-4'}`}
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
                      ? 'bg-gray-900 text-white max-w-[80%] inline-block'
                      : 'text-gray-200'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <MarkdownMessage content={cleanMarkdownImages(message.content)} />
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}

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

                  {/* Generated Images - for both user and assistant messages */}
                  {/* {message.images && message.images.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.images.map((img, i) => (
                        <div key={i} className="rounded-lg overflow-hidden border border-[#3a3a3a]">
                          <img
                            src={img.url}
                            alt={img.prompt || 'Generated image'}
                            className="w-full h-auto"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )} */}
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

        {/* Uploaded Images Thumbnails */}
        {uploadedImages.length > 0 && (
          <div className="mb-2">
            <div className="text-xs text-gray-400 mb-2">Uploaded Images</div>
            <div className="flex items-center gap-2 flex-wrap">
              {uploadedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-purple-500/50 flex-shrink-0 group"
                >
                  <img
                    src={img.url}
                    alt="Uploaded"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {/* Remove button */}
                  <button
                    onClick={() => removeUploadedImage(img.id)}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-bl px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uploading Images Indicator */}
        {uploadingImages.size > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Uploading {uploadingImages.size} image(s)...</span>
            </div>
          </div>
        )}

        {/* Hidden file input for image upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
          multiple
          className="hidden"
        />

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
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#2a2a2a]">
            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Upload image"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Send Button */}
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
