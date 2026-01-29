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

const MATERIALS = [
  { name: 'Silver', value: '#E5E7EB', bg: 'linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 100%)' },
  { name: 'Gold', value: '#FDBA74', bg: 'linear-gradient(135deg, #FDBA74 0%, #D97706 100%)' },
  { name: 'Slate', value: '#4B5563', bg: 'linear-gradient(135deg, #4B5563 0%, #1F2937 100%)' },
  { name: 'Midnight', value: '#111827', bg: 'linear-gradient(135deg, #374151 0%, #111827 100%)' },
];

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
        className="w-full h-12 bg-[#F2F2F2] border border-black/[0.02] rounded-[20px] px-5 text-black text-[13px] font-bold flex items-center justify-between cursor-pointer outline-none transition-all hover:bg-gray-200"
      >
        <span className="truncate">
          {typeof options[0] === 'object'
            ? (options as { label: string; value: string | number }[]).find(opt => opt.value == value)?.label || value
            : value}{isSize ? 'px' : ''}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-14 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 overflow-y-auto py-2 max-h-60 animate-in fade-in zoom-in-95 duration-200 origin-top">
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
                className={`w-full px-5 py-2.5 text-left text-[13px] font-semibold transition-colors ${isSelected ? 'bg-black text-white' : 'text-gray-900 hover:bg-gray-100'
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
  const commonBackgroundColor = getCommonValue(s => s.style.backgroundColor);
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
      className="fixed right-6 top-6 bottom-6 w-[232px] bg-white z-50 flex flex-col rounded-[48px] overflow-hidden"
      style={{
        fontFamily: 'var(--font-poppins), sans-serif',
        border: '0.1px solid #cfcfcf',
        boxShadow: 'var(--tw-ring-offset-shadow, 0 0 #0000006b), -1px 0px 17px 0px #00000026, var(--tw-shadow)'
      }}
    >
      {/* Header with Title and Icon */}
      <div className="px-6 flex items-center mb-2 border-b" style={{ paddingTop: '1.10rem', paddingBottom: '0.8rem', gap: '0.4rem', borderColor: '#c0c0c0cc' }}>
        <img src="/templates/draw.png" alt="" className="w-8 h-8 object-contain" />
        <span className="text-[15px] font-black text-black uppercase tracking-[0.15em]">Design</span>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-8 pb-8">
        {/* Text Color Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-gray-900 text-[13px] font-bold tracking-tight">Text Color</div>
            <div className="relative group">
              <input
                type="color"
                value={commonFill || '#000000'}
                onChange={(e) => updateStyle({ fill: e.target.value })}
                className="w-6 h-6 rounded-lg cursor-pointer absolute inset-0 opacity-0 z-10"
              />
              <button className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-black transition-colors rounded-lg hover:bg-gray-100">
                <span className="text-lg leading-none font-medium text-[20px]">+</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {MATERIALS.map((m, i) => (
              <button
                key={i}
                onClick={() => updateStyle({ fill: m.value })}
                className={`aspect-square bg-[#F8F9FA] rounded-[16px] flex items-center justify-center p-1.5 border transition-all hover:shadow-md group ${commonFill === m.value ? 'border-black' : 'border-transparent'
                  }`}
              >
                <div
                  className="w-full h-full rounded-full shadow-[inset_0_-2px_6px_rgba(0,0,0,0.2),0_4px_8px_rgba(0,0,0,0.1)] transition-transform group-hover:scale-110"
                  style={{ background: m.bg }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Background Section */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="text-gray-900 text-[13px] font-bold tracking-tight">Background</div>
          </div>

          <div className="flex items-center gap-2 bg-[#F1F3F5] p-2 rounded-[22px] border border-black/[0.02]">
            <div className="relative group shrink-0">
              <input
                type="color"
                value={(shapeType === 'text' ? commonBackgroundColor : commonFill) || '#F8F9FA'}
                onChange={(e) => updateStyle(shapeType === 'text' ? { backgroundColor: e.target.value } : { fill: e.target.value })}
                className="w-10 h-10 rounded-xl cursor-pointer absolute inset-0 opacity-0 z-10"
              />
              <div
                className="w-10 h-10 rounded-[16px] bg-white shadow-sm border border-black/5 p-1 transition-transform group-hover:scale-105"
              >
                <div className="w-full h-full rounded-[10px]" style={{ backgroundColor: (shapeType === 'text' ? commonBackgroundColor : commonFill) || '#F8F9FA' }} />
              </div>
            </div>

            <div className="flex-1 px-2">
              <input
                type="text"
                value={((shapeType === 'text' ? commonBackgroundColor : commonFill) || '#F8F9FA').replace('#', '').toUpperCase()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[0-9A-F]{0,6}$/i.test(val)) {
                    const newHex = val.length === 6 ? `#${val}` : (shapeType === 'text' ? commonBackgroundColor : commonFill);
                    updateStyle(shapeType === 'text' ? { backgroundColor: newHex } : { fill: newHex });
                  }
                }}
                className="bg-transparent border-none outline-none text-black text-[13px] w-full font-bold uppercase tracking-wider"
              />
            </div>

            <div className="flex items-center gap-2 px-3 border-l border-gray-200">
              <input
                type="text"
                value={Math.round((commonOpacity ?? 1) * 100)}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) updateStyle({ opacity: Math.min(100, Math.max(0, val)) / 100 });
                }}
                className="bg-transparent border-none outline-none text-black text-[13px] w-6 font-bold text-right"
              />
              <span className="text-gray-400 text-[13px] font-bold">%</span>
            </div>
          </div>
        </div>

        {/* Stroke Section */}
        {shapeType !== 'text' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="text-gray-900 text-[14px] font-bold tracking-tight">Stroke</div>
            </div>

            <div className="flex items-center gap-2 bg-[#F2F2F2] p-1.5 rounded-[22px] border border-black/[0.02] mb-3">
              <div className="relative group shrink-0">
                <input
                  type="color"
                  value={getCommonValue(s => s.style.stroke) || '#000000'}
                  onChange={(e) => updateStyle({ stroke: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer absolute inset-0 opacity-0 z-10"
                />
                <div
                  className="w-10 h-10 rounded-[16px] bg-white shadow-sm border border-black/5 p-1 transition-transform group-hover:scale-105"
                >
                  <div className="w-full h-full rounded-[10px]" style={{ backgroundColor: getCommonValue(s => s.style.stroke) || '#000000' }} />
                </div>
              </div>

              <div className="flex-1 px-2">
                <input
                  type="text"
                  value={(getCommonValue(s => s.style.stroke) || '#000000').replace('#', '').toUpperCase()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9A-F]{0,6}$/i.test(val)) {
                      updateStyle({ stroke: val.length === 6 ? `#${val}` : getCommonValue(s => s.style.stroke) });
                    }
                  }}
                  className="bg-transparent border-none outline-none text-black text-[13px] w-full font-bold uppercase tracking-wider"
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#F2F2F2] px-5 h-12 rounded-[22px] border border-black/[0.02]">
              <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Stroke Width</span>
              <input
                type="number"
                min="0"
                max="20"
                value={getCommonValue(s => s.style.strokeWidth) ?? 1}
                onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) || 0 })}
                className="w-10 bg-transparent border-none outline-none text-black text-[13px] text-right font-bold"
              />
            </div>
          </div>
        )}

        {/* Dimensions Section */}
        {!isMultiSelection && (shapeType === 'rectangle' || shapeType === 'circle' || shapeType === 'image') && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="text-gray-900 text-[14px] font-bold tracking-tight">Dimensions</div>
              <button
                onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                className={`w-10 h-10 flex items-center justify-center rounded-[16px] transition-all border ${aspectRatioLocked
                  ? 'bg-black text-white border-black'
                  : 'bg-[#F2F2F2] text-gray-400 border-transparent hover:text-black'
                  }`}
              >
                <Link className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#F2F2F2] p-4 rounded-[24px] border border-black/[0.02]">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Width</div>
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
                  className="w-full bg-transparent border-none outline-none text-black text-[14px] font-bold"
                />
              </div>
              <div className="bg-[#F2F2F2] p-4 rounded-[24px] border border-black/[0.02]">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Height</div>
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
                  className="w-full bg-transparent border-none outline-none text-black text-[14px] font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* Corner Radius Section */}
        {!isMultiSelection && shapeType === 'rectangle' && (
          <div>
            <div className="text-gray-900 text-[14px] font-bold tracking-tight mb-5">Corner Radius</div>
            <div className="flex items-center gap-4 bg-[#F2F2F2] p-4 rounded-[24px] border border-black/[0.02]">
              <input
                type="range"
                min="0"
                max="100"
                value={(firstShape as RectangleShape).radius || 0}
                onChange={(e) => updateShape(firstShape.id, { radius: parseInt(e.target.value) } as Partial<Shape>)}
                className="flex-1 accent-black h-1 bg-gray-300 rounded-full cursor-pointer appearance-none"
              />
              <input
                type="number"
                min="0"
                value={(firstShape as RectangleShape).radius || 0}
                onChange={(e) => updateShape(firstShape.id, { radius: parseInt(e.target.value) || 0 } as Partial<Shape>)}
                className="w-10 bg-transparent border-none outline-none text-black text-[13px] text-right font-bold"
              />
            </div>
          </div>
        )}

        {/* Typography Section */}
        {shapeType === 'text' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="text-gray-900 text-[14px] font-bold tracking-tight">Typography</div>
              <button className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-black transition-colors rounded-lg hover:bg-gray-100">
                <span className="text-lg leading-none">+</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2">Font Family</div>
              <CustomSelect
                value={(firstShape as TextShape).style.fontFamily || 'Arial'}
                options={FONT_FAMILIES}
                onChange={(val) => updateStyle({ fontFamily: val })}
              />

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <div className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2">Size</div>
                  <CustomSelect
                    value={(firstShape as TextShape).style.fontSize || 14}
                    options={FONT_SIZES}
                    onChange={(val) => updateStyle({ fontSize: parseInt(val) })}
                    isSize={true}
                  />
                </div>
                <div>
                  <div className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2">Weight</div>
                  <CustomSelect
                    value={(firstShape as TextShape).style.fontWeight || '400'}
                    options={FONT_WEIGHTS}
                    onChange={(val) => updateStyle({ fontWeight: val })}
                  />
                </div>
              </div>

              <div className="mt-8">
                <div className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-3">Alignment</div>
                <div className="flex bg-[#F2F2F2] p-1.5 rounded-[22px] border border-black/[0.02]">
                  {[
                    { id: 'left', label: 'L' },
                    { id: 'center', label: 'C' },
                    { id: 'right', label: 'R' },
                    { id: 'justify', label: 'J' }
                  ].map(align => (
                    <button
                      key={align.id}
                      onClick={() => updateStyle({ textAlign: align.id as any })}
                      className={`flex-1 py-1.5 rounded-[16px] text-[12px] font-bold transition-all ${((firstShape as TextShape).style.textAlign || 'left') === align.id
                        ? 'bg-white text-black shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {align.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Effects (Border & Shadow) */}
              <div className="mt-8 pt-8 border-t border-gray-100 space-y-8">
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 text-[14px] font-bold tracking-tight">Text Border</span>
                  <button
                    onClick={() => updateStyle({ textBorder: !(firstShape as TextShape).style.textBorder })}
                    className={`w-12 h-7 rounded-full transition-all p-1.5 ${(firstShape as TextShape).style.textBorder ? 'bg-black' : 'bg-[#F2F2F2]'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${(firstShape as TextShape).style.textBorder ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                  </button>
                </div>

                <div>
                  <div className="text-gray-900 text-[14px] font-bold tracking-tight mb-5">Text Shadow</div>
                  <div className="grid grid-cols-4 gap-3">
                    {TEXT_SHADOW_PRESETS.map((preset, index) => (
                      <button
                        key={preset.name}
                        onClick={() => updateStyle({ textShadow: preset.shadow })}
                        className={`aspect-square rounded-[20px] flex items-center justify-center transition-all border ${getActiveShadowPreset() === index
                          ? 'bg-black border-black shadow-lg shadow-black/10'
                          : 'bg-[#F8F9FA] border-transparent hover:border-gray-200'
                          }`}
                      >
                        <div
                          className={`text-[18px] font-bold select-none ${getActiveShadowPreset() === index ? 'text-white' : 'text-gray-900'}`}
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
              </div>
            </div>
          </div>
        )}

        {/* Image Actions Section */}
        {!isMultiSelection && shapeType === 'image' && (
          <div>
            <div className="text-gray-900 text-[14px] font-bold tracking-tight mb-5">Image Actions</div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => onCropImage?.(firstShape.id)}
                className="flex items-center justify-center gap-2 h-12 bg-[#F2F2F2] hover:bg-gray-200 border border-black/[0.02] rounded-[20px] text-black text-[13px] font-bold transition-all"
              >
                <Crop className="w-4 h-4 text-gray-400" />
                Crop
              </button>
              <button
                onClick={() => onDuplicateShape?.(firstShape.id)}
                className="flex items-center justify-center gap-2 h-12 bg-[#F2F2F2] hover:bg-gray-200 border border-black/[0.02] rounded-[20px] text-black text-[13px] font-bold transition-all"
              >
                <Copy className="w-4 h-4 text-gray-400" />
                Duplicate
              </button>
              <button
                onClick={() => onDownloadImage?.(firstShape.id)}
                className="col-span-2 flex items-center justify-center gap-2 h-14 bg-black text-white rounded-[24px] text-[13px] font-bold transition-all active:scale-95 shadow-xl shadow-black/10"
              >
                <Download className="w-4 h-4" />
                Save Image
              </button>
            </div>
          </div>
        )}

        {/* Position Section */}
        {!isMultiSelection && (
          <div>
            <div className="text-gray-900 text-[14px] font-bold tracking-tight mb-5">Position</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#F2F2F2] p-4 rounded-[24px] border border-black/[0.02]">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">X Coordinate</div>
                <input
                  type="number"
                  value={Math.round(firstShape.x)}
                  onChange={(e) => updateShape(firstShape.id, { x: parseInt(e.target.value) || 0 } as Partial<Shape>)}
                  className="w-full bg-transparent border-none outline-none text-black text-[14px] font-bold"
                />
              </div>
              <div className="bg-[#F2F2F2] p-4 rounded-[24px] border border-black/[0.02]">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Y Coordinate</div>
                <input
                  type="number"
                  value={Math.round(firstShape.y)}
                  onChange={(e) => updateShape(firstShape.id, { y: parseInt(e.target.value) || 0 } as Partial<Shape>)}
                  className="w-full bg-transparent border-none outline-none text-black text-[14px] font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* Delete Shape Button */}
        <div className="pt-4">
          <button
            onClick={() => {
              selectedShapes.forEach(shape => {
                onSettingsChange(shape.id, { _delete: true } as any);
              });
            }}
            className="w-full py-5 bg-[#FFF5F5] hover:bg-red-50 text-red-500 text-[14px] font-bold rounded-[28px] transition-all active:scale-95 border border-red-100/50"
          >
            Delete {isMultiSelection ? `${selectedShapes.length} shapes` : 'shape'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #EEF2F5;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #E1E7EB;
        }
      `}</style>
    </div>
  );
};

export default ShapeSettingsPanel;
