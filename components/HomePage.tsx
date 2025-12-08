'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Grid3x3, List, FolderOpen, User, ChevronDown, Workflow } from 'lucide-react';
import ProtectedRoute from './auth/ProtectedRoute';
import CanvasPreview from './CanvasPreview';

interface Project {
  id: string;
  name: string;
  description: string | null;
  type?: 'canvas' | 'workflow';
  preview_images?: string[];
  created_at: string;
  updated_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function HomePageContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCreateMenuOpenSidebar, setIsCreateMenuOpenSidebar] = useState(false);
  const [isCreateMenuOpenHeader, setIsCreateMenuOpenHeader] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'workflow' | 'canvas' | 'tutorials'>('workflow');

  // Fetch projects
  const fetchProjects = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch projects');
      }

      setProjects(data.projects || []);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isCreateMenuOpenSidebar && !target.closest('.create-menu-container-sidebar')) {
        setIsCreateMenuOpenSidebar(false);
      }
      if (isCreateMenuOpenHeader && !target.closest('.create-menu-container-header')) {
        setIsCreateMenuOpenHeader(false);
      }
    };

    if (isCreateMenuOpenSidebar || isCreateMenuOpenHeader) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isCreateMenuOpenSidebar, isCreateMenuOpenHeader]);

  // Filter projects based on search query
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Further filter by active tab
  const displayedProjects = filteredProjects.filter(project => {
    if (activeTab === 'canvas') {
      return project.type === 'canvas';
    }
    if (activeTab === 'workflow') {
      return project.type === 'workflow';
    }
    // Tutorials or other tabs show no projects (for now)
    return false;
  });

  // Handle create new project
  const handleCreateProject = async (type: 'workflow' | 'canvas' = 'canvas') => {
    try {
      setError(null);
      setIsCreateMenuOpenSidebar(false);
      setIsCreateMenuOpenHeader(false);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setError('Not authenticated. Please log in again.');
        return;
      }
      
      const projectName = type === 'workflow' ? 'canvas-workflow' : 'canvas';
      
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          type: type,
        }),
      });

      let data: any = {};
      let errorText = '';
      
      // Always read as text first to see what we're getting
      errorText = await response.text();
      
      // Log raw response for debugging
      console.log('📦 Raw response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        bodyLength: errorText.length,
        bodyPreview: errorText.substring(0, 200)
      });
      
      if (errorText.length === 0) {
        console.error('❌ Empty response body');
        throw new Error(`Server returned empty response (${response.status} ${response.statusText})`);
      }
      
      try {
        data = JSON.parse(errorText);
      } catch (e) {
        // If JSON parsing fails, use the text as error message
        console.error('❌ Failed to parse response as JSON:', errorText);
        data = { 
          error: 'Failed to create project',
          message: errorText || `HTTP ${response.status} ${response.statusText}`,
          status: response.status,
          statusText: response.statusText
        };
      }

      if (!response.ok) {
        console.error('❌ Error creating project:', {
          status: response.status,
          statusText: response.statusText,
          responseText: errorText,
          parsedData: data,
          error: data.error || data.message || 'Unknown error',
          details: data
        });
        throw new Error(data.error || data.message || `Failed to create project (${response.status} ${response.statusText})`);
      }

      // Navigate to canvas with new project
      if (type === 'workflow') {
        router.push(`/canvas/canvas-workflow?projectId=${data.project.id}`);
      } else {
        router.push(`/canvas/canvas?projectId=${data.project.id}`);
      }
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project. Please check your connection and try again.');
    }
  };

  // Handle project click - route based on project type
  const handleProjectClick = (projectId: string, projectType?: string) => {
    if (projectType === 'canvas') {
      router.push(`/canvas/canvas?projectId=${projectId}`);
    } else {
      router.push(`/canvas/canvas-workflow?projectId=${projectId}`);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Get user initials
  const getUserInitials = () => {
    if (!user?.email) return 'U';
    const parts = user.email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Left Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
        {/* User Profile Section */}
        <div className="p-4 border-b border-[#2a2a2a]">
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 w-full hover:bg-[#2a2a2a] rounded-lg p-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#8b5cf6] flex items-center justify-center text-white font-semibold">
                {getUserInitials()}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">
                  {user.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs text-gray-400">
                  {user.email}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {/* User Menu Dropdown */}
            {isUserMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50">
                <button
                  onClick={() => {
                    signOut();
                    router.push('/login');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Create New File Button */}
        <div className="p-4 relative create-menu-container-sidebar">
          <button
            onClick={() => {
              setIsCreateMenuOpenSidebar(!isCreateMenuOpenSidebar);
              setIsCreateMenuOpenHeader(false);
            }}
            className="w-full bg-[#fbbf24] hover:bg-[#f59e0b] text-black font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create New File
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {isCreateMenuOpenSidebar && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 overflow-hidden">
              <button
                onClick={() => handleCreateProject('workflow')}
                className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors"
              >
                Make a Workflow
              </button>
              <button
                onClick={() => handleCreateProject('canvas')}
                className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors border-t border-[#2a2a2a]"
              >
                Make a Canvas
              </button>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto">
          <nav className="p-2">
            <button className="w-full flex items-center justify-between px-3 py-2.5 bg-[#2a2a2a] rounded-lg text-left hover:bg-[#2a2a2a] transition-colors">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium">My Files</span>
              </div>
              <Plus className="w-4 h-4 text-gray-400" />
            </button>
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-4 border-t border-[#2a2a2a]">
          <a
            href="https://discord.gg/weavy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <div className="w-6 h-6 rounded bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
              D
            </div>
            <span className="text-sm">Discord</span>
          </a>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold mb-1">
              {user.email?.split('@')[0] || 'User'}'s Workspace
            </h1>
          </div>
          <div className="relative create-menu-container-header">
            <button
              onClick={() => {
                setIsCreateMenuOpenHeader(!isCreateMenuOpenHeader);
                setIsCreateMenuOpenSidebar(false);
              }}
              className="bg-[#fbbf24] hover:bg-[#f59e0b] text-black font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create New File
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isCreateMenuOpenHeader && (
              <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 overflow-hidden min-w-[180px]">
                <button
                  onClick={() => handleCreateProject('workflow')}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors"
                >
                  Make a Workflow
                </button>
                <button
                  onClick={() => handleCreateProject('canvas')}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors border-t border-[#2a2a2a]"
                >
                  Make a Canvas
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#2a2a2a]">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'workflow'
                ? 'border-b-2 border-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Workflow library
          </button>

          <button
            onClick={() => setActiveTab('canvas')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'canvas'
                ? 'border-b-2 border-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Canvas Library
          </button>

          <button
            onClick={() => setActiveTab('tutorials')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'tutorials'
                ? 'border-b-2 border-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Tutorials
          </button>
        </div>

        {/* My Files Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">My files</h2>
            <div className="flex items-center gap-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm focus:outline-none focus:border-[#8b5cf6] transition-colors w-64"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-[#2a2a2a] text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-[#2a2a2a] text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Projects Grid/List */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              Loading projects...
            </div>
          ) : displayedProjects.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {searchQuery
                ? 'No projects found matching your search.'
                : activeTab === 'canvas'
                  ? 'No canvas projects yet. Create your first canvas project!'
                  : activeTab === 'workflow'
                    ? 'No workflow projects yet. Create your first workflow project!'
                    : 'No projects yet. Create your first project to get started!'}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project.id, project.type)}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#8b5cf6] transition-colors text-left group"
                >
                  <div className="aspect-video bg-[#0a0a0a] rounded mb-3 flex items-center justify-center overflow-hidden">
                    {project.type === 'canvas' ? (
                      <CanvasPreview images={project.preview_images} />
                    ) : (
                      <div className="w-16 h-16 text-gray-600 group-hover:text-[#8b5cf6] transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                          <rect x="9" y="2" width="6" height="4" rx="0.5" />
                          <path d="M12 6v3" />
                          <rect x="2" y="11" width="6" height="4" rx="0.5" />
                          <rect x="16" y="11" width="6" height="4" rx="0.5" />
                          <path d="M12 9L5 11M12 9L19 11" />
                          <rect x="9" y="18" width="6" height="4" rx="0.5" />
                          <path d="M5 15L12 18M19 15L12 18" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="font-medium mb-1 truncate">{project.name}</div>
                  <div className="text-xs text-gray-400">
                    Updated {formatDate(project.updated_at)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {displayedProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project.id, project.type)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#8b5cf6] transition-colors text-left flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-[#0a0a0a] rounded flex items-center justify-center flex-shrink-0">
                    {project.type === 'workflow' ? (
                      <Workflow className="w-6 h-6 text-gray-600" />
                    ) : (
                      <FolderOpen className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium mb-1 truncate">{project.name}</div>
                    {project.description && (
                      <div className="text-sm text-gray-400 truncate">{project.description}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {formatDate(project.updated_at)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomePageContent />
    </ProtectedRoute>
  );
}

