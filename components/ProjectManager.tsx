'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, Edit2, Check, X, FolderOpen } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectManagerProps {
  currentProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectCreated?: (project: Project) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function ProjectManager({
  currentProjectId,
  onProjectSelect,
  onProjectCreated,
}: ProjectManagerProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch projects
  const fetchProjects = async () => {
    if (!user) return;

    try {
      setLoading(true);
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

  // Create new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      setProjects([data.project, ...projects]);
      setNewProjectName('');
      setIsCreating(false);
      
      // Select the new project
      onProjectSelect(data.project.id);
      if (onProjectCreated) {
        onProjectCreated(data.project);
      }
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project');
      setIsCreating(false);
    }
  };

  // Update project name
  const handleUpdateProject = async (projectId: string) => {
    if (!editingName.trim()) {
      setEditingProjectId(null);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update project');
      }

      setProjects(projects.map(p => p.id === projectId ? data.project : p));
      setEditingProjectId(null);
      setEditingName('');
    } catch (err: any) {
      console.error('Error updating project:', err);
      setError(err.message || 'Failed to update project');
    }
  };

  // Delete project
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This will delete all associated workflows and data.')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete project');
      }

      setProjects(projects.filter(p => p.id !== projectId));
      
      // If deleted project was current, select first project or null
      if (currentProjectId === projectId) {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        if (remainingProjects.length > 0) {
          onProjectSelect(remainingProjects[0].id);
        } else {
          onProjectSelect('');
        }
      }
    } catch (err: any) {
      console.error('Error deleting project:', err);
      setError(err.message || 'Failed to delete project');
    }
  };

  // Start editing
  const startEditing = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingName(project.name);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingProjectId(null);
    setEditingName('');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create New Project */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateProject();
              }
            }}
            placeholder="New project name..."
            className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#8b5cf6] transition-colors text-sm"
            disabled={isCreating}
          />
          <button
            onClick={handleCreateProject}
            disabled={isCreating || !newProjectName.trim()}
            className="px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="text-gray-400 text-sm text-center py-8">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-8">
          No projects yet. Create your first project above.
        </div>
      ) : (
        <div className="space-y-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`
                group flex items-center gap-2 p-2 rounded-lg transition-colors
                ${currentProjectId === project.id
                  ? 'bg-[#8b5cf6]/20 border border-[#8b5cf6]/50'
                  : 'hover:bg-[#2a2a2a]'
                }
              `}
            >
              <button
                onClick={() => onProjectSelect(project.id)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {editingProjectId === project.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateProject(project.id);
                      } else if (e.key === 'Escape') {
                        cancelEditing();
                      }
                    }}
                    className="flex-1 px-2 py-1 bg-[#0a0a0a] border border-[#8b5cf6] rounded text-white text-sm focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-white text-sm truncate">{project.name}</span>
                )}
              </button>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {editingProjectId === project.id ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateProject(project.id);
                      }}
                      className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                      title="Save"
                    >
                      <Check className="w-4 h-4 text-green-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEditing();
                      }}
                      className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(project);
                      }}
                      className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

