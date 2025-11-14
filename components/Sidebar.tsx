'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Clock,
  Image,
  Wrench,
  FolderOpen,
  Video,
  ChevronDown,
  ChevronRight,
  LogOut,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

interface SidebarProps {
  onOpenPanel: (type: string) => void;
  activePanelType: string | null;
  onClosePanel?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onOpenPanel, activePanelType, onClosePanel }) => {
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { signOut, user } = useAuth();
  const router = useRouter();

  const topNavItems: NavItem[] = [
    { icon: Clock, label: 'Recent' },
  ];

  const middleNavItems: NavItem[] = [
    { icon: Image, label: 'Image Generation' },
    { icon: Video, label: 'Video models' },
    { icon: FolderOpen, label: 'Assets' },
    { icon: Wrench, label: 'Tools' },
  ];


  const handleItemClick = (label: string) => {
    // Toggle: if clicking the same panel that's already open, close it
    if (activePanelType === label && onClosePanel) {
      onClosePanel();
      setActiveItem(null);
    } else {
      setActiveItem(label);
      onOpenPanel(label);
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

              <div className="w-full h-px bg-[#2a2a2a] my-1" />

              <button
                onClick={async () => {
                  await signOut();
                  router.push('/login');
                }}
                className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
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

    </aside>
  );
};

export default Sidebar;
