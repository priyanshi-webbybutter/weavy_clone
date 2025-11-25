'use client';

import React, { useState, useCallback } from 'react';
import { X, Link, Square, Circle as CircleIcon, Type, Image, Minus, Download, Crop, Copy } from 'lucide-react';
import { Shape, RectangleShape, CircleShape, TextShape, ImageShape, TextShadow } from '@/lib/canvas/types';

interface ShapeSettingsPanelProps {
  isOpen: boolean;
  selectedShapes: Shape[];
  onClose: () => void;
  onSettingsChange: (shapeId: string, updates: Partial<Shape>) => void;
  onCropImage?: (shapeId: string) => void;
  onDownloadImage?: (shapeId: string) => void;
  onDuplicateShape?: (shapeId: string) => void;
}

const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
];

const FONT_WEIGHTS = [
  { label: 'Thin', value: '100' },
  { label: 'Light', value: '300' },
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semi Bold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extra Bold', value: '800' },
  { label: 'Black', value: '900' },
];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96, 120];

// Text shadow presets
const TEXT_SHADOW_PRESETS: { name: string; shadow: TextShadow }[] = [
  { name: 'none', shadow: { enabled: false } },
  { name: 'light', shadow: { enabled: true, color: '#727272', opacity: 100, blur: 6, angle: -90, offsetX: 0, offsetY: 1, outlineWidth: 0 } },
  { name: 'dark', shadow: { enabled: true, color: '#000000', opacity: 100, blur: 8, angle: -90, offsetX: 0, offsetY: 2, outlineWidth: 0 } },
  { name: 'outline', shadow: { enabled: true, color: '#000000', opacity: 100, blur: 0, angle: 0, offsetX: 0, offsetY: 0, outlineWidth: 2 } },
];

