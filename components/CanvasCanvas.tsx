'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CanvasEngine, ResizeHandle } from '@/lib/canvas/CanvasEngine';
import { Shape, Point, Tool, ImageShape, TextShape } from '@/lib/canvas/types';
import ColorPicker from './ColorPicker';
import {
  ChevronDown,
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
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface CanvasCanvasProps {
  initialProjectId?: string | null;
}

function CanvasCanvasInner({ initialProjectId }: CanvasCanvasProps = {}) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
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
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isTasksMenuOpen, setIsTasksMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [isShapesMenuOpen, setIsShapesMenuOpen] = useState(false);
  const [credits, setCredits] = useState(0.8);
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

      // Fit to screen after loading state
      setTimeout(() => {
        if (engineRef.current) {
          engineRef.current.fitToScreen();
          engineRef.current.render();
          const zoom = engineRef.current.getState().viewport.zoom;
          setZoomLevel(Math.round(zoom * 100));
          console.log('🖼️ Fit to screen complete, zoom:', zoom);
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

  // Update properties panel position when shape is selected or moved
  const updatePropertiesPanelPosition = () => {
    if (!engineRef.current || !canvasRef.current || !selectedShapeId) {
      setPropertiesPanelPos(null);
      return;
    }

    const shape = engineRef.current.getShape(selectedShapeId);
    if (!shape) {
      setPropertiesPanelPos(null);
      return;
    }

    const bounds = engineRef.current.getShapeBoundsInScreen(shape);
    if (!bounds) {
      setPropertiesPanelPos(null);
      return;
    }

    // Position panel above the shape with a small gap, centered horizontally
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const panelHeight = 90; // Approximate height of the properties panel
    const gap = 40; // Gap between panel and shape
    
    // For text shapes, add significant extra gap to ensure text content is fully visible below panel
    const isTextShape = shape.type === 'text';
    const extraGap = isTextShape ? 80 : 0; // Extra gap for text shapes to ensure text is visible
    
    // Position panel above the shape
    const topPosition = bounds.y - panelHeight - gap - extraGap;
    
    // If panel would go off-screen at the top, position it below the shape instead
    const finalY = topPosition < 0 
      ? canvasRect.top + bounds.y + bounds.height + gap
      : canvasRect.top + topPosition;
    
    setPropertiesPanelPos({
      x: canvasRect.left + bounds.centerX,
      y: finalY,
    });
  };

  useEffect(() => {
    updatePropertiesPanelPosition();
  }, [selectedShapeId]);

  // Update panel position smoothly during interactions
  useEffect(() => {
    if (engineRef.current && selectedShapeId && (isDrawing || isResizing || isGroupResizing || isGroupMoving || isPanning)) {
      let animationFrameId: number;
      const update = () => {
        updatePropertiesPanelPosition();
        animationFrameId = requestAnimationFrame(update);
      };
      animationFrameId = requestAnimationFrame(update);
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [selectedShapeId, isDrawing, isResizing, isGroupResizing, isGroupMoving, isPanning]);

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
            console.log('✅ Canvas loaded from backend');

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
          console.log('✅ Canvas loaded from localStorage');
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
  const saveCanvasState = async () => {
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

      console.log('💾 Saving canvas state:', {
        projectId: currentProjectId,
        shapesCount: canvasData.shapes?.length || 0,
        serializedLength: serialized.length
      });

      // Save to localStorage for quick access
      localStorage.setItem(`canvas-${currentProjectId}`, serialized);

      // Save to backend for persistence
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

    // Find all images with base64 data URLs
    shapes.forEach((shape, id) => {
      if (shape.type === 'image') {
        const imageShape = shape as ImageShape;
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

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !canvasRef.current) return;

    // Don't handle canvas interactions in crop mode
    if (isCropping) return;

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
        if (engineRef.current.isPointInGroupBounds(point, selected)) {
          // Start group move
          setIsGroupMoving(true);
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
        // Single shape selection and move
        engineRef.current.selectShape(shape.id, e.shiftKey);
        setSelectedShapeId(shape.id);
        setIsDrawing(true); // Start dragging selected shape
        // Store initial shape position and mouse position for smooth dragging
        const worldPoint = engineRef.current.screenToWorld(point);
        setInitialShapePos({ x: shape.x, y: shape.y });
        setInitialMouseWorldPos(worldPoint);
      } else {
        // Start selection box
        if (!e.shiftKey) {
          engineRef.current.clearSelection();
          setSelectedShapeId(null);
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
      setIsDrawing(true);
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
              fill: '#8b5cf6',
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
              fill: '#8b5cf6',
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
            text: 'Text',
            style: {
              fill: '#ffffff',
              fontSize: 16,
              fontFamily: 'Arial',
            },
          };
          engineRef.current.addShape(shape);
          engineRef.current.selectShape(id);
          setSelectedShapeId(id);
          // Start editing text immediately
          setTimeout(() => {
            setEditingTextId(id);
            setTextInputValue('Text');
            if (canvasRef.current && engineRef.current) {
              const canvasRect = canvasRef.current.getBoundingClientRect();
              const screenPos = engineRef.current.worldToScreen({ x: worldPoint.x, y: worldPoint.y });
              setTextInputPos({
                x: canvasRect.left + screenPos.x,
                y: canvasRect.top + screenPos.y,
              });
              // Hide the text shape while editing
              engineRef.current.render(id);
            }
          }, 0);
          return; // Don't set isDrawing for text
        default:
          return;
      }
      
      engineRef.current.addShape(shape);
      engineRef.current.selectShape(id); // Select the shape after drawing
      setSelectedShapeId(id);
      setIsDrawing(true);
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
      if (selected.length === 1) {
        const hoveredShape = engineRef.current.hitTest(point);
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
      }
      canvasRef.current.style.cursor = 'default';
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
      const selected = engineRef.current.getSelectedShapes();
      engineRef.current.moveGroup(selected, initialGroupPositions, deltaX, deltaY);
      updatePropertiesPanelPosition();
      return;
    }

    if (isResizing && selectedShapeId && resizeHandle && initialShapeBounds) {
      const shape = engineRef.current.getShape(selectedShapeId);
      if (!shape) return;
      const worldCurrent = engineRef.current.screenToWorld(point);
      engineRef.current.resizeShape(shape, resizeHandle, worldCurrent, initialShapeBounds, initialFontSize || undefined);
      updatePropertiesPanelPosition();
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
        updatePropertiesPanelPosition();
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
        engineRef.current.render(shape.id);
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
      }
      
      setIsSelecting(false);
      setSelectionBox(null);
    }
    
    if ((isDrawing || isResizing || isGroupResizing || isGroupMoving) && engineRef.current) {
      engineRef.current.saveState();
      saveCanvasState();
      const zoom = engineRef.current.getState().viewport.zoom;
      setZoomLevel(Math.round(zoom * 100));
    }
    
    // If we just finished drawing a new shape (not moving/resizing), switch to select tool
    if (isDrawing && tool !== 'select' && !isResizing && !isGroupResizing) {
      setTool('select');
    }
    
    setIsDrawing(false);
    setIsPanning(false);
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

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !canvasRef.current) return;

    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    engineRef.current.zoom(delta, e.clientX - rect.left, e.clientY - rect.top);
    const zoom = engineRef.current.getState().viewport.zoom;
    setZoomLevel(Math.round(zoom * 100));
    updatePropertiesPanelPosition();
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

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
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
        const selected = engineRef.current.getSelectedShapes();
        selected.forEach(shape => {
          engineRef.current?.removeShape(shape.id);
        });
        saveCanvasState();
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
    setIsZoomMenuOpen(false);
  };

  const handleFitToScreen = () => {
    if (!engineRef.current) return;
    engineRef.current.fitToScreen();
    const zoom = engineRef.current.getState().viewport.zoom;
    setZoomLevel(Math.round(zoom * 100));
    setIsZoomMenuOpen(false);
  };

  return (
    <div className="w-full h-screen bg-[#0a0a0a] text-white flex">
      {/* Left Sidebar */}
      <div className="w-16 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col items-center py-4 gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 bg-[#8b5cf6] rounded flex items-center justify-center text-white font-bold text-lg">
            W
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>

        {/* Navigation Icons */}
        <div className="flex flex-col gap-4 flex-1">
          <button
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
            title="Pointer Tool"
            onClick={() => setTool('select')}
          >
            <MousePointer2 className="w-5 h-5" />
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
            title="Hand Tool"
            onClick={() => setTool('pan')}
          >
            <Hand className="w-5 h-5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
            title="Upload Image"
          >
            <Upload className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file && engineRef.current && canvasRef.current) {
                const token = localStorage.getItem('auth_token');
                if (!token) {
                  alert('Please log in to upload images');
                  e.target.value = '';
                  return;
                }

                if (!currentProjectId) {
                  alert('Please save your project first');
                  e.target.value = '';
                  return;
                }

                const reader = new FileReader();
                reader.onload = async (event) => {
                  const dataUrl = event.target?.result as string;
                  if (!dataUrl || !engineRef.current || !canvasRef.current) return;

                  // Get image dimensions first
                  const img = new Image();
                  img.onload = async () => {
                    if (!engineRef.current || !canvasRef.current) return;

                    // Place image at center of viewport
                    const canvasRect = canvasRef.current.getBoundingClientRect();
                    const centerX = canvasRect.width / 2;
                    const centerY = canvasRect.height / 2;
                    const worldPoint = engineRef.current.screenToWorld({ x: centerX, y: centerY });

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

                    // Create placeholder shape with loading state
                    const placeholderId = `image-uploading-${Date.now()}-${Math.random()}`;
                    const placeholderShape: ImageShape = {
                      id: placeholderId,
                      type: 'image',
                      x: worldPoint.x - width / 2,
                      y: worldPoint.y - height / 2,
                      width,
                      height,
                      src: dataUrl, // Show local preview while uploading
                      style: {
                        opacity: 0.5, // Dim to indicate loading
                      },
                    };

                    engineRef.current.addShape(placeholderShape);
                    engineRef.current.selectShape(placeholderId);
                    setUploadingImageId(placeholderId);

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

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Upload failed');
                      }

                      const { url } = await response.json();

                      // Update the shape with the Supabase URL
                      if (engineRef.current) {
                        engineRef.current.updateShape(placeholderId, {
                          src: url,
                          style: { opacity: 1 },
                        });
                        engineRef.current.saveState();
                        saveCanvasState();
                      }

                      console.log('Image uploaded successfully:', url);
                    } catch (uploadError: unknown) {
                      console.error('Failed to upload image:', uploadError);
                      // Remove the placeholder on failure
                      if (engineRef.current) {
                        engineRef.current.removeShape(placeholderId);
                      }
                      const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
                      alert(`Failed to upload image: ${errorMessage}`);
                    } finally {
                      setUploadingImageId(null);
                    }
                  };

                  img.onerror = () => {
                    console.error('Failed to load image');
                    alert('Failed to load the selected image');
                  };
                  img.src = dataUrl;
                };

                reader.onerror = () => {
                  console.error('Failed to read file');
                  alert('Failed to read the selected file');
                };
                reader.readAsDataURL(file);
              }
              // Reset input so same file can be selected again
              e.target.value = '';
            }}
          />
          <div className="relative" data-shapes-menu>
            <button
              className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                isShapesMenuOpen ? 'bg-[#2a2a2a] text-white' : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
              }`}
              title="Shapes"
              onClick={(e) => {
                e.stopPropagation();
                setIsShapesMenuOpen((prev) => !prev);
              }}
            >
              <Shapes className="w-5 h-5" />
            </button>
            {isShapesMenuOpen && (
              <div className="absolute left-12 top-0 bg-white text-[#4A4A4A] rounded-2xl shadow-[0px_4px_12px_rgba(0,0,0,0.1)] border border-[#E0E0E0] w-50 p-4 z-50">
                <div className="text-[14px] font-medium mb-3">Shapes</div>
                <div className="flex items-center gap-4">
                  {[
                    { key: 'square', Icon: () => <div className="w-5 h-5 border border-[#2E2E2E]" />, action: () => setTool('rectangle') },
                    { key: 'circle', Icon: () => <div className="w-5 h-5 border border-[#2E2E2E] rounded-full" />, action: () => setTool('circle') },
                    { key: 'triangle', Icon: () => (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2E2E2E" strokeWidth="1.5">
                        <path d="M12 5L4 19H20L12 5Z" />
                      </svg>
                    ), action: () => alert('Triangle coming soon') },
                    { key: 'star', Icon: () => (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2E2E2E" strokeWidth="1.5">
                        <path d="M12 3l2.09 6.26L20 9.27l-5 3.64L16.18 19 12 15.77 7.82 19 9 12.91l-5-3.64 5.91-.01L12 3z" />
                      </svg>
                    ), action: () => alert('Star coming soon') },
                  ].map(({ key, Icon, action }) => (
                    <button
                      key={key}
                      onClick={() => {
                        action();
                        setIsShapesMenuOpen(false);
                      }}
                      className="w-8 h-8 flex items-center justify-center text-[#2E2E2E] hover:text-[#8b5cf6] transition-colors"
                      title={key}
                    >
                      <Icon />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
            title="Text Tool"
            onClick={() => setTool('text')}
          >
            <Type className="w-5 h-5" />
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
            title="Pencil Tool"
            onClick={() => setTool('freehand')}
          >
            <Pencil className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Icon */}
        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-bold">
          N
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Project Name Display - Fixed at top left */}
        {currentProjectId && (
          <div className="fixed top-6 left-[88px] z-40">
            {isLoadingCanvas ? (
              <div className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#2a2a2a] rounded-xl px-4 py-2 text-sm text-gray-400 shadow-2xl min-w-[200px]">
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
                className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#8b5cf6] rounded-xl px-4 py-2 text-sm text-white shadow-2xl min-w-[200px] outline-none focus:ring-2 focus:ring-[#8b5cf6]/50"
              />
            ) : (
              <div
                onClick={handleProjectNameClick}
                className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#2a2a2a] rounded-xl px-4 py-2 text-sm text-white shadow-2xl min-w-[200px] cursor-pointer hover:border-[#3a3a3a] transition-colors"
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
              className={`
                px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${isSaving
                  ? 'bg-[#2a2a2a] text-gray-500 cursor-not-allowed'
                  : saveStatus === 'saved'
                  ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                  : 'bg-[#8b5cf6] hover:bg-[#7c3aed] text-white'
                }
              `}
              title={isSaving ? 'Saving...' : 'Save canvas'}
            >
              {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        )}

        {/* Right Side Panel - Credits, Status, Share, Tasks */}
        <div className="fixed top-6 right-6 z-40">
          <div className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#2a2a2a] rounded-xl p-2.5 shadow-2xl min-w-[240px]">
            {/* Top Section */}
            <div className="flex items-center justify-between mb-2.5">
              {/* Left: Credits and Status */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-xs">✨</span>
                  <span className="text-white text-xs">{credits}</span>
                </div>
                <div className="bg-yellow-400/20 border border-yellow-400/30 rounded-sm px-2 py-0.5 flex relative">
                  <span className="text-yellow-400 text-[10px]">Low credits</span>
                </div>
              </div>
              {/* Right: Share Button */}
              <div className="flex items-center gap-2">
                <button className="bg-[#e5e5e5] hover:bg-white text-black px-2 py-0.5 rounded-sm text-xs transition-colors flex items-center gap-1.5">
                  <span className="text-xs">↗</span>
                  <span>Share</span>
                </button>
              </div>
            </div>
            {/* Bottom Section: Tasks Dropdown */}
            <div className="relative" data-tasks-menu>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTasksMenuOpen(!isTasksMenuOpen);
                }}
                className="text-white text-xs flex items-center gap-1.5 hover:text-gray-300 transition-colors"
              >
                <span>Tasks</span>
                <svg className={`w-3 h-3 transition-transform ${isTasksMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isTasksMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl shadow-lg py-2 z-50">
                  <div className="px-4 py-2 text-sm text-gray-400">No tasks</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-[#0a0a0a] overflow-hidden relative">
          <canvas
            ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onDoubleClick={handleDoubleClick}
                  onWheel={handleWheel}
            className="w-full h-full cursor-crosshair"
            style={{ display: 'block' }}
          />
          {/* Selection Box Overlay */}
          {isSelecting && selectionBox && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none z-10"
              style={{
                left: `${Math.min(selectionBox.start.x, selectionBox.end.x)}px`,
                top: `${Math.min(selectionBox.start.y, selectionBox.end.y)}px`,
                width: `${Math.abs(selectionBox.end.x - selectionBox.start.x)}px`,
                height: `${Math.abs(selectionBox.end.y - selectionBox.start.y)}px`,
                borderStyle: 'dashed',
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

          {/* Properties Panel */}
          {propertiesPanelPos && selectedShapeId && engineRef.current && (() => {
            const shape = engineRef.current.getShape(selectedShapeId);
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
                  className="absolute bg-white rounded-lg shadow-md px-3 py-2.5 flex items-center gap-2 z-50"
                  style={{
                    left: `${propertiesPanelPos.x}px`,
                    top: `${propertiesPanelPos.y}px`,
                    transform: 'translateX(-50%)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Crop Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCropping(true);
                      setCroppingImageId(selectedShapeId);
                      // Initialize crop rect to full image bounds
                      setCropRect({
                        x: shape.x,
                        y: shape.y,
                        width: width,
                        height: height
                      });
                    }}
                    className="w-8 h-8 flex items-center justify-center text-black hover:bg-gray-100 rounded"
                    title="Crop Image"
                  >
                    <Crop className="w-4 h-4" />
                  </button>

                  {/* Duplicate Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!engineRef.current) return;

                      // Create duplicate with offset position
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
                      saveCanvasState();
                    }}
                    className="w-8 h-8 flex items-center justify-center text-black hover:bg-gray-100 rounded"
                    title="Duplicate Image"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const imageShape = shape as ImageShape;

                      // Create a temporary link and trigger download
                      const link = document.createElement('a');
                      link.href = imageShape.src;
                      link.download = `image-${Date.now()}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-black hover:bg-gray-100 rounded"
                    title="Download Image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              );
            }

            // For text shapes, show different controls
            if (shape.type === 'text') {
              const textShape = shape;
              const fontFamily = textShape.style.fontFamily || 'Inter';
              const fontWeight = textShape.style.fontWeight || 'Regular';
              const fontSize = textShape.style.fontSize || 16;
              const textAlign = textShape.style.textAlign || 'left';

              return (
                <div
                  className="absolute bg-gray-100 rounded-lg shadow-md px-3 py-2 flex items-center gap-2 z-50"
                style={{
                  left: `${propertiesPanelPos.x}px`,
                  top: `${propertiesPanelPos.y}px`,
                  transform: 'translateX(-50%)',
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

                {/* No Fill / Stroke Color */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setStrokePickerPos({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
                    setIsStrokePickerOpen(true);
                    setIsFillPickerOpen(false);
                    setIsOpacityOpen(false);
                    setIsFontFamilyOpen(false);
                    setIsFontWeightOpen(false);
                    setIsFontSizeOpen(false);
                    setIsAlignmentOpen(false);
                    setIsTextStyleOpen(false);
                  }}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center bg-white relative"
                  title="Stroke Color"
                >
                  {strokeColor === 'transparent' || !strokeColor ? (
                    <div className="w-full h-full rounded-full" style={{
                      backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 4px 4px',
                    }}>
                      <Minus className="w-4 h-4 text-red-500 rotate-45 absolute inset-0 m-auto" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: strokeColor }} />
                  )}
                </button>

                {/* Font Family Dropdown */}
                <div className="relative" data-font-family>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFontFamilyOpen(!isFontFamilyOpen);
                      setIsFontWeightOpen(false);
                      setIsFontSizeOpen(false);
                      setIsAlignmentOpen(false);
                      setIsTextStyleOpen(false);
                      setIsOpacityOpen(false);
                    }}
                    className="px-2 py-1 text-sm text-black border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-1 min-w-[80px]"
                  >
                    <span>{fontFamily}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {isFontFamilyOpen && (
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-300 rounded shadow-lg py-1 z-50 min-w-[120px]">
                      {['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'].map((font) => (
                        <button
                          key={font}
                          onClick={() => {
                            engineRef.current?.updateShape(selectedShapeId, {
                              style: { ...textShape.style, fontFamily: font },
                            });
                            engineRef.current?.saveState();
                            saveCanvasState();
                            setIsFontFamilyOpen(false);
                          }}
                          className="w-full px-3 py-1 text-sm text-left text-black hover:bg-gray-100"
                        >
                          {font}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Font Weight Dropdown */}
                <div className="relative" data-font-weight>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFontWeightOpen(!isFontWeightOpen);
                      setIsFontFamilyOpen(false);
                      setIsFontSizeOpen(false);
                      setIsAlignmentOpen(false);
                      setIsTextStyleOpen(false);
                      setIsOpacityOpen(false);
                    }}
                    className="px-2 py-1 text-sm text-black border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-1 min-w-[80px]"
                  >
                    <span>{fontWeight}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {isFontWeightOpen && (
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-300 rounded shadow-lg py-1 z-50 min-w-[120px]">
                      {['Regular', 'Bold', 'Italic', 'Bold Italic', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map((weight) => (
                        <button
                          key={weight}
                          onClick={() => {
                            engineRef.current?.updateShape(selectedShapeId, {
                              style: { ...textShape.style, fontWeight: weight },
                            });
                            engineRef.current?.saveState();
                            saveCanvasState();
                            setIsFontWeightOpen(false);
                          }}
                          className="w-full px-3 py-1 text-sm text-left text-black hover:bg-gray-100"
                        >
                          {weight}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Font Size Dropdown */}
                <div className="relative" data-font-size>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFontSizeOpen(!isFontSizeOpen);
                      setIsFontFamilyOpen(false);
                      setIsFontWeightOpen(false);
                      setIsAlignmentOpen(false);
                      setIsTextStyleOpen(false);
                      setIsOpacityOpen(false);
                    }}
                    className="px-2 py-1 text-sm text-black border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-1 min-w-[60px]"
                  >
                    <span>{Math.round(fontSize)}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {isFontSizeOpen && (
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-300 rounded shadow-lg py-1 z-50 min-w-[100px] max-h-[200px] overflow-y-auto">
                      {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96, 120, 144, 168, 192, 216, 240].map((size) => (
                        <button
                          key={size}
                          onClick={() => {
                            if (engineRef.current && selectedShapeId) {
                              const fontFamily = textShape.style.fontFamily || 'Arial';
                              let fontWeight = textShape.style.fontWeight || 'normal';
                              // Convert "Regular" to "normal" for CSS compatibility
                              if (fontWeight === 'Regular') {
                                fontWeight = 'normal';
                              }
                              
                              const oldFontSize = textShape.style.fontSize || 16;
                              const fontSizeRatio = size / oldFontSize;
                              
                              // Scale the selection box proportionally with font size
                              const newWidth = textShape.width * fontSizeRatio;
                              const newHeight = textShape.height * fontSizeRatio;
                              
                              // Update shape with new font size and scaled dimensions
                              engineRef.current.updateShape(selectedShapeId, {
                                style: { ...textShape.style, fontSize: size },
                                width: Math.max(50, newWidth),
                                height: Math.max(size * 1.2, newHeight),
                              });
                              engineRef.current.saveState();
                              saveCanvasState();
                            }
                            setIsFontSizeOpen(false);
                          }}
                          className="w-full px-3 py-1 text-sm text-left text-black hover:bg-gray-100"
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Alignment Icon */}
                <div className="relative" data-alignment>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAlignmentOpen(!isAlignmentOpen);
                      setIsFontFamilyOpen(false);
                      setIsFontWeightOpen(false);
                      setIsFontSizeOpen(false);
                      setIsTextStyleOpen(false);
                      setIsOpacityOpen(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-black hover:text-gray-700 relative"
                    title="Text Alignment"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <ChevronDown className="w-2 h-2 absolute bottom-0 right-0" />
                  </button>
                  {isAlignmentOpen && (
                    <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded shadow-lg py-1 z-50">
                      {[
                        { value: 'left', icon: 'M4 6h16M4 12h8M4 18h16' },
                        { value: 'center', icon: 'M4 6h16M8 12h8M4 18h16' },
                        { value: 'right', icon: 'M4 6h16M12 12h8M4 18h16' },
                        { value: 'justify', icon: 'M4 6h16M4 12h16M4 18h16' },
                      ].map((align) => (
                        <button
                          key={align.value}
                          onClick={() => {
                            engineRef.current?.updateShape(selectedShapeId, {
                              style: { ...textShape.style, textAlign: align.value as any },
                            });
                            engineRef.current?.saveState();
                            saveCanvasState();
                            setIsAlignmentOpen(false);
                          }}
                          className="w-full px-3 py-2 flex items-center justify-center hover:bg-gray-100"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={align.icon} />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Text Styling Icon */}
                <div data-text-style>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTextStyleOpen(!isTextStyleOpen);
                      setIsFontFamilyOpen(false);
                      setIsFontWeightOpen(false);
                      setIsFontSizeOpen(false);
                      setIsAlignmentOpen(false);
                      setIsOpacityOpen(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-black hover:text-gray-700"
                    title="Text Styling"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>

                {/* Opacity Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setOpacityPos({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
                      setIsOpacityOpen(!isOpacityOpen);
                      setIsFontFamilyOpen(false);
                      setIsFontWeightOpen(false);
                      setIsFontSizeOpen(false);
                      setIsAlignmentOpen(false);
                      setIsTextStyleOpen(false);
                    }}
                    className="px-2 py-1 text-sm text-black border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-1"
                  >
                    <div 
                      className="w-4 h-4 border border-gray-300 relative"
                      style={{
                        backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 4px 4px',
                      }}
                    />
                    <span>Opacity</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
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
                      <h4 className="text-sm font-semibold text-black mb-2">Opacity</h4>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(opacity * 100)}
                          onChange={(e) => {
                            const newOpacity = parseInt(e.target.value) / 100;
                            engineRef.current?.updateShape(selectedShapeId, {
                              style: { ...textShape.style, opacity: newOpacity },
                            });
                            engineRef.current?.saveState();
                            saveCanvasState();
                          }}
                          className="w-full"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={Math.round(opacity * 100)}
                          onChange={(e) => {
                            const newOpacity = parseInt(e.target.value) / 100;
                            engineRef.current?.updateShape(selectedShapeId, {
                              style: { ...textShape.style, opacity: newOpacity },
                            });
                            engineRef.current?.saveState();
                            saveCanvasState();
                          }}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                        />
                        <span className="text-sm text-black">%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Download Icon */}
                <button className="w-8 h-8 flex items-center justify-center text-black hover:text-gray-700" title="Download">
                  <Download className="w-4 h-4" />
                </button>
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
                  transform: 'translateX(-50%)',
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
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      nw: { top: -handleSize/2, left: -handleSize/2, cursor: 'nwse-resize' },
                      n: { top: -handleSize/2, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
                      ne: { top: -handleSize/2, right: -handleSize/2, cursor: 'nesw-resize' },
                      e: { top: '50%', right: -handleSize/2, transform: 'translateY(-50%)', cursor: 'ew-resize' },
                      se: { bottom: -handleSize/2, right: -handleSize/2, cursor: 'nwse-resize' },
                      s: { bottom: -handleSize/2, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
                      sw: { bottom: -handleSize/2, left: -handleSize/2, cursor: 'nesw-resize' },
                      w: { top: '50%', left: -handleSize/2, transform: 'translateY(-50%)', cursor: 'ew-resize' },
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
                      }, false);
                      // Re-render with text hidden
                      engineRef.current.render(editingTextId);
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
                        });
                        engineRef.current.saveState();
                        saveCanvasState();
                        // Re-render to show the text shape again
                        engineRef.current.render();
                      }
                    }
                    setEditingTextId(null);
                    setTextInputPos(null);
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
                            });
                            engineRef.current.saveState();
                            saveCanvasState();
                          }
                        }
                      }
                      setEditingTextId(null);
                      setTextInputPos(null);
                    } else if (e.key === 'Escape') {
                      setEditingTextId(null);
                      setTextInputPos(null);
                    }
                  }}
                  autoFocus
                  className="px-1 py-0 bg-transparent border-none text-black focus:outline-none"
                  style={{
                    fontSize: `${shape.style.fontSize || 16}px`,
                    fontFamily: shape.style.fontFamily || 'Arial',
                    color: shape.style.fill || '#000000',
                    minWidth: '50px',
                    width: `${measureText(textInputValue).width}px`,
                  }}
                />
              </div>
            );
          })()}

          {/* Color Pickers */}
          {isFillPickerOpen && fillPickerPos && selectedShapeId && engineRef.current && (() => {
            const shape = engineRef.current.getShape(selectedShapeId);
            if (!shape) return null;
            return (
              <ColorPicker
                isOpen={isFillPickerOpen}
                onClose={() => setIsFillPickerOpen(false)}
                color={shape.style.fill || '#808080'}
                onChange={(color) => {
                  engineRef.current?.updateShape(selectedShapeId, {
                    style: { ...shape.style, fill: color },
                  });
                  engineRef.current?.saveState();
                  saveCanvasState();
                }}
                title="Fill"
                position={fillPickerPos}
              />
            );
          })()}

          {isStrokePickerOpen && strokePickerPos && selectedShapeId && engineRef.current && (() => {
            const shape = engineRef.current.getShape(selectedShapeId);
            if (!shape) return null;
            return (
              <ColorPicker
                isOpen={isStrokePickerOpen}
                onClose={() => setIsStrokePickerOpen(false)}
                color={shape.style.stroke || '#ffffff'}
                onChange={(color) => {
                  engineRef.current?.updateShape(selectedShapeId, {
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
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
            <button
              onClick={() => setTool('select')}
              className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                tool === 'select' ? 'bg-yellow-500 text-black' : 'bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]'
              }`}
              title="Select"
            >
              <MousePointer2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('pan')}
              className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                tool === 'pan' ? 'bg-[#8b5cf6] text-white' : 'bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]'
              }`}
              title="Pan"
            >
              <Hand className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-[#2a2a2a] mx-1" />
            <button
              onClick={handleUndo}
              className="w-10 h-10 flex items-center justify-center bg-[#2a2a2a] text-white rounded hover:bg-[#3a3a3a] transition-colors"
              title="Undo"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleRedo}
              className="w-10 h-10 flex items-center justify-center bg-[#2a2a2a] text-white rounded hover:bg-[#3a3a3a] transition-colors"
              title="Redo"
            >
              <Redo2 className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-[#2a2a2a] mx-1" />
            <div className="relative" data-zoom-menu>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomMenuOpen(!isZoomMenuOpen);
                }}
                className="px-3 py-2 bg-[#2a2a2a] text-white rounded text-sm hover:bg-[#3a3a3a] transition-colors flex items-center gap-1"
              >
                {zoomLevel}%
                <ChevronDown className="w-4 h-4" />
              </button>
              {isZoomMenuOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-40 bg-[#2a2a2a] border border-[#3a3a3a] rounded shadow-lg py-2 z-50">
                  <button
                    onClick={handleFitToScreen}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-[#3a3a3a] transition-colors text-white border-b border-[#3a3a3a] mb-1"
                  >
                    Fit to Screen
                  </button>
                  {[25, 50, 75, 100, 125, 150, 200].map((zoom) => (
                    <button
                      key={zoom}
                      onClick={() => handleZoomChange(zoom)}
                      className={`w-full px-4 py-2 text-sm text-left hover:bg-[#3a3a3a] transition-colors ${
                        zoomLevel === zoom ? 'text-[#8b5cf6]' : 'text-white'
                      }`}
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
    </div>
  );
}

export default function CanvasCanvas({ initialProjectId }: CanvasCanvasProps = {}) {
  return <CanvasCanvasInner initialProjectId={initialProjectId} />;
}
