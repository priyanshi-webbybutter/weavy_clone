'use client';

import React, { useState } from 'react';
import {
  Search,
  Clock,
  FolderOpen,
  PenLine,
  Image,
  Box,
  Sparkles,
  Images,
  CircleHelp,
  MessageCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

interface SidebarProps {
  onOpenPanel: (type: string) => void;
  activePanelType: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ onOpenPanel, activePanelType }) => {
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const topNavItems: NavItem[] = [
    { icon: Search, label: 'Search' },
    { icon: Clock, label: 'Recent' },
    { icon: FolderOpen, label: 'Projects' },
  ];

  const middleNavItems: NavItem[] = [
    { icon: PenLine, label: 'Edit' },
    { icon: Image, label: 'Image Generation' },
    { icon: Box, label: '3D Tools' },
    { icon: Sparkles, label: 'AI Assistant' },
    { icon: Images, label: 'Gallery' },
  ];

  const bottomNavItems: NavItem[] = [
    { icon: CircleHelp, label: 'Help' },
    { icon: MessageCircle, label: 'Community' },
  ];

  const handleItemClick = (label: string) => {
    // Only Recent and Image Generation open panels
    if (label === 'Recent' || label === 'Image Generation') {
      setActiveItem(label);
      onOpenPanel(label);
    } else {
      // Show Coming Soon alert for other buttons
      alert('Coming Soon: This feature is under development');
    }
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDropdownItemClick = (item: string) => {
    console.log('Dropdown item clicked:', item);
    setIsDropdownOpen(false);
    // TODO: Add actual functionality for dropdown items
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[68px] bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col items-center py-4 z-50">
      {/* Logo/Brand */}
      <div className="mb-8 relative group">
        <div className="absolute w-7 h-7 left-[-25px] bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-sm hover:opacity-80 transition-opacity">
          W
        </div>
        <button
          onClick={handleDropdownToggle}
          className="absolute -bottom-5 right-[-25px] w-5 h-5 flex items-center justify-center hover:bg-[#2a2a2a] rounded transition-colors cursor-pointer"
        >
          <ChevronDown className="w-3 h-3 text-gray-500" />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setIsDropdownOpen(false)}
            />

            {/* Dropdown Content */}
            <div className="absolute left-[-20px] top-9 w-[200px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl z-[70] py-1">
              <button
                onClick={() => handleDropdownItemClick('Back to files')}
                className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
              >
                Back to files
              </button>

              <div className="w-full h-px bg-[#2a2a2a] my-1" />

              <button
                onClick={() => handleDropdownItemClick('Create new file')}
                className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
              >
                Create new file
              </button>

              <button
                onClick={() => handleDropdownItemClick('Duplicate file')}
                className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
              >
                Duplicate file
              </button>

              <div className="w-full h-px bg-[#2a2a2a] my-1" />

              <button
                onClick={() => handleDropdownItemClick('Share file')}
                className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
              >
                Share file
              </button>

              <div className="w-full h-px bg-[#2a2a2a] my-1" />

              <button
                onClick={() => handleDropdownItemClick('Preferences')}
                className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors flex items-center justify-between group"
              >
                <span>Preferences</span>
                <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-white transition-colors" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Top Navigation */}
      <nav className="flex flex-col gap-2 mt-4">
        {topNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanelType === item.label;
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
      {/* Middle Navigation */}
      <nav className="flex flex-col gap-2 flex-1">
        {middleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanelType === item.label;
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
          const isActive = activePanelType === item.label;
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
