'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Send, Paperclip, Sparkles, RefreshCw, Info, ArrowUp } from 'lucide-react';
import { Shape, ImageShape, TextShape, ArrowShape, Point } from '@/lib/canvas/types';
import { findOptimalPlacement, findMultiPlacement } from '@/lib/canvas/placementUtils';
import MarkdownMessage from './MarkdownMessage';
import { MarkerResultChip, MarkerResult } from './MarkerResultChip';
import { MarkerChipWithDropdown } from './MarkerChipWithDropdown';
import { useCredits } from './CreditsDisplay';
import CreditsDisplay from './CreditsDisplay';
import SubscriptionTiersPopup from './SubscriptionTiersPopup';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  phase?: 'STRATEGY' | 'EXECUTION' | 'REFINEMENT';
  images?: { url: string; prompt: string }[];
  selectedImages?: { id: string; url: string }[];
  actions?: CanvasAction[];
  markerData?: {
    imageUrl: string;
    label: string;
    bbox: number[]; // [x1, y1, x2, y2] in normalized [0, 1] coordinates
  };
  timestamp: Date;
  // Streaming response fields
  acknowledgement?: string;
  description?: string;
  isGenerating?: boolean;
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
  onNewCanvas?: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Quick template presets
const QUICK_TEMPLATES = [
  {
    id: 'gradient-banner',
    name: 'Gradient hero banner',
    description: 'Colorful gradient background',
    prompt: 'Create a modern gradient hero banner for my brand',
    image: '/templates/Capture.PNG',
    static: true,
    position: 'right-6 top-1/2 -translate-y-1/2'
  },
  {
    id: '3d-abstract',
    name: '3D abstract shape',
    description: 'Modern 3D geometric shapes',
    prompt: 'Render a high-quality 3D abstract shape',
    image: '/templates/image-removebg-preview.png',
    static: true,
    dimensions: 'w-36 h-36',
    position: 'right-1 top-1/2 -translate-y-1/2'
  },
  {
    id: 'botanical',
    name: 'Botanical pattern',
    description: 'Nature-inspired patterns',
    prompt: 'Design a seamless botanical floral pattern',
    image: '/templates/botanical pattern.png',
    static: true,
    dimensions: 'w-44 h-44',
    position: 'right-[-25px] top-1/2 -translate-y-1/2'
  },
  {
    id: 'doodle',
    name: 'Doodle element set',
    description: 'Hand-drawn style elements',
    prompt: 'Generate hand-drawn doodle design elements',
    image: '/templates/doodle element set.png',
    static: true,
    dimensions: 'w-28 h-28',
    position: 'right-0 top-1/2 -translate-y-1/2'
  }
];

