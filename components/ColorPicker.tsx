'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface ColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  color: string;
  onChange: (color: string) => void;
  title: string;
  position?: { x: number; y: number };
}

export default function ColorPicker({ isOpen, onClose, color, onChange, title, position }: ColorPickerProps) {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [lightness, setLightness] = useState(50);
  const [alpha, setAlpha] = useState(100);
  const [hexColor, setHexColor] = useState('#808080');
  const pickerRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);
  const hueRefValue = useRef(hue);
  const satRefValue = useRef(saturation);
  const lightRefValue = useRef(lightness);
  const alphaRefValue = useRef(alpha);

  // Keep refs in sync with state
  useEffect(() => {
    hueRefValue.current = hue;
    satRefValue.current = saturation;
    lightRefValue.current = lightness;
    alphaRefValue.current = alpha;
  }, [hue, saturation, lightness, alpha]);

  // Parse color on mount or when color prop changes
  useEffect(() => {
    if (color) {
      if (color === 'transparent') {
        setAlpha(0);
        setHexColor('#000000');
      } else {
        const parsed = parseColor(color);
        setHue(parsed.h);
        setSaturation(parsed.s);
        setLightness(parsed.l);
        setAlpha(parsed.a * 100);
        setHexColor(parsed.hex);
      }
    }
  }, [color]);

  const parseColor = (colorStr: string) => {
    // Handle hex colors
    if (colorStr.startsWith('#')) {
      const hex = colorStr.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const hsl = rgbToHsl(r, g, b);
      return { h: hsl.h, s: hsl.s, l: hsl.l, a: 1, hex: colorStr };
    }
    // Handle rgba/rgb
    const match = colorStr.match(/(\d+)/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0]);
      const g = parseInt(match[1]);
      const b = parseInt(match[2]);
      const a = match.length > 3 ? parseFloat(match[3]) : 1;
      const hsl = rgbToHsl(r, g, b);
      return { h: hsl.h, s: hsl.s, l: hsl.l, a, hex: rgbToHex(r, g, b) };
    }
    return { h: 0, s: 0, l: 50, a: 1, hex: '#808080' };
  };

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  const hslToRgb = (h: number, s: number, l: number) => {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };

  const updateColor = (newHue: number, newSat: number, newLight: number, newAlpha: number) => {
    setHue(newHue);
    setSaturation(newSat);
    setLightness(newLight);
    setAlpha(newAlpha);
    
    const rgb = hslToRgb(newHue, newSat, newLight);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setHexColor(hex);
    
    if (newAlpha === 0) {
      onChange('transparent');
    } else if (newAlpha === 100) {
      onChange(hex);
    } else {
      onChange(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${newAlpha / 100})`);
    }
  };

  const [isDragging, setIsDragging] = useState<'color' | 'hue' | 'alpha' | null>(null);

  const handleColorSquareMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging('color');
    handleColorSquareMove(e);
  };

  const handleColorSquareMove = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!pickerRef.current) return;
    const rect = pickerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const l = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
    updateColor(hue, s, l, alpha);
  };

  const handleHueSliderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging('hue');
    handleHueSliderMove(e);
  };

  const handleHueSliderMove = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const h = Math.max(0, Math.min(360, (x / rect.width) * 360));
    updateColor(h, saturation, lightness, alpha);
  };

  const handleAlphaSliderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging('alpha');
    handleAlphaSliderMove(e);
  };

  const handleAlphaSliderMove = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!alphaRef.current) return;
    const rect = alphaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const a = Math.max(0, Math.min(100, (x / rect.width) * 100));
    updateColor(hue, saturation, lightness, a);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging === 'color' && pickerRef.current) {
        const rect = pickerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const s = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const l = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
        updateColor(hueRefValue.current, s, l, alphaRefValue.current);
      } else if (isDragging === 'hue' && hueRef.current) {
        const rect = hueRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const h = Math.max(0, Math.min(360, (x / rect.width) * 360));
        updateColor(h, satRefValue.current, lightRefValue.current, alphaRefValue.current);
      } else if (isDragging === 'alpha' && alphaRef.current) {
        const rect = alphaRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const a = Math.max(0, Math.min(100, (x / rect.width) * 100));
        updateColor(hueRefValue.current, satRefValue.current, lightRefValue.current, a);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setHexColor(hex);
      const parsed = parseColor(hex);
      updateColor(parsed.h, parsed.s, parsed.l, alpha);
    } else {
      setHexColor(hex);
    }
  };

  const presetColors = [
    'transparent',
    '#000000',
    '#FFFFFF',
    '#00FF00',
    '#8B5CF6',
    '#E0E0E0',
  ];

  const currentColor = alpha === 0 ? 'transparent' : 
    alpha === 100 ? hexColor : 
    `rgba(${hslToRgb(hue, saturation, lightness).r}, ${hslToRgb(hue, saturation, lightness).g}, ${hslToRgb(hue, saturation, lightness).b}, ${alpha / 100})`;

  if (!isOpen) return null;

  const rgb = hslToRgb(hue, saturation, lightness);
  const hueColor = `hsl(${hue}, 100%, 50%)`;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl z-50 p-4 w-80 color-picker"
      style={{
        left: position ? `${position.x}px` : '50%',
        top: position ? `${position.y}px` : '50%',
        transform: position ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-black">{title}</h3>
        <button onClick={onClose} className="text-gray-600 hover:text-black">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Color Square */}
      <div
        ref={pickerRef}
        className="w-full h-48 rounded cursor-crosshair relative mb-3 select-none"
        style={{
          background: `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, ${hueColor})`,
        }}
        onMouseDown={handleColorSquareMouseDown}
      >
        <div
          className="absolute w-3 h-3 border-2 border-white rounded-full shadow-lg pointer-events-none"
          style={{
            left: `${saturation}%`,
            top: `${100 - lightness}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Hue Slider */}
      <div className="mb-3">
        <div
          ref={hueRef}
          className="w-full h-6 rounded cursor-pointer relative select-none"
          style={{
            background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          }}
          onMouseDown={handleHueSliderMouseDown}
        >
          <div
            className="absolute w-3 h-full border-2 border-white rounded shadow-lg pointer-events-none"
            style={{
              left: `${(hue / 360) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      </div>

      {/* Alpha Slider */}
      <div className="mb-3">
        <div
          ref={alphaRef}
          className="w-full h-6 rounded cursor-pointer relative select-none overflow-hidden"
          style={{
            backgroundImage: `repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 8px 8px`,
          }}
          onMouseDown={handleAlphaSliderMouseDown}
        >
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, transparent, ${hexColor})`,
            }}
          />
          {/* Slider handle */}
          <div
            className="absolute w-3 h-full border-2 border-white rounded shadow-lg pointer-events-none z-10"
            style={{
              left: `${alpha}%`,
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      </div>

      {/* Preset Colors */}
      <div className="flex gap-2 mb-3">
        {presetColors.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (preset === 'transparent') {
                updateColor(hue, saturation, lightness, 0);
              } else {
                const parsed = parseColor(preset);
                updateColor(parsed.h, parsed.s, parsed.l, 100);
              }
            }}
            className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center"
            style={{
              backgroundColor: preset === 'transparent' ? 'white' : preset,
            }}
          >
            {preset === 'transparent' && (
              <div className="w-full h-full bg-white rounded-full" style={{
                backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 4px 4px',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Hex and Opacity Inputs */}
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <input
          type="text"
          value={hexColor}
          onChange={handleHexChange}
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="#000000"
        />
        <input
          type="text"
          value={`${Math.round(alpha)} %`}
          readOnly
          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-black"
        />
      </div>
    </div>
  );
}