const ShapeSettingsPanel: React.FC<ShapeSettingsPanelProps> = ({
  isOpen,
  selectedShapes,
  onClose,
  onSettingsChange,
  onCropImage,
  onDownloadImage,
  onDuplicateShape,
}) => {
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false);

  // Memoized update functions for better performance
  const updateStyle = useCallback((styleUpdates: Partial<Shape['style']>) => {
    selectedShapes.forEach(shape => {
      onSettingsChange(shape.id, {
        style: { ...shape.style, ...styleUpdates }
      } as Partial<Shape>);
    });
  }, [selectedShapes, onSettingsChange]);

  const updateShape = useCallback((shapeId: string, updates: Partial<Shape>) => {
    onSettingsChange(shapeId, updates);
  }, [onSettingsChange]);

  if (!isOpen || selectedShapes.length === 0) {
    return null;
  }

  const isMultiSelection = selectedShapes.length > 1;
  const firstShape = selectedShapes[0];

  // Check if all selected shapes are of the same type
  const allSameType = selectedShapes.every(s => s.type === firstShape.type);
  const shapeType = allSameType ? firstShape.type : 'mixed';

  // Get common values for multi-selection
  const getCommonValue = <T,>(getter: (shape: Shape) => T | undefined): T | undefined => {
    if (selectedShapes.length === 0) return undefined;
    const firstValue = getter(selectedShapes[0]);
    const allSame = selectedShapes.every(s => getter(s) === firstValue);
    return allSame ? firstValue : undefined;
  };

  // Common properties
  const commonFill = getCommonValue(s => s.style.fill);
  const commonOpacity = getCommonValue(s => s.style.opacity);

  // Get icon for shape type
  const getShapeIcon = () => {
    if (isMultiSelection) return '📦';
    switch (shapeType) {
      case 'rectangle': return <Square className="w-4 h-4 text-white" />;
      case 'circle': return <CircleIcon className="w-4 h-4 text-white" />;
      case 'text': return <Type className="w-4 h-4 text-white" />;
      case 'image': return <Image className="w-4 h-4 text-white" />;
      case 'line': return <Minus className="w-4 h-4 text-white" />;
      default: return '📐';
    }
  };

  // Get shape name
  const getShapeName = () => {
    if (isMultiSelection) return `${selectedShapes.length} shapes selected`;
    switch (shapeType) {
      case 'rectangle': return 'Rectangle';
      case 'circle': return 'Ellipse';
      case 'text': return 'Text';
      case 'image': return 'Image';
      case 'line': return 'Line';
      default: return 'Shape';
    }
  };

  // Get text shadow from shape
  const getTextShadow = (): TextShadow => {
    if (shapeType !== 'text') return { enabled: false };
    const textShape = firstShape as TextShape;
    return textShape.style.textShadow || { enabled: false };
  };

  // Update text shadow
  const updateTextShadow = (shadowUpdates: Partial<TextShadow>) => {
    if (shapeType !== 'text') return;
    const currentShadow = getTextShadow();
    updateStyle({
      textShadow: { ...currentShadow, ...shadowUpdates }
    });
  };

  // Get active shadow preset index
  const getActiveShadowPreset = (): number => {
    const shadow = getTextShadow();
    if (!shadow.enabled) return 0;
    // Check if matches any preset (simplified check)
    if (shadow.outlineWidth && shadow.outlineWidth > 0) return 3;
    if (shadow.blur && shadow.blur >= 8) return 2;
    if (shadow.enabled) return 1;
    return 0;
  };

  return (
    <div
      className="fixed right-0 top-0 h-screen w-[240px] bg-[#0a0a0a] border-l border-[#2a2a2a] z-50 flex flex-col shadow-2xl"
      style={{ fontWeight: 200 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
            {typeof getShapeIcon() === 'string' ? (
              <span className="text-xs">{getShapeIcon()}</span>
            ) : (
              getShapeIcon()
            )}
          </div>
          <span className="text-white text-sm" style={{ fontWeight: 200 }}>{getShapeName()}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Fill Color - For all shapes except line */}
        {shapeType !== 'line' && (
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <div className="text-gray-400 text-xs mb-3" style={{ fontWeight: 200 }}>Fill Color</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={commonFill || '#ffffff'}
                onChange={(e) => updateStyle({ fill: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border border-[#2a2a2a] bg-transparent"
              />
              <input
                type="text"
                value={commonFill || '#ffffff'}
                onChange={(e) => updateStyle({ fill: e.target.value })}
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-white text-xs"
              />
            </div>
          </div>
        )}

        {/* Stroke - For non-text shapes */}
        {shapeType !== 'text' && (
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <div className="text-gray-400 text-xs mb-3" style={{ fontWeight: 200 }}>Stroke</div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={getCommonValue(s => s.style.stroke) || '#000000'}
                onChange={(e) => updateStyle({ stroke: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border border-[#2a2a2a] bg-transparent"
              />
              <input
                type="text"
                value={getCommonValue(s => s.style.stroke) || '#000000'}
                onChange={(e) => updateStyle({ stroke: e.target.value })}
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-white text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Width</span>
              <input
                type="number"
                min="0"
                max="20"
                value={getCommonValue(s => s.style.strokeWidth) ?? 1}
                onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) || 0 })}
                className="w-16 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-white text-xs text-center"
              />
            </div>
          </div>
        )}

        {/* Opacity */}
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <div className="text-gray-400 text-xs mb-3" style={{ fontWeight: 200 }}>Opacity</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={(commonOpacity ?? 1) * 100}
              onChange={(e) => updateStyle({ opacity: parseInt(e.target.value) / 100 })}
              className="flex-1 accent-[#8b5cf6]"
            />
            <span className="text-white text-xs w-10 text-right">{Math.round((commonOpacity ?? 1) * 100)}%</span>
          </div>
        </div>

        {/* Dimensions - Only for rectangle, circle, image */}
        {!isMultiSelection && (shapeType === 'rectangle' || shapeType === 'circle' || shapeType === 'image') && (
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <div className="text-gray-400 text-xs mb-3" style={{ fontWeight: 200 }}>Dimensions</div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="text-gray-500 text-[10px] mb-1">W</div>
                <input
                  type="number"
                  min="1"
                  value={Math.round((firstShape as RectangleShape | ImageShape).width || (firstShape as CircleShape).radius * 2 || 100)}
                  onChange={(e) => {
                    const newWidth = parseInt(e.target.value) || 1;
                    if (shapeType === 'circle') {
                      updateShape(firstShape.id, { radius: newWidth / 2 } as Partial<Shape>);
                    } else {
                      const shape = firstShape as RectangleShape | ImageShape;
                      if (aspectRatioLocked && shape.width && shape.height) {
                        const ratio = shape.height / shape.width;
                        updateShape(firstShape.id, { width: newWidth, height: Math.round(newWidth * ratio) } as Partial<Shape>);
                      } else {
                        updateShape(firstShape.id, { width: newWidth } as Partial<Shape>);
                      }
                    }
                  }}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-white text-xs"
                />
              </div>
              <button
                onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                className={`mt-4 p-1.5 rounded transition-colors ${aspectRatioLocked ? 'bg-[#8b5cf6] text-white' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
              >
                <Link className="w-3 h-3" />
              </button>
              <div className="flex-1">
                <div className="text-gray-500 text-[10px] mb-1">H</div>
                <input
                  type="number"
                  min="1"
                  value={Math.round((firstShape as RectangleShape | ImageShape).height || (firstShape as CircleShape).radius * 2 || 100)}
                  onChange={(e) => {
                    const newHeight = parseInt(e.target.value) || 1;
                    if (shapeType === 'circle') {
                      updateShape(firstShape.id, { radius: newHeight / 2 } as Partial<Shape>);
                    } else {
                      const shape = firstShape as RectangleShape | ImageShape;
                      if (aspectRatioLocked && shape.width && shape.height) {
                        const ratio = shape.width / shape.height;
                        updateShape(firstShape.id, { width: Math.round(newHeight * ratio), height: newHeight } as Partial<Shape>);
                      } else {
                        updateShape(firstShape.id, { height: newHeight } as Partial<Shape>);
                      }
                    }
                  }}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-white text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Border Radius - Only for rectangles */}
        {!isMultiSelection && shapeType === 'rectangle' && (
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <div className="text-gray-400 text-xs mb-3" style={{ fontWeight: 200 }}>Border Radius</div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={(firstShape as RectangleShape).radius || 0}
                onChange={(e) => updateShape(firstShape.id, { radius: parseInt(e.target.value) } as Partial<Shape>)}
                className="flex-1 accent-[#8b5cf6]"
              />
              <input
                type="number"
                min="0"
                value={(firstShape as RectangleShape).radius || 0}
                onChange={(e) => updateShape(firstShape.id, { radius: parseInt(e.target.value) || 0 } as Partial<Shape>)}
                className="w-14 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-white text-xs text-center"
              />
            </div>
          </div>
        )}

        {/* Text Settings - Only for text shapes */}
        {!isMultiSelection && shapeType === 'text' && (
          <>
            {/* Typography */}
            <div className="px-4 py-3 border-b border-[#2a2a2a]">
              <div className="text-gray-400 text-xs mb-3" style={{ fontWeight: 200 }}>Typography</div>

              {/* Font Family */}
              <div className="mb-3">
                <div className="text-gray-500 text-[10px] mb-1">Font Family</div>
                <select
                  value={(firstShape as TextShape).style.fontFamily || 'Inter'}
                  onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-white text-xs"
                >
                  {FONT_FAMILIES.map(font => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
              </div>

              {/* Font Size & Weight */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <div className="text-gray-500 text-[10px] mb-1">Size</div>
                  <select
                    value={(firstShape as TextShape).style.fontSize || 16}
                    onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-white text-xs"
                  >
                    {FONT_SIZES.map(size => (
                      <option key={size} value={size}>{size}px</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <div className="text-gray-500 text-[10px] mb-1">Weight</div>
                  <select
                    value={(firstShape as TextShape).style.fontWeight || '400'}
                    onChange={(e) => updateStyle({ fontWeight: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-white text-xs"
                  >
                    {FONT_WEIGHTS.map(w => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Text Alignment */}
              <div>
                <div className="text-gray-500 text-[10px] mb-1">Alignment</div>
                <div className="flex gap-1">
                  {(['left', 'center', 'right', 'justify'] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => updateStyle({ textAlign: align })}
                      className={`flex-1 py-1.5 rounded text-xs transition-colors ${
                        (firstShape as TextShape).style.textAlign === align
                          ? 'bg-[#8b5cf6] text-white'
                          : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                      }`}
                    >
                      {align.charAt(0).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Text Border/Outline */}
            <div className="px-4 py-3 border-b border-[#2a2a2a]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-xs" style={{ fontWeight: 200 }}>Text Border</span>
                <button
                  onClick={() => updateStyle({ textBorder: !(firstShape as TextShape).style.textBorder })}
                  className={`w-8 h-4 rounded-full transition-colors ${
                    (firstShape as TextShape).style.textBorder ? 'bg-[#8b5cf6]' : 'bg-[#2a2a2a]'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                    (firstShape as TextShape).style.textBorder ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {(firstShape as TextShape).style.textBorder && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="color"
                      value={(firstShape as TextShape).style.textBorderColor || '#000000'}
                      onChange={(e) => updateStyle({ textBorderColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border border-[#2a2a2a] bg-transparent"
                    />
                    <input
                      type="text"
                      value={(firstShape as TextShape).style.textBorderColor || '#000000'}
                      onChange={(e) => updateStyle({ textBorderColor: e.target.value })}
                      className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Width</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={(firstShape as TextShape).style.textBorderWidth || 1}
                      onChange={(e) => updateStyle({ textBorderWidth: parseInt(e.target.value) || 1 })}
                      className="w-16 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-white text-xs text-center"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Text Shadow */}
            <div className="px-4 py-3 border-b border-[#2a2a2a]">
              <div className="text-gray-400 text-xs mb-3" style={{ fontWeight: 200 }}>Text Shadow</div>

              {/* Shadow Presets */}
              <div className="flex gap-2 mb-3">
                {TEXT_SHADOW_PRESETS.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => updateStyle({ textShadow: preset.shadow })}
                    className={`flex-1 h-10 rounded flex items-center justify-center text-lg font-bold transition-all ${
                      getActiveShadowPreset() === index
                        ? 'bg-[#1a1a1a] border-2 border-[#3b82f6]'
                        : 'bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a]'
                    }`}
                    style={{
                      textShadow: preset.shadow.enabled
                        ? preset.shadow.outlineWidth && preset.shadow.outlineWidth > 0
                          ? `0 0 0 ${preset.shadow.color}, -1px -1px 0 ${preset.shadow.color}, 1px -1px 0 ${preset.shadow.color}, -1px 1px 0 ${preset.shadow.color}, 1px 1px 0 ${preset.shadow.color}`
                          : `${preset.shadow.offsetX || 0}px ${preset.shadow.offsetY || 1}px ${preset.shadow.blur || 6}px ${preset.shadow.color || '#727272'}`
                        : 'none'
                    }}
                  >
                    <span className="text-white">A</span>
                  </button>
                ))}
              </div>

              {/* Shadow Settings - only show if shadow is enabled */}
              {getTextShadow().enabled && (
                <>
                  {/* Shadow Color */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="color"
                      value={getTextShadow().color || '#727272'}
                      onChange={(e) => updateTextShadow({ color: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border border-[#2a2a2a] bg-transparent"
                    />
                    <input
                      type="text"
                      value={(getTextShadow().color || '#727272').replace('#', '')}
                      onChange={(e) => updateTextShadow({ color: '#' + e.target.value })}
                      className="w-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-white text-xs"
                    />
                    <span className="text-white text-xs">{getTextShadow().opacity || 100}%</span>
                  </div>

                  {/* Offset */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 text-xs">Offset</span>
                      <span className="text-white text-xs">{Math.round(Math.sqrt(Math.pow(getTextShadow().offsetX || 0, 2) + Math.pow(getTextShadow().offsetY || 1, 2)))}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={Math.round(Math.sqrt(Math.pow(getTextShadow().offsetX || 0, 2) + Math.pow(getTextShadow().offsetY || 1, 2)))}
                      onChange={(e) => {
                        const offset = parseInt(e.target.value);
                        const angle = (getTextShadow().angle || -90) * Math.PI / 180;
                        updateTextShadow({
                          offsetX: Math.round(offset * Math.cos(angle)),
                          offsetY: Math.round(offset * Math.sin(angle))
                        });
                      }}
                      className="w-full accent-[#8b5cf6]"
                    />
                  </div>

                  {/* Angle */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 text-xs">Angle</span>
                      <span className="text-white text-xs">{getTextShadow().angle || -90}°</span>
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={getTextShadow().angle || -90}
                      onChange={(e) => {
                        const angle = parseInt(e.target.value);
                        const offset = Math.round(Math.sqrt(Math.pow(getTextShadow().offsetX || 0, 2) + Math.pow(getTextShadow().offsetY || 1, 2)));
                        const angleRad = angle * Math.PI / 180;
                        updateTextShadow({
                          angle,
                          offsetX: Math.round(offset * Math.cos(angleRad)),
                          offsetY: Math.round(offset * Math.sin(angleRad))
                        });
                      }}
                      className="w-full accent-[#8b5cf6]"
                    />
                  </div>

                  {/* Blur */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 text-xs">Blur</span>
                      <span className="text-white text-xs">{getTextShadow().blur || 6}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={getTextShadow().blur || 6}
                      onChange={(e) => updateTextShadow({ blur: parseInt(e.target.value) })}
                      className="w-full accent-[#8b5cf6]"
                    />
                  </div>

                  {/* Outline Width */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 text-xs">Outline Width</span>
                      <span className="text-white text-xs">{getTextShadow().outlineWidth || 0}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={getTextShadow().outlineWidth || 0}
                      onChange={(e) => updateTextShadow({ outlineWidth: parseInt(e.target.value) })}
                      className="w-full accent-[#8b5cf6]"
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Image Actions - Only for image shapes */}
        {!isMultiSelection && shapeType === 'image' && (
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <div className="text-gray-400 text-xs mb-3" style={{ fontWeight: 200 }}>Actions</div>
            <div className="flex gap-2">
              <button
                onClick={() => onCropImage?.(firstShape.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded text-white text-xs transition-colors"
              >
                <Crop className="w-3 h-3" />
                Crop
              </button>
              <button
                onClick={() => onDuplicateShape?.(firstShape.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded text-white text-xs transition-colors"
              >
                <Copy className="w-3 h-3" />
                Duplicate
              </button>
              <button
                onClick={() => onDownloadImage?.(firstShape.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded text-white text-xs transition-colors"
              >
                <Download className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Position */}
        {!isMultiSelection && (
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <div className="text-gray-400 text-xs mb-3" style={{ fontWeight: 200 }}>Position</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-gray-500 text-[10px] mb-1">X</div>
                <input
                  type="number"
                  value={Math.round(firstShape.x)}
                  onChange={(e) => updateShape(firstShape.id, { x: parseInt(e.target.value) || 0 } as Partial<Shape>)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-white text-xs"
                />
              </div>
              <div className="flex-1">
                <div className="text-gray-500 text-[10px] mb-1">Y</div>
                <input
                  type="number"
                  value={Math.round(firstShape.y)}
                  onChange={(e) => updateShape(firstShape.id, { y: parseInt(e.target.value) || 0 } as Partial<Shape>)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-white text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Delete Button */}
      <div className="px-4 py-3 border-t border-[#2a2a2a]">
        <button
          onClick={() => {
            selectedShapes.forEach(shape => {
              onSettingsChange(shape.id, { _delete: true } as any);
            });
          }}
          className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded text-red-400 text-xs transition-colors"
        >
          Delete {isMultiSelection ? `${selectedShapes.length} shapes` : 'shape'}
        </button>
      </div>
    </div>
  );
};

export default ShapeSettingsPanel;