interface QuickTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  image: string;
  static?: boolean;
  dimensions?: string;
  position?: string;
}


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
  onNewCanvas
}) => {
  // === HELPER COMPONENT: Image Chip with Hover Preview ===
  const ImageChip = ({
    imageUrl,
    name,
    onRemove,
    borderColor = 'border-gray-200'
  }: {
    imageUrl: string;
    name: string;
    onRemove?: () => void;
    borderColor?: string;
  }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div className="relative inline-flex items-center">
        {/* Hover Preview */}
        {isHovered && (
          <div
            className="absolute bottom-full left-0 mb-2 w-48 h-48 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{ pointerEvents: 'none' }}
          >
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          </div>
        )}

        {/* The Chip */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`flex items-center gap-2 px-2 py-1 bg-white border ${borderColor} rounded-full transition-shadow hover:shadow-sm cursor-default`}
        >
          <div className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0 border border-gray-100">
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="text-[13px] text-gray-600 max-w-[100px] truncate leading-none pt-[1px]">
            {name}
          </span>
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-0.5 hover:bg-gray-100 rounded-full transition-colors ml-0.5"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    );
  };

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
  const { credits, refreshCredits } = useCredits();
  const [showSubscriptionPopup, setShowSubscriptionPopup] = useState(false);
  const currentReferenceIdsRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allShapesRef = useRef<Shape[]>(allShapes);
  // Track processed image URLs to prevent duplicates across re-renders
  const processedImageUrlsRef = useRef<Set<string>>(new Set());

  // Marker results state
  const [markerResults, setMarkerResults] = useState<MarkerResult[]>([]);
  const [analyzingMarkers, setAnalyzingMarkers] = useState<Set<string>>(new Set());
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);

  // Resize state
  const [panelWidth, setPanelWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  // Sync allShapesRef when allShapes changes
  useEffect(() => {
    allShapesRef.current = allShapes;
  }, [allShapes]);

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

  // Handle Resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      // Calculate new width: mouse X - panel start X (75px)
      const newWidth = e.clientX - 75;

      // Limit width between 300px and 450px
      if (newWidth >= 300 && newWidth <= 450) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      isResizingRef.current = false;
      document.body.style.cursor = 'default';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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

  // Handle marker analysis start - create loading marker result immediately
  const handleMarkerAnalyzing = useCallback((markerData: any) => {
    console.log('🔍 handleMarkerAnalyzing called:', markerData);

    if (!markerData.imageUrl) {
      console.warn('⚠️ No imageUrl in marker data:', markerData);
      return;
    }

    // Create loading marker result immediately
    const loadingResult: MarkerResult = {
      markerId: markerData.id,
      markerNumber: markerData.number,
      label: 'Analyzing...',
      imageUrl: markerData.imageUrl,
      markerPosition: {
        x: markerData.normalizedX,
        y: markerData.normalizedY
      },
      detections: [],
      selectedDetectionIndex: 0,
      isLoading: true
    };

    // Add to results immediately
    setMarkerResults(prev => {
      // Check if marker already exists (shouldn't happen, but be safe)
      const exists = prev.find(m => m.markerId === markerData.id);
      if (exists) return prev;
      return [...prev, loadingResult];
    });

    console.log('✅ Loading marker result created:', loadingResult);
  }, []);

  // Handle marker analysis results
  const handleMarkerAnalyzed = useCallback((markerData: any) => {
    console.log('🔍 handleMarkerAnalyzed called:', markerData);

    // Use imageUrl directly from marker data (no need to look up in allShapes)
    if (!markerData.imageUrl) {
      console.warn('⚠️ No imageUrl in marker data:', markerData);
      return;
    }

    // Handle empty or missing detections - use objectName as fallback
    let label = markerData.objectName || 'Unknown';
    let zoomRegion = null;
    let detections = markerData.detections || [];

    // If we have detections, use first one
    if (detections.length > 0) {
      label = detections[0].label;
      zoomRegion = detections[0].bbox;
    } else {
      console.warn('⚠️ No detections for marker, using objectName:', label);
    }

    // Update existing marker result (should already exist from analyzing event)
    setMarkerResults(prev => prev.map(m =>
      m.markerId === markerData.id
        ? {
          ...m,
          label: label,
          zoomRegion: zoomRegion,
          detections: detections,
          selectedDetectionIndex: 0,
          isLoading: false
        }
        : m
    ));

    // Remove from analyzing set
    setAnalyzingMarkers(prev => {
      const next = new Set(prev);
      next.delete(markerData.id);
      return next;
    });

    console.log('✅ Marker result updated:', { markerId: markerData.id, label, detectionsCount: detections.length });
  }, []);

  // Listen for marker events from CanvasCanvas
  useEffect(() => {
    const handleMarkerEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { type, marker } = customEvent.detail;

      if (type === 'marker-analyzing') {
        handleMarkerAnalyzing(marker);
        setAnalyzingMarkers(prev => new Set(prev).add(marker.id));
      } else if (type === 'marker-analyzed') {
        console.log('📥 Received marker-analyzed event:', marker);
        handleMarkerAnalyzed(marker);
      } else if (type === 'marker-error') {
        // Remove from analyzing on error and update marker
        setMarkerResults(prev => prev.map(m =>
          m.markerId === marker.id
            ? { ...m, label: 'Error', isLoading: false }
            : m
        ));
        setAnalyzingMarkers(prev => {
          const next = new Set(prev);
          next.delete(marker.id);
          return next;
        });
      }
    };

    window.addEventListener('marker-event', handleMarkerEvent);
    return () => window.removeEventListener('marker-event', handleMarkerEvent);
  }, [handleMarkerAnalyzing, handleMarkerAnalyzed]);

  // Handle marker selection for chat context
  const handleSelectMarker = useCallback((markerId: string, detectionIndex?: number) => {
    setSelectedMarkerId(markerId);

    const marker = markerResults.find(m => m.markerId === markerId);
    if (!marker) return;

    // If detectionIndex provided, update the marker to use that detection
    if (detectionIndex !== undefined && marker.detections && marker.detections[detectionIndex]) {
      const selectedDetection = marker.detections[detectionIndex];

      // Update the marker with the selected detection
      setMarkerResults(prev => prev.map(m =>
        m.markerId === markerId
          ? {
            ...m,
            label: selectedDetection.label,
            zoomRegion: selectedDetection.bbox,
            selectedDetectionIndex: detectionIndex
          }
          : m
      ));

      console.log(`✅ Changed marker #${marker.markerNumber} to: ${selectedDetection.label}`);
    }

    // Get the selected detection (default to first if not specified)
    const selectedDetection = detectionIndex !== undefined && marker.detections
      ? marker.detections[detectionIndex]
      : marker.detections?.[0] || { label: marker.label };

    // Pre-fill input with marker context
    const markerContext = `Tell me more about the ${selectedDetection.label} marked as #${marker.markerNumber}.`;

    if (inputRef.current) {
      inputRef.current.value = markerContext;
      setInputValue(markerContext);
      inputRef.current.focus();
    }

    console.log(`🎯 Selected marker #${marker.markerNumber}: ${selectedDetection.label}`);
  }, [markerResults]);

  // Handle dropdown toggle
  const handleToggleDropdown = useCallback((markerId: string) => {
    setDropdownOpenId(prevId => prevId === markerId ? null : markerId);
  }, []);

  // Handle marker removal
  const handleRemoveMarker = useCallback((markerId: string) => {
    // Remove chip from chat panel
    setMarkerResults(prev => prev.filter(m => m.markerId !== markerId));

    // Clear selection if removing selected marker
    if (selectedMarkerId === markerId) {
      setSelectedMarkerId(null);
    }

    // Close dropdown if it was open
    if (dropdownOpenId === markerId) {
      setDropdownOpenId(null);
    }

    // Emit event to remove marker from canvas
    window.dispatchEvent(new CustomEvent('marker-delete', {
      detail: { markerId }
    }));
  }, [selectedMarkerId, dropdownOpenId]);

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
    console.log('🎨 handleCanvasActions called:', {
      actionsCount: actions.length,
      imagesCount: images.length,
      imageUrls: images.map(img => img.url.substring(0, 50))
    });

    // Handle generated images with smart placement
    // Handle generated images with smart placement
    if (images.length > 0) {
      // Deduplicate images to prevent double-generation of the same image
      // Also check against global processed set to prevent duplicates across re-renders
      const uniqueImages = images.filter((img, index, self) => {
        const isFirstInList = index === self.findIndex((t) => t.url === img.url);
        const isNotProcessed = !processedImageUrlsRef.current.has(img.url);
        return isFirstInList && isNotProcessed;
      });

      const skippedCount = images.length - uniqueImages.length;
      console.log(`🎨 Processing ${uniqueImages.length} generated images (skipped ${skippedCount} duplicates)...`);

      // Mark these as processed immediately to prevent concurrent handling
      uniqueImages.forEach(img => processedImageUrlsRef.current.add(img.url));

      // Load all images first to get actual dimensions
      const imageData: Array<{
        url: string;
        prompt: string;
        width: number;
        height: number;
      }> = [];

      for (const image of uniqueImages) {
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


      // Find optimal positions for all images at once using smart placement
      console.log('📍 Finding optimal placements for images...');
      const positions = findMultiPlacement(
        imageData.map(img => ({ width: img.width, height: img.height })),
        allShapesRef.current, // Use ref
        selectedShapes, // Reference shapes
        [], // No longer exclude placeholders
        {
          minGap: 2,
          preferredGap: 10,
          maxIterations: 50,
          spiralStep: 20,
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
        // Sync ref immediately to avoid overlap in same cycle if this is called multiple times
        allShapesRef.current = [...allShapesRef.current, imageShape];
        console.log('✅ Image added to canvas:', imageId);

        // Arrows now render automatically from CanvasArrows component based on generationMetadata.referenceImageIds
      }
    }

    // Handle other actions (text, shapes, modifications)
    // Prevent duplicate images: Filter out 'add' actions for images if we already have generated images
    const filteredActions = images.length > 0
      ? actions.filter(a => !(a.type === 'add' && (a.asset_type === 'image' || a.content?.includes('<img'))))
      : actions;

    for (const action of filteredActions) {
      if (action.type === 'add') {
        if (action.asset_type === 'text' && action.content) {
          // Use smart placement for text as well
          const position = findOptimalPlacement(
            300, // Default text width
            50,  // Default text height
            allShapesRef.current,
            selectedShapes,
            [], // No longer exclude placeholders
            { minGap: 2, preferredGap: 10 }
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
          allShapesRef.current = [...allShapesRef.current, newShape];
        }
      } else if (action.type === 'modify' && action.element_id && action.updates) {
        console.log('🔧 Modifying element:', action.element_id, action.updates);
        onUpdateShape(action.element_id, action.updates as Partial<Shape>);
        // Update ref for modifications too
        allShapesRef.current = allShapesRef.current.map(s =>
          s.id === action.element_id ? { ...s, ...action.updates } as Shape : s
        );
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
  const detectImageGeneration = useCallback((message: string, shapes: Shape[], markerResults: MarkerResult[] = []): boolean => {
    console.log('🔍 detectImageGeneration called:', {
      message: message.substring(0, 100),
      markerCount: markerResults.length,
      shapesCount: shapes.length
    });

    // NEW: Check for active markers FIRST (marker-based editing always generates images)
    if (markerResults.length > 0) {
      console.log('✅ Marker-based generation detected');
      return true;
    }

    // NEW: Check for marker pattern in text (e.g., [@image:#1:label])
    const markerPattern = /\[@image:#\d+:[^\]]+\]/g;
    if (markerPattern.test(message)) {
      console.log('✅ Marker pattern found in message text');
      return true;
    }

    const lowerMessage = message.toLowerCase();

    // HIGH CONFIDENCE ONLY - explicit generation commands
    const explicitGenerationCommands = [
      'generate image', 'create image', 'generate a', 'create a', 'make a',
      'design a', 'render a', 'paint a', 'draw a',
      'paint', 'draw', 'composite', 'merge images', 'blend images',
      'combine images', 'design me', 'give me a'
    ];

    // Check for explicit phrases first
    if (explicitGenerationCommands.some(cmd => lowerMessage.includes(cmd))) {
      return true;
    }

    // Single words only if with "image/photo/picture" or other visual nouns
    const singleWords = ['generate', 'create', 'make', 'design', 'render', 'draw', 'paint', 'composite', 'blend', 'merge', 'new'];
    const imageNouns = [
      'image', 'photo', 'picture', 'visual', 'illustration', 'graphic',
      'pattern', 'background', 'banner', 'logo', 'icon', 'art', 'sketch',
      'doodle', 'elements', 'element', 'mockup', 'poster', 'canvas', 'wallpaper', 'asset'
    ];

    const hasSingleWord = singleWords.some(w => lowerMessage.includes(w));
    const hasImageNoun = imageNouns.some(n => lowerMessage.includes(n));

    if (hasSingleWord && hasImageNoun) {
      console.log('✅ Verb + Noun generation detected');
      return true;
    }

    // NEW: Check for common visual keywords anywhere in the message
    const visualKeywords = [
      'pattern', 'background', 'banner', 'logo', 'icon', 'illustration',
      'graphic', 'doodle', 'mockup', 'poster', 'wallpaper', 'texture',
      'hand-drawn', 'element', 'branding', 'identity', 'sticker'
    ];
    if (visualKeywords.some(k => lowerMessage.includes(k))) {
      console.log('✅ Visual keyword detected:', visualKeywords.find(k => lowerMessage.includes(k)));
      return true;
    }

    // Special cases for single words that almost always mean generation in this context
    const commandStarts = ['generate ', 'render ', 'draw ', 'paint ', 'create ', 'make ', 'design '];
    if (commandStarts.some(cmd => lowerMessage.startsWith(cmd))) {
      console.log('✅ Command-start generation detected');
      return true;
    }

    console.log('❌ No image generation detected for message');
    return false;
  }, []);

  /**
   * Creates an animated loading placeholder SVG frame
   * @param frame - Current frame number (0-11) for 12-frame animation cycle
   */
  const createLoadingPlaceholderSVG = useCallback((frame: number = 0): string => {
    // Subtle pulse for the border
    const borderOpacity = 0.6 + Math.sin(frame * 0.5) * 0.2;
    const textOpacity = 0.8 + Math.cos(frame * 0.3) * 0.1;

    const svg = `
      <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="400" fill="transparent" />
        
        <!-- Main Card Body -->
        <rect x="10" y="10" width="380" height="380" rx="32" fill="#ffffff" />
        <rect x="10" y="10" width="380" height="380" rx="32" fill="#f8fafc" opacity="0.8" />
        
        <!-- Border with pulse -->
        <rect x="10" y="10" width="380" height="380" rx="32" 
              fill="none" stroke="#3b82f6" stroke-width="8" 
              opacity="${borderOpacity}" />
        
        <!-- Text "Generating" -->
        <text x="200" y="215" text-anchor="middle" 
              font-family="'Poppins', 'Inter', system-ui, sans-serif" 
              font-size="44" fill="#1e293b" font-weight="700"
              opacity="${textOpacity}">
          Generating
        </text>
        
        <!-- Subtle loading indicator -->
        <circle cx="180" cy="270" r="6" fill="#3b82f6" opacity="${frame % 3 === 0 ? 1 : 0.3}" />
        <circle cx="200" cy="270" r="6" fill="#3b82f6" opacity="${frame % 3 === 1 ? 1 : 0.3}" />
        <circle cx="220" cy="270" r="6" fill="#3b82f6" opacity="${frame % 3 === 2 ? 1 : 0.3}" />
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

    // Smart placement using collision detection - use portrait orientation like the screenshot
    const PLACEHOLDER_WIDTH = 380;
    const PLACEHOLDER_HEIGHT = 480;

    // Find optimal placement using smart algorithm
    const position = findOptimalPlacement(
      PLACEHOLDER_WIDTH,
      PLACEHOLDER_HEIGHT,
      allShapesRef.current, // Use ref for sync tracking
      selectedShapes, // Reference shapes
      [], // No longer exclude placeholders to prevent overlap
      {
        minGap: 2,
        preferredGap: 10,
        maxIterations: 50,
        spiralStep: 20,
      }
    );

    console.log(`🎯 Smart placement for placeholder at (${position.x}, ${position.y})`);

    // Create placeholder image shape (src is ignored by custom engine drawer for placeholders)
    const placeholderShape: ImageShape = {
      id: placeholderId,
      type: 'image',
      x: position.x,
      y: position.y,
      width: PLACEHOLDER_WIDTH,
      height: PLACEHOLDER_HEIGHT,
      src: '', // Will be rendered as animation by CanvasEngine
      style: { opacity: 1 }
    };

    // Add to canvas immediately
    onAddShape(placeholderShape);
    allShapesRef.current = [...allShapesRef.current, placeholderShape];
    console.log('🎨 Added loading placeholder shape:', placeholderId);

    // No longer using setInterval here - animation will be handled by the engine
    // But we still need to trigger occasional re-renders if the engine isn't auto-animating
    // For now, let's keep a slower interval just to ensure canvas refreshes
    const animationInterval = setInterval(() => {
      onUpdateShape(placeholderId, { style: { opacity: 0.99 + Math.random() * 0.01 } });
    }, 150);

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

    // Check if user has enough credits
    if (credits !== null && credits <= 0) {
      // Show subscription popup instead of just a message
      setShowSubscriptionPopup(true);
      setInputValue('');
      return;
    }

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

    // Build mention_list from ALL active markerResults (Phase 5: Auto-attach markers)
    const mentionList = markerResults
      .filter(marker => marker.zoomRegion) // Only include markers with valid bbox
      .map((marker, index) => ({
        type: "image",
        value: `element-image-${marker.markerId}`,
        label: marker.label,
        thumbnail: marker.imageUrl,
        source: "mark",
        bbox: [
          marker.zoomRegion!.x,
          marker.zoomRegion!.y,
          marker.zoomRegion!.x + marker.zoomRegion!.width,
          marker.zoomRegion!.y + marker.zoomRegion!.height
        ]
      }));

    // Build image_list from markers
    const imageList = mentionList.map(mention => ({
      image_url: mention.thumbnail
    }));

    // Update message text to include marker references
    let finalMessageText = messageText;
    if (mentionList.length > 0) {
      const refs = mentionList
        .map((m, i) => `[@image:#${i + 1}:${m.label}]`)
        .join(' ');
      finalMessageText = `${refs} ${messageText}`;
    }

    // Store markerData in message for display (first marker only for now)
    const firstMarker = markerResults.find(m => m.zoomRegion);
    const markerDataForDisplay = firstMarker && firstMarker.zoomRegion ? {
      imageUrl: firstMarker.imageUrl,
      label: firstMarker.label,
      bbox: [
        firstMarker.zoomRegion.x,
        firstMarker.zoomRegion.y,
        firstMarker.zoomRegion.x + firstMarker.zoomRegion.width,
        firstMarker.zoomRegion.y + firstMarker.zoomRegion.height
      ]
    } : undefined;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: finalMessageText,
      selectedImages: allImages.length > 0 ? allImages : undefined,
      markerData: markerDataForDisplay,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Clear markers after sending message
    if (markerResults.length > 0) {
      console.log('🧹 Clearing markers after message sent');

      // Remove all markers from canvas
      markerResults.forEach(marker => {
        window.dispatchEvent(new CustomEvent('marker-delete', {
          detail: { markerId: marker.markerId }
        }));
      });

      // Clear marker state
      setMarkerResults([]);
    }

    // NEW: Debug logging before detection
    console.log('🔍 DEBUG: Detection phase:', {
      messageText,
      hasMarkers: markerResults.length > 0,
      markerCount: markerResults.length,
      markerLabels: markerResults.map(m => m.label),
      selectedShapes: selectedShapes.length
    });

    setIsLoading(true);

    // === PLACEHOLDER LOGIC: Detect if image generation expected ===
    // Declare outside try block so it's accessible in catch
    const willGenerateImage = detectImageGeneration(messageText, selectedShapes, markerResults);
    let placeholderId: string | null = null;

    if (willGenerateImage) {
      console.log('🎨 Image generation detected - adding placeholder:', {
        reason: markerResults.length > 0 ? 'markers' : 'keywords',
        markerCount: markerResults.length
      });
      placeholderId = addGenerationPlaceholder();
      console.log('✅ Placeholder created:', placeholderId);
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
      formData.append('message', finalMessageText); // Use finalMessageText with marker references
      formData.append('conversationHistory', JSON.stringify(
        messages.map(m => ({ role: m.role, content: m.content }))
      ));
      formData.append('canvasContext', JSON.stringify(buildCanvasContext()));

      // Append mention_list and image_list if markers present (Phase 5)
      if (mentionList.length > 0) {
        formData.append('mention_list', JSON.stringify(mentionList));
        formData.append('image_list', JSON.stringify(imageList));
        console.log('🎯 Attached marker data (reference agent format):', {
          markers: mentionList.length,
          labels: mentionList.map(m => m.label)
        });
      }

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

      // Append marker data if present (image, label, bbox coordinates)
      if (userMessage.markerData) {
        formData.append('markerData', JSON.stringify(userMessage.markerData));
        console.log('🎯 Attached marker data:', {
          label: userMessage.markerData.label,
          bbox: userMessage.markerData.bbox
        });
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

      // Check HTTP status before parsing JSON
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // NEW: Debug logging for response
      console.log('🔍 DEBUG: Full backend response:', {
        success: data.success,
        hasResponse: !!data.response,
        hasActions: !!data.actions,
        actionsLength: data.actions?.length || 0,
        hasGeneratedImages: !!data.generatedImages,
        generatedImagesLength: data.generatedImages?.length || 0,
        markerContext: data.markerContext
      });

      if (data.success) {
        // NEW: Validate generatedImages structure
        if (data.generatedImages && data.generatedImages.length > 0) {
          console.log('✅ Generated images received:', data.generatedImages.map((img: any) => ({
            hasUrl: !!img.url,
            hasPrompt: !!img.prompt,
            urlPreview: img.url?.substring(0, 50)
          })));
        }

        // Update brand bible if returned
        if (data.brandBible) {
          setBrandBible(data.brandBible);
        }

        // NEW: Explicit condition checks
        const hasActions = Array.isArray(data.actions) && data.actions.length > 0;
        const hasImages = Array.isArray(data.generatedImages) && data.generatedImages.length > 0;

        console.log('🔍 Processing check:', { hasActions, hasImages });

        // Handle canvas actions
        if (hasActions || hasImages) {
          // === DEBUG: Check placeholder state before removal ===
          console.log('🔍 DEBUG: Checking placeholders for removal:', {
            activePlaceholdersLength: activePlaceholders.length,
            activePlaceholdersRef: activePlaceholdersRef.current,
            hasGeneratedImages: data.generatedImages?.length > 0,
            onRemovePlaceholderDefined: !!onRemovePlaceholder
          });

          // Handle canvas actions with real images FIRST
          // This keeps the placeholders on screen until the real images are ready
          try {
            await handleCanvasActions(data.actions || [], data.generatedImages || []);
          } catch (canvasError) {
            console.error('Canvas action error:', canvasError);
          }

          // === REMOVE PLACEHOLDERS AFTER ADDING REAL IMAGES ===
          const currentPlaceholders = activePlaceholdersRef.current;
          if (currentPlaceholders.length > 0 && data.generatedImages && data.generatedImages.length > 0) {
            console.log('🗑️ Removing placeholders after adding real images:', currentPlaceholders);

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

        // Refresh credits after successful request
        refreshCredits();

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

      // Check for insufficient credits error
      if (error instanceof Error && (
        error.message?.includes('Insufficient credits') ||
        error.message?.includes('insufficient credits')
      )) {
        setShowSubscriptionPopup(true);
        return;
      }

      // === PLACEHOLDER LOGIC: Show error state on placeholder ===
      if (placeholderId) {
        console.log('⚠️ Updating placeholder with error state');
        // Stop the animation first
        stopPlaceholderAnimation(placeholderId);
        try {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          onUpdateShape(placeholderId, {
            src: createErrorPlaceholderSVG(errorMsg + '\n\n(Click to remove)'),
            style: { opacity: 0.5 }
          });
        } catch (updateError) {
          console.error('❌ Failed to update placeholder with error:', updateError);
        }
      }

      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: error instanceof Error
          ? `I encountered an error: ${error.message}. Click the error placeholder on canvas to remove it, then try rephrasing your request.`
          : 'Sorry, an unexpected error occurred. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, buildCanvasContext, brandBible, handleCanvasActions, onCaptureCanvas, getSelectedImagesBase64, getSelectedImageShapes, selectedShapes, detectImageGeneration, addGenerationPlaceholder, replacePlaceholderWithImage, onUpdateShape, createErrorPlaceholderSVG, stopPlaceholderAnimation, uploadedImages]);

  // ===================================================================
  // STREAMING SEND MESSAGE - Progressive response with SSE
  // ===================================================================
  const sendMessageStreaming = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    // Check credits
    if (credits !== null && credits <= 0) {
      setShowSubscriptionPopup(true);
      setInputValue('');
      return;
    }

    // Get selected images
    const selectedImageShapes = getSelectedImageShapes();
    const selectedImagesData = selectedImageShapes.map(img => ({
      id: img.id,
      url: img.src
    }));
    const allImages = [...selectedImagesData, ...uploadedImages.map(img => ({
      id: img.id,
      url: img.url
    }))];

    // Add user message
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

    // Clear markers after sending message
    if (markerResults.length > 0) {
      console.log('🧹 Clearing markers after streaming message sent');
      markerResults.forEach(marker => {
        window.dispatchEvent(new CustomEvent('marker-delete', {
          detail: { markerId: marker.markerId }
        }));
      });
      setMarkerResults([]);
    }

    // === PLACEHOLDER LOGIC: Detect if image generation expected ===
    const willGenerateImage = detectImageGeneration(messageText, selectedShapes, markerResults);
    let placeholderId: string | null = null;

    if (willGenerateImage) {
      console.log('🎨 Streaming: Image generation detected - adding placeholder');
      placeholderId = addGenerationPlaceholder();
    }

    // Create placeholder assistant message for streaming updates
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      acknowledgement: '',
      isGenerating: false,
      images: [],
      description: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Capture canvas
      const canvasBlob = await onCaptureCanvas();

      // Get selected images for compositing
      const selectedImages = await getSelectedImagesBase64();

      // Build FormData
      const formData = new FormData();
      formData.append('message', messageText);
      formData.append('conversationHistory', JSON.stringify(
        messages.map(m => ({ role: m.role, content: m.content }))
      ));
      formData.append('canvasContext', JSON.stringify(buildCanvasContext()));

      if (brandBible) {
        formData.append('brandBible', JSON.stringify(brandBible));
      }
      if (projectId) {
        formData.append('projectId', projectId);
      }
      if (selectedImages.length > 0) {
        formData.append('selectedImages', JSON.stringify(selectedImages));
      }
      if (canvasBlob) {
        formData.append('canvasImage', canvasBlob, 'canvas-capture.png');
      }

      // Get auth token
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Stream response using fetch with ReadableStream
      const response = await fetch(`${API_BASE_URL}/ai-chat/stream`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let generatedImagesReceived: { url: string; prompt: string; aspectRatio?: string }[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('📡 [STREAM] Received event:', data.type);

              setMessages(prev => prev.map(msg => {
                if (msg.id !== assistantMessageId) return msg;

                switch (data.type) {
                  case 'acknowledgement':
                    return {
                      ...msg,
                      acknowledgement: data.text,
                      content: data.text
                    };

                  case 'generating':
                    return { ...msg, isGenerating: true };

                  case 'images':
                    generatedImagesReceived = data.generatedImages || [];
                    // Also add to canvas
                    if (generatedImagesReceived.length > 0) {
                      handleCanvasActions([], generatedImagesReceived);

                      // Remove our placeholder now that we have real images
                      if (placeholderId) {
                        onRemovePlaceholder?.(placeholderId);
                        setActivePlaceholders(prev => prev.filter(id => id !== placeholderId));
                        activePlaceholdersRef.current = activePlaceholdersRef.current.filter(id => id !== placeholderId);
                        placeholderId = null; // Prevent duplicate removal
                      }
                    }
                    return {
                      ...msg,
                      isGenerating: false,
                      images: generatedImagesReceived
                    };

                  case 'description':
                    return {
                      ...msg,
                      description: data.text,
                      content: (msg.acknowledgement || '') + '\n\n' + data.text
                    };

                  case 'error':
                    // Cleanup placeholder on error
                    if (placeholderId) {
                      onRemovePlaceholder?.(placeholderId);
                      setActivePlaceholders(prev => prev.filter(id => id !== placeholderId));
                      activePlaceholdersRef.current = activePlaceholdersRef.current.filter(id => id !== placeholderId);
                    }
                    return {
                      ...msg,
                      isGenerating: false,
                      content: `Error: ${data.message || data.text || 'Unknown error'}`
                    };

                  case 'done':
                    return { ...msg, isGenerating: false };

                  default:
                    return msg;
                }
              }));
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

      // Refresh credits
      refreshCredits();

      // Clear uploaded images
      setUploadedImages([]);

    } catch (error) {
      console.error('Streaming error:', error);

      // Update assistant message with error
      setMessages(prev => prev.map(msg => {
        if (msg.id !== assistantMessageId) return msg;
        return {
          ...msg,
          isGenerating: false,
          content: error instanceof Error
            ? `I encountered an error: ${error.message}`
            : 'Sorry, an unexpected error occurred.'
        };
      }));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, buildCanvasContext, brandBible, handleCanvasActions, onCaptureCanvas, getSelectedImagesBase64, getSelectedImageShapes, projectId, uploadedImages, credits, refreshCredits, detectImageGeneration, addGenerationPlaceholder, onRemovePlaceholder, markerResults, selectedShapes]);

  // Handle template click
  const handleTemplateClick = (template: typeof QUICK_TEMPLATES[0]) => {
    sendMessageStreaming(template.prompt); // Use streaming version
  };

  // Handle new chat
  const handleNewChat = () => {
    setMessages([]);
    setBrandBible(null);
    setInputValue('');
    setHistoryLoaded(true); // Don't trigger reload from useEffect
    onNewCanvas?.();
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageStreaming(inputValue); // Use streaming version
    }
  };

  // Render phase badge
  const renderPhaseBadge = (phase?: string) => {
    if (!phase) return null;

    const colors = {
      STRATEGY: 'bg-blue-500/20 text-blue-400',
      EXECUTION: 'bg-[#9d9eb152] text-[#00000080]',
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
    <>
      <div
        data-chat-panel
        className="fixed left-[75px] top-4 h-[calc(100vh-32px)] bg-white border border-[#dcdcdc] rounded-[30px] z-50 flex flex-col font-sans overflow-hidden py-1"
        style={{ fontWeight: 400, width: `${panelWidth}px` }}
      >
        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize group/resizer z-[60]"
          title="Drag to resize"
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-8 bg-gray-300 rounded-full group-hover/resizer:bg-gray-400 group-hover/resizer:h-12 transition-all" />
        </div>
        {/* Header - Minimal with Right Actions */}
        <div className="flex items-center justify-between px-[0.5rem] pt-[0.6rem] pb-[0.2rem] border-b border-[#00000021]">
          <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
            <img
              src="/assets/chat-logo.png"
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex items-center gap-4 text-gray-500">
            <div onClick={() => setShowSubscriptionPopup(true)} className="cursor-pointer flex items-center gap-1.5 hover:bg-gray-50 transition-colors px-3 py-1.5 border border-[#dcdcdc] rounded-full">
              <img src="/templates/credit.png" alt="credits" className="w-4 h-4 object-contain" />
              <span className="text-xs font-medium text-black">{credits !== null ? credits.toFixed(2) : '0.00'}</span>
            </div>

            <button onClick={handleNewChat} title="New chat" className="w-8 h-8 flex items-center justify-center rounded-full border border-[#dcdcdc] bg-white text-gray-500 hover:text-black hover:bg-gray-50 transition-all shadow-sm">
              <Plus className="w-4 h-4" />
            </button>

            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full border border-[#dcdcdc] bg-white text-gray-500 hover:text-black hover:bg-gray-50 transition-all shadow-sm">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Brand Bible (if active) */}
        {brandBible && (
          <div className="px-6 py-2">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-600 font-medium">Brand Bible Active</span>
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!hasMessages ? (
            /* Welcome Screen */
            <div className="px-6 pt-2">
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                  <RefreshCw className="w-8 h-8 text-gray-600 animate-spin mb-3" />
                  <p className="text-gray-500 text-sm">Loading...</p>
                </div>
              ) : (
                <>
                  {/* Welcome Text */}
                  <div className="mb-10 mt-4">
                    <h1 className="text-3xl text-black font-semibold mb-2">Hi there,</h1>
                    <h2 className="text-3xl text-gray-400 font-medium leading-tight">What are we creating today?</h2>
                  </div>

                  {/* Templates Grid */}
                  <div className="space-y-3">
                    {QUICK_TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateClick(template)}
                        className="w-full text-left p-4 bg-[#f7f7f7] border border-gray-200 rounded-2xl transition-all group relative overflow-hidden h-[110px] flex items-center justify-between hover:bg-[#eeeeee]"
                      >
                        <div className="z-10 relative max-w-[75%] pr-2">
                          <h3 className="text-black font-medium mb-1 group-hover:text-black transition-colors text-sm">{template.name}</h3>
                          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{template.description}</p>
                        </div>

                        <img
                          src={template.image}
                          alt=""
                          className={`absolute ${(template as any).dimensions || 'w-24 h-24'} object-contain transform opacity-90 transition-all duration-300 ${(template as any).position || ((template as any).static ? 'right-6 top-1/2 -translate-y-1/2' : 'right-[-5px] bottom-[-10px] rotate-6 group-hover:scale-110 group-hover:rotate-12')}`}
                          onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Chat Messages */
            <div className="px-5 py-4 space-y-6">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Minimal Layout for Messages */}
                  <div className={`max-w-[90%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>



                    {/* Message Bubble */}
                    <div
                      className={`text-sm leading-relaxed ${message.role === 'user'
                        ? 'bg-[#efefef] text-black px-4 py-2 rounded-2xl rounded-tr-sm'
                        : 'text-black px-1 py-1'
                        }`}
                    >
                      {/* Inline Marker Chip */}
                      {message.role === 'user' && message.markerData && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-600/30">
                          <img
                            src={message.markerData.imageUrl}
                            alt={message.markerData.label}
                            className="w-4 h-4 rounded-full object-cover ring-1 ring-white/20"
                          />
                          <span className="text-blue-300 text-xs font-medium">{message.markerData.label}</span>
                        </div>
                      )}

                      {message.role === 'assistant' ? (
                        <div className="space-y-3">
                          {/* Acknowledgement - shows immediately for streaming */}
                          {message.acknowledgement ? (
                            <div className="text-black/90">{message.acknowledgement}</div>
                          ) : (
                            <MarkdownMessage content={cleanMarkdownImages(message.content)} />
                          )}

                          {/* Skeleton loader - shows while generating (Updated to match screenshot) */}
                          {message.isGenerating && (
                            <div className="space-y-3">
                              <div className="rounded-2xl overflow-hidden border border-gray-100 bg-[#f3f4f6] shadow-sm">
                                <div
                                  className="w-full h-64 bg-gradient-to-r from-gray-100/50 via-gray-200/50 to-gray-100/50"
                                  style={{
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 2s infinite linear'
                                  }}
                                />
                                <div className="p-3 pb-4 bg-white/40 flex items-center gap-2 text-[13px] text-gray-400 font-medium">
                                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full shadow-[0_0_8px_rgba(192,132,252,0.6)] animate-pulse" />
                                  <span>Generating image...</span>
                                </div>
                              </div>

                              {/* The three dots loader below the box */}
                              <div className="flex gap-1.5 ml-1 pt-1 opacity-40">
                                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" />
                              </div>
                            </div>
                          )}

                          {/* Generated images - replaces skeleton */}
                          {message.images && message.images.length > 0 && (
                            <div className="grid grid-cols-1 gap-3">
                              {message.images.map((img, i) => (
                                <div key={i} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                                  <img
                                    src={img.url}
                                    alt={img.prompt}
                                    className="w-full h-auto"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Description - shows after image */}
                          {message.description && (
                            <div className="text-black/80 text-sm whitespace-pre-wrap">
                              <MarkdownMessage content={message.description} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}

                      {/* Selected Images Thumbnails */}
                      {message.selectedImages && message.selectedImages.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 flex-wrap pt-2 border-t border-white/10">
                          {message.selectedImages.map((img) => (
                            <div key={img.id} className="w-10 h-10 rounded overflow-hidden border border-white/20 opacity-80">
                              <img src={img.url} className="w-full h-full object-cover" alt="" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phase Badge */}
                    {message.role === 'assistant' && message.phase && (
                      <div className="mt-1 ml-1">{renderPhaseBadge(message.phase)}</div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center mt-1">
                    <Sparkles className="w-3 h-3 text-black" />
                  </div>
                  <div className="text-gray-500 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-200"></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="p-2 bg-white">
          {/* Input Container */}
          <div
            className="relative bg-white border border-gray-200 rounded-[17px] focus-within:border-gray-400 focus-within:bg-white transition-all shadow-xl"
          >
            {/* Pre-input States (Image Chips) - NOW INSIDE BORDER */}
            {(getSelectedImageShapes().length > 0 || uploadedImages.length > 0) && (
              <div className="p-2 flex items-center gap-2 flex-wrap">
                {getSelectedImageShapes().map(img => {
                  const name = img.generationMetadata?.prompt
                    ? (img.generationMetadata.prompt.length > 15
                      ? img.generationMetadata.prompt.substring(0, 15) + '...'
                      : img.generationMetadata.prompt)
                    : 'Selected Image';

                  return (
                    <ImageChip
                      key={img.id}
                      imageUrl={img.src}
                      name={name}
                      borderColor="border-blue-100"
                    />
                  );
                })}
                {uploadedImages.map(img => (
                  <ImageChip
                    key={img.id}
                    imageUrl={img.url}
                    name={img.file.name || 'Uploaded Image'}
                    onRemove={() => removeUploadedImage(img.id)}
                    borderColor="border-gray-100"
                  />
                ))}
              </div>
            )}
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Start with an idea, or type '@' to mention"
              className="w-full bg-transparent border-none focus:ring-0 text-black px-2 pt-2 pb-0 text-[15px] resize-none max-h-[120px] min-h-[50px] placeholder:text-gray-400"
              disabled={isLoading}
              style={{ height: 'auto', outline: 'none' }}
            />

            {/* Bottom Toolbar */}
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-black hover:bg-gray-100 transition-colors py-[0.25rem] px-[0.35rem]"
                  title="Attach"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* Agent Pill - White/Blue Style */}
                <div className="flex items-center gap-1.5 px-[0.35rem] py-[0.25rem] bg-white rounded-full border border-blue-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                  <span className="text-[12px] font-medium text-blue-600">Agent</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* New Icons: Globe, Box, etc. (Visual placeholders to match reference) */}
                <div className="flex items-center gap-1 mr-2">
                  <button className="flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-black hover:bg-gray-100 transition-colors py-[0.25rem] px-[0.35rem]" title="Web Search">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                  </button>
                  <button className="flex items-center justify-center rounded-full border border-gray-200 text-blue-500 border-blue-500/30 hover:bg-blue-50 transition-colors py-[0.25rem] px-[0.35rem]" title="Canvas Context">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                  </button>
                </div>

                {/* Send Button */}
                <button
                  onClick={() => sendMessageStreaming(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${inputValue.trim() && !isLoading
                    ? 'bg-[#263341] text-white hover:bg-[#1e2833] hover:scale-105'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
          multiple
          className="hidden"
        />

      </div>

      {/* Subscription Popup - Rendered outside to avoid being trapped by backdrop-filter */}
      {
        showSubscriptionPopup && (
          <SubscriptionTiersPopup
            isOpen={showSubscriptionPopup}
            onClose={() => setShowSubscriptionPopup(false)}
            currentCredits={credits || 0}
            creditsRequired={0}
            onSelectTier={async (tierId) => {
              refreshCredits();
            }}
          />
        )
      }

    </>
  );
};

export default AIChatPanel;
