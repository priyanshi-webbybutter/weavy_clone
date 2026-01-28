'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, FolderOpen, ChevronDown, Workflow, Play, Clock, Filter, Bell, Star } from 'lucide-react';
import ProtectedRoute from './auth/ProtectedRoute';
import CanvasPreview from './CanvasPreview';
import CreditsDisplay from './CreditsDisplay';

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
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isUserProfileMenuOpen, setIsUserProfileMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Initialize activeTab from URL query param, default to 'workflow'
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam === 'canvas' || tabParam === 'workflow' || tabParam === 'tutorials')
    ? tabParam
    : 'workflow';
  const [activeTab, setActiveTab] = useState<'workflow' | 'canvas' | 'tutorials'>(initialTab);

  // Update tab when URL param changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'canvas' || tabParam === 'workflow' || tabParam === 'tutorials') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

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
      if (isCreateMenuOpen && !target.closest('.create-menu-container')) {
        setIsCreateMenuOpen(false);
      }
      if (isCategoryMenuOpen && !target.closest('.category-menu-container')) {
        setIsCategoryMenuOpen(false);
      }
      if (isUserProfileMenuOpen && !target.closest('.user-profile-menu-container')) {
        setIsUserProfileMenuOpen(false);
      }
    };

    if (isCreateMenuOpen || isCategoryMenuOpen || isUserProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isCreateMenuOpen, isCategoryMenuOpen, isUserProfileMenuOpen]);

  // Track scroll direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 10) {
        // At the top, no shadow
        setIsScrollingUp(false);
      } else if (currentScrollY > lastScrollY) {
        // Scrolling down
        setIsScrollingUp(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up
        setIsScrollingUp(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

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
      setIsCreateMenuOpen(false);
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

      errorText = await response.text();

      if (errorText.length === 0) {
        throw new Error(`Server returned empty response (${response.status} ${response.statusText})`);
      }

      try {
        data = JSON.parse(errorText);
      } catch (e) {
        data = {
          error: 'Failed to create project',
          message: errorText || `HTTP ${response.status} ${response.statusText}`,
        };
      }

      if (!response.ok) {
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

  // Get featured project for hero banner
  const featuredProject = displayedProjects.length > 0 ? displayedProjects[0] : null;

  if (!user) {
    return null;
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{
        fontFamily: 'var(--font-poppins), Poppins, sans-serif',
        background: 'radial-gradient(circle at center, rgba(245, 196, 81, 0.08) 0%, #0E1518 70%)',
        backgroundColor: '#0E1518',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Left Sidebar Navigation */}
      <div className="fixed left-0 top-0 h-full w-72 flex flex-col z-40">
        {/* Logo/Brand Section */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5C451] to-[#d4a842] flex items-center justify-center">
              <Workflow className="w-6 h-6 text-[#0E1518]" />
            </div>
            <span className="text-xl font-bold text-white">Weavy</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="px-4 space-y-2">
            <button
              onClick={() => {
                setActiveTab('canvas');
                router.push('/?tab=canvas');
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-[14px] transition-all duration-200 ${activeTab === 'canvas'
                ? 'bg-[#1B2529] text-white shadow-lg'
                : 'text-[#B3BDC4] hover:bg-[#1B2529]/50 hover:text-white'
                }`}
            >
              <FolderOpen className="w-5 h-5" />
              <span className="font-medium" style={{ fontSize: '80%' }}>My Library</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('tutorials');
                router.push('/?tab=tutorials');
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-[14px] transition-all duration-200 ${activeTab === 'tutorials'
                ? 'bg-[#1B2529] text-white shadow-lg'
                : 'text-[#B3BDC4] hover:bg-[#1B2529]/50 hover:text-white'
                }`}
            >
              <Play className="w-5 h-5" />
              <span className="font-medium" style={{ fontSize: '80%' }}>Tutorials</span>
            </button>
          </nav>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-72">
        {/* Top Navigation Bar */}
        <div className="fixed top-0 left-72 right-0 z-[100]">
          <div className="h-16 px-6 flex items-center justify-between gap-4">
            {/* Left Section - Category Dropdown */}
            <div className="relative category-menu-container flex-shrink-0">
              <button
                onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 hover:bg-[#2A3439]/70 rounded-full text-sm font-medium text-white transition-all duration-200 backdrop-blur-sm"
                style={{
                  fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                  backgroundColor: 'rgba(42, 52, 57, 0.83)',
                  boxShadow: isScrollingUp ? '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                }}
              >
                <span>{activeTab === 'workflow' ? 'Workflows' : activeTab === 'canvas' ? 'Canvas' : 'Tutorials'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {isCategoryMenuOpen && (
                <div className="absolute top-full left-0 mt-2 backdrop-blur-sm rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-50 min-w-[180px]"
                  style={{ backgroundColor: 'rgba(26, 35, 39, 0.83)' }}
                >
                  <button
                    onClick={() => {
                      setActiveTab('workflow');
                      router.push('/?tab=workflow');
                      setIsCategoryMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-white hover:bg-[#2A3439]/50 transition-colors"
                    style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                  >
                    Workflows
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('canvas');
                      router.push('/?tab=canvas');
                      setIsCategoryMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-white hover:bg-[#2A3439]/50 transition-colors border-t border-[#2A3439]/30"
                    style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                  >
                    Canvas
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('tutorials');
                      router.push('/?tab=tutorials');
                      setIsCategoryMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-white hover:bg-[#2A3439]/50 transition-colors border-t border-[#2A3439]/30"
                    style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                  >
                    Tutorials
                  </button>
                </div>
              )}
            </div>

            {/* Center Section - Search Bar */}
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#9AA6AD]" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-full text-sm font-medium text-white placeholder-[#9AA6AD] focus:outline-none transition-all duration-200 backdrop-blur-sm"
                style={{
                  fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                  backgroundColor: 'rgba(42, 52, 57, 0.83)',
                  boxShadow: isScrollingUp ? '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                }}
                onFocus={(e) => e.target.style.backgroundColor = 'rgba(42, 52, 57, 0.9)'}
                onBlur={(e) => e.target.style.backgroundColor = 'rgba(42, 52, 57, 0.83)'}
              />
            </div>

            {/* Right Section - Icons & User Profile */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Filter Icon Button */}
              <button
                className="w-10 h-10 rounded-full hover:bg-[#2A3439]/70 flex items-center justify-center text-[#9AA6AD] hover:text-white transition-all duration-200 backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgba(42, 52, 57, 0.83)',
                  boxShadow: isScrollingUp ? '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                }}
                aria-label="Filter"
              >
                <Filter className="w-5 h-5" />
              </button>

              {/* Notifications Icon Button */}
              <button
                className="w-10 h-10 rounded-full hover:bg-[#2A3439]/70 flex items-center justify-center text-[#9AA6AD] hover:text-white transition-all duration-200 relative backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgba(42, 52, 57, 0.83)',
                  boxShadow: isScrollingUp ? '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                }}
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {/* Notification badge can be added here if needed */}
              </button>

              {/* Create Button */}
              <div className="relative create-menu-container">
                <button
                  onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-[#2A3439]/70 text-white rounded-full transition-all duration-200 backdrop-blur-sm"
                  style={{
                    fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    backgroundColor: 'rgba(42, 52, 57, 0.83)',
                    boxShadow: isScrollingUp ? '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Create</span>
                </button>

                {isCreateMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 backdrop-blur-xl rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-50 min-w-[200px]"
                    style={{ backgroundColor: 'rgba(26, 35, 39, 0.83)' }}
                  >
                    <button
                      onClick={() => handleCreateProject('workflow')}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-white hover:bg-[#2A3439]/50 transition-colors"
                      style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                    >
                      Make a Workflow
                    </button>
                    <button
                      onClick={() => handleCreateProject('canvas')}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-white hover:bg-[#2A3439]/50 transition-colors border-t border-[#2A3439]/30"
                      style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                    >
                      Make a Canvas
                    </button>
                  </div>
                )}
              </div>

              {/* User Profile Section */}
              <div className="relative user-profile-menu-container">
                <button
                  onClick={() => setIsUserProfileMenuOpen(!isUserProfileMenuOpen)}
                  className="flex items-center gap-3 pl-3 border-l border-[#2A3439]/30"
                >
                  <div className="flex flex-col items-end">
                    <div className="text-sm font-medium text-white" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', fontSize: '14px' }}>
                      {user.email?.split('@')[0] || 'User'}
                    </div>
                    <div className="text-xs font-medium text-[#F5C451]" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', fontSize: '12px' }}>
                      Premium
                    </div>
                  </div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm cursor-pointer hover:brightness-110 transition-all duration-200 border border-[#2A3439]/50 backdrop-blur-xl"
                    style={{
                      background: 'linear-gradient(to bottom right, rgba(42, 52, 57, 0.83), rgba(26, 35, 39, 0.83))',
                      boxShadow: isScrollingUp ? '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                    }}
                  >
                    {getUserInitials()}
                  </div>
                  <ChevronDown className="w-4 h-4 text-[#9AA6AD] ml-1" />
                </button>

                {isUserProfileMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 backdrop-blur-sm rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-50 min-w-[280px]"
                    style={{ backgroundColor: 'rgba(26, 35, 39, 0.83)' }}
                  >
                    <div className="p-4 border-b border-[#2A3439]/30">
                      <CreditsDisplay />
                    </div>
                    <button
                      onClick={() => {
                        signOut();
                        router.push('/login');
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-red-400 hover:bg-[#2A3439]/50 transition-colors"
                      style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 pt-24">
          {/* Hero Banner Section */}
          {featuredProject && (
            <div className="relative mb-8 rounded-[20px] overflow-hidden group cursor-pointer"
              onClick={() => handleProjectClick(featuredProject.id, featuredProject.type)}
            >
              <div className="relative h-[400px] bg-gradient-to-br from-[#1B2529] to-[#0E1518]">
                {featuredProject.preview_images && featuredProject.preview_images.length > 0 ? (
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0E1518] via-[#0E1518]/80 to-transparent z-10" />
                    <CanvasPreview images={featuredProject.preview_images} />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 text-[#7C8A93] group-hover:text-[#F5C451] transition-colors">
                      <Workflow className="w-full h-full" />
                    </div>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#0E1518] via-transparent to-transparent z-20" />

                <div className="absolute bottom-0 left-0 right-0 p-8 z-30">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 bg-[#F5C451]/20 text-[#F5C451] text-xs font-semibold rounded-full">
                      {featuredProject.type === 'workflow' ? 'Workflow' : 'Canvas'}
                    </span>
                    <span className="text-[#B3BDC4] text-sm">Updated {formatDate(featuredProject.updated_at)}</span>
                  </div>
                  <h2 className="text-4xl font-bold mb-2 text-white group-hover:text-[#F5C451] transition-colors">
                    {featuredProject.name}
                  </h2>
                  {featuredProject.description && (
                    <p className="text-[#B3BDC4] text-lg max-w-2xl">
                      {featuredProject.description}
                    </p>
                  )}
                  <button className="mt-4 px-6 py-3 bg-[#F5C451] hover:bg-[#d4a842] text-[#0E1518] font-semibold rounded-full transition-all duration-200 hover:scale-105 flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    <span>Open Project</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">
              {activeTab === 'workflow' ? 'Workflow Library' : activeTab === 'canvas' ? 'Canvas Library' : 'Tutorials'}
            </h2>
            {displayedProjects.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-[#1B2529] text-[#B3BDC4] text-sm rounded-full">
                  {displayedProjects.length} {displayedProjects.length === 1 ? 'project' : 'projects'}
                </span>
              </div>
            )}
          </div>

          {/* Projects Carousel */}
          {loading ? (
            <div className="text-center py-16 text-[#7C8A93]">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#F5C451]"></div>
              <p className="mt-4">Loading projects...</p>
            </div>
          ) : displayedProjects.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#1B2529] flex items-center justify-center">
                <FolderOpen className="w-12 h-12 text-[#7C8A93]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchQuery
                  ? 'No projects found'
                  : activeTab === 'canvas'
                    ? 'No canvas projects yet'
                    : activeTab === 'workflow'
                      ? 'No workflow projects yet'
                      : 'No projects yet'}
              </h3>
              <p className="text-[#7C8A93] mb-6">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Create your first project to get started!'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsCreateMenuOpen(true)}
                  className="px-6 py-3 bg-[#F5C451] hover:bg-[#d4a842] text-[#0E1518] font-semibold rounded-full transition-all duration-200 hover:scale-105"
                >
                  Create New Project
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide">
              <div className="flex gap-4 min-w-max">
                {displayedProjects.map((project) => {
                  const projectYear = new Date(project.created_at).getFullYear();
                  const rating = 4.5; // You can replace this with actual rating if available

                  return (
                    <button
                      key={project.id}
                      onClick={() => handleProjectClick(project.id, project.type)}
                      className="group flex-shrink-0 w-[140px] transition-all duration-300 hover:scale-105"
                      style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                    >
                      {/* Poster */}
                      <div
                        className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-2.5"
                        style={{ boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.3)' }}
                      >
                        {project.type === 'canvas' && project.preview_images ? (
                          <>
                            <CanvasPreview images={project.preview_images} />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />
                          </>
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-[#1B2529] to-[#0E1518] flex items-center justify-center">
                            <div className="w-16 h-16 text-[#7C8A93] group-hover:text-[#F5C451] transition-colors">
                              {project.type === 'workflow' ? (
                                <Workflow className="w-full h-full" />
                              ) : (
                                <FolderOpen className="w-full h-full" />
                              )}
                            </div>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className="text-white font-medium mb-1.5 truncate text-left"
                        style={{ fontSize: '14px', lineHeight: '1.2' }}
                      >
                        {project.name}
                      </h3>

                      {/* Metadata Row */}
                      <div className="flex items-center gap-2 text-left">
                        <span
                          className="text-[#9AA6AD]"
                          style={{ fontSize: '12px', fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                        >
                          {projectYear}
                        </span>
                        <span className="text-[#9AA6AD]" style={{ fontSize: '12px' }}>•</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-[#F5C451] text-[#F5C451]" />
                          <span
                            className="text-[#F5C451] font-medium"
                            style={{ fontSize: '12px', fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                          >
                            {rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
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
      <Suspense fallback={
        <div className="w-full h-screen bg-[#0E1518] flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      }>
        <HomePageContent />
      </Suspense>
    </ProtectedRoute>
  );
}

