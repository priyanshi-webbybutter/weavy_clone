'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CanvasEngine, ResizeHandle } from '@/lib/canvas/CanvasEngine';
import { Shape, Point, Tool, ImageShape, TextShape, RectangleShape, CircleShape, ArrowShape } from '@/lib/canvas/types';
import ColorPicker from './ColorPicker';
import ShapeSettingsPanel from './ShapeSettingsPanel';
import {
  ChevronDown,
  ChevronRight,
  Share2,
  Star,
  MousePointer2,
  Hand,
  Undo2,
  Redo2,
  Upload,
  Shapes,
  Type,
  Pencil,
  Link,
  Download,
  Minus,
  Crop,
  Copy,
  Bot,
  LogOut,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Settings2,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  CaseLower,
  CaseUpper,
  CaseSensitive,
  X,
} from 'lucide-react';
import AIChatPanel from './AIChatPanel';
import { CanvasArrows } from './CanvasArrows';
import { useCredits } from './CreditsDisplay';
import SubscriptionTiersPopup from './SubscriptionTiersPopup';
// Removed: MarkerSuggestionsPanel import - popup no longer needed

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface CanvasCanvasProps {
  initialProjectId?: string | null;
}

function CanvasCanvasInner({ initialProjectId }: CanvasCanvasProps = {}) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const lastShapeCountRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialProjectId || null);
  const [currentProjectName, setCurrentProjectName] = useState<string>('canvas');
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [tempProjectName, setTempProjectName] = useState<string>('canvas');
  const [tool, setTool] = useState<Tool>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [initialShapeBounds, setInitialShapeBounds] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [initialFontSize, setInitialFontSize] = useState<number | null>(null);
  const [lastMousePos, setLastMousePos] = useState<Point | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [initialShapePos, setInitialShapePos] = useState<Point | null>(null);
  const [initialMouseWorldPos, setInitialMouseWorldPos] = useState<Point | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedShapes, setSelectedShapes] = useState<Shape[]>([]);
  const [dragUpdateTrigger, setDragUpdateTrigger] = useState(0);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [allShapesState, setAllShapesState] = useState<Shape[]>([]);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(50);
  const [isTasksMenuOpen, setIsTasksMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [isShapesMenuOpen, setIsShapesMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { credits, loading: creditsLoading, refreshCredits } = useCredits();
  const [showSubscriptionPopup, setShowSubscriptionPopup] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(false);
  const [propertiesPanelPos, setPropertiesPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false);
  const [isFillPickerOpen, setIsFillPickerOpen] = useState(false);
  const [isStrokePickerOpen, setIsStrokePickerOpen] = useState(false);
  const [isOpacityOpen, setIsOpacityOpen] = useState(false);
  const [isRadiusOpen, setIsRadiusOpen] = useState(false);
  const [isLineStyleOpen, setIsLineStyleOpen] = useState(false);
  const [isFontFamilyOpen, setIsFontFamilyOpen] = useState(false);
  const [isFontWeightOpen, setIsFontWeightOpen] = useState(false);
  const [isFontSizeOpen, setIsFontSizeOpen] = useState(false);
  const [isAlignmentOpen, setIsAlignmentOpen] = useState(false);
  const [isTextStyleOpen, setIsTextStyleOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textInputValue, setTextInputValue] = useState<string>('');
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
  const [fillPickerPos, setFillPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [strokePickerPos, setStrokePickerPos] = useState<{ x: number; y: number } | null>(null);
  const [opacityPos, setOpacityPos] = useState<{ x: number; y: number } | null>(null);
  const [radiusPos, setRadiusPos] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);
  const [isGroupResizing, setIsGroupResizing] = useState(false);
  const [initialGroupBounds, setInitialGroupBounds] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [initialGroupShapeBounds, setInitialGroupShapeBounds] = useState<Map<string, { x: number, y: number, width: number, height: number }>>(new Map());
  const [initialGroupFontSizes, setInitialGroupFontSizes] = useState<Map<string, number>>(new Map());
  const [isGroupMoving, setIsGroupMoving] = useState(false);
  const [initialGroupPositions, setInitialGroupPositions] = useState<Map<string, Point>>(new Map());
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [croppingImageId, setCroppingImageId] = useState<string | null>(null);
  const [cropDragging, setCropDragging] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null>(null);
  const [cropDragStart, setCropDragStart] = useState<Point | null>(null);
  const [initialCropRect, setInitialCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [isMigratingImages, setIsMigratingImages] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{ current: number; total: number } | null>(null);
  const canvasLoadedRef = useRef<boolean>(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [isZoomManual, setIsZoomManual] = useState(false);

  // Text editing states
  const [isEditingText, setIsEditingText] = useState(false);
  const [extractedTextRegions, setExtractedTextRegions] = useState<Array<{
    text: string;
    location?: string;
  }>>([]);
  const [editedTextRegions, setEditedTextRegions] = useState<string[]>([]);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [isGeneratingEditedImage, setIsGeneratingEditedImage] = useState(false);
  const [textEditingImageId, setTextEditingImageId] = useState<string | null>(null);
  const [textEditPopupPos, setTextEditPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [textExtractionError, setTextExtractionError] = useState<string | null>(null);

  // Multi-point marking system states (simplified to match reference demo)
  interface Detection {
    label: string;
    kind: string;
    priority_index: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  interface MarkedPoint {
    id: string;                    // Unique marker ID
    number: number;                // Display number (1, 2, 3...)
    shapeId: string;               // ID of the marker shape (CircleShape)
    imageId: string;               // ID of parent image
    imageUrl: string;              // URL/src of the parent image (for chat panel)
    normalizedX: number;           // [0-1] normalized X coordinate relative to image
    normalizedY: number;           // [0-1] normalized Y coordinate relative to image
    timestamp: number;             // When marked
    objectName: string | null;     // Best match label (for backward compatibility)
    detections: Detection[] | null; // Full detection results with bboxes
    isAnalyzing: boolean;          // Loading state
  }

  const [markedPoints, setMarkedPoints] = useState<MarkedPoint[]>([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  // Removed: showMarkerSuggestions state - popup no longer used

  // Helper function to update marker positions when parent image changes
  const updateMarkersForImage = useCallback((imageId: string) => {
    const imageShape = engineRef.current?.getShape(imageId) as ImageShape;
    if (!imageShape) return;

    // Find all markers for this image
    const imageMarkers = markedPoints.filter(m => m.imageId === imageId);

    imageMarkers.forEach(marker => {
      // Simple positioning - circle center at the exact coordinate
      const x = imageShape.x + (marker.normalizedX * imageShape.width);
      const y = imageShape.y + (marker.normalizedY * imageShape.height);

      // Update marker shape position (without saving state to avoid cluttering undo history)
      engineRef.current?.updateShape(marker.shapeId, { x, y }, false);
    });
  }, [markedPoints]);

  // Initialize engine
  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new CanvasEngine();
      engineRef.current.setCanvas(canvasRef.current);
      engineRef.current.render();
    }

    return () => {
      if (engineRef.current) {
        saveCanvasState();
      }
    };
  }, []);

  // Load canvas state when project ID changes
  useEffect(() => {
    const initializeCanvas = async () => {
      console.log('🔄 initializeCanvas called, projectId:', currentProjectId);
      if (!currentProjectId) {
        console.log('⏭️ No project ID, skipping');
        return;
      }

      // Reset loaded flag when project changes
      canvasLoadedRef.current = false;

      // Wait for engine to be ready
      const waitForEngine = () => {
        return new Promise<void>((resolve) => {
          const checkEngine = () => {
            if (engineRef.current) {
              console.log('✅ Engine ready');
              resolve();
            } else {
              console.log('⏳ Waiting for engine...');
              setTimeout(checkEngine, 50);
            }
          };
          checkEngine();
        });
      };

      await waitForEngine();
      console.log('📥 Loading canvas state...');
      await loadCanvasState();
      console.log('📥 Canvas state loaded');

      // Mark canvas as loaded - now saving is allowed
      canvasLoadedRef.current = true;
      console.log('✅ Canvas marked as loaded - saving enabled');

      // Update allShapesState for AI chat panel
      if (engineRef.current) {
        setAllShapesState(engineRef.current.getAllShapes());
      }

      // Default view at 50% zoom after loading state
      setTimeout(() => {
        if (engineRef.current && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          engineRef.current.setViewport({ x: centerX, y: centerY, zoom: 0.5 });
          setZoomLevel(50);
          setIsZoomManual(false); // Reset manual zoom flag for new project
          console.log('🖼️ Initial view set to 50% centered');
        }
      }, 100);
    };
    initializeCanvas();
  }, [currentProjectId]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (engineRef.current && canvasRef.current) {
        engineRef.current.resize();
        engineRef.current.render();
        updatePropertiesPanelPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle wheel event with non-passive listener to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
      if (!engineRef.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      engineRef.current.zoom(delta, e.clientX - rect.left, e.clientY - rect.top);
      const zoom = engineRef.current.getState().viewport.zoom;
      setZoomLevel(Math.round(zoom * 100));
      setIsZoomManual(true); // User manually zoomed with wheel
      updatePropertiesPanelPosition();
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelEvent);
  }, []);

  // Helper to update selected shapes state and open settings panel
  const updateSelectedShapesState = () => {
    if (!engineRef.current) {
      setSelectedShapes([]);
      setSelectedShapeId(null);
      setAllShapesState([]);
      setIsSettingsPanelOpen(false);
      setPropertiesPanelPos(null);
      return;
    }
    const shapes = engineRef.current.getSelectedShapes();
    setSelectedShapes(shapes);

    // Sync selectedShapeId with the primary selection (first selected shape)
    if (shapes.length === 1) {
      setSelectedShapeId(shapes[0].id);
    } else if (shapes.length === 0) {
      setSelectedShapeId(null);
      setPropertiesPanelPos(null);
    }

    // Also update all shapes state for AI chat panel
    setAllShapesState(engineRef.current.getAllShapes());
    if (shapes.length > 0) {
      setIsSettingsPanelOpen(true);
      // Trigger a position update for the properties panel
      setTimeout(updatePropertiesPanelPosition, 10);
    } else {
      setIsSettingsPanelOpen(false);
    }
  };

  // Update properties panel position when shape is selected or moved
  const updatePropertiesPanelPosition = () => {
    if (!engineRef.current || !canvasRef.current) {
      setPropertiesPanelPos(null);
      return;
    }

    const targetId = selectedShapeId || editingTextId;
    if (!targetId) {
      setPropertiesPanelPos(null);
      return;
    }

    const shape = engineRef.current.getShape(targetId);
    if (!shape) {
      setPropertiesPanelPos(null);
      return;
    }

    // Don't show properties panel for red dots (locked circles)
    if (shape.locked && shape.type === 'circle') {
      setPropertiesPanelPos(null);
      return;
    }

    const bounds = engineRef.current.getShapeBoundsInScreen(shape);
    if (!bounds) {
      setPropertiesPanelPos(null);
      return;
    }

    // Prevent the panel from jumping around during active resizing
    if (isResizing || isGroupResizing) {
      return;
    }

    // Position panel relative to shape
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const gap = 32; // Increased gap for better separation
    const PANEL_HEIGHT = 60; // Approximate height of the styling panel used for bounds check

    // Always position ABOVE as requested
    // We want visual bottom of panel at (bounds.y - gap).
    // Since CSS has transform: translate(-50%, -100%), style.top IS the visual bottom.
    const finalY = canvasRect.top + (bounds.y - gap);

    setPropertiesPanelPos({
      x: canvasRect.left + bounds.centerX,
      y: finalY,
    });
  };

  const updateTextEditPopupPosition = () => {
    if (!engineRef.current || !canvasRef.current || !textEditingImageId) {
      setTextEditPopupPos(null);
      return;
    }

    const shape = engineRef.current.getShape(textEditingImageId);
    if (!shape) {
      setTextEditPopupPos(null);
      return;
    }

    const bounds = engineRef.current.getShapeBoundsInScreen(shape);
    if (!bounds) {
      setTextEditPopupPos(null);
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const gap = 20; // Gap between image and popup

    setTextEditPopupPos({
      x: canvasRect.left + bounds.x + bounds.width + gap,  // To the right
      y: canvasRect.top + bounds.y,  // Top-aligned with image
    });
  };

  useEffect(() => {
    updatePropertiesPanelPosition();
  }, [selectedShapeId, editingTextId]);

  // Update panel position smoothly during interactions
  useEffect(() => {
    if (engineRef.current && (selectedShapeId || editingTextId) && (isDrawing || isResizing || isGroupResizing || isGroupMoving || isPanning)) {
      let animationFrameId: number;
      const update = () => {
        updatePropertiesPanelPosition();
        animationFrameId = requestAnimationFrame(update);
      };
      animationFrameId = requestAnimationFrame(update);
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [selectedShapeId, editingTextId, isDrawing, isResizing, isGroupResizing, isGroupMoving, isPanning]);

  // Update text edit popup position when editing starts/changes
  useEffect(() => {
    if (isEditingText && textEditingImageId) {
      updateTextEditPopupPosition();
    }
  }, [textEditingImageId, isEditingText]);

  // Update text edit popup position smoothly during interactions
  useEffect(() => {
    if (engineRef.current && textEditingImageId && isEditingText &&
      (isDrawing || isResizing || isPanning)) {
      let animationFrameId: number;
      const update = () => {
        updateTextEditPopupPosition();
        animationFrameId = requestAnimationFrame(update);
      };
      animationFrameId = requestAnimationFrame(update);
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [textEditingImageId, isEditingText, isDrawing, isResizing, isPanning]);

  // Sync cursor when tool or state changes
  useEffect(() => {
    if (canvasRef.current) {
      if (isPanning) canvasRef.current.style.cursor = 'grabbing';
      else if (tool === 'pan') canvasRef.current.style.cursor = 'grab';
      else if (tool === 'select') canvasRef.current.style.cursor = 'default';
      else if (tool === 'text') canvasRef.current.style.cursor = 'text';
      else canvasRef.current.style.cursor = 'crosshair';
    }
  }, [tool, isPanning]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isTasksMenuOpen && !target.closest('[data-tasks-menu]')) {
        setIsTasksMenuOpen(false);
      }
      if (isZoomMenuOpen && !target.closest('[data-zoom-menu]')) {
        setIsZoomMenuOpen(false);
      }
      if (isShapesMenuOpen && !target.closest('[data-shapes-menu]')) {
        setIsShapesMenuOpen(false);
      }
      if (isFillPickerOpen && !target.closest('.color-picker')) {
        setIsFillPickerOpen(false);
      }
      if (isStrokePickerOpen && !target.closest('.color-picker')) {
        setIsStrokePickerOpen(false);
      }
      if (isOpacityOpen && !target.closest('.opacity-panel')) {
        setIsOpacityOpen(false);
      }
      if (isLineStyleOpen && !target.closest('.line-style-panel') && !target.closest('[data-line-style-button]')) {
        setIsLineStyleOpen(false);
      }
      if (isFontFamilyOpen && !target.closest('[data-font-family]')) {
        setIsFontFamilyOpen(false);
      }
      if (isFontWeightOpen && !target.closest('[data-font-weight]')) {
        setIsFontWeightOpen(false);
      }
      if (isFontSizeOpen && !target.closest('[data-font-size]')) {
        setIsFontSizeOpen(false);
      }
      if (isAlignmentOpen && !target.closest('[data-alignment]')) {
        setIsAlignmentOpen(false);
      }
      if (isTextStyleOpen && !target.closest('[data-text-style]')) {
        setIsTextStyleOpen(false);
      }

      // CLEAR SELECTION if click is completely outside the canvas area, sidebars, and panels
      // We whitelist everything that IS considered part of the workspace
      const isOutsideWorkspace =
        !target.closest('[data-canvas-area]') &&
        !target.closest('.sidebar-glass-panel') &&
        !target.closest('.properties-panel') &&
        !target.closest('[data-chat-panel]') &&
        !target.closest('.color-picker') &&
        !target.closest('.opacity-panel') &&
        !target.closest('.line-style-panel') &&
        !target.closest('.font-family-dropdown') &&
        !target.closest('.font-weight-dropdown') &&
        !target.closest('[data-text-input-overlay]');

      if (isOutsideWorkspace && !editingTextId) {
        if (engineRef.current && (engineRef.current.getSelectedShapes().length > 0)) {
          console.log('🌑 Clicking outside workspace - clearing selection');
          engineRef.current.clearSelection();
          updateSelectedShapesState();
          saveCanvasState();
        }
      }
    };

    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isTasksMenuOpen, isZoomMenuOpen, isShapesMenuOpen, isFillPickerOpen, isStrokePickerOpen, isOpacityOpen, isLineStyleOpen]);

  // Load project data
  useEffect(() => {
    if (currentProjectId && user) {
      const loadProject = async () => {
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) return;

          const response = await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            setCurrentProjectName(data.project.name || 'canvas');
            setTempProjectName(data.project.name || 'canvas');
          }
        } catch (error) {
          console.error('Error loading project:', error);
        }
      };

      loadProject();
    }
  }, [currentProjectId, user]);

  // Load canvas state from backend (or localStorage as fallback)
  const loadCanvasState = async () => {
    if (!currentProjectId) return;

    setIsLoadingCanvas(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      // Try to load from backend first
      let canvasLoaded = false;
      try {
        const response = await fetch(`${API_BASE_URL}/workflows/${currentProjectId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📥 Backend response:', {
            hasCanvasState: !!data.workflow?.canvas_state,
            canvasStateKeys: data.workflow?.canvas_state ? Object.keys(data.workflow.canvas_state) : null
          });
          if (data.workflow?.canvas_state && engineRef.current) {
            const serialized = JSON.stringify(data.workflow.canvas_state);
            console.log('📥 Deserializing canvas state, length:', serialized.length);
            engineRef.current.deserialize(serialized);
            engineRef.current.render(); // Force render after deserialize
            const zoom = engineRef.current.getState().viewport.zoom;
            setZoomLevel(Math.round(zoom * 100));
            canvasLoaded = true;

            // Initialize shape count tracking
            const loadedShapeCount = data.workflow.canvas_state.shapes?.length || 0;
            lastShapeCountRef.current = loadedShapeCount;
            console.log('✅ Canvas loaded from backend, shapes:', loadedShapeCount);

            // Also update localStorage for quick access next time
            localStorage.setItem(`canvas-${currentProjectId}`, serialized);
          }
        } else {
          console.log('❌ Backend response not ok:', response.status);
        }
      } catch (fetchError) {
        console.error('Error fetching canvas from backend:', fetchError);
      }

      // Fallback to localStorage if backend didn't have canvas state
      if (!canvasLoaded) {
        console.log('📥 Trying localStorage fallback...');
        const saved = localStorage.getItem(`canvas-${currentProjectId}`);
        if (saved && engineRef.current) {
          console.log('📥 Found localStorage data, length:', saved.length);
          engineRef.current.deserialize(saved);
          engineRef.current.render(); // Force render after deserialize
          const zoom = engineRef.current.getState().viewport.zoom;
          setZoomLevel(Math.round(zoom * 100));

          // Initialize shape count tracking from localStorage
          try {
            const parsedData = JSON.parse(saved);
            lastShapeCountRef.current = parsedData.shapes?.length || 0;
            console.log('✅ Canvas loaded from localStorage, shapes:', lastShapeCountRef.current);
          } catch {
            console.log('✅ Canvas loaded from localStorage');
          }
        } else {
          console.log('📥 No localStorage data found for canvas-' + currentProjectId);
        }
      }

      // Migrate any existing base64 images to Supabase Storage
      await migrateBase64Images();
    } catch (error) {
      console.error('Error loading canvas state:', error);
    } finally {
      setIsLoadingCanvas(false);
    }
  };

  // Save canvas state to localStorage (for quick local persistence)
  const saveCanvasStateLocal = async () => {
    // Don't save while uploading - wait for upload to complete with Supabase URL
    if (uploadingImageId) return;

    // Don't save if canvas hasn't been loaded yet
    if (!canvasLoadedRef.current) return;

    if (!currentProjectId || !engineRef.current) return;

    try {
      const serialized = engineRef.current.serialize();
      localStorage.setItem(`canvas-${currentProjectId}`, serialized);
    } catch (error) {
      console.error('Error saving canvas state locally:', error);
    }
  };

  // Save canvas state to backend (for persistence across devices)
  // Extract Supabase Storage image URLs for preview
  const extractPreviewImages = (canvasData: any): string[] => {
    if (!canvasData?.shapes) return [];

    // Extract image shapes with Supabase Storage URLs only
    // Note: shapes are stored as tuples [shapeId, shapeData]
    const supabaseStorageImages = canvasData.shapes
      .filter((shapeEntry: any) => {
        // shapeEntry is a tuple: [shapeId, shapeData]
        const shape = shapeEntry[1]; // Access the shape data from tuple
        if (!shape || shape.type !== 'image' || !shape.src) return false;

        // Only include Supabase Storage URLs (exclude base64 and other URLs)
        return shape.src.includes('.supabase.co/storage/');
      })
      .slice(0, 4) // Max 4 images
      .map((shapeEntry: any) => shapeEntry[1].src); // Access src from tuple

    return supabaseStorageImages;
  };

  const saveCanvasState = async (force: boolean = false) => {
    // Don't save while uploading - wait for upload to complete with Supabase URL
    if (uploadingImageId) return;

    // Don't save if canvas hasn't been loaded yet (prevents overwriting with empty state)
    if (!canvasLoadedRef.current) {
      console.log('⏭️ Skipping save - canvas not loaded yet');
      return;
    }

    if (!currentProjectId || !engineRef.current) return;

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const serialized = engineRef.current.serialize();
      const canvasData = JSON.parse(serialized);
      const currentShapeCount = canvasData.shapes?.length || 0;

      // CRITICAL: Don't save empty state if we previously had shapes (unless forced)
      if (currentShapeCount === 0 && lastShapeCountRef.current > 0 && !force) {
        console.log('⚠️ Blocking save - would overwrite', lastShapeCountRef.current, 'shapes with empty state');
        return;
      }

      // Update last known shape count
      lastShapeCountRef.current = currentShapeCount;

      console.log('💾 Saving canvas state:', {
        projectId: currentProjectId,
        shapesCount: currentShapeCount,
        serializedLength: serialized.length
      });

      // Save to localStorage for quick access
      localStorage.setItem(`canvas-${currentProjectId}`, serialized);

      // Debounce backend save to prevent rapid repeated saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          // Extract preview images (Supabase Storage URLs only)
          const previewImages = extractPreviewImages(canvasData);
          console.log('🖼️ Extracted preview images:', previewImages);

          // Save canvas state to backend for persistence
          const response = await fetch(`${API_BASE_URL}/workflows/${currentProjectId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              canvas_state: canvasData,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Failed to save canvas to backend:', response.status, errorText);
          } else {
            console.log('✅ Canvas saved to backend successfully');
          }

          // Update preview_images in projects table (non-blocking)
          try {
            const previewResponse = await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                preview_images: previewImages,
              }),
            });

            if (!previewResponse.ok) {
              const errorText = await previewResponse.text();
              console.error('❌ Failed to update preview images:', previewResponse.status, errorText);
            } else {
              console.log('✅ Preview images updated successfully:', previewImages.length, 'images');
            }
          } catch (previewError) {
            // Don't block canvas save if preview update fails
            console.warn('⚠️ Could not update preview images (canvas still saved):', previewError);
          }
        } catch (error) {
          console.error('❌ Error saving to backend:', error);
        }
      }, 500); // 500ms debounce
    } catch (error) {
      console.error('❌ Error saving canvas state:', error);
    }
  };

  // Migrate existing base64 images to Supabase Storage
  const migrateBase64Images = async () => {
    if (!engineRef.current || !currentProjectId) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const shapes = engineRef.current.getState().shapes;
    const base64Images: Array<{ id: string; src: string }> = [];

    // Find all images with base64 data URLs (skip placeholders)
    shapes.forEach((shape, id) => {
      if (shape.type === 'image') {
        const imageShape = shape as ImageShape;
        // Skip placeholder images (from AI chat) - they have SVG data URIs and placeholder IDs
        if (id.startsWith('placeholder-') || imageShape.src.includes('Generating image')) {
          console.log(`Skipping placeholder image: ${id}`);
          // Remove stale placeholders
          if (engineRef.current) {
            engineRef.current.removeShape(id);
          }
          return;
        }
        // Skip marker pins (SVG data URLs, not uploadable images)
        if (id.startsWith('marker-')) {
          console.log(`Skipping marker pin: ${id}`);
          return;
        }
        if (imageShape.src.startsWith('data:image/')) {
          base64Images.push({ id, src: imageShape.src });
        }
      }
    });

    if (base64Images.length === 0) {
      console.log('No base64 images to migrate');
      return;
    }

    console.log(`Found ${base64Images.length} base64 images to migrate`);
    setIsMigratingImages(true);
    setMigrationProgress({ current: 0, total: base64Images.length });

    let migratedCount = 0;
    let hasUpdates = false;

    for (const { id, src } of base64Images) {
      try {
        console.log(`Migrating image ${id}...`);

        const response = await fetch(`${API_BASE_URL}/upload-canvas-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            imageData: src,
            projectId: currentProjectId,
          }),
        });

        if (response.ok) {
          const { url } = await response.json();
          if (engineRef.current) {
            engineRef.current.updateShape(id, { src: url });
            hasUpdates = true;
            console.log(`Successfully migrated image ${id}`);
          }
        } else {
          console.error(`Failed to migrate image ${id}`);
        }
      } catch (error) {
        console.error(`Error migrating image ${id}:`, error);
      }

      migratedCount++;
      setMigrationProgress({ current: migratedCount, total: base64Images.length });
    }

    if (hasUpdates && engineRef.current) {
      engineRef.current.saveState();
      await saveCanvasState();
      console.log('Migration complete - canvas saved');
    }

    setIsMigratingImages(false);
    setMigrationProgress(null);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await saveProjectName();
      await saveCanvasState();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle settings change from ShapeSettingsPanel
  const handleShapeSettingsChange = (shapeId: string, updates: Partial<Shape>) => {
    if (!engineRef.current) return;

    // Handle delete action
    if ((updates as any)._delete) {
      engineRef.current.removeShape(shapeId);
      engineRef.current.saveState();
      saveCanvasState();
      updateSelectedShapesState();
      updatePropertiesPanelPosition();
      return;
    }

    // Get current shape
    const shape = engineRef.current.getShape(shapeId);
    if (!shape) return;

    // If updating style, merge with existing style
    if (updates.style) {
      updates = {
        ...updates,
        style: { ...shape.style, ...updates.style }
      };
    }

    // Update shape
    engineRef.current.updateShape(shapeId, updates);
    engineRef.current.saveState();
    engineRef.current.render();
    saveCanvasState();

    // Update the selectedShapes state to reflect changes
    updateSelectedShapesState();
    updatePropertiesPanelPosition();
  };

  // Handle crop image from settings panel
  const handleCropImageFromPanel = (shapeId: string) => {
    const shape = engineRef.current?.getShape(shapeId);
    if (shape && shape.type === 'image') {
      const imageShape = shape as ImageShape;
      setCroppingImageId(shapeId);
      setIsCropping(true);
      setCropRect({
        x: imageShape.x,
        y: imageShape.y,
        width: imageShape.width,
        height: imageShape.height
      });
    }
  };

  // Handle download image from settings panel
  const handleDownloadImageFromPanel = (shapeId: string) => {
    const shape = engineRef.current?.getShape(shapeId);
    if (shape && shape.type === 'image') {
      const imageShape = shape as ImageShape;
      const link = document.createElement('a');
      link.href = imageShape.src;
      link.download = `image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle duplicate shape from settings panel
  const handleDuplicateShapeFromPanel = (shapeId: string) => {
    const shape = engineRef.current?.getShape(shapeId);
    if (!shape || !engineRef.current) return;

    const newId = `shape-${Date.now()}-${Math.random()}`;
    const newShape = {
      ...shape,
      id: newId,
      x: shape.x + 20,
      y: shape.y + 20,
    };

    engineRef.current.addShape(newShape);
    engineRef.current.clearSelection();
    engineRef.current.selectShape(newId);
    setSelectedShapeId(newId);
    updateSelectedShapesState();
    engineRef.current.saveState();
    saveCanvasState();
  };

  // Handle adding shape from AI Chat Panel
  const handleAddShapeFromChat = async (shape: Shape) => {
    if (!engineRef.current) return;

    // Add shape immediately so user sees it
    engineRef.current.addShape(shape);
    engineRef.current.saveState();

    // If it's an image with a temporary URL (not from Supabase), upload to permanent storage
    if (shape.type === 'image' && (shape as ImageShape).src) {
      const imgSrc = (shape as ImageShape).src;
      const isTemporaryUrl = imgSrc.startsWith('http') &&
        !imgSrc.includes('supabase') &&
        !imgSrc.startsWith('data:');

      if (isTemporaryUrl && currentProjectId) {
        try {
          console.log('Uploading AI-generated image to permanent storage...');
          const token = localStorage.getItem('auth_token');

          if (token) {
            // Fetch the image and convert to base64
            const response = await fetch(imgSrc);
            const blob = await response.blob();

            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = reader.result as string;

              // Upload to Supabase
              const uploadResponse = await fetch(`${API_BASE_URL}/upload-canvas-image`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                  imageData: base64data,
                  projectId: currentProjectId,
                }),
              });

              if (uploadResponse.ok) {
                const { url } = await uploadResponse.json();
                // Update the shape with permanent URL
                if (engineRef.current) {
                  engineRef.current.updateShape(shape.id, { src: url });
                  engineRef.current.saveState();
                  engineRef.current.render();
                  saveCanvasState();
                  console.log('AI-generated image uploaded to permanent storage:', url);
                }
              } else {
                console.error('Failed to upload AI-generated image');
              }
            };
            reader.readAsDataURL(blob);
          }
        } catch (error) {
          console.error('Error uploading AI-generated image:', error);
        }
      }
    }

    saveCanvasState();
    updateSelectedShapesState();
  };

  // Handle updating shape from AI Chat Panel
  const handleUpdateShapeFromChat = (shapeId: string, updates: Partial<Shape>) => {
    if (!engineRef.current) return;
    const shape = engineRef.current.getShape(shapeId);
    if (!shape) return;

    if (updates.style) {
      updates = {
        ...updates,
        style: { ...shape.style, ...updates.style }
      };
    }

    // Identify if this is a transient placeholder animation
    const isPlaceholder = shapeId.startsWith('placeholder-');

    // Update the engine
    engineRef.current.updateShape(shapeId, updates);

    // Skip heavy operations and history for placeholders to prevent flickering
    if (!isPlaceholder) {
      engineRef.current.saveState();
      saveCanvasState();
      updateSelectedShapesState();
    } else {
      // For placeholders, just force a render to show the next frame
      // engineRef.current.render(); // updateShape(..., true) already calls this
    }
  };

  // Handle removing placeholder from AI Chat Panel
  const removePlaceholder = useCallback((placeholderId: string) => {
    if (!engineRef.current) return;

    // Remove shape from engine
    engineRef.current.removeShape(placeholderId);
    engineRef.current.saveState();
    engineRef.current.render();
    saveCanvasState();
    updateSelectedShapesState();

    console.log('🗑️ Removed placeholder:', placeholderId);
  }, [saveCanvasState]);

  // Update arrows connected to a moved image
  const updateConnectedArrows = useCallback((movedImageId: string) => {
    if (!engineRef.current) return;

    const allShapes = Array.from(engineRef.current.getState().shapes.values()) as Shape[];

    // Find arrows connected to this image
    const connectedArrows = allShapes.filter((shape): shape is ArrowShape =>
      shape.type === 'arrow' &&
      shape.connectionMetadata !== undefined &&
      (shape.connectionMetadata.sourceImageId === movedImageId ||
        shape.connectionMetadata.targetImageId === movedImageId)
    );

    if (connectedArrows.length === 0) return;

    console.log(`🔄 Updating ${connectedArrows.length} arrows connected to image:`, movedImageId);

    // Recalculate each arrow's position
    connectedArrows.forEach(arrow => {
      const sourceImage = allShapes.find((s): s is ImageShape =>
        s.type === 'image' && s.id === arrow.connectionMetadata?.sourceImageId
      );

      const targetImage = allShapes.find((s): s is ImageShape =>
        s.type === 'image' && s.id === arrow.connectionMetadata?.targetImageId
      );

      if (!sourceImage || !targetImage) {
        console.warn('⚠️ Could not find source or target image for arrow:', arrow.id);
        return;
      }

      // Calculate edge-to-edge positions (same logic as in AIChatPanel)
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

      const dx = targetBounds.centerX - sourceBounds.centerX;
      const dy = targetBounds.centerY - sourceBounds.centerY;
      const arrowIndex = arrow.connectionMetadata?.arrowIndex || 0;

      let startPoint: Point, endPoint: Point;

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal separation
        if (dx > 0) {
          startPoint = {
            x: sourceBounds.right,
            y: sourceBounds.centerY + (arrowIndex * 15)
          };
          endPoint = {
            x: targetBounds.left,
            y: targetBounds.centerY + (arrowIndex * 15)
          };
        } else {
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
        // Vertical separation
        if (dy > 0) {
          startPoint = {
            x: sourceBounds.centerX + (arrowIndex * 15),
            y: sourceBounds.bottom
          };
          endPoint = {
            x: targetBounds.centerX + (arrowIndex * 15),
            y: targetBounds.top
          };
        } else {
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

      // Update arrow
      engineRef.current?.updateShape(arrow.id, {
        x: startPoint.x,
        y: startPoint.y,
        points: [startPoint, endPoint]
      });

      console.log(`✅ Updated arrow ${arrow.id}`);
    });

    engineRef.current?.render();
  }, []);

  // Set up callback for dynamic arrow updates
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setOnImageUpdateCallback(updateConnectedArrows);
      console.log('✅ Registered dynamic arrow update callback');
    }
  }, [updateConnectedArrows]);

  // Handle focusing on a shape from AI Chat Panel
  const handleFocusShapeFromChat = (shapeId: string, keepSelection: boolean = false) => {
    if (!engineRef.current || !canvasRef.current) return;

    const shape = engineRef.current.getShape(shapeId);
    if (!shape) return;

    // Select the shape only if not keeping selection
    if (!keepSelection) {
      setSelectedShapeId(shapeId);
      engineRef.current.clearSelection();
      engineRef.current.selectShape(shapeId);
      updateSelectedShapesState();
    }

    // Get canvas dimensions
    const canvasWidth = canvasRef.current.width / window.devicePixelRatio;
    const canvasHeight = canvasRef.current.height / window.devicePixelRatio;

    // Calculate shape bounds
    let shapeX = shape.x;
    let shapeY = shape.y;
    let shapeWidth = 0;
    let shapeHeight = 0;

    if ('width' in shape && 'height' in shape) {
      shapeWidth = shape.width;
      shapeHeight = shape.height;
    } else if ('radius' in shape) {
      shapeWidth = shape.radius * 2;
      shapeHeight = shape.radius * 2;
      shapeX = shape.x - shape.radius;
      shapeY = shape.y - shape.radius;
    }

    // Add padding (10% on each side)
    const padding = 0.1;
    const paddedWidth = shapeWidth * (1 + padding * 2);
    const paddedHeight = shapeHeight * (1 + padding * 2);

    // Calculate zoom to fit the shape with padding
    const zoomX = canvasWidth / paddedWidth;
    const zoomY = canvasHeight / paddedHeight;
    const newZoom = Math.min(zoomX, zoomY, 1); // Don't zoom in beyond 100%

    // Calculate shape center
    const centerX = shapeX + shapeWidth / 2;
    const centerY = shapeY + shapeHeight / 2;

    // Calculate viewport to center the shape
    const viewportX = (canvasWidth / 2) - (centerX * newZoom);
    const viewportY = (canvasHeight / 2) - (centerY * newZoom);

    // Update viewport with zoom and position
    engineRef.current.setViewport({
      x: viewportX,
      y: viewportY,
      zoom: newZoom,
    });
    setZoomLevel(Math.round(newZoom * 100));
  };

  // Handle centering canvas to a specific shape without selecting it
  const handleCenterToShape = useCallback((shapeId: string, animate: boolean = true) => {
    if (!engineRef.current || !canvasRef.current) return;

    const shape = engineRef.current.getShape(shapeId);
    if (!shape) return;

    // Get canvas dimensions
    const canvasWidth = canvasRef.current.width / window.devicePixelRatio;
    const canvasHeight = canvasRef.current.height / window.devicePixelRatio;

    // Calculate shape bounds
    let shapeX = shape.x;
    let shapeY = shape.y;
    let shapeWidth = 0;
    let shapeHeight = 0;

    if ('width' in shape && 'height' in shape) {
      shapeWidth = shape.width;
      shapeHeight = shape.height;
    } else if ('radius' in shape) {
      shapeWidth = shape.radius * 2;
      shapeHeight = shape.radius * 2;
      shapeX = shape.x - shape.radius;
      shapeY = shape.y - shape.radius;
    }

    // Add padding (15% for better framing)
    const padding = 0.15;
    const paddedWidth = shapeWidth * (1 + padding * 2);
    const paddedHeight = shapeHeight * (1 + padding * 2);

    // Use 50% zoom by default unless user has manually changed it
    // or if the shape is too large to fit in 50% zoom
    const targetZoom = 0.5;
    const zoomX = canvasWidth / paddedWidth;
    const zoomY = canvasHeight / paddedHeight;
    const fitZoom = Math.min(zoomX, zoomY, 1);

    // If zoom is NOT manual, always prefer 50% (unless we need to zoom out to fit)
    const newZoom = isZoomManual ? fitZoom : Math.min(targetZoom, fitZoom);

    // Calculate shape center
    const centerX = shapeX + shapeWidth / 2;
    const centerY = shapeY + shapeHeight / 2;

    // Calculate viewport to center the shape
    const viewportX = (canvasWidth / 2) - (centerX * newZoom);
    const viewportY = (canvasHeight / 2) - (centerY * newZoom);

    // Update viewport (smooth transition handled by CSS if animate=true)
    engineRef.current.setViewport({
      x: viewportX,
      y: viewportY,
      zoom: newZoom,
    });
    setZoomLevel(Math.round(newZoom * 100));
  }, []);

  // Handle image generation for AI Chat Panel
  const handleGenerateImageForChat = async (prompt: string, aspectRatio?: string): Promise<string> => {
    // This is a placeholder - the actual generation is handled by the backend
    // The AIChatPanel will call the API directly
    return '';
  };

  // Capture canvas for AI visual analysis - returns PNG Blob
  const captureCanvasForAI = async (): Promise<Blob | null> => {
    if (!canvasRef.current || !engineRef.current) return null;

    const allShapes = engineRef.current.getAllShapes();
    const selectedShapesList = engineRef.current.getSelectedShapes();

    // If canvas is empty, return null
    if (allShapes.length === 0) {
      console.log('📷 Canvas is empty, skipping capture');
      return null;
    }

    // Determine which shapes to capture
    const shapesToCapture = selectedShapesList.length > 0 ? selectedShapesList : allShapes;
    console.log(`📷 Capturing ${shapesToCapture.length} shapes (${selectedShapesList.length > 0 ? 'selected' : 'all'})`);

    // Calculate bounding box of shapes to capture (in screen coordinates)
    const calculateShapesBounds = (shapes: Shape[]) => {
      if (shapes.length === 0) return null;

      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      const zoom = engineRef.current?.getState().viewport.zoom || 1;

      for (const shape of shapes) {
        const screenPos = engineRef.current?.worldToScreen({ x: shape.x, y: shape.y });
        if (!screenPos) continue;

        let width = 0, height = 0;
        if (shape.type === 'rectangle' || shape.type === 'image' || shape.type === 'text') {
          width = (shape as any).width * zoom;
          height = (shape as any).height * zoom;
        } else if (shape.type === 'circle') {
          const radius = (shape as any).radius || 50;
          width = height = radius * 2 * zoom;
        } else if (shape.type === 'line') {
          const line = shape as any;
          const endScreenPos = engineRef.current?.worldToScreen({ x: line.x2, y: line.y2 });
          if (endScreenPos) {
            width = Math.abs(endScreenPos.x - screenPos.x);
            height = Math.abs(endScreenPos.y - screenPos.y);
          }
        }

        minX = Math.min(minX, screenPos.x);
        minY = Math.min(minY, screenPos.y);
        maxX = Math.max(maxX, screenPos.x + width);
        maxY = Math.max(maxY, screenPos.y + height);
      }

      if (minX === Infinity) return null;
      return { minX, minY, maxX, maxY };
    };

    const bounds = calculateShapesBounds(shapesToCapture);
    if (!bounds) {
      console.log('📷 Could not calculate bounds');
      return null;
    }

    // Add padding around bounds
    const padding = 40;
    const canvasWidth = canvasRef.current.width;
    const canvasHeight = canvasRef.current.height;

    const x = Math.max(0, bounds.minX - padding);
    const y = Math.max(0, bounds.minY - padding);
    const width = Math.min(bounds.maxX - bounds.minX + (padding * 2), canvasWidth - x);
    const height = Math.min(bounds.maxY - bounds.minY + (padding * 2), canvasHeight - y);

    console.log(`📷 Capturing region: x=${x}, y=${y}, w=${width}, h=${height}`);

    // Create temporary canvas for cropped capture
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    // Draw the cropped region
    tempCtx.drawImage(
      canvasRef.current,
      x, y, width, height,  // Source rectangle
      0, 0, width, height   // Destination rectangle
    );

    // Return as Blob (NOT base64)
    return new Promise((resolve) => {
      try {
        tempCanvas.toBlob((blob) => {
          console.log(`📷 Canvas captured as PNG Blob: ${blob?.size || 0} bytes`);
          resolve(blob);
        }, 'image/png');
      } catch (error) {
        // Handle tainted canvas error (images loaded without CORS)
        console.warn('📷 Canvas capture failed (tainted canvas). Proceeding with text-only mode.', error);
        resolve(null);
      }
    });
  };

  const handleProjectNameClick = () => {
    setEditingProjectName(true);
  };

  const handleProjectNameBlur = () => {
    setEditingProjectName(false);
    saveProjectName();
  };

  const handleProjectNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setEditingProjectName(false);
      saveProjectName();
    } else if (e.key === 'Escape') {
      setEditingProjectName(false);
      setTempProjectName(currentProjectName);
    }
  };

  const saveProjectName = async () => {
    if (!currentProjectId || !user || tempProjectName === currentProjectName) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tempProjectName.trim() || 'canvas',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentProjectName(data.project.name || 'canvas');
        setTempProjectName(data.project.name || 'canvas');
      }
    } catch (error) {
      console.error('Error saving project name:', error);
      setTempProjectName(currentProjectName);
    }
  };

  // Helper: Convert screen coordinates to normalized [0-1] coordinates (matches reference demo)
  const screenToNormalized = (screenX: number, screenY: number, imageShape: ImageShape): { normalizedX: number; normalizedY: number } | null => {
    if (!engineRef.current) return null;

    // Get viewport state
    const viewport = (engineRef.current as any).state.viewport;

    console.log('=== DETAILED COORDINATE DEBUG ===');
    console.log('1. Raw screen click:', { x: screenX, y: screenY });
    console.log('2. Viewport state:', {
      pan: { x: viewport.x.toFixed(2), y: viewport.y.toFixed(2) },
      zoom: viewport.zoom.toFixed(3)
    });

    // Get canvas size
    const canvas = canvasRef.current;
    const canvasRect = canvas?.getBoundingClientRect();
    console.log('3. Canvas size:', {
      width: canvasRect?.width,
      height: canvasRect?.height
    });

    // Convert screen to world coordinates (accounts for pan/zoom)
    const worldPoint = engineRef.current.screenToWorld({ x: screenX, y: screenY });
    console.log('4. World coordinates:', {
      x: worldPoint.x.toFixed(2),
      y: worldPoint.y.toFixed(2)
    });

    // Image shape in world space
    console.log('5. Image shape (world space):', {
      position: { x: imageShape.x.toFixed(2), y: imageShape.y.toFixed(2) },
      size: { w: imageShape.width.toFixed(2), h: imageShape.height.toFixed(2) }
    });

    // Calculate image-relative coordinates
    const imageRelativeX = worldPoint.x - imageShape.x;
    const imageRelativeY = worldPoint.y - imageShape.y;
    console.log('6. Image-relative (world units):', {
      x: imageRelativeX.toFixed(2),
      y: imageRelativeY.toFixed(2)
    });

    // Normalize to [0-1]
    const normalizedX = imageRelativeX / imageShape.width;
    const normalizedY = imageRelativeY / imageShape.height;
    console.log('7. Normalized [0-1]:', {
      x: normalizedX.toFixed(4),
      y: normalizedY.toFixed(4)
    });

    // Expected pixel location on original image (if image was 1000px wide)
    const expectedPixelX = Math.round(normalizedX * 1000);
    const expectedPixelY = Math.round(normalizedY * 1000);
    console.log('8. Expected pixel (on 1000px image):', {
      x: expectedPixelX,
      y: expectedPixelY
    });

    // Validate bounds
    if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
      console.log('❌ Click outside image bounds');
      return null; // Click outside image
    }

    return { normalizedX, normalizedY };
  };

  // Helper: Capture image as base64 JPEG (matches reference demo approach)
  const captureImageAsBase64 = (imageShape: ImageShape): Promise<string> => {
    // Create temporary canvas for just this image
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      throw new Error('Failed to get canvas context');
    }

    // Set canvas size to match image dimensions (use reasonable max size)
    const maxSize = 1000;
    let canvasWidth = imageShape.width;
    let canvasHeight = imageShape.height;

    // Scale down if too large (maintain aspect ratio)
    if (canvasWidth > maxSize || canvasHeight > maxSize) {
      const scale = Math.min(maxSize / canvasWidth, maxSize / canvasHeight);
      canvasWidth = Math.floor(canvasWidth * scale);
      canvasHeight = Math.floor(canvasHeight * scale);
    }

    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;

    // Create image element from imageShape.src
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise<string>((resolve, reject) => {
      img.onload = () => {
        // Draw image to temp canvas
        tempCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        // Export as JPEG (like reference demo)
        const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = imageShape.src;
    });
  };

  // Call backend API to analyze point (structured output with bounding boxes)
  const analyzePoint = async (
    normalizedX: number,
    normalizedY: number,
    imageShape: ImageShape
  ): Promise<{ objectName: string; detections: Detection[] }> => {
    try {
      // Get ORIGINAL image as base64 (normalized coords work on any size)
      let imageBase64: string;

      if (imageShape.src.startsWith('data:image/')) {
        // Already a data URL, extract base64 part
        imageBase64 = imageShape.src.split(',')[1];
        console.log('📷 Using original image (data URL)');
      } else {
        // Fetch from URL and convert to base64
        console.log('📷 Fetching original image from:', imageShape.src);
        const response = await fetch(imageShape.src);
        const blob = await response.blob();

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64data = dataUrl.split(',')[1];
            resolve(base64data);
          };
          reader.readAsDataURL(blob);
        });

        imageBase64 = base64;
        console.log('📷 Original image fetched and converted');
      }

      console.log(`🔍 Analyzing point [${normalizedX.toFixed(4)}, ${normalizedY.toFixed(4)}] on ORIGINAL image`);

      // Send to simplified backend API
      const response = await fetch('http://localhost:3001/api/analyze-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          normalizedX,
          normalizedY
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      // Extract best match (first item has highest priority)
      const bestMatch = data.detections?.[0];
      const objectName = bestMatch?.label || 'Unknown';

      console.log(`✅ Detected ${data.detections?.length || 0} objects, best: "${objectName}"`);

      return {
        objectName,
        detections: data.detections || []
      };

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      return {
        objectName: 'Error',
        detections: []
      };
    }
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !canvasRef.current) return;

    // IF EDITING TEXT: Manually blur the input when clicking on the canvas
    // This is needed because e.preventDefault() below blocks natural focus change
    const isEditing = editingTextId || isEditingText;
    if (isEditing) {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
        (document.activeElement as HTMLElement).blur();
      }
    }

    // Prevent browser text selection/drag behaviors
    e.preventDefault();

    // Clear selection if starting to draw with a tool (rectangle, circle, etc.)
    if (tool !== 'select' && tool !== 'pan') {
      engineRef.current.clearSelection();
      setSelectedShapeId(null);
      updateSelectedShapesState();
    }

    // Don't handle canvas interactions in crop mode
    if (isCropping) return;

    // Detect Ctrl+Click to place red dot (rebuilt to match reference demo)
    if ((e.ctrlKey || e.metaKey) && e.button === 0) {
      const rect = canvasRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Check if clicked on an image
      const clickedShape = engineRef.current.hitTest({ x: screenX, y: screenY });
      if (clickedShape && clickedShape.type === 'image') {
        const imageShape = clickedShape as ImageShape;

        // Convert screen coordinates to normalized [0-1] (like reference demo)
        const coords = screenToNormalized(screenX, screenY, imageShape);
        if (!coords) {
          console.log('❌ Click outside image bounds');
          return;
        }

        const { normalizedX, normalizedY } = coords;
        console.log(`📍 Marker at normalized: [${normalizedX.toFixed(4)}, ${normalizedY.toFixed(4)}]`);

        // Get next marker number for this image
        const markerNumber = markedPoints.filter(p => p.imageId === imageShape.id).length + 1;

        // Get current zoom for inverse scaling (like reference demo)
        const zoom = (engineRef.current as any).state.viewport.zoom;

        // Create red dot marker at exact click coordinates with inverse scaling
        const markerDot: CircleShape = {
          id: `marker-${Date.now()}-${markerNumber}`,
          type: 'circle',
          x: imageShape.x + (normalizedX * imageShape.width),
          y: imageShape.y + (normalizedY * imageShape.height),
          radius: 7 / zoom,  // Inverse scaling (matches reference demo's 7 / scale)
          style: {
            fill: 'red',
            stroke: 'white',
            strokeWidth: 2 / zoom,  // Also scale stroke width
            opacity: 1
          },
          visible: true,
          locked: true  // Enable selection border rendering
        };

        console.log(`🎯 Marker radius: ${(7 / zoom).toFixed(2)} (zoom: ${zoom.toFixed(2)}x)`);

        // Create marker metadata (simplified)
        const newMarker: MarkedPoint = {
          id: markerDot.id,
          number: markerNumber,
          shapeId: markerDot.id,
          imageId: imageShape.id,
          imageUrl: imageShape.src,  // Include image URL so chat panel doesn't need to look it up
          normalizedX,
          normalizedY,
          timestamp: Date.now(),
          objectName: null,
          detections: null,
          isAnalyzing: true
        };

        // Add to canvas and state
        engineRef.current.addShape(markerDot);
        setMarkedPoints(prev => [...prev, newMarker]);

        console.log(`✅ Marker #${markerNumber} placed`);

        // Dispatch analyzing event immediately
        window.dispatchEvent(new CustomEvent('marker-event', {
          detail: {
            type: 'marker-analyzing',
            marker: newMarker
          }
        }));

        // Analyze point (backend API call)
        analyzePoint(normalizedX, normalizedY, imageShape)
          .then(({ objectName, detections }) => {
            // Update marker with result
            setMarkedPoints(prev => prev.map(m =>
              m.id === newMarker.id
                ? { ...m, objectName, detections, isAnalyzing: false }
                : m
            ));

            console.log(`✅ Marker #${markerNumber} detected: "${objectName}" (${detections.length} total objects)`);
            console.log('📤 Dispatching marker-analyzed event:', {
              id: newMarker.id,
              objectName,
              detectionsCount: detections.length
            });

            // Emit analyzed event
            window.dispatchEvent(new CustomEvent('marker-event', {
              detail: {
                type: 'marker-analyzed',
                marker: { ...newMarker, objectName, detections, isAnalyzing: false }
              }
            }));
          })
          .catch(error => {
            console.error(`❌ Analysis failed for marker #${markerNumber}:`, error);
            setMarkedPoints(prev => prev.map(m =>
              m.id === newMarker.id
                ? { ...m, objectName: 'Error', isAnalyzing: false }
                : m
            ));
          });
      } else {
        console.log('❌ Must click on an image to place marker');
      }

      return; // Don't process as normal click
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const point: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    setLastMousePos(point);
    setDragStart(point);

    // Check for resize handles first (only when select tool is active)
    if (tool === 'select') {
      const selected = engineRef.current.getSelectedShapes();
      if (selected.length === 1) {
        const handle = engineRef.current.getResizeHandleAt(point, selected[0]);
        if (handle) {
          setIsResizing(true);
          setResizeHandle(handle);
          engineRef.current.setHideSelection(true);
          // Store initial bounds for resizing
          let bounds: { x: number; y: number; width: number; height: number };
          if (selected[0].type === 'rectangle' || selected[0].type === 'text' || selected[0].type === 'image') {
            bounds = { x: selected[0].x, y: selected[0].y, width: selected[0].width, height: selected[0].height };
          } else if (selected[0].type === 'circle') {
            bounds = { x: selected[0].x, y: selected[0].y, width: selected[0].radius * 2, height: selected[0].radius * 2 };
          } else {
            return; // Should not happen
          }
          setInitialShapeBounds(bounds);
          // Store initial fontSize for text shapes
          if (selected[0].type === 'text') {
            setInitialFontSize(selected[0].style.fontSize || 16);
          } else {
            setInitialFontSize(null);
          }
          return;
        }
      }
    }

    if (tool === 'pan' || (e.button === 1) || (e.button === 0 && (e as any).spaceKey)) {
      setIsPanning(true);
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      return;
    }

    if (tool === 'select') {
      const selected = engineRef.current.getSelectedShapes();

      // Check for group resize handle first (before checking shapes)
      if (selected.length > 1) {
        const groupHandle = engineRef.current.getGroupResizeHandleAt(point, selected);
        if (groupHandle) {
          setIsGroupResizing(true);
          setResizeHandle(groupHandle);
          engineRef.current.setHideSelection(true);
          const groupBounds = engineRef.current.getGroupBounds(selected);
          if (groupBounds && engineRef.current) {
            setInitialGroupBounds(groupBounds);
            // Store initial bounds and font sizes for all shapes in the group
            const shapeBoundsMap = new Map<string, { x: number, y: number, width: number, height: number }>();
            const fontSizesMap = new Map<string, number>();
            selected.forEach(shape => {
              let bounds: { x: number, y: number, width: number, height: number };
              if (shape.type === 'rectangle' || shape.type === 'image') {
                bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
              } else if (shape.type === 'text') {
                const textShape = shape as TextShape;
                const textBounds = engineRef.current!.getTextBounds(textShape);
                bounds = { x: shape.x, y: shape.y, width: textBounds.width, height: textBounds.height };
                fontSizesMap.set(shape.id, textShape.style.fontSize || 16);
              } else if (shape.type === 'circle') {
                bounds = { x: shape.x, y: shape.y, width: shape.radius * 2, height: shape.radius * 2 };
              } else {
                return;
              }
              shapeBoundsMap.set(shape.id, bounds);
            });
            setInitialGroupShapeBounds(shapeBoundsMap);
            setInitialGroupFontSizes(fontSizesMap);
          }
          return;
        }

        // Check if clicking inside group bounds (for group move)
        // Don't start group move if shift is held (allow element toggle instead)
        if (engineRef.current.isPointInGroupBounds(point, selected) && !e.shiftKey) {
          // Start group move
          setIsGroupMoving(true);
          engineRef.current.setHideSelection(true);
          const worldPoint = engineRef.current.screenToWorld(point);
          const positions = new Map<string, Point>();
          selected.forEach(s => {
            positions.set(s.id, { x: s.x, y: s.y });
          });
          setInitialGroupPositions(positions);
          setInitialMouseWorldPos(worldPoint);
          return;
        }
      }

      const shape = engineRef.current.hitTest(point);

      if (shape) {
        // Check if clicked on a marker
        if (shape.id.startsWith('marker-')) {
          const marker = markedPoints.find(m => m.shapeId === shape.id);

          if (marker) {
            console.log('🔵 Clicked marker #' + marker.number);
            engineRef.current.selectShape(marker.shapeId);  // Register with engine for visual feedback
            setSelectedMarkerId(marker.id);  // Track selected marker for deletion

            // Removed: analyzeMarkerPoint call - no longer needed for popup
            // Removed: setShowMarkerSuggestions(true) - popup removed
            // User has implemented custom marker deletion logic

            return; // Don't propagate event - prevent marker from being dragged
          }
        }

        // Single shape selection and move
        engineRef.current.selectShape(shape.id, e.shiftKey);
        setSelectedShapeId(shape.id);
        updateSelectedShapesState();
        setIsDrawing(true); // Start dragging selected shape
        engineRef.current.setHideSelection(true);
        // Store initial shape position and mouse position for smooth dragging
        const worldPoint = engineRef.current.screenToWorld(point);
        setInitialShapePos({ x: shape.x, y: shape.y });
        setInitialMouseWorldPos(worldPoint);
      } else {
        // Start selection box
        if (!e.shiftKey) {
          engineRef.current.clearSelection();
          setSelectedShapeId(null);
          setSelectedMarkerId(null);  // Also clear marker selection
          updateSelectedShapesState();
        }
        setIsSelecting(true);
        setSelectionBox({ start: point, end: point });
      }
    } else if (tool === 'freehand') {
      const id = `shape-${Date.now()}-${Math.random()}`;
      const worldPoint = engineRef.current.screenToWorld(point);
      const shape: Shape = {
        id,
        type: 'freehand',
        x: worldPoint.x,
        y: worldPoint.y,
        points: [worldPoint],
        style: {
          stroke: '#ffffff',
          strokeWidth: 2,
        },
      };
      engineRef.current.addShape(shape);
      engineRef.current.selectShape(id); // Select the shape after drawing
      setSelectedShapeId(id);
      updateSelectedShapesState();
      setIsDrawing(true);
      engineRef.current.setHideSelection(true);
    } else {
      const worldPoint = engineRef.current.screenToWorld(point);
      const id = `shape-${Date.now()}-${Math.random()}`;

      let shape: Shape;

      switch (tool) {
        case 'rectangle':
          shape = {
            id,
            type: 'rectangle',
            x: worldPoint.x,
            y: worldPoint.y,
            width: 0,
            height: 0,
            radius: 0,
            style: {
              fill: '#bdbdbd',
              stroke: '#ffffff',
              strokeWidth: 2,
            },
          };
          break;
        case 'circle':
          shape = {
            id,
            type: 'circle',
            x: worldPoint.x,
            y: worldPoint.y,
            radius: 0,
            style: {
              fill: '#bdbdbd',
              stroke: '#ffffff',
              strokeWidth: 2,
            },
          };
          break;
        case 'line':
          shape = {
            id,
            type: 'line',
            x: worldPoint.x,
            y: worldPoint.y,
            points: [worldPoint, worldPoint],
            style: {
              stroke: '#ffffff',
              strokeWidth: 2,
            },
          };
          break;
        case 'arrow':
          shape = {
            id,
            type: 'arrow',
            x: worldPoint.x,
            y: worldPoint.y,
            points: [worldPoint, worldPoint],
            style: {
              stroke: '#ffffff',
              strokeWidth: 2,
            },
          };
          break;
        case 'text':
          shape = {
            id,
            type: 'text',
            x: worldPoint.x,
            y: worldPoint.y,
            width: 200,
            height: 30,
            text: '',
            style: {
              fill: '#000000',
              fontSize: 16,
              fontFamily: 'Arial',
              backgroundColor: '#ffffff',
            },
          };
          engineRef.current.addShape(shape);

          // Switch to select tool immediately after adding text
          setTool('select');

          // Start editing text immediately (don't select yet - selection will appear after editing)
          setTimeout(() => {
            setEditingTextId(id);
            setTextInputValue('');
            if (canvasRef.current && engineRef.current) {
              const canvasRect = canvasRef.current.getBoundingClientRect();
              const screenPos = engineRef.current.worldToScreen({ x: worldPoint.x, y: worldPoint.y });
              setTextInputPos({
                x: canvasRect.left + screenPos.x,
                y: canvasRect.top + screenPos.y,
              });
              // Hide the text shape while editing
              engineRef.current.updateShape(id, { visible: false }, false);
              // Update panel position for editing
              updatePropertiesPanelPosition();
            }
          }, 0);
          return; // Don't set isDrawing for text
        default:
          return;
      }

      engineRef.current.addShape(shape);
      engineRef.current.selectShape(id); // Select the shape after drawing
      setSelectedShapeId(id);
      // Wait for mouseUp to open panel for new shapes to avoid interrupting drawing
      setIsDrawing(true);
      engineRef.current.setHideSelection(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const point: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // Update cursor based on hover (but not when selecting)
    if (!isDrawing && !isPanning && !isResizing && !isSelecting && !isGroupResizing && !isGroupMoving && tool === 'select' && canvasRef.current) {
      const selected = engineRef.current.getSelectedShapes();
      const hoveredShape = engineRef.current.hitTest(point);

      // Update hover state for all shapes (selected or not)
      setHoveredShapeId(hoveredShape?.id || null);

      if (selected.length === 1) {
        if (hoveredShape && selected.includes(hoveredShape)) {
          const handle = engineRef.current.getResizeHandleAt(point, hoveredShape);
          if (handle) {
            canvasRef.current.style.cursor = getCursorForHandle(handle);
            setLastMousePos(point);
            return;
          }
          // Show move cursor when hovering over selected shape
          canvasRef.current.style.cursor = 'move';
          setLastMousePos(point);
          return;
        } else if (hoveredShape) {
          // Show pointer cursor for non-selected shapes
          canvasRef.current.style.cursor = 'pointer';
          setLastMousePos(point);
          return;
        }
      } else if (selected.length > 1) {
        // Check for group resize handle first
        const groupHandle = engineRef.current.getGroupResizeHandleAt(point, selected);
        if (groupHandle) {
          canvasRef.current.style.cursor = getCursorForHandle(groupHandle);
          setLastMousePos(point);
          return;
        }
        // Check if hovering inside group bounds (for group move)
        if (engineRef.current.isPointInGroupBounds(point, selected)) {
          canvasRef.current.style.cursor = 'move';
          setLastMousePos(point);
          return;
        }
        // Show pointer cursor for non-selected shapes when multiple selected
        if (hoveredShape && !selected.includes(hoveredShape)) {
          canvasRef.current.style.cursor = 'pointer';
          setLastMousePos(point);
          return;
        }
      } else if (hoveredShape) {
        // No selection but hovering over a shape
        canvasRef.current.style.cursor = 'pointer';
        setLastMousePos(point);
        return;
      }
      canvasRef.current.style.cursor = 'default';
    } else if (canvasRef.current) {
      if (isPanning) {
        canvasRef.current.style.cursor = 'grabbing';
      } else if (tool === 'pan') {
        canvasRef.current.style.cursor = 'grab';
      } else if (tool === 'select') {
        canvasRef.current.style.cursor = 'default';
      } else if (tool === 'text') {
        canvasRef.current.style.cursor = 'text';
      } else {
        canvasRef.current.style.cursor = 'crosshair';
      }
    }

    if (isSelecting && selectionBox) {
      // Update selection box end point as mouse moves
      setSelectionBox({ ...selectionBox, end: point });
      return;
    }

    if (isPanning && lastMousePos) {
      const deltaX = point.x - lastMousePos.x;
      const deltaY = point.y - lastMousePos.y;
      engineRef.current.pan(deltaX, deltaY);
      setLastMousePos(point);
      updatePropertiesPanelPosition();
      return;
    }

    if (isGroupResizing && resizeHandle && initialGroupBounds && initialGroupShapeBounds.size > 0 && engineRef.current) {
      const selected = engineRef.current.getSelectedShapes();
      if (selected.length > 1) {
        const worldCurrent = engineRef.current.screenToWorld(point);
        engineRef.current.resizeGroup(selected, resizeHandle, worldCurrent, initialGroupBounds, initialGroupShapeBounds, initialGroupFontSizes);
        return;
      }
    }

    if (isGroupMoving && initialGroupPositions.size > 0 && initialMouseWorldPos && engineRef.current) {
      const worldCurrent = engineRef.current.screenToWorld(point);
      const deltaX = worldCurrent.x - initialMouseWorldPos.x;
      const deltaY = worldCurrent.y - initialMouseWorldPos.y;
      // Get selected shapes from initialGroupPositions keys
      const selected = Array.from(initialGroupPositions.keys())
        .map(id => engineRef.current!.getShape(id))
        .filter((shape): shape is Shape => shape !== undefined);
      engineRef.current!.moveGroup(selected, initialGroupPositions, deltaX, deltaY);
      setDragUpdateTrigger(prev => prev + 1); // Force arrow update
      updatePropertiesPanelPosition();
      return;
    }

    if (isResizing && selectedShapeId && resizeHandle && initialShapeBounds) {
      const shape = engineRef.current.getShape(selectedShapeId);
      if (!shape) return;
      const worldCurrent = engineRef.current.screenToWorld(point);
      engineRef.current.resizeShape(shape, resizeHandle, worldCurrent, initialShapeBounds, initialFontSize || undefined);
      // Don't update panel position during resize - wait for mouseUp
      return;
    }

    if (isDrawing && selectedShapeId) {
      const shape = engineRef.current.getShape(selectedShapeId);
      if (!shape) return;

      const worldCurrent = engineRef.current.screenToWorld(point);

      if (tool === 'select' && shape && initialShapePos && initialMouseWorldPos) {
        // Calculate delta from initial mouse position and apply to initial shape position
        const deltaX = worldCurrent.x - initialMouseWorldPos.x;
        const deltaY = worldCurrent.y - initialMouseWorldPos.y;
        engineRef.current.updateShape(selectedShapeId, {
          x: initialShapePos.x + deltaX,
          y: initialShapePos.y + deltaY,
        }, false);
        setDragUpdateTrigger(prev => prev + 1); // Force arrow update
        // Don't update panel position during drag - wait for mouseUp
      } else if (tool === 'freehand') {
        if (shape.type === 'freehand') {
          engineRef.current.updateShape(selectedShapeId, {
            points: [...shape.points, worldCurrent],
          }, false);
        }
      } else if (dragStart) {
        const worldStart = engineRef.current.screenToWorld(dragStart);
        const width = worldCurrent.x - worldStart.x;
        const height = worldCurrent.y - worldStart.y;

        switch (tool) {
          case 'rectangle':
            engineRef.current.updateShape(selectedShapeId, {
              width: Math.abs(width),
              height: Math.abs(height),
              x: width < 0 ? worldCurrent.x : worldStart.x,
              y: height < 0 ? worldCurrent.y : worldStart.y,
            }, false);
            break;
          case 'circle':
            const radius = Math.sqrt(width * width + height * height);
            engineRef.current.updateShape(selectedShapeId, {
              radius,
            }, false);
            break;
          case 'line':
          case 'arrow':
            if (shape.type === 'line' || shape.type === 'arrow') {
              engineRef.current.updateShape(selectedShapeId, {
                points: [worldStart, worldCurrent],
              }, false);
            }
            break;
        }
      }
    }

    setLastMousePos(point);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !canvasRef.current || tool !== 'select') return;

    const rect = canvasRef.current.getBoundingClientRect();
    const point: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const shape = engineRef.current.hitTest(point);
    if (shape && shape.type === 'text') {
      // Clear selection while editing
      engineRef.current.clearSelection();
      setSelectedShapeId(null);

      setEditingTextId(shape.id);
      setTextInputValue(shape.text);
      if (canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const screenPos = engineRef.current.worldToScreen({ x: shape.x, y: shape.y });
        setTextInputPos({
          x: canvasRect.left + screenPos.x,
          y: canvasRect.top + screenPos.y,
        });
        // Hide the text shape while editing
        engineRef.current.updateShape(shape.id, { visible: false }, false);
      }
    }
  };

  const handleMouseUp = () => {
    // Handle selection box completion
    if (isSelecting && selectionBox && engineRef.current) {
      const startWorld = engineRef.current.screenToWorld(selectionBox.start);
      const endWorld = engineRef.current.screenToWorld(selectionBox.end);

      const minX = Math.min(startWorld.x, endWorld.x);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxY = Math.max(startWorld.y, endWorld.y);

      // Find all shapes that intersect with the selection box
      const allShapes = engineRef.current.getAllShapes();
      const selectedShapes = allShapes.filter(shape => {
        let bounds: { x: number; y: number; width: number; height: number };

        if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'image') {
          bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        } else if (shape.type === 'circle') {
          bounds = {
            x: shape.x,
            y: shape.y,
            width: shape.radius * 2,
            height: shape.radius * 2,
          };
        } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
          const xs = shape.points.map(p => p.x);
          const ys = shape.points.map(p => p.y);
          bounds = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          };
        } else {
          return false;
        }

        // Check if shape intersects with selection box
        return !(
          bounds.x + bounds.width < minX ||
          bounds.x > maxX ||
          bounds.y + bounds.height < minY ||
          bounds.y > maxY
        );
      });

      // Select all intersecting shapes
      if (selectedShapes.length > 0) {
        engineRef.current.clearSelection();
        selectedShapes.forEach(shape => {
          engineRef.current?.selectShape(shape.id, true);
        });
        if (selectedShapes.length === 1) {
          setSelectedShapeId(selectedShapes[0].id);
        } else {
          setSelectedShapeId(null);
        }
        updateSelectedShapesState();
      }

      setIsSelecting(false);
      setSelectionBox(null);
    }

    if ((isDrawing || isResizing || isGroupResizing || isGroupMoving) && engineRef.current) {
      engineRef.current.setHideSelection(false);
      engineRef.current.saveState();

      // Update marker positions for all images (in case any were moved/resized)
      // This ensures markers stay at the correct relative position on their parent images
      const allShapes = engineRef.current.getAllShapes();
      const imageShapes = allShapes.filter(s => s.type === 'image' && !s.id.startsWith('marker-'));
      imageShapes.forEach(imageShape => {
        updateMarkersForImage(imageShape.id);
      });

      saveCanvasState();
      const zoom = engineRef.current.getState().viewport.zoom;
      setZoomLevel(Math.round(zoom * 100));
    }

    // If we just finished drawing a new shape (not moving/resizing), switch to select tool and open panel
    if (isDrawing && tool !== 'select' && !isResizing && !isGroupResizing) {
      // Check if the newly created shape has a valid size
      const shapesMap = engineRef.current.getState().shapes;
      const currentShapes = Array.from(shapesMap.values());
      const lastShapeId = Array.from(shapesMap.keys()).pop();
      const lastShape = lastShapeId ? shapesMap.get(lastShapeId) : null;

      // Detect "empty" or "accidental click" shapes
      let isEmpty = false;
      if (lastShape && lastShape.id === selectedShapeId) {
        if (lastShape.type === 'rectangle' || lastShape.type === 'image' || lastShape.type === 'text') {
          if (Math.abs((lastShape as any).width) < 1 && Math.abs((lastShape as any).height) < 1) isEmpty = true;
        } else if (lastShape.type === 'circle') {
          if (Math.abs((lastShape as any).radius) < 1) isEmpty = true;
        }
      }

      if (isEmpty && lastShapeId) {
        // Remove the accidental shape
        engineRef.current.deleteShape(lastShapeId);
        setSelectedShapeId(null);
        setTool('select');
      } else {
        setTool('select');
        updateSelectedShapesState();
      }
    }

    // Restore selection visibility after drawing
    if (engineRef.current) {
      engineRef.current.setHideSelection(false);
    }

    setIsDrawing(false);
    setIsPanning(false);
    if (canvasRef.current) {
      if (tool === 'pan') canvasRef.current.style.cursor = 'grab';
      else if (tool === 'select') canvasRef.current.style.cursor = 'default';
      else canvasRef.current.style.cursor = 'crosshair';
    }
    setIsResizing(false);
    setIsGroupResizing(false);
    setIsGroupMoving(false);
    setResizeHandle(null);
    setInitialShapeBounds(null);
    setInitialGroupBounds(null);
    setInitialGroupShapeBounds(new Map());
    setInitialGroupFontSizes(new Map());
    setInitialGroupPositions(new Map());
    setInitialFontSize(null);
    setDragStart(null);
    setInitialShapePos(null);
    setInitialMouseWorldPos(null);
    setLastMousePos(null);
    setHoveredShapeId(null);

    // Show the upper floating toolbar after state is cleaned up
    // Use setTimeout to ensure state updates have propagated
    setTimeout(() => {
      updatePropertiesPanelPosition();
    }, 50);
  };

  const getCursorForHandle = (handle: ResizeHandle): string => {
    switch (handle) {
      case 'topLeft':
      case 'bottomRight':
        return 'nwse-resize';
      case 'topRight':
      case 'bottomLeft':
        return 'nesw-resize';
      case 'top':
      case 'bottom':
        return 'ns-resize';
      case 'left':
      case 'right':
        return 'ew-resize';
      default:
        return 'default';
    }
  };


  // Crop handlers
  const handleCropMouseDown = (e: React.MouseEvent, handle: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w') => {
    e.stopPropagation();
    if (!cropRect) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    setCropDragging(handle);
    setCropDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setInitialCropRect({ ...cropRect });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!cropDragging || !cropDragStart || !initialCropRect || !engineRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const currentPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Convert screen delta to world delta
    const startWorld = engineRef.current.screenToWorld(cropDragStart);
    const currentWorld = engineRef.current.screenToWorld(currentPoint);
    const deltaX = currentWorld.x - startWorld.x;
    const deltaY = currentWorld.y - startWorld.y;

    const newCropRect = { ...initialCropRect };

    if (cropDragging === 'move') {
      newCropRect.x = initialCropRect.x + deltaX;
      newCropRect.y = initialCropRect.y + deltaY;
    } else if (cropDragging === 'nw') {
      newCropRect.x = initialCropRect.x + deltaX;
      newCropRect.y = initialCropRect.y + deltaY;
      newCropRect.width = initialCropRect.width - deltaX;
      newCropRect.height = initialCropRect.height - deltaY;
    } else if (cropDragging === 'ne') {
      newCropRect.y = initialCropRect.y + deltaY;
      newCropRect.width = initialCropRect.width + deltaX;
      newCropRect.height = initialCropRect.height - deltaY;
    } else if (cropDragging === 'sw') {
      newCropRect.x = initialCropRect.x + deltaX;
      newCropRect.width = initialCropRect.width - deltaX;
      newCropRect.height = initialCropRect.height + deltaY;
    } else if (cropDragging === 'se') {
      newCropRect.width = initialCropRect.width + deltaX;
      newCropRect.height = initialCropRect.height + deltaY;
    } else if (cropDragging === 'n') {
      newCropRect.y = initialCropRect.y + deltaY;
      newCropRect.height = initialCropRect.height - deltaY;
    } else if (cropDragging === 's') {
      newCropRect.height = initialCropRect.height + deltaY;
    } else if (cropDragging === 'e') {
      newCropRect.width = initialCropRect.width + deltaX;
    } else if (cropDragging === 'w') {
      newCropRect.x = initialCropRect.x + deltaX;
      newCropRect.width = initialCropRect.width - deltaX;
    }

    // Ensure minimum size
    if (newCropRect.width < 20) {
      if (cropDragging.includes('w')) {
        newCropRect.x = initialCropRect.x + initialCropRect.width - 20;
      }
      newCropRect.width = 20;
    }
    if (newCropRect.height < 20) {
      if (cropDragging.includes('n')) {
        newCropRect.y = initialCropRect.y + initialCropRect.height - 20;
      }
      newCropRect.height = 20;
    }

    setCropRect(newCropRect);
  };

  const handleCropMouseUp = () => {
    setCropDragging(null);
    setCropDragStart(null);
    setInitialCropRect(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      // Don't handle keyboard shortcuts when editing text
      if (editingTextId) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        // Select all shapes
        const allShapes = engineRef.current.getAllShapes();
        allShapes.forEach(shape => {
          engineRef.current?.selectShape(shape.id, true);
        });
        updateSelectedShapesState();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        engineRef.current.undo();
        const zoom = engineRef.current.getState().viewport.zoom;
        setZoomLevel(Math.round(zoom * 100));
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        engineRef.current.redo();
        const zoom = engineRef.current.getState().viewport.zoom;
        setZoomLevel(Math.round(zoom * 100));
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if we're editing text
        if (editingTextId) {
          return; // Let the text input handle backspace
        }

        // Don't delete shapes if user is typing in an input or textarea (like chatbot)
        const activeElement = document.activeElement;
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
          return; // Let the input handle backspace
        }

        // DELETE MARKER IF SELECTED
        if (selectedMarkerId) {
          const markerToDelete = markedPoints.find(m => m.id === selectedMarkerId);
          if (markerToDelete) {
            // Remove from state
            setMarkedPoints(prev => prev.filter(m => m.id !== selectedMarkerId));

            // Remove marker shape from canvas (pin marker with embedded number)
            engineRef.current?.removeShape(markerToDelete.shapeId);

            // Clear selection
            engineRef.current?.clearSelection();  // Clear from CanvasEngine
            setSelectedMarkerId(null);
            // Removed: setShowMarkerSuggestions(false); - state no longer exists

            // Save state
            saveCanvasState();

            console.log('🗑️ Deleted marker #' + markerToDelete.number);
            return; // Don't continue to shape deletion
          }
        }

        const selected = engineRef.current.getSelectedShapes();
        if (selected.length > 0) {
          selected.forEach(shape => {
            engineRef.current?.removeShape(shape.id);
          });
          engineRef.current.clearSelection();
          setSelectedShapeId(null);
          updateSelectedShapesState();
          setPropertiesPanelPos(null);
          saveCanvasState();
        }
      }

      if (e.key === 'v') setTool('select');
      if (e.key === 'r') setTool('rectangle');
      if (e.key === 'c') setTool('circle');
      if (e.key === 'l') setTool('line');
      if (e.key === 'a') setTool('arrow');
      if (e.key === 'f') setTool('freehand');
      if (e.key === 'h') setTool('pan');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTextId]);

  // Listen for marker delete events from AIChatPanel
  useEffect(() => {
    const handleMarkerDelete = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { markerId } = customEvent.detail;

      const markerToDelete = markedPoints.find(m => m.id === markerId);
      if (markerToDelete) {
        // Remove from state
        setMarkedPoints(prev => prev.filter(m => m.id !== markerId));

        // Remove marker shape from canvas (pin marker with embedded number)
        engineRef.current?.removeShape(markerToDelete.shapeId);

        // Clear selection if this marker was selected
        if (selectedMarkerId === markerId) {
          setSelectedMarkerId(null);
          // Removed: setShowMarkerSuggestions(false); - state no longer exists
        }

        // Save
        saveCanvasState();

        console.log('🗑️ Deleted marker via chat panel');
      }
    };

    window.addEventListener('marker-delete', handleMarkerDelete);
    return () => window.removeEventListener('marker-delete', handleMarkerDelete);
  }, [markedPoints, selectedMarkerId]);

  // Sync hover state with canvas engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setHoveredShape(hoveredShapeId);
    }
  }, [hoveredShapeId]);

  const handleUndo = () => {
    if (engineRef.current) {
      engineRef.current.undo();
      const zoom = engineRef.current.getState().viewport.zoom;
      setZoomLevel(Math.round(zoom * 100));
    }
  };

  const handleRedo = () => {
    if (engineRef.current) {
      engineRef.current.redo();
      const zoom = engineRef.current.getState().viewport.zoom;
      setZoomLevel(Math.round(zoom * 100));
    }
  };

  const handleZoomChange = (newZoom: number) => {
    if (!engineRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const currentZoom = engineRef.current.getState().viewport.zoom;
    const factor = newZoom / 100 / currentZoom;
    engineRef.current.zoom(factor, centerX, centerY);
    setZoomLevel(newZoom);
    setIsZoomManual(true); // User manually changed zoom level
    setIsZoomMenuOpen(false);
  };

  const handleSize = () => {
    if (!engineRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Smoothly pan to center
    engineRef.current.setViewport({ x: centerX, y: centerY, zoom: 1 });
    setZoomLevel(100);
    setIsZoomManual(true); // User manually reset size
    setIsZoomMenuOpen(false);
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDropdownEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setIsDropdownOpen(true);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 200);
  };

  const handleDropdownItemClick = (item: string) => {
    console.log('Dropdown item clicked:', item);
    setIsDropdownOpen(false);

    // Handle "Back to files" - navigate to home page with canvas tab
    if (item === 'Back to files') {
      router.push('/?tab=canvas');
      return;
    }


    // TODO: Add actual functionality for other dropdown items
  };

  return (
    <div className="w-full h-screen bg-white text-black flex">
      {/* Left Sidebar */}
      <div className="fixed left-0 top-0 z-[100] w-[55px] m-4 h-[calc(100vh-2rem)] flex flex-col items-center py-4 gap-6 rounded-[35px] sidebar-glass-panel">
        {/* Logo */}
        <div
          className="mb-8 relative group"
          onMouseEnter={handleDropdownEnter}
          onMouseLeave={handleDropdownLeave}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer shadow-lg"
            style={{
              background: '#263341',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            W
          </div>

          {/* Dropdown Menu */}
          <div
            className={`absolute left-12 top-0 w-[200px] rounded-xl border border-gray-200 shadow-2xl z-[70] py-1 transition-all duration-200 origin-top-left ${isDropdownOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
            style={{
              backgroundColor: 'white',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
            }}
          >
            <button
              onClick={() => handleDropdownItemClick('Back to files')}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-[#656565] hover:text-white transition-colors"
            >
              Back to files
            </button>

            <div className="w-full h-px bg-gray-200 my-1" />

            <button
              onClick={() => handleDropdownItemClick('Create new file')}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-[#656565] hover:text-white transition-colors"
            >
              Create new file
            </button>

            <button
              onClick={() => handleDropdownItemClick('Duplicate file')}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-[#656565] hover:text-white transition-colors"
            >
              Duplicate file
            </button>

            <div className="w-full h-px bg-gray-200 my-1" />

            <button
              onClick={() => handleDropdownItemClick('Share file')}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-[#656565] hover:text-white transition-colors"
            >
              Share file
            </button>

            <div className="w-full h-px bg-gray-200 my-1" />

            <button
              onClick={() => handleDropdownItemClick('Preferences')}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-[#656565] hover:text-white transition-colors flex items-center justify-between group"
            >
              <span>Preferences</span>
              <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-white transition-colors" />
            </button>

            <div className="w-full h-px bg-gray-200 my-1" />

            <button
              onClick={async () => {
                await signOut();
                router.push('/login');
              }}
              className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-[#656565] hover:text-white transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Navigation Icons */}
        {/* Navigation Icons */}
        <div className="flex flex-col gap-4 flex-1">

          {/* Upload Button with Tooltip */}
          <div className="group relative flex items-center justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 flex items-center justify-center text-[#263341] hover:text-black hover:bg-gray-100 rounded-full transition-colors"
            >
              <Upload className="w-5 h-5 stroke-2" />
            </button>
            <div className="absolute left-14 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
              }}
            >
              Upload Image
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={async (e) => {
              const files = e.target.files;
              console.log('📷 Files selected:', files?.length);
              if (!files || files.length === 0) {
                console.log('❌ No files selected');
                return;
              }
              if (!engineRef.current || !canvasRef.current) {
                console.error('❌ Canvas not ready');
                return;
              }

              const token = localStorage.getItem('auth_token');
              if (!token) {
                console.error('❌ No auth token');
                alert('Please log in to upload images');
                e.target.value = '';
                return;
              }

              if (!currentProjectId) {
                console.error('❌ No project ID');
                alert('Please save your project first');
                e.target.value = '';
                return;
              }

              // Calculate initial center position
              const canvasRect = canvasRef.current.getBoundingClientRect();
              const centerX = canvasRect.width / 2;
              const centerY = canvasRect.height / 2;
              const initialWorldPoint = engineRef.current.screenToWorld({ x: centerX, y: centerY });

              // Process each file
              const fileArray = Array.from(files);
              for (let fileIndex = 0; fileIndex < fileArray.length; fileIndex++) {
                const file = fileArray[fileIndex];
                console.log(`📷 Processing file ${fileIndex + 1}/${fileArray.length}:`, file.name, file.type, file.size);

                await new Promise<void>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    const dataUrl = event.target?.result as string;
                    console.log(`📷 FileReader loaded image ${fileIndex + 1}, dataUrl length:`, dataUrl?.length);
                    if (!dataUrl || !engineRef.current || !canvasRef.current) {
                      console.error('❌ Missing required data:', { hasDataUrl: !!dataUrl, hasEngine: !!engineRef.current, hasCanvas: !!canvasRef.current });
                      resolve();
                      return;
                    }

                    // Get image dimensions first
                    const img = new Image();
                    img.onload = async () => {
                      console.log(`📷 Image ${fileIndex + 1} loaded, dimensions:`, img.width, 'x', img.height);
                      if (!engineRef.current || !canvasRef.current) {
                        console.error('❌ Engine or canvas lost during image load');
                        resolve();
                        return;
                      }

                      // Scale down if too large
                      const maxWidth = 400;
                      const maxHeight = 400;
                      let width = img.width;
                      let height = img.height;

                      if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = width * ratio;
                        height = height * ratio;
                      }

                      // Position images with offset (50px spacing for each subsequent image)
                      const offset = fileIndex * 50;
                      const x = initialWorldPoint.x - width / 2 + offset;
                      const y = initialWorldPoint.y - height / 2 + offset;

                      // Create placeholder shape with loading state
                      const placeholderId = `image-uploading-${Date.now()}-${Math.random()}`;
                      const placeholderShape: ImageShape = {
                        id: placeholderId,
                        type: 'image',
                        x,
                        y,
                        width,
                        height,
                        src: dataUrl, // Show local preview while uploading
                        style: {
                          opacity: 0.5, // Dim to indicate loading
                        },
                      };

                      console.log(`📷 Adding placeholder shape ${fileIndex + 1}:`, placeholderId);
                      engineRef.current.addShape(placeholderShape);
                      if (fileIndex === fileArray.length - 1) {
                        // Select the last image
                        engineRef.current.selectShape(placeholderId);
                        setSelectedShapeId(placeholderId);
                      }
                      engineRef.current.render(); // Force render to show placeholder
                      updateSelectedShapesState();
                      setUploadingImageId(placeholderId);
                      console.log(`📷 Placeholder ${fileIndex + 1} added, starting upload...`);

                      try {
                        // Upload to Supabase Storage via backend
                        const response = await fetch(`${API_BASE_URL}/upload-canvas-image`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            imageData: dataUrl,
                            projectId: currentProjectId,
                          }),
                        });

                        console.log(`📷 Upload ${fileIndex + 1} response status:`, response.status);
                        if (!response.ok) {
                          const errorData = await response.json();
                          console.error(`❌ Upload ${fileIndex + 1} failed:`, errorData);
                          throw new Error(errorData.error || errorData.message || 'Upload failed');
                        }

                        const result = await response.json();
                        console.log(`📷 Upload ${fileIndex + 1} result:`, result);
                        const { url } = result;

                        // Update the shape with the Supabase URL
                        if (engineRef.current) {
                          engineRef.current.updateShape(placeholderId, {
                            src: url,
                            style: { opacity: 1 },
                          });
                          engineRef.current.saveState();
                          engineRef.current.render();
                          saveCanvasState();
                          updateSelectedShapesState();
                        }

                        console.log(`📷 Image ${fileIndex + 1} uploaded successfully:`, url);
                      } catch (uploadError: unknown) {
                        console.error(`❌ Failed to upload image ${fileIndex + 1}:`, uploadError);
                        // Remove the placeholder on failure
                        if (engineRef.current) {
                          engineRef.current.removeShape(placeholderId);
                          engineRef.current.render();
                        }
                        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
                        alert(`Failed to upload image ${file.name}: ${errorMessage}`);
                      } finally {
                        setUploadingImageId(null);
                        resolve();
                      }
                    };

                    img.onerror = () => {
                      console.error(`❌ Failed to load image ${fileIndex + 1} preview`);
                      alert(`Failed to load the selected image: ${file.name}`);
                      resolve();
                    };
                    img.src = dataUrl;
                  };

                  reader.onerror = () => {
                    console.error(`❌ Failed to read file ${fileIndex + 1}`);
                    alert(`Failed to read the selected file: ${file.name}`);
                    resolve();
                  };
                  reader.readAsDataURL(file);
                });
              }

              // Reset input so same files can be selected again
              e.target.value = '';
            }}
          />

          {/* Shapes Menu with Tooltip */}
          <div className="relative group" data-shapes-menu>
            <button
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${tool === 'rectangle' || tool === 'circle'
                ? 'bg-[#1a1a1a] text-white shadow-lg'
                : isShapesMenuOpen
                  ? 'bg-gray-200 text-black'
                  : 'text-[#263341] hover:text-black hover:bg-gray-100'
                }`}
              onClick={(e) => {
                e.stopPropagation();
                setIsShapesMenuOpen((prev) => !prev);
              }}
            >
              <Shapes className="w-5 h-5 stroke-2" />
            </button>
            <div className="absolute left-14 top-2 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
              }}
            >
              Shapes
            </div>
            {isShapesMenuOpen && (
              <div className="absolute left-12 top-0 bg-white text-[#4A4A4A] rounded-2xl shadow-[0px_4px_12px_rgba(0,0,0,0.1)] border border-[#E0E0E0] w-50 p-4 z-[120]">
                <div className="text-[14px] font-medium mb-3">Shapes</div>
                <div className="flex items-center gap-4">
                  {[
                    { key: 'square', toolName: 'rectangle', Icon: () => <div className="w-5 h-5 border border-[#263341]" />, action: () => setTool('rectangle') },
                    { key: 'circle', toolName: 'circle', Icon: () => <div className="w-5 h-5 border border-[#263341] rounded-full" />, action: () => setTool('circle') },
                    {
                      key: 'triangle', toolName: null, Icon: () => (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#263341" strokeWidth="1.5">
                          <path d="M12 5L4 19H20L12 5Z" />
                        </svg>
                      ), action: () => alert('Triangle coming soon')
                    },
                    {
                      key: 'star', toolName: null, Icon: () => (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#263341" strokeWidth="1.5">
                          <path d="M12 3l2.09 6.26L20 9.27l-5 3.64L16.18 19 12 15.77 7.82 19 9 12.91l-5-3.64 5.91-.01L12 3z" />
                        </svg>
                      ), action: () => alert('Star coming soon')
                    },
                  ].map(({ key, toolName, Icon, action }) => (
                    <button
                      key={key}
                      onClick={() => {
                        action();
                        setIsShapesMenuOpen(false);
                      }}
                      className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${toolName && tool === toolName
                        ? 'bg-[#1a1a1a] text-white'
                        : 'text-[#263341] hover:text-[#8b5cf6]'
                        }`}
                      title={key}
                    >
                      <Icon />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Text Tool with Tooltip */}
          <div className="group relative flex items-center justify-center">
            <button
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${tool === 'text'
                ? 'bg-[#1a1a1a] text-white shadow-lg'
                : 'text-[#263341] hover:text-black hover:bg-gray-100'
                }`}
              onClick={() => setTool('text')}
            >
              <Type className="w-5 h-5 stroke-2" />
            </button>
            <div className="absolute left-14 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
              }}
            >
              Text Tool
            </div>
          </div>

          {/* Pencil Tool with Tooltip */}
          <div className="group relative flex items-center justify-center">
            <button
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${tool === 'freehand'
                ? 'bg-[#1a1a1a] text-white shadow-lg'
                : 'text-[#263341] hover:text-black hover:bg-gray-100'
                }`}
              onClick={() => setTool('freehand')}
            >
              <Pencil className="w-5 h-5 stroke-2" />
            </button>
            <div className="absolute left-14 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
              }}
            >
              Pencil Tool
            </div>
          </div>

          {/* AI Chat Button with Tooltip */}
          <div className="group relative flex items-center justify-center">
            <button
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isChatPanelOpen ? 'bg-[#263341] text-white shadow-lg' : 'text-[#263341] hover:text-black hover:bg-gray-100'
                }`}
              onClick={() => setIsChatPanelOpen(!isChatPanelOpen)}
            >
              <Bot className="w-5 h-5 stroke-2" />
            </button>
            <div className="absolute left-14 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
              }}
            >
              Canvas AI Assistant
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Project Name Display - Fixed at top left */}
        {currentProjectId && (
          <div className="fixed top-6 left-[88px] z-40">
            {isLoadingCanvas ? (
              <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 shadow-sm min-w-[200px]">
                Loading...
              </div>
            ) : editingProjectName ? (
              <input
                type="text"
                value={tempProjectName}
                onChange={(e) => setTempProjectName(e.target.value)}
                onBlur={handleProjectNameBlur}
                onKeyDown={handleProjectNameKeyDown}
                autoFocus
                className="glass-input rounded-full px-4 py-2 text-sm min-w-[200px] outline-none transition-all duration-200"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  color: '#000000',
                  fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                  fontWeight: '500',
                  boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.5), 0 2px 4px rgba(0, 0, 0, 0.05)'
                }}
              />
            ) : (
              <div
                onClick={handleProjectNameClick}
                className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl px-4 py-2 text-sm text-black shadow-sm min-w-[200px] cursor-pointer hover:border-gray-300 transition-colors"
              >
                <div className="truncate">{currentProjectName}</div>
              </div>
            )}
          </div>
        )}

        {/* Save Button - Fixed next to project name */}
        {currentProjectId && (
          <div className="fixed top-6 left-[300px] z-40">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 shadow-md ${isSaving
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : saveStatus === 'saved'
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-[#263341] text-white hover:bg-white hover:text-black border border-transparent hover:border-gray-200'
                }`}
              style={{
                fontFamily: 'var(--font-poppins), Poppins, sans-serif'
              }}
              title={isSaving ? 'Saving...' : 'Save canvas'}
            >
              {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        )}



        {/* Shape Settings Panel */}
        <ShapeSettingsPanel
          isOpen={isSettingsPanelOpen}
          selectedShapes={selectedShapes}
          onClose={() => setIsSettingsPanelOpen(false)}
          onSettingsChange={handleShapeSettingsChange}
          onCropImage={handleCropImageFromPanel}
          onDownloadImage={handleDownloadImageFromPanel}
          onDuplicateShape={handleDuplicateShapeFromPanel}
        />

        {/* AI Chat Panel */}
        <AIChatPanel
          isOpen={isChatPanelOpen}
          onClose={() => setIsChatPanelOpen(false)}
          selectedShapes={selectedShapes}
          allShapes={allShapesState}
          onAddShape={handleAddShapeFromChat}
          onUpdateShape={handleUpdateShapeFromChat}
          onRemovePlaceholder={removePlaceholder}
          onGenerateImage={handleGenerateImageForChat}
          onCaptureCanvas={captureCanvasForAI}
          onFocusShape={handleFocusShapeFromChat}
          onCenterToShape={handleCenterToShape}
          projectId={currentProjectId}
          onNewCanvas={() => {
            // Clear markers and selection when starting a new chat
            setMarkedPoints([]);
            if (engineRef.current) {
              engineRef.current.clearSelection();
              updateSelectedShapesState();
            }
          }}
        />

        {/* Removed: Marker Suggestions Panel - popup no longer used */}
        {/* User has implemented custom marker deletion logic */}

        {/* Canvas Area */}
        <div data-canvas-area className="flex-1 overflow-hidden relative" style={{ backgroundColor: '#fafcff' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            className="w-full h-full"
            style={{
              display: 'block',
              cursor: isPanning ? 'grabbing' :
                tool === 'pan' ? 'grab' :
                  tool === 'select' ? 'default' :
                    'crosshair'
            }}
          />

          {/* Arrow Overlay - SVG arrows connecting reference to generated images */}
          {engineRef.current && (
            <CanvasArrows
              shapes={engineRef.current.getAllShapes()}
              viewport={engineRef.current.getState().viewport}
              updateTrigger={dragUpdateTrigger}
              isSelecting={isSelecting}
            />
          )}

          {/* Selection Box Overlay */}
          {isSelecting && selectionBox && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: `${Math.min(selectionBox.start.x, selectionBox.end.x)}px`,
                top: `${Math.min(selectionBox.start.y, selectionBox.end.y)}px`,
                width: `${Math.abs(selectionBox.end.x - selectionBox.start.x)}px`,
                height: `${Math.abs(selectionBox.end.y - selectionBox.start.y)}px`,
                backgroundColor: 'rgba(24, 160, 251, 0.12)',
                border: '1.5px solid #18A0FB',
                borderRadius: '1px'
              }}
            />
          )}

          {/* Image Upload Loading Overlay */}
          {uploadingImageId && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="bg-black/70 text-white px-6 py-4 rounded-lg flex items-center gap-3 shadow-lg">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Uploading image...</span>
              </div>
            </div>
          )}

          {/* Migration Progress Overlay */}
          {isMigratingImages && migrationProgress && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="bg-black/70 text-white px-6 py-4 rounded-lg flex flex-col items-center gap-3 shadow-lg">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">
                  Migrating images to cloud storage...
                </span>
                <span className="text-xs text-gray-300">
                  {migrationProgress.current} / {migrationProgress.total}
                </span>
              </div>
            </div>
          )}

          {/* Text Editing Popup */}
          {isEditingText && textEditPopupPos && textEditingImageId && (
            <div
              className="absolute bg-white rounded-xl shadow-2xl border border-gray-200 z-50"
              style={{
                left: `${textEditPopupPos.x}px`,
                top: `${textEditPopupPos.y}px`,
                width: '300px',
                maxHeight: '600px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Type className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Edit Text</h3>
                </div>
              </div>

              {/* Text Fields */}
              <div className="px-5 py-4 max-h-[400px] overflow-y-auto">
                {extractedTextRegions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Type className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No text detected</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {extractedTextRegions.map((region, index) => (
                      <div key={index} className="relative">
                        <input
                          type="text"
                          value={editedTextRegions[index] || ''}
                          onChange={(e) => {
                            const newRegions = [...editedTextRegions];
                            newRegions[index] = e.target.value;
                            setEditedTextRegions(newRegions);
                          }}
                          className="glass-input w-full px-3 py-2 rounded-lg text-sm transition-all duration-200"
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid rgba(124, 92, 255, 0.3)',
                            color: '#000000',
                            fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                            fontWeight: '500',
                            boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 2px 4px rgba(124, 92, 255, 0.2)'
                          }}
                          placeholder="Enter text..."
                        />
                        {editedTextRegions[index] !== region.text && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full" title="Modified" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error Message */}
              {textExtractionError && (
                <div className="px-5 py-3 bg-red-50 border-t border-red-100">
                  <p className="text-sm text-red-600">{textExtractionError}</p>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setIsEditingText(false);
                    setExtractedTextRegions([]);
                    setEditedTextRegions([]);
                    setTextEditingImageId(null);
                    setTextEditPopupPos(null);
                    setTextExtractionError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isGeneratingEditedImage}
                >
                  Cancel
                </button>

                <button
                  onClick={async () => {
                    if (!engineRef.current || !textEditingImageId) return;

                    const imageShape = engineRef.current.getShape(textEditingImageId) as ImageShape;
                    if (!imageShape) return;

                    // Check if any text was actually changed
                    const hasChanges = extractedTextRegions.some(
                      (region, index) => region.text !== editedTextRegions[index]
                    );

                    if (!hasChanges) {
                      alert('No changes detected. Please edit at least one text field.');
                      return;
                    }

                    setIsGeneratingEditedImage(true);
                    setTextExtractionError(null);

                    try {
                      // Build prompt for Reve Edit
                      const replacements = extractedTextRegions
                        .map((region, index) => {
                          if (region.text !== editedTextRegions[index]) {
                            return `Replace "${region.text}" with "${editedTextRegions[index]}"`;
                          }
                          return null;
                        })
                        .filter(Boolean);

                      const prompt = replacements.join('. ') + '.';

                      console.log('🎨 Generating edited image with prompt:', prompt);

                      // Call image generation API with Reve Edit model
                      const response = await fetch(`${API_BASE_URL}/generate-image`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          modelId: 'reve/edit',
                          image: imageShape.src,
                          prompt: prompt,
                          version: 'latest',
                        }),
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to generate edited image');
                      }

                      const data = await response.json();

                      if (!data.success || !data.imageUrl) {
                        throw new Error('No image URL returned from generation');
                      }

                      console.log('✅ Generated edited image:', data.imageUrl);

                      // Update the image shape with new URL
                      const updatedShape: ImageShape = {
                        ...imageShape,
                        src: data.imageUrl,
                      };

                      engineRef.current.updateShape(imageShape.id, updatedShape);
                      updateSelectedShapesState();
                      saveCanvasState();

                      // Close popup
                      setIsEditingText(false);
                      setExtractedTextRegions([]);
                      setEditedTextRegions([]);
                      setTextEditingImageId(null);
                      setTextEditPopupPos(null);
                      setTextExtractionError(null);

                    } catch (error: any) {
                      console.error('❌ Error generating edited image:', error);
                      setTextExtractionError(error.message || 'Failed to generate edited image');
                    } finally {
                      setIsGeneratingEditedImage(false);
                    }
                  }}
                  className="px-5 py-2 text-sm font-medium text-white bg-[#263341] rounded-lg hover:bg-[#1e2832] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={isGeneratingEditedImage || extractedTextRegions.length === 0}
                >
                  {isGeneratingEditedImage ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    `Generate`
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Properties Panel */}
          {propertiesPanelPos && (selectedShapeId || editingTextId) && engineRef.current && (() => {
            const targetId = selectedShapeId || editingTextId;
            const shape = engineRef.current.getShape(targetId!);
            if (!shape) return null;

            const bounds = engineRef.current.getShapeBoundsInScreen(shape);
            if (!bounds) return null;

            const width = shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'image' ? Math.round(shape.width) :
              shape.type === 'circle' ? Math.round(shape.radius * 2) : 0;
            const height = shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'image' ? Math.round(shape.height) :
              shape.type === 'circle' ? Math.round(shape.radius * 2) : 0;
            const fillColor = shape.style.fill || '#808080';
            const strokeColor = shape.style.stroke || 'transparent';
            const opacity = shape.style.opacity ?? 1;

            // For image shapes, show image-specific controls
            if (shape.type === 'image') {
              return (
                <div
                  className="absolute bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] px-2 py-1.5 flex items-center gap-1 z-50 border border-gray-100"
                  style={{
                    left: `${propertiesPanelPos.x}px`,
                    top: `${propertiesPanelPos.y}px`,
                    transform: 'translate(-50%, -100%)',
                    fontFamily: 'var(--font-poppins), Poppins, sans-serif'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Crop Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCropping(true);
                      setCroppingImageId(selectedShapeId);
                      setCropRect({
                        x: shape.x,
                        y: shape.y,
                        width: width,
                        height: height
                      });
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors shrink-0"
                    title="Crop Image"
                  >
                    <Crop className="w-4 h-4 text-gray-500" />
                    <span className="text-[13px] font-medium">Crop</span>
                  </button>

                  <div className="w-[1px] h-4 bg-gray-100 mx-1" />

                  {/* Duplicate Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!engineRef.current) return;
                      const imageShape = shape as ImageShape;
                      const newShape: ImageShape = {
                        ...imageShape,
                        id: `shape-${Date.now()}-${Math.random()}`,
                        x: imageShape.x + 20,
                        y: imageShape.y + 20,
                      };
                      engineRef.current.addShape(newShape);
                      engineRef.current.clearSelection();
                      engineRef.current.selectShape(newShape.id);
                      setSelectedShapeId(newShape.id);
                      updateSelectedShapesState();
                      saveCanvasState();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors shrink-0"
                    title="Duplicate Image"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                    <span className="text-[13px] font-medium">Duplicate</span>
                  </button>

                  <div className="w-[1px] h-4 bg-gray-100 mx-1" />

                  {/* Download Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const imageShape = shape as ImageShape;
                      const link = document.createElement('a');
                      link.href = imageShape.src;
                      link.download = `image-${Date.now()}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors shrink-0"
                    title="Download Image"
                  >
                    <Download className="w-4 h-4 text-gray-500" />
                    <span className="text-[13px] font-medium">Export</span>
                  </button>

                  <div className="w-[1px] h-4 bg-gray-100 mx-1" />

                  {/* Edit Text Button */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!engineRef.current) return;
                      const imageShape = shape as ImageShape;
                      setIsExtractingText(true);
                      setTextExtractionError(null);
                      setTextEditingImageId(imageShape.id);
                      try {
                        const response = await fetch(`${API_BASE_URL}/extract-text`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ imageUrl: imageShape.src }),
                        });
                        if (!response.ok) throw new Error('Failed to extract text');
                        const data = await response.json();
                        if (!data.success) throw new Error(data.message || 'Text extraction failed');
                        setExtractedTextRegions(data.textRegions);
                        setEditedTextRegions(data.textRegions.map((r: any) => r.text));
                        setIsEditingText(true);
                      } catch (error: any) {
                        setTextExtractionError(error.message || 'Failed to extract text');
                      } finally {
                        setIsExtractingText(false);
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors shrink-0 relative"
                    title="Edit Text"
                    disabled={isExtractingText}
                  >
                    {isExtractingText ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Type className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="text-[13px] font-medium">Edit Text</span>
                    <span className="absolute -top-1 -right-1 flex items-center justify-center px-1 py-0.5 bg-blue-500 text-white text-[8px] font-bold rounded-full shadow-sm animate-pulse">NEW</span>
                  </button>
                </div>
              );
            }

            // For text shapes, show different controls
            if (shape.type === 'text') {
              const textShape = shape;
              const fontFamily = textShape.style.fontFamily || 'Inter';
              const fontWeightCode = textShape.style.fontWeight || '400';

              const weightMap: Record<string, string> = {
                '100': 'Thin', '200': 'Extra Light', '300': 'Light', '400': 'Regular',
                '500': 'Medium', '600': 'Semi Bold', '700': 'Bold', '800': 'Extra Bold', '900': 'Black',
                'Regular': 'Regular', 'Bold': 'Bold'
              };

              return (
                <div
                  className="absolute rounded-2xl shadow-2xl flex items-center p-1.5 gap-1.5 z-[105]"
                  style={{
                    left: `${propertiesPanelPos.x}px`,
                    top: `${propertiesPanelPos.y}px`,
                    transform: 'translate(-50%, -100%)',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                    fontFamily: 'var(--font-poppins), Poppins, sans-serif'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Fill Color Circles */}
                  <div className="flex items-center gap-1 px-1.5 ml-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setFillPickerPos({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
                        setIsFillPickerOpen(true);
                        setIsFontFamilyOpen(false);
                        setIsFontWeightOpen(false);
                      }}
                      className="w-5 h-5 rounded-full border border-gray-200 transition-transform active:scale-95 shadow-sm hover:scale-105"
                      style={{ backgroundColor: fillColor === 'transparent' ? '#000000' : fillColor }}
                      title="Text Color"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPropertiesPanelPos({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
                        const targetId = selectedShapeId || editingTextId;
                        const s = engineRef.current?.getShape(targetId!);
                        if (s) {
                          setFillPickerPos({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
                          setIsFillPickerOpen(true);
                          // Use a custom property or state to indicate we're picking background
                          (window as any).__isPickingBackground = true;
                        }
                      }}
                      className="w-5 h-5 rounded-full border border-gray-200 shadow-sm hover:scale-105"
                      style={{ backgroundColor: shape.style.backgroundColor || '#ffffff' }}
                      title="Background Color"
                    />
                  </div>

                  <div className="w-[1px] h-6 bg-gray-200/60 mx-1" />

                  {/* Font Family Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFontFamilyOpen(!isFontFamilyOpen);
                        setIsFontWeightOpen(false);
                      }}
                      className="h-9 px-3 text-[13px] font-medium text-black bg-white/50 hover:bg-white rounded-xl transition-all border border-gray-100 flex items-center gap-2 min-w-[90px]"
                    >
                      <span className="truncate">{fontFamily}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-40" />
                    </button>
                    {isFontFamilyOpen && (
                      <div className="absolute top-full mt-2 left-0 bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-2xl py-1 z-[110] min-w-[140px] overflow-hidden">
                        {['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Verdana'].map((font) => (
                          <button
                            key={font}
                            onClick={() => {
                              const targetId = selectedShapeId || editingTextId;
                              engineRef.current?.updateShape(targetId!, {
                                style: { ...textShape.style, fontFamily: font },
                              });
                              engineRef.current?.saveState();
                              saveCanvasState();
                              setIsFontFamilyOpen(false);
                            }}
                            className="w-full px-4 py-2 text-[13px] text-left text-black hover:bg-black/5 transition-colors"
                          >
                            {font}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Font Weight Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFontWeightOpen(!isFontWeightOpen);
                        setIsFontFamilyOpen(false);
                      }}
                      className="h-9 px-3 text-[13px] font-medium text-black bg-white/50 hover:bg-white rounded-xl transition-all border border-gray-100 flex items-center gap-2 min-w-[90px]"
                    >
                      <span className="truncate">{weightMap[fontWeightCode] || fontWeightCode}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-40" />
                    </button>
                    {isFontWeightOpen && (
                      <div className="absolute top-full mt-2 left-0 bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-2xl py-1 z-[110] min-w-[140px] overflow-hidden">
                        {['100', '200', '300', '400', '500', '600', '700', '800', '900'].map((weightCode) => (
                          <button
                            key={weightCode}
                            onClick={() => {
                              const targetId = selectedShapeId || editingTextId;
                              engineRef.current?.updateShape(targetId!, {
                                style: { ...textShape.style, fontWeight: weightCode },
                              });
                              engineRef.current?.saveState();
                              saveCanvasState();
                              setIsFontWeightOpen(false);
                            }}
                            className="w-full px-4 py-2 text-[13px] text-left text-black hover:bg-black/5 transition-colors"
                          >
                            {weightMap[weightCode] || weightCode}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-[1px] h-6 bg-gray-200/60 mx-1" />

                  {/* Font Size Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFontSizeOpen(!isFontSizeOpen);
                        setIsFontFamilyOpen(false);
                        setIsFontWeightOpen(false);
                        setIsAlignmentOpen(false);
                      }}
                      className="h-9 px-2 text-[13px] font-medium text-black bg-white/50 hover:bg-white rounded-xl transition-all border border-gray-100 flex items-center gap-1.5 min-w-[60px]"
                    >
                      <span className="truncate">{textShape.style.fontSize || 16}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-40" />
                    </button>
                    {isFontSizeOpen && (
                      <div className="absolute top-full mt-2 left-0 bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-2xl py-1 z-[110] min-w-[80px] max-h-[200px] overflow-y-auto overflow-x-hidden">
                        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96, 120].map((size) => (
                          <button
                            key={size}
                            onClick={() => {
                              const targetId = selectedShapeId || editingTextId;
                              const oldFontSize = textShape.style.fontSize || 16;
                              const scaleFactor = size / oldFontSize;
                              engineRef.current?.updateShape(targetId!, {
                                width: textShape.width * scaleFactor,
                                height: textShape.height * scaleFactor,
                                style: { ...textShape.style, fontSize: size },
                              });
                              engineRef.current?.saveState();
                              saveCanvasState();
                              setIsFontSizeOpen(false);
                            }}
                            className="w-full px-4 py-1.5 text-[13px] text-left text-black hover:bg-black/5 transition-colors"
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Alignment Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAlignmentOpen(!isAlignmentOpen);
                        setIsFontFamilyOpen(false);
                        setIsFontWeightOpen(false);
                        setIsFontSizeOpen(false);
                      }}
                      className="h-9 px-2 text-gray-500 hover:text-black bg-white/50 hover:bg-white rounded-xl transition-all border border-gray-100 flex items-center gap-1"
                    >
                      {(() => {
                        const Icon = ({ left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignLeft }[textShape.style.textAlign || 'left']) || AlignLeft;
                        return <Icon className="w-4 h-4" />;
                      })()}
                      <ChevronDown className="w-3 h-3 opacity-40 ml-0.5" />
                    </button>
                    {isAlignmentOpen && (
                      <div className="absolute top-full mt-2 left-0 bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-2xl p-1 z-[110] flex gap-1 min-w-[120px]">
                        {[
                          { id: 'left', icon: AlignLeft },
                          { id: 'center', icon: AlignCenter },
                          { id: 'right', icon: AlignRight },
                        ].map((align) => (
                          <button
                            key={align.id}
                            onClick={() => {
                              const targetId = selectedShapeId || editingTextId;
                              engineRef.current?.updateShape(targetId!, {
                                style: { ...textShape.style, textAlign: align.id as any },
                              });
                              engineRef.current?.saveState();
                              saveCanvasState();
                              setIsAlignmentOpen(false);
                            }}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${(textShape.style.textAlign || 'left') === align.id
                              ? 'bg-black/10 text-black'
                              : 'text-gray-400 hover:text-black hover:bg-black/5'
                              }`}
                          >
                            <align.icon className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Advanced Settings Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAdvancedOpen(!isAdvancedOpen);
                    }}
                    className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all border ${isAdvancedOpen
                      ? 'bg-black/10 text-black border-black/10'
                      : 'text-gray-500 hover:text-black bg-white/50 hover:bg-white border-gray-100'
                      }`}
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>

                  {/* Advanced Settings Panel */}
                  {isAdvancedOpen && (
                    <div
                      className="absolute top-0 right-0 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 p-5 z-[120] min-w-[320px]"
                      style={{
                        transform: 'translate(calc(100% + 16px), -40%)',
                        fontFamily: 'var(--font-inter), Inter, sans-serif'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-5 px-1">
                        <h3 className="text-[15px] font-semibold text-gray-900">Advanced</h3>
                        <button
                          onClick={() => setIsAdvancedOpen(false)}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-black transition-colors rounded-full hover:bg-gray-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-6">
                        {/* Line Height & Letter Spacing */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="h-11 px-3 bg-gray-50/80 rounded-xl flex items-center gap-3 group transition-colors hover:bg-gray-100">
                            <span className="text-[15px] text-gray-400 group-hover:text-black font-medium">A̅</span>
                            <div className="flex flex-col flex-1">
                              <input
                                type="text"
                                className="bg-transparent border-none outline-none text-[13px] w-full text-black placeholder:text-gray-300 font-medium"
                                placeholder="Auto"
                                value={textShape.style.lineHeight || ''}
                                onChange={(e) => {
                                  const targetId = selectedShapeId || editingTextId;
                                  engineRef.current?.updateShape(targetId!, {
                                    style: { ...textShape.style, lineHeight: e.target.value }
                                  });
                                }}
                              />
                            </div>
                          </div>
                          <div className="h-11 px-3 bg-gray-50/80 rounded-xl flex items-center gap-3 group transition-colors hover:bg-gray-100">
                            <span className="text-[12px] text-gray-400 group-hover:text-black font-bold tracking-tight">|A|</span>
                            <div className="flex flex-col flex-1">
                              <input
                                type="text"
                                className="bg-transparent border-none outline-none text-[13px] w-full text-black placeholder:text-gray-300 font-medium"
                                placeholder="0%"
                                value={textShape.style.letterSpacing !== undefined ? `${textShape.style.letterSpacing}%` : ''}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value.replace('%', ''));
                                  const targetId = selectedShapeId || editingTextId;
                                  engineRef.current?.updateShape(targetId!, {
                                    style: { ...textShape.style, letterSpacing: isNaN(val) ? 0 : val }
                                  });
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Decoration & Lists Row */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 bg-gray-50/80 p-1 rounded-xl flex-1 justify-between">
                            {[
                              { id: 'underline', icon: Underline },
                              { id: 'overline', icon: Minus }, // Placeholder for overline
                              { id: 'strikethrough', icon: Strikethrough },
                            ].map((item) => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  const targetId = selectedShapeId || editingTextId;
                                  const current = textShape.style.textDecoration;
                                  engineRef.current?.updateShape(targetId!, {
                                    style: { ...textShape.style, textDecoration: (current === item.id ? 'none' : item.id) as any }
                                  });
                                }}
                                className={`h-9 flex-1 flex items-center justify-center rounded-lg transition-all ${textShape.style.textDecoration === item.id
                                  ? 'bg-white text-black shadow-sm'
                                  : 'text-gray-400 hover:text-black'
                                  }`}
                              >
                                <item.icon className="w-4 h-4" />
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 bg-gray-50/80 p-1 rounded-xl flex-[0.7] justify-between">
                            {[
                              { id: 'ordered', icon: ListOrdered },
                              { id: 'bullet', icon: List },
                            ].map((item) => (
                              <button
                                key={item.id}
                                className="h-9 flex-1 flex items-center justify-center rounded-lg text-gray-400 hover:text-black transition-all hover:bg-white hover:shadow-sm"
                              >
                                <item.icon className="w-4 h-4" />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Case & Alignment Row */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 bg-gray-50/80 p-1 rounded-xl flex-1 justify-between">
                            {[
                              { id: 'titlecase', label: 'Aa' },
                              { id: 'uppercase', label: 'AA' },
                              { id: 'lowercase', label: 'aa' },
                            ].map((item) => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  const targetId = selectedShapeId || editingTextId;
                                  const current = textShape.style.textCase;
                                  engineRef.current?.updateShape(targetId!, {
                                    style: { ...textShape.style, textCase: (current === item.id ? 'none' : item.id) as any }
                                  });
                                }}
                                className={`h-9 flex-1 flex items-center justify-center rounded-lg transition-all text-sm font-medium ${textShape.style.textCase === item.id
                                  ? 'bg-white text-black shadow-sm'
                                  : 'text-gray-400 hover:text-black'
                                  }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 bg-gray-50/80 p-1 rounded-xl flex-[0.7] justify-between">
                            {[
                              { id: 'indent', icon: ChevronRight },
                              { id: 'align', icon: AlignCenter, rotate: 90 },
                            ].map((item) => (
                              <button
                                key={item.id}
                                className={`h-9 flex-1 flex items-center justify-center rounded-lg text-gray-400 hover:text-black transition-all hover:bg-white hover:shadow-sm`}
                                style={{ transform: item.rotate ? `rotate(${item.rotate}deg)` : 'none' }}
                              >
                                <item.icon className="w-4 h-4" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // For non-text shapes, show original controls
            return (
              <div
                className="absolute bg-white rounded-lg shadow-md px-3 py-2.5 flex items-center gap-2 z-50"
                style={{
                  left: `${propertiesPanelPos.x}px`,
                  top: `${propertiesPanelPos.y}px`,
                  transform: 'translate(-50%, -100%)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Fill Color */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setFillPickerPos({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
                    setIsFillPickerOpen(true);
                    setIsStrokePickerOpen(false);
                    setIsOpacityOpen(false);
                    setIsRadiusOpen(false);
                  }}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center"
                  style={{ backgroundColor: fillColor === 'transparent' ? 'white' : fillColor }}
                  title="Fill Color"
                >
                  {fillColor === 'transparent' && (
                    <div className="w-full h-full rounded-full" style={{
                      backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 4px 4px',
                    }} />
                  )}
                </button>

                {/* Stroke Color */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setStrokePickerPos({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
                    setIsStrokePickerOpen(true);
                    setIsFillPickerOpen(false);
                    setIsOpacityOpen(false);
                    setIsRadiusOpen(false);
                  }}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center bg-white"
                  title="Stroke Color"
                >
                  {strokeColor === 'transparent' || !strokeColor ? (
                    <Minus className="w-4 h-4 text-gray-400 rotate-45" />
                  ) : (
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: strokeColor }} />
                  )}
                </button>

                {/* Line Style Icon */}
                <button
                  data-line-style-button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLineStyleOpen(!isLineStyleOpen);
                    setIsFillPickerOpen(false);
                    setIsStrokePickerOpen(false);
                    setIsOpacityOpen(false);
                    setIsRadiusOpen(false);
                  }}
                  className={`w-8 h-8 flex items-center justify-center text-black hover:text-gray-700 ${isLineStyleOpen ? 'bg-gray-200 rounded' : ''}`}
                  title="Line Style"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>

                {/* Width Input */}
                {(shape.type === 'rectangle' || shape.type === 'circle') && (
                  <>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={width}
                        onChange={(e) => {
                          const newWidth = parseInt(e.target.value) || 0;
                          if (shape.type === 'rectangle') {
                            const aspectRatio = aspectRatioLocked && shape.height > 0 ? shape.width / shape.height : 1;
                            engineRef.current?.updateShape(selectedShapeId, {
                              width: newWidth,
                              height: aspectRatioLocked ? newWidth / aspectRatio : shape.height,
                            });
                          } else if (shape.type === 'circle') {
                            engineRef.current?.updateShape(selectedShapeId, {
                              radius: newWidth / 2,
                            });
                          }
                          engineRef.current?.saveState();
                          saveCanvasState();
                        }}
                        className="glass-input w-16 px-2 py-1 text-sm rounded transition-all duration-200"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          border: '1px solid rgba(124, 92, 255, 0.3)',
                          color: '#000000',
                          fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                          fontWeight: '500',
                          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 2px 4px rgba(124, 92, 255, 0.2)'
                        }}
                        placeholder="W"
                      />
                      <span className="text-xs text-black">W</span>
                    </div>

                    <button
                      onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                      className={`w-6 h-6 flex items-center justify-center ${aspectRatioLocked ? 'text-blue-600' : 'text-gray-600'}`}
                      title="Lock Aspect Ratio"
                    >
                      <Link className="w-4 h-4" />
                    </button>

                    {/* Height Input */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => {
                          const newHeight = parseInt(e.target.value) || 0;
                          if (shape.type === 'rectangle') {
                            const aspectRatio = aspectRatioLocked && shape.width > 0 ? shape.height / shape.width : 1;
                            engineRef.current?.updateShape(selectedShapeId, {
                              height: newHeight,
                              width: aspectRatioLocked ? newHeight / aspectRatio : shape.width,
                            });
                          } else if (shape.type === 'circle') {
                            engineRef.current?.updateShape(selectedShapeId, {
                              radius: newHeight / 2,
                            });
                          }
                          engineRef.current?.saveState();
                          saveCanvasState();
                        }}
                        className="glass-input w-16 px-2 py-1 text-sm rounded transition-all duration-200"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          border: '1px solid rgba(124, 92, 255, 0.3)',
                          color: '#000000',
                          fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                          fontWeight: '500',
                          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 2px 4px rgba(124, 92, 255, 0.2)'
                        }}
                        placeholder="H"
                      />
                      <span className="text-xs text-black">H</span>
                    </div>
                  </>
                )}

                {/* Opacity */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setOpacityPos({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
                    setIsOpacityOpen(!isOpacityOpen);
                    setIsFillPickerOpen(false);
                    setIsStrokePickerOpen(false);
                    setIsRadiusOpen(false);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-black cursor-pointer hover:text-gray-700"
                >
                  <div
                    className="w-4 h-4 border border-gray-300 relative"
                    style={{
                      backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 4px 4px',
                    }}
                  />
                  <span>Opacity</span>
                  <ChevronDown className="w-3 h-3" />
                </div>
                {isOpacityOpen && opacityPos && (
                  <div
                    className="fixed bg-white rounded-lg shadow-xl z-50 p-4 w-64 opacity-panel"
                    style={{
                      left: `${opacityPos.x}px`,
                      top: `${opacityPos.y}px`,
                      transform: 'translateX(-50%)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-2">
                      <label className="text-xs text-gray-600 mb-1 block">Opacity</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(opacity * 100)}
                        onChange={(e) => {
                          const newOpacity = parseInt(e.target.value) / 100;
                          engineRef.current?.updateShape(selectedShapeId, {
                            style: { ...shape.style, opacity: newOpacity },
                          });
                          engineRef.current?.saveState();
                          saveCanvasState();
                        }}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0%</span>
                        <span>{Math.round(opacity * 100)}%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Download Icon */}
                <button className="w-8 h-8 flex items-center justify-center text-black hover:text-gray-700" title="Download">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            );
          })()}

          {/* Crop Overlay */}
          {isCropping && cropRect && croppingImageId && engineRef.current && (() => {
            const shape = engineRef.current.getShape(croppingImageId);
            if (!shape || shape.type !== 'image') return null;

            const bounds = engineRef.current.getShapeBoundsInScreen(shape);
            if (!bounds) return null;

            // Convert crop rect from world to screen coordinates
            const cropTopLeft = engineRef.current.worldToScreen({ x: cropRect.x, y: cropRect.y });
            const cropBottomRight = engineRef.current.worldToScreen({
              x: cropRect.x + cropRect.width,
              y: cropRect.y + cropRect.height
            });

            const screenCropRect = {
              x: cropTopLeft.x,
              y: cropTopLeft.y,
              width: cropBottomRight.x - cropTopLeft.x,
              height: cropBottomRight.y - cropTopLeft.y
            };

            return (
              <>
                {/* Dark overlay outside crop area */}
                <div
                  className="absolute inset-0 bg-black bg-opacity-50 pointer-events-none z-40"
                  style={{
                    clipPath: `polygon(
                      0 0,
                      100% 0,
                      100% 100%,
                      0 100%,
                      0 0,
                      ${screenCropRect.x}px ${screenCropRect.y}px,
                      ${screenCropRect.x}px ${screenCropRect.y + screenCropRect.height}px,
                      ${screenCropRect.x + screenCropRect.width}px ${screenCropRect.y + screenCropRect.height}px,
                      ${screenCropRect.x + screenCropRect.width}px ${screenCropRect.y}px,
                      ${screenCropRect.x}px ${screenCropRect.y}px
                    )`
                  }}
                />

                {/* Crop rectangle border with drag area */}
                <div
                  className="absolute border-2 border-white z-50 cursor-move"
                  style={{
                    left: `${screenCropRect.x}px`,
                    top: `${screenCropRect.y}px`,
                    width: `${screenCropRect.width}px`,
                    height: `${screenCropRect.height}px`,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                  }}
                  onMouseDown={(e) => handleCropMouseDown(e, 'move')}
                  onMouseMove={handleCropMouseMove}
                  onMouseUp={handleCropMouseUp}
                  onMouseLeave={handleCropMouseUp}
                >
                  {/* Resize handles */}
                  {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
                    const isCorner = handle.length === 2;
                    const handleSize = 10;
                    const positions: Record<string, React.CSSProperties> = {
                      nw: { top: -handleSize / 2, left: -handleSize / 2, cursor: 'nwse-resize' },
                      n: { top: -handleSize / 2, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
                      ne: { top: -handleSize / 2, right: -handleSize / 2, cursor: 'nesw-resize' },
                      e: { top: '50%', right: -handleSize / 2, transform: 'translateY(-50%)', cursor: 'ew-resize' },
                      se: { bottom: -handleSize / 2, right: -handleSize / 2, cursor: 'nwse-resize' },
                      s: { bottom: -handleSize / 2, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
                      sw: { bottom: -handleSize / 2, left: -handleSize / 2, cursor: 'nesw-resize' },
                      w: { top: '50%', left: -handleSize / 2, transform: 'translateY(-50%)', cursor: 'ew-resize' },
                    };

                    return (
                      <div
                        key={handle}
                        className="absolute bg-white border-2 border-blue-500"
                        style={{
                          width: `${handleSize}px`,
                          height: `${handleSize}px`,
                          ...positions[handle],
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCropMouseDown(e, handle as any);
                        }}
                      />
                    );
                  })}
                </div>

                {/* Crop controls */}
                <div
                  className="absolute z-50 flex gap-2"
                  style={{
                    left: `${screenCropRect.x + screenCropRect.width / 2}px`,
                    top: `${screenCropRect.y + screenCropRect.height + 16}px`,
                    transform: 'translateX(-50%)'
                  }}
                >
                  <button
                    onClick={async () => {
                      if (!engineRef.current || !canvasRef.current) return;

                      const imageShape = shape as ImageShape;

                      // Create a temporary canvas to crop the image
                      const tempCanvas = document.createElement('canvas');
                      const tempCtx = tempCanvas.getContext('2d');
                      if (!tempCtx) return;

                      // Load the image
                      const img = new Image();
                      img.crossOrigin = 'anonymous';
                      img.src = imageShape.src;

                      await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                      });

                      // Calculate crop region in image coordinates
                      const scaleX = img.width / imageShape.width;
                      const scaleY = img.height / imageShape.height;
                      const cropX = (cropRect.x - imageShape.x) * scaleX;
                      const cropY = (cropRect.y - imageShape.y) * scaleY;
                      const cropW = cropRect.width * scaleX;
                      const cropH = cropRect.height * scaleY;

                      // Set canvas size to crop dimensions
                      tempCanvas.width = cropW;
                      tempCanvas.height = cropH;

                      // Draw cropped portion
                      tempCtx.drawImage(
                        img,
                        cropX, cropY, cropW, cropH,
                        0, 0, cropW, cropH
                      );

                      // Convert to data URL
                      const croppedDataUrl = tempCanvas.toDataURL('image/png');

                      // Update the shape with cropped image
                      engineRef.current.updateShape(croppingImageId, {
                        src: croppedDataUrl,
                        x: cropRect.x,
                        y: cropRect.y,
                        width: cropRect.width,
                        height: cropRect.height
                      });

                      // Exit crop mode
                      setIsCropping(false);
                      setCropRect(null);
                      setCroppingImageId(null);
                      saveCanvasState();
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Apply Crop
                  </button>
                  <button
                    onClick={() => {
                      setIsCropping(false);
                      setCropRect(null);
                      setCroppingImageId(null);
                    }}
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </>
            );
          })()}

          {/* Radius Panel for Rectangles */}
          {isLineStyleOpen && propertiesPanelPos && selectedShapeId && engineRef.current && (() => {
            const shape = engineRef.current.getShape(selectedShapeId);
            if (!shape || shape.type !== 'rectangle') return null;
            const radius = shape.radius || 0;

            return (
              <div
                className="absolute bg-white rounded-lg shadow-md px-3 py-2.5 flex items-center gap-2 z-50 line-style-panel"
                style={{
                  left: `${propertiesPanelPos.x}px`,
                  top: `${propertiesPanelPos.y + 52}px`,
                  transform: 'translateX(-50%)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm text-black">Radius</span>
                <input
                  type="range"
                  min="0"
                  max={Math.min(shape.width, shape.height) / 2}
                  value={radius}
                  onChange={(e) => {
                    const newRadius = parseInt(e.target.value) || 0;
                    engineRef.current?.updateShape(selectedShapeId, {
                      radius: newRadius,
                    });
                    engineRef.current?.saveState();
                    saveCanvasState();
                  }}
                  className="flex-1"
                />
                <input
                  type="number"
                  value={Math.round(radius)}
                  onChange={(e) => {
                    const newRadius = Math.max(0, Math.min(parseInt(e.target.value) || 0, Math.min(shape.width, shape.height) / 2));
                    engineRef.current?.updateShape(selectedShapeId, {
                      radius: newRadius,
                    });
                    engineRef.current?.saveState();
                    saveCanvasState();
                  }}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            );
          })()}

          {/* Text Input Overlay */}
          {editingTextId && textInputPos && engineRef.current && (() => {
            const shape = engineRef.current.getShape(editingTextId);
            if (!shape || shape.type !== 'text') return null;

            // Measure text to calculate width
            const measureText = (text: string) => {
              const ctx = document.createElement('canvas').getContext('2d');
              if (!ctx) return { width: 0, height: 0 };
              const fontSize = shape.style.fontSize || 16;
              const fontFamily = shape.style.fontFamily || 'Arial';
              const fontWeight = shape.style.fontWeight || 'normal';
              ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
              const metrics = ctx.measureText(text || ' ');
              return {
                width: Math.max(50, metrics.width + 10),
                height: (shape.style.fontSize || 16) * 1.2, // Approximate line height
              };
            };

            return (
              <div
                className="fixed z-50"
                style={{
                  left: `${textInputPos.x}px`,
                  top: `${textInputPos.y}px`,
                  transform: `scale(${engineRef.current.getState().viewport.zoom})`,
                  transformOrigin: 'top left',
                }}
                data-text-input-overlay
              >
                <input
                  type="text"
                  value={textInputValue}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setTextInputValue(newValue);
                    if (engineRef.current && shape) {
                      // Update text and measure width in real-time
                      const { width, height } = measureText(newValue || ' ');
                      engineRef.current.updateShape(editingTextId, {
                        text: newValue || ' ',
                        width: width,
                        height: height,
                      }, false, false);
                      // Re-render with text hidden
                      engineRef.current.render(editingTextId);
                      // Update properties panel position as text grows/shrinks
                      updatePropertiesPanelPosition();
                    }
                  }}
                  onBlur={() => {
                    if (engineRef.current && editingTextId) {
                      const shape = engineRef.current.getShape(editingTextId);
                      if (shape && shape.type === 'text') {
                        // Measure final text and resize shape to fit
                        const { width, height } = measureText(textInputValue || ' ');
                        engineRef.current.updateShape(editingTextId, {
                          text: textInputValue || ' ',
                          width: width,
                          height: height,
                          visible: true,
                        });
                        engineRef.current.saveState();
                        saveCanvasState();
                        // Do NOT select the text shape after editing
                        // Also check if text is empty, if so, we might want to delete it
                        if (!textInputValue || textInputValue.trim() === '') {
                          engineRef.current.removeShape(editingTextId);
                        } else {
                          engineRef.current.render();
                        }
                      }
                    }
                    if (textInputValue && textInputValue.trim() !== '') {
                      setTool('select');
                    }
                    setEditingTextId(null);
                    setTextInputPos(null);
                    updateSelectedShapesState();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (engineRef.current && editingTextId) {
                        const shape = engineRef.current.getShape(editingTextId);
                        if (shape && shape.type === 'text') {
                          // Measure final text and resize shape to fit
                          const ctx = document.createElement('canvas').getContext('2d');
                          if (ctx) {
                            const fontSize = shape.style.fontSize || 16;
                            const fontFamily = shape.style.fontFamily || 'Arial';
                            const fontWeight = shape.style.fontWeight || 'normal';
                            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                            const metrics = ctx.measureText(textInputValue || ' ');
                            const width = Math.max(50, metrics.width + 10);
                            const height = (shape.style.fontSize || 16) * 1.2;
                            engineRef.current.updateShape(editingTextId, {
                              text: textInputValue || ' ',
                              width: width,
                              height: height,
                              visible: true,
                            });
                            // Finalize and clear selection
                            // Check if text is empty
                            if (!textInputValue || textInputValue.trim() === '') {
                              engineRef.current.removeShape(editingTextId);
                            } else {
                              engineRef.current.render();
                            }
                          }
                        }
                      }
                      if (textInputValue && textInputValue.trim() !== '') {
                        setTool('select');
                      }
                      setEditingTextId(null);
                      setTextInputPos(null);
                      updateSelectedShapesState();
                    } else if (e.key === 'Escape') {
                      if (engineRef.current && editingTextId) {
                        engineRef.current.updateShape(editingTextId, { visible: true }, false);
                      }
                      setEditingTextId(null);
                      setTextInputPos(null);
                    }
                  }}
                  autoFocus
                  className="outline-none bg-transparent"
                  style={{
                    fontSize: `${shape.style.fontSize || 16}px`,
                    fontFamily: shape.style.fontFamily || 'Arial',
                    color: shape.style.fill || '#000000',
                    minWidth: '2px',
                    width: `${measureText(textInputValue).width + (textInputValue ? 10 : 0)}px`,
                    backgroundColor: shape.style.backgroundColor || 'transparent',
                    border: textInputValue ? '1px solid #60a5fa' : 'none',
                    boxShadow: textInputValue ? '0 0 0 1px rgba(96, 165, 250, 0.5)' : 'none',
                    padding: textInputValue ? '2px 4px' : '0',
                    margin: textInputValue ? '-3px -5px' : '0',
                    caretColor: shape.style.fill || '#000000',
                    outline: 'none'
                  }}
                />
              </div>
            );
          })()}

          {/* Color Pickers */}
          {isFillPickerOpen && fillPickerPos && (selectedShapeId || editingTextId) && engineRef.current && (() => {
            const targetId = selectedShapeId || editingTextId;
            const shape = engineRef.current.getShape(targetId!);
            if (!shape) return null;
            return (
              <ColorPicker
                isOpen={isFillPickerOpen}
                color={(window as any).__isPickingBackground ? (shape.style.backgroundColor || '#ffffff') : (shape.style.fill || '#808080')}
                onChange={(color) => {
                  const targetId = selectedShapeId || editingTextId;
                  const updates = (window as any).__isPickingBackground
                    ? { style: { ...shape.style, backgroundColor: color } }
                    : { style: { ...shape.style, fill: color } };

                  engineRef.current?.updateShape(targetId!, updates);
                  engineRef.current?.saveState();
                  saveCanvasState();
                }}
                title={(window as any).__isPickingBackground ? "Background" : "Fill"}
                onClose={() => {
                  setIsFillPickerOpen(false);
                  (window as any).__isPickingBackground = false;
                }}
                position={fillPickerPos}
              />
            );
          })()}

          {isStrokePickerOpen && strokePickerPos && (selectedShapeId || editingTextId) && engineRef.current && (() => {
            const targetId = selectedShapeId || editingTextId;
            const shape = engineRef.current.getShape(targetId!);
            if (!shape) return null;
            return (
              <ColorPicker
                isOpen={isStrokePickerOpen}
                onClose={() => setIsStrokePickerOpen(false)}
                color={shape.style.stroke || '#ffffff'}
                onChange={(color) => {
                  const targetId = selectedShapeId || editingTextId;
                  engineRef.current?.updateShape(targetId!, {
                    style: { ...shape.style, stroke: color },
                  });
                  engineRef.current?.saveState();
                  saveCanvasState();
                }}
                title="Stroke"
                position={strokePickerPos}
              />
            );
          })()}

          {/* Bottom Floating Toolbar */}
          <div
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 rounded-full px-3 py-2 flex items-center gap-1.5"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #dcdcdc',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.08)'
            }}
          >
            <div className="group relative flex items-center justify-center">
              <button
                onClick={() => setTool('select')}
                className="group w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200"
                style={{
                  background: tool === 'select'
                    ? '#ffffff'
                    : 'transparent',
                  boxShadow: tool === 'select'
                    ? '0 2px 8px rgba(0, 0, 0, 0.1)'
                    : 'none'
                }}
              >
                <MousePointer2 className={`w-5 h-5 transition-colors ${tool === 'select' ? 'text-black' : 'text-gray-400 group-hover:text-black'}`} />
              </button>
              <div className="absolute bottom-12 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                Select
              </div>
            </div>
            <div className="group relative flex items-center justify-center">
              <button
                onClick={() => setTool('pan')}
                className="group w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200"
                style={{
                  background: tool === 'pan'
                    ? '#ffffff'
                    : 'transparent',
                  boxShadow: tool === 'pan'
                    ? '0 2px 8px rgba(0, 0, 0, 0.1)'
                    : 'none'
                }}
              >
                <Hand className={`w-5 h-5 transition-colors ${tool === 'pan' ? 'text-black' : 'text-gray-400 group-hover:text-black'}`} />
              </button>
              <div className="absolute bottom-12 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                Pan
              </div>
            </div>
            <div className="w-px h-5 bg-[#C7CBD4]/20 mx-0.5" />
            <div className="group relative flex items-center justify-center">
              <button
                onClick={handleUndo}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-black/5"
                style={{
                  backgroundColor: 'transparent'
                }}
              >
                <Undo2 className="w-5 h-5 text-[#263341]" />
              </button>
              <div className="absolute bottom-12 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                Undo
              </div>
            </div>
            <div className="group relative flex items-center justify-center">
              <button
                onClick={handleRedo}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-black/5"
                style={{
                  backgroundColor: 'transparent'
                }}
              >
                <Redo2 className="w-5 h-5 text-[#263341]" />
              </button>
              <div className="absolute bottom-12 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                Redo
              </div>
            </div>
            <div className="w-px h-5 bg-[#C7CBD4]/20 mx-0.5" />
            <div className="relative" data-zoom-menu>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomMenuOpen(!isZoomMenuOpen);
                }}
                className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200 flex items-center gap-1.5 shadow-md font-semibold font-poppins ${isZoomMenuOpen
                  ? 'bg-white text-black border border-gray-200'
                  : 'bg-[#263341] text-white hover:bg-white hover:text-black border border-transparent hover:border-gray-200'
                  }`}
              >
                <span>{zoomLevel}%</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute bottom-12 px-3 py-1.5 rounded-lg text-sm text-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[110]"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                Zoom Options
              </div>
              {isZoomMenuOpen && (
                <div
                  className="absolute bottom-full mb-2 w-40 z-50"
                  style={{
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'white',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08)',
                    padding: '6px',
                    fontFamily: 'var(--font-poppins), Poppins, sans-serif'
                  }}
                >
                  <button
                    onClick={handleSize}
                    style={{
                      height: '40px',
                      fontSize: '13px',
                      fontWeight: '500',
                      fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                      borderRadius: '8px'
                    }}
                    className="w-full px-4 text-left transition-all duration-200 dropdown-option text-gray-700 hover:bg-[#656565] hover:text-white"
                  >
                    Size
                  </button>
                  {[25, 50, 75, 100].map((zoom) => (
                    <button
                      key={zoom}
                      onClick={() => handleZoomChange(zoom)}
                      className={`w-full px-4 text-left transition-all duration-200 dropdown-option text-gray-700 hover:bg-[#656565] hover:text-white ${zoomLevel === zoom ? 'bg-[#656565] text-white' : ''
                        }`}
                      style={{
                        height: '40px',
                        fontSize: zoomLevel === zoom ? '14px' : '13px',
                        fontWeight: '500',
                        fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                        borderRadius: '8px'
                      }}
                    >
                      {zoom}%
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Tiers Popup */}
      {
        showSubscriptionPopup && (
          <SubscriptionTiersPopup
            isOpen={showSubscriptionPopup}
            onClose={() => setShowSubscriptionPopup(false)}
            currentCredits={credits || 0}
            creditsRequired={0}
            onSelectTier={async (tierId) => {
              // TODO: Implement payment processing
              console.log('Selected tier:', tierId);
              refreshCredits(); // Refresh after purchase
            }}
          />
        )
      }
    </div >
  );
}

export default function CanvasCanvas({ initialProjectId }: CanvasCanvasProps = {}) {
  return <CanvasCanvasInner initialProjectId={initialProjectId} />;
}
