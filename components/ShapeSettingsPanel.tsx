'use client';

import React, { useState, useCallback } from 'react';
import { X, Link, Square, Circle as CircleIcon, Type, Image, Minus, Download, Crop, Copy, ChevronDown } from 'lucide-react';
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

const CustomSelect: React.FC<{
  value: string | number;
  options: (string | number | { label: string; value: string | number })[];
  onChange: (value: any) => void;
  className?: string;
  isSize?: boolean;
}> = ({ value, options, onChange, className, isSize }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 bg-gray-100 border border-gray-300 rounded-xl px-4 text-gray-900 text-[12px] font-semibold flex items-center justify-between cursor-pointer outline-none transition-all hover:border-gray-400"
      >
        <span className="truncate">
          {typeof options[0] === 'object'
            ? (options as { label: string; value: string | number }[]).find(opt => opt.value == value)?.label || value
            : value}{isSize ? 'px' : ''}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-10 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 overflow-y-auto py-1 max-h-60 animate-in fade-in zoom-in-95 duration-100 origin-top">
          {options.map((opt) => {
            const label = typeof opt === 'object' ? opt.label : String(opt);
            const val = typeof opt === 'object' ? opt.value : opt;
            const isSelected = String(val) === String(value);
            return (
              <button
                key={String(val)}
                onClick={() => {
                  onChange(val);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-[12px] font-medium transition-colors ${isSelected ? 'bg-[#656565] text-white' : 'text-gray-900 hover:bg-gray-100'
                  }`}
              >
                {label}{isSize && typeof opt !== 'object' ? 'px' : ''}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
      className="fixed right-4 top-4 bottom-4 w-[260px] bg-white/95 backdrop-blur-xl border border-gray-200 z-50 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.15)] rounded-[32px] overflow-hidden"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#666666] bg-[#525252]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#666666] rounded-xl flex items-center justify-center border border-[#767676]">
            {typeof getShapeIcon() === 'string' ? (
              <span className="text-sm">{getShapeIcon()}</span>
            ) : (
              <div className="scale-90 text-white">{getShapeIcon()}</div>
            )}
          </div>
          <span className="text-white text-[14px] font-semibold tracking-tight">{getShapeName()}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-full hover:bg-[#666666]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
        {/* Fill Color */}
        {shapeType !== 'line' && (
          <div className="px-5 py-5 border-b border-gray-50">
            <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-4">Fill Color</div>
            <div className="flex items-center gap-3">
              <div className="relative group">
                <input
                  type="color"
                  value={commonFill || '#000000'}
                  onChange={(e) => updateStyle({ fill: e.target.value })}
                  className="w-10 h-10 rounded-full cursor-pointer absolute inset-0 opacity-0 z-10"
                />
                <div
                  className="w-10 h-10 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.05)] transition-transform group-hover:scale-105"
                  style={{ backgroundColor: commonFill || '#000000' }}
                />
              </div>
              <div className="flex-1 h-10 flex items-center px-4 bg-gray-100 border border-gray-300 rounded-xl">
                <span className="text-gray-400 text-[12px] font-medium mr-1">#</span>
                <input
                  type="text"
                  value={(commonFill || '#000000').replace('#', '').toUpperCase()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9A-F]{0,6}$/i.test(val)) {
                      updateStyle({ fill: val.length === 6 ? `#${val}` : commonFill });
                    }
                  }}
                  className="bg-transparent border-none outline-none text-gray-900 text-[12px] w-full font-medium uppercase"
                />
              </div>
            </div>
          </div>
        )}

        {/* Stroke */}
        {shapeType !== 'text' && (
          <div className="px-5 py-5 border-b border-gray-50">
            <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-4">Stroke</div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative group">
                <input
                  type="color"
                  value={getCommonValue(s => s.style.stroke) || '#000000'}
                  onChange={(e) => updateStyle({ stroke: e.target.value })}
                  className="w-10 h-10 rounded-full cursor-pointer absolute inset-0 opacity-0 z-10"
                />
                <div
                  className="w-10 h-10 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.05)] transition-transform group-hover:scale-105"
                  style={{ backgroundColor: getCommonValue(s => s.style.stroke) || '#000000' }}
                />
              </div>
              <div className="flex-1 h-10 flex items-center px-4 bg-gray-100 border border-gray-300 rounded-xl">
                <span className="text-gray-500 text-[12px] font-medium mr-1">#</span>
                <input
                  type="text"
                  value={(getCommonValue(s => s.style.stroke) || '#000000').replace('#', '').toUpperCase()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9A-F]{0,6}$/i.test(val)) {
                      updateStyle({ stroke: val.length === 6 ? `#${val}` : getCommonValue(s => s.style.stroke) });
                    }
                  }}
                  className="bg-transparent border-none outline-none text-gray-900 text-[12px] w-full font-medium uppercase"
                />
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-100 border border-gray-300 rounded-xl px-4 h-10">
              <span className="text-gray-500 text-[11px] font-medium">Width</span>
              <input
                type="number"
                min="0"
                max="20"
                value={getCommonValue(s => s.style.strokeWidth) ?? 1}
                onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) || 0 })}
                className="w-10 bg-transparent border-none outline-none text-gray-900 text-[12px] text-right font-medium"
              />
            </div>
          </div>
        )}

        {/* Opacity */}
        <div className="px-5 py-5 border-b border-gray-50">
          <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-4">Opacity</div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={(commonOpacity ?? 1) * 100}
              onChange={(e) => updateStyle({ opacity: parseInt(e.target.value) / 100 })}
              className="flex-1 accent-black h-1 bg-gray-100 rounded-full cursor-pointer appearance-none"
            />
            <span className="text-gray-900 text-[12px] font-bold w-10 text-right">
              {Math.round((commonOpacity ?? 1) * 100)}%
            </span>
          </div>
        </div>

        {/* Dimensions */}
        {!isMultiSelection && (shapeType === 'rectangle' || shapeType === 'circle' || shapeType === 'image') && (
          <div className="px-5 py-5 border-b border-gray-50">
            <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-4">Dimensions</div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-gray-500 text-[9px] font-medium mb-1.5 ml-1">Width</div>
                <div className="h-10 bg-gray-100 border border-gray-300 rounded-xl flex items-center px-3">
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
                    className="w-full bg-transparent border-none outline-none text-gray-900 text-[12px] font-medium"
                  />
                </div>
              </div>
              <button
                onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                className={`mt-5 w-8 h-8 flex items-center justify-center rounded-lg transition-all border ${aspectRatioLocked
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-400 border-gray-100 hover:text-gray-900'
                  }`}
              >
                <Link className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1">
                <div className="text-gray-500 text-[9px] font-medium mb-1.5 ml-1">Height</div>
                <div className="h-10 bg-gray-100 border border-gray-300 rounded-xl flex items-center px-3">
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
                    className="w-full bg-transparent border-none outline-none text-gray-900 text-[12px] font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Border Radius */}
        {!isMultiSelection && shapeType === 'rectangle' && (
          <div className="px-5 py-5 border-b border-gray-50">
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-4">Corner Radius</div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={(firstShape as RectangleShape).radius || 0}
                onChange={(e) => updateShape(firstShape.id, { radius: parseInt(e.target.value) } as Partial<Shape>)}
                className="flex-1 accent-black h-1 bg-gray-200 rounded-full cursor-pointer appearance-none"
              />
              <div className="w-12 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-lg">
                <input
                  type="number"
                  min="0"
                  value={(firstShape as RectangleShape).radius || 0}
                  onChange={(e) => updateShape(firstShape.id, { radius: parseInt(e.target.value) || 0 } as Partial<Shape>)}
                  className="w-full bg-transparent border-none outline-none text-gray-900 text-[12px] text-center font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* Text Settings */}
        {!isMultiSelection && shapeType === 'text' && (
          <>
            <div className="px-5 py-5 border-b border-gray-50">
              <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-5">Typography</div>

              {/* Font Family */}
              <div className="mb-5">
                <div className="text-gray-500 text-[9px] font-medium mb-1.5 ml-1">Font Family</div>
                <CustomSelect
                  value={(firstShape as TextShape).style.fontFamily || 'Arial'}
                  options={FONT_FAMILIES}
                  onChange={(val) => updateStyle({ fontFamily: val })}
                />
              </div>

              {/* Size & Weight */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <div className="text-gray-500 text-[9px] font-medium mb-1.5 ml-1">Size</div>
                  <CustomSelect
                    value={(firstShape as TextShape).style.fontSize || 14}
                    options={FONT_SIZES}
                    onChange={(val) => updateStyle({ fontSize: parseInt(val) })}
                    isSize={true}
                  />
                </div>
                <div>
                  <div className="text-gray-500 text-[9px] font-medium mb-1.5 ml-1">Weight</div>
                  <CustomSelect
                    value={(firstShape as TextShape).style.fontWeight || '400'}
                    options={FONT_WEIGHTS}
                    onChange={(val) => updateStyle({ fontWeight: val })}
                  />
                </div>
              </div>

              {/* Alignment */}
              <div>
                <div className="text-gray-500 text-[9px] font-medium mb-2 ml-1">Alignment</div>
                <div className="flex bg-gray-100 border border-gray-300 p-1 rounded-xl">
                  {[
                    { id: 'left', label: 'L' },
                    { id: 'center', label: 'C' },
                    { id: 'right', label: 'R' },
                    { id: 'justify', label: 'J' }
                  ].map(align => (
                    <button
                      key={align.id}
                      onClick={() => updateStyle({ textAlign: align.id as any })}
                      className={`flex-1 h-8 rounded-lg text-[12px] font-bold transition-all ${((firstShape as TextShape).style.textAlign || 'left') === align.id
                        ? 'bg-white text-black shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {align.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Text Border */}
            <div className="px-5 py-5 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">Text Border</span>
                <button
                  onClick={() => updateStyle({ textBorder: !(firstShape as TextShape).style.textBorder })}
                  className={`w-9 h-5 rounded-full transition-all p-1 ${(firstShape as TextShape).style.textBorder ? 'bg-black' : 'bg-gray-100'
                    }`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${(firstShape as TextShape).style.textBorder ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                </button>
              </div>
            </div>

            {/* Text Shadow */}
            <div className="px-5 py-5 border-b border-gray-50">
              <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-4">Text Shadow</div>
              <div className="grid grid-cols-4 gap-2">
                {TEXT_SHADOW_PRESETS.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => updateStyle({ textShadow: preset.shadow })}
                    className={`aspect-square rounded-xl flex items-center justify-center transition-all border ${getActiveShadowPreset() === index
                      ? 'bg-black border-black shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
                      : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                      }`}
                  >
                    <div
                      className={`text-[16px] font-bold select-none ${getActiveShadowPreset() === index ? 'text-white' : 'text-gray-900'}`}
                      style={{
                        textShadow: preset.shadow.enabled
                          ? preset.shadow.outlineWidth && preset.shadow.outlineWidth > 0
                            ? `0 0 0 ${preset.shadow.color}, -1px -1px 0 ${preset.shadow.color}, 1px -1px 0 ${preset.shadow.color}, -1px 1px 0 ${preset.shadow.color}, 1px 1px 0 ${preset.shadow.color}`
                            : `${preset.shadow.offsetX || 0}px ${preset.shadow.offsetY || 1}px ${preset.shadow.blur || 6}px ${preset.shadow.color || '#727272'}`
                          : 'none'
                      }}
                    >
                      A
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Image Actions */}
        {!isMultiSelection && shapeType === 'image' && (
          <div className="px-5 py-5 border-b border-gray-50">
            <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-4">Actions</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onCropImage?.(firstShape.id)}
                className="flex items-center justify-center gap-2 h-10 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl text-gray-900 text-[11px] font-semibold transition-all"
              >
                <Crop className="w-4 h-4 text-gray-400" />
                Crop
              </button>
              <button
                onClick={() => onDuplicateShape?.(firstShape.id)}
                className="flex items-center justify-center gap-2 h-10 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl text-gray-900 text-[11px] font-semibold transition-all"
              >
                <Copy className="w-4 h-4 text-gray-400" />
                Duplicate
              </button>
              <button
                onClick={() => onDownloadImage?.(firstShape.id)}
                className="col-span-2 flex items-center justify-center gap-2 h-10 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl text-gray-900 text-[11px] font-semibold transition-all"
              >
                <Download className="w-4 h-4 text-gray-400" />
                Save Image
              </button>
            </div>
          </div>
        )}

        {/* Position */}
        {!isMultiSelection && (
          <div className="px-5 py-5 border-b border-gray-50">
            <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-4">Position</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-500 text-[9px] font-medium mb-1.5 ml-1">X</div>
                <div className="h-10 bg-gray-100 border border-gray-300 rounded-xl flex items-center px-3">
                  <input
                    type="number"
                    value={Math.round(firstShape.x)}
                    onChange={(e) => updateShape(firstShape.id, { x: parseInt(e.target.value) || 0 } as Partial<Shape>)}
                    className="w-full bg-transparent border-none outline-none text-gray-900 text-[12px] font-medium"
                  />
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-[9px] font-medium mb-1.5 ml-1">Y</div>
                <div className="h-10 bg-gray-100 border border-gray-300 rounded-xl flex items-center px-3">
                  <input
                    type="number"
                    value={Math.round(firstShape.y)}
                    onChange={(e) => updateShape(firstShape.id, { y: parseInt(e.target.value) || 0 } as Partial<Shape>)}
                    className="w-full bg-transparent border-none outline-none text-gray-900 text-[12px] font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-5 border-t border-gray-50 bg-gray-50/50">
        <button
          onClick={() => {
            selectedShapes.forEach(shape => {
              onSettingsChange(shape.id, { _delete: true } as any);
            });
          }}
          className="w-full h-11 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl text-red-600 text-[12px] font-bold transition-all active:scale-95 shadow-sm"
        >
          Delete {isMultiSelection ? `${selectedShapes.length} shapes` : 'shape'}
        </button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #e1e1e1;
        }
      `}</style>
    </div >
  );
};

export default ShapeSettingsPanel;
