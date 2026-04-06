'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Users, DollarSign, CreditCard, FileText, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface UserDetails {
  id: string;
  email: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignIn: string | null;
  isAdmin: boolean;
  credits: {
    balance: number;
    createdAt: string | null;
    updatedAt: string | null;
  };
  transactions: {
    count: number;
    totalCreditsDeducted: string;
    totalDollarCost: string;
    lastTransaction: string | null;
  };
  modelUsage: {
    modelName: string;
    count: number;
    totalCredits: string;
    totalDollarCost: string;
    totalTokens: number;
  }[];
  projects: {
    count: number;
    lastProject: {
      id: string;
      createdAt: string;
    } | null;
  };
}

interface Stats {
  totalUsers: number;
  totalCredits: number;
  totalTransactions: number;
  totalCreditsDeducted: string;
  totalDollarCost: string;
  totalProjects: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'createdAt' | 'email' | 'credits' | 'transactions'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    await Promise.all([fetchUsers(token), fetchStats(token)]);
  };

  const fetchUsers = async (token: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('admin_user');
          router.push('/admin/login');
          return;
        }
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.users || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('admin_user');
    router.push('/admin/login');
  };

  const toggleUserExpansion = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredAndSortedUsers = users
    .filter(user => 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'credits':
          aValue = a.credits.balance;
          bValue = b.credits.balance;
          break;
        case 'transactions':
          aValue = a.transactions.count;
          bValue = b.transactions.count;
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">User Management & Analytics</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-gray-400">Total Users</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-gray-400">Total Credits</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalCredits.toFixed(2)}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">Total Revenue</span>
              </div>
              <div className="text-2xl font-bold text-white">${stats.totalDollarCost}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-gray-400">Transactions</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalTransactions}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span className="text-sm text-gray-400">Projects</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalProjects}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-orange-400" />
                <span className="text-sm text-gray-400">Credits Used</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalCreditsDeducted}</div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#8b5cf6] transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:border-[#8b5cf6]"
              >
                <option value="createdAt">Sort by Date</option>
                <option value="email">Sort by Email</option>
                <option value="credits">Sort by Credits</option>
                <option value="transactions">Sort by Transactions</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-sm hover:border-[#8b5cf6] transition-colors"
              >
                {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  const token = localStorage.getItem('auth_token');
                  if (token) {
                    fetchUsers(token);
                    fetchStats(token);
                  }
                }}
                className="px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-sm hover:border-[#8b5cf6] transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0a] border-b border-[#2a2a2a]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Credits</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Transactions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Projects</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {filteredAndSortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      {searchQuery ? 'No users found matching your search' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedUsers.map((user) => (
                    <React.Fragment key={user.id}>
                      <tr className="hover:bg-[#2a2a2a]/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-white font-medium">{user.email}</div>
                            <div className="text-xs text-gray-400 mt-1">ID: {user.id.substring(0, 8)}...</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{user.credits.balance.toFixed(2)}</div>
                          <div className="text-xs text-gray-400">${(user.credits.balance * 0.02).toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{user.transactions.count}</div>
                          <div className="text-xs text-gray-400">${user.transactions.totalDollarCost}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{user.projects.count}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {user.emailConfirmed ? (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Verified</span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">Unverified</span>
                            )}
                            {user.isAdmin && (
                              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">Admin</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleUserExpansion(user.id)}
                            className="text-[#8b5cf6] hover:text-[#7c3aed] text-sm font-medium"
                          >
                            {expandedUsers.has(user.id) ? 'Hide Details' : 'View Details'}
                          </button>
                        </td>
                      </tr>
                      {expandedUsers.has(user.id) && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-[#0a0a0a]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <h4 className="text-gray-400 mb-2 font-medium">Account Information</h4>
                                <div className="space-y-1 text-gray-300">
                                  <div>Created: {formatDate(user.createdAt)}</div>
                                  <div>Last Sign In: {formatDate(user.lastSignIn)}</div>
                                  <div>Email Verified: {user.emailConfirmed ? 'Yes' : 'No'}</div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-gray-400 mb-2 font-medium">Credits Information</h4>
                                <div className="space-y-1 text-gray-300">
                                  <div>Balance: {user.credits.balance.toFixed(2)} credits</div>
                                  <div>Credits Created: {formatDate(user.credits.createdAt)}</div>
                                  <div>Last Updated: {formatDate(user.credits.updatedAt)}</div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-gray-400 mb-2 font-medium">Transaction Statistics</h4>
                                <div className="space-y-1 text-gray-300">
                                  <div>Total Transactions: {user.transactions.count}</div>
                                  <div>Total Credits Used: {user.transactions.totalCreditsDeducted}</div>
                                  <div>Total Dollar Cost: ${user.transactions.totalDollarCost}</div>
                                  <div>Last Transaction: {formatDate(user.transactions.lastTransaction)}</div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-gray-400 mb-2 font-medium">Project Information</h4>
                                <div className="space-y-1 text-gray-300">
                                  <div>Total Projects: {user.projects.count}</div>
                                  {user.projects.lastProject && (
                                    <div>Last Project: {formatDate(user.projects.lastProject.createdAt)}</div>
                                  )}
                                </div>
                              </div>
                              <div className="md:col-span-2">
                                <h4 className="text-gray-400 mb-3 font-medium">Model Usage Statistics</h4>
                                {user.modelUsage && user.modelUsage.length > 0 ? (
                                  <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-gray-400 font-medium">Model</th>
                                          <th className="px-4 py-2 text-right text-gray-400 font-medium">Uses</th>
                                          <th className="px-4 py-2 text-right text-gray-400 font-medium">Credits</th>
                                          <th className="px-4 py-2 text-right text-gray-400 font-medium">Cost</th>
                                          <th className="px-4 py-2 text-right text-gray-400 font-medium">Tokens</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#2a2a2a]">
                                        {user.modelUsage.map((model, idx) => (
                                          <tr key={idx} className="hover:bg-[#1a1a1a]/50">
                                            <td className="px-4 py-2 text-gray-300 font-mono text-xs">
                                              {model.modelName}
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-300">
                                              {model.count}
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-300">
                                              {model.totalCredits}
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-300">
                                              ${model.totalDollarCost}
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-400 text-xs">
                                              {model.totalTokens.toLocaleString()}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-[#1a1a1a] border-t border-[#2a2a2a]">
                                        <tr>
                                          <td className="px-4 py-2 text-gray-300 font-medium">Total</td>
                                          <td className="px-4 py-2 text-right text-gray-300 font-medium">
                                            {user.modelUsage.reduce((sum, m) => sum + m.count, 0)}
                                          </td>
                                          <td className="px-4 py-2 text-right text-gray-300 font-medium">
                                            {user.modelUsage.reduce((sum, m) => sum + parseFloat(m.totalCredits), 0).toFixed(4)}
                                          </td>
                                          <td className="px-4 py-2 text-right text-gray-300 font-medium">
                                            ${user.modelUsage.reduce((sum, m) => sum + parseFloat(m.totalDollarCost), 0).toFixed(6)}
                                          </td>
                                          <td className="px-4 py-2 text-right text-gray-300 font-medium">
                                            {user.modelUsage.reduce((sum, m) => sum + m.totalTokens, 0).toLocaleString()}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-gray-400 text-sm">No model usage data available</div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 text-sm text-gray-400 text-center">
          Showing {filteredAndSortedUsers.length} of {users.length} users
        </div>
      </div>
    </div>
  );
}

