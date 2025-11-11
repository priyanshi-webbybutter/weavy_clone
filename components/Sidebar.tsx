'use client';

import React, { useState } from 'react';
import {
  Search,
  Clock,
  FolderOpen,
  Edit3,
  Image,
  Box,
  Sparkles,
  Images,
  HelpCircle,
  MessageCircle,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

const Sidebar = () => {
  const [activeItem, setActiveItem] = useState<string | null>(null);

  const topNavItems: NavItem[] = [
    { icon: Search, label: 'Search' },
    { icon: Clock, label: 'Recent' },
    { icon: FolderOpen, label: 'Projects' },
  ];

  const middleNavItems: NavItem[] = [
    { icon: Edit3, label: 'Edit' },
    { icon: Image, label: 'Image Generation' },
    { icon: Box, label: '3D Tools' },
    { icon: Sparkles, label: 'AI Assistant' },
    { icon: Images, label: 'Gallery' },
  ];

  const bottomNavItems: NavItem[] = [
    { icon: HelpCircle, label: 'Help' },
    { icon: MessageCircle, label: 'Community' },
  ];

  const handleItemClick = (label: string) => {
    setActiveItem(label);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[68px] bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col items-center py-4 z-50">
      {/* Logo/Brand */}
      <div className="mb-8 relative group cursor-pointer">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xl hover:opacity-80 transition-opacity">
          W
        </div>
        <ChevronDown className="absolute -bottom-2 right-0 w-3 h-3 text-gray-500" />
      </div>

      {/* Top Navigation */}
      <nav className="flex flex-col gap-2 mb-6">
        {topNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.label;
          return (
            <button
              key={item.label}
              onClick={() => handleItemClick(item.label)}
              className={`
                w-10 h-10 flex items-center justify-center rounded-lg
                transition-all duration-200 group relative
                ${
                  isActive
                    ? 'bg-[#2a2a2a] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#242424]'
                }
              `}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="w-8 h-px bg-[#2a2a2a] mb-6" />

      {/* Middle Navigation */}
      <nav className="flex flex-col gap-2 flex-1">
        {middleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.label;
          return (
            <button
              key={item.label}
              onClick={() => handleItemClick(item.label)}
              className={`
                w-10 h-10 flex items-center justify-center rounded-lg
                transition-all duration-200 group relative
                ${
                  isActive
                    ? 'bg-[#2a2a2a] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#242424]'
                }
              `}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <nav className="flex flex-col gap-2 mt-auto">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.label;
          return (
            <button
              key={item.label}
              onClick={() => handleItemClick(item.label)}
              className={`
                w-10 h-10 flex items-center justify-center rounded-lg
                transition-all duration-200 group relative
                ${
                  isActive
                    ? 'bg-[#2a2a2a] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#242424]'
                }
              `}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
