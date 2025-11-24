'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface CanvasCanvasProps {
  initialProjectId?: string | null;
}

function CanvasCanvasInner({ initialProjectId }: CanvasCanvasProps = {}) {
  const { user } = useAuth();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialProjectId || null);
  const [currentProjectName, setCurrentProjectName] = useState<string>('untitled');
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [tempProjectName, setTempProjectName] = useState<string>('untitled');

  // Load project data
  useEffect(() => {
    if (currentProjectId && user) {
      const loadProject = async () => {
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) return;

          const response = await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            setCurrentProjectName(data.project.name || 'untitled');
            setTempProjectName(data.project.name || 'untitled');
          }
        } catch (error) {
          console.error('Error loading project:', error);
        }
      };

      loadProject();
    }
  }, [currentProjectId, user]);

  const handleProjectNameClick = () => {
    setEditingProjectName(true);
  };

  const handleProjectNameBlur = () => {
    setEditingProjectName(false);
    saveProjectName();
  };

  const handleProjectNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setEditingProjectName(false);
      saveProjectName();
    } else if (e.key === 'Escape') {
      setEditingProjectName(false);
      setTempProjectName(currentProjectName);
    }
  };

  const saveProjectName = async () => {
    if (!currentProjectId || !user || tempProjectName === currentProjectName) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/projects/${currentProjectId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tempProjectName.trim() || 'untitled',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentProjectName(data.project.name || 'untitled');
        setTempProjectName(data.project.name || 'untitled');
      }
    } catch (error) {
      console.error('Error saving project name:', error);
      setTempProjectName(currentProjectName);
    }
  };

  return (
    <div className="w-full h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <div className="h-16 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {editingProjectName ? (
            <input
              type="text"
              value={tempProjectName}
              onChange={(e) => setTempProjectName(e.target.value)}
              onBlur={handleProjectNameBlur}
              onKeyDown={handleProjectNameKeyDown}
              className="bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-1 text-sm focus:outline-none focus:border-[#8b5cf6]"
              autoFocus
            />
          ) : (
            <h1
              onClick={handleProjectNameClick}
              className="text-lg font-semibold cursor-pointer hover:text-[#8b5cf6] transition-colors"
            >
              {currentProjectName}
            </h1>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full h-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-2xl font-semibold mb-2">Canvas Canvas</h2>
            <p className="text-gray-400">Your new canvas workspace</p>
            <p className="text-sm text-gray-500 mt-4">Project ID: {currentProjectId || 'No project'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CanvasCanvas({ initialProjectId }: CanvasCanvasProps = {}) {
  return <CanvasCanvasInner initialProjectId={initialProjectId} />;
}

