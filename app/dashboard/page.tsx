'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { UserRole } from '@prisma/client';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  trialEndsAt?: string;
  subscriptionStatus: string;
}

interface SessionData {
  user: User;
  tenant: Tenant;
  role: string;
}

interface QuickMetrics {
  totalMessages: number;
  successRate: number;
  todayMessages: number;
  todaySuccessRate: number;
}

export default function DashboardPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [quickMetrics, setQuickMetrics] = useState<QuickMetrics | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);

  const fetchQuickMetrics = async (tenantId: string) => {
    try {
      setMetricsLoading(true);
      const res = await fetch(`/api/analytics?tenantId=${tenantId}`);
      
      if (res.ok) {
        const data = await res.json();
        setQuickMetrics(data.quickMetrics);
      }
    } catch {
      // Silently fail metrics loading, don't break the dashboard
    } finally {
      setMetricsLoading(false);
    }
  };

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!res.ok) {
        setError('Failed to load session');
        return;
      }

      const data = await res.json();
      setSession(data);
      
      // Fetch quick metrics after session is loaded
      if (data.tenant?.id) {
        fetchQuickMetrics(data.tenant.id);
      }
    } catch {
      setError('Failed to load session');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();

    // Check if trial expired flag is in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('trial') === 'expired') {
      setTrialExpired(true);
    }
  }, [fetchSession]);

  // Calculate trial days remaining when session is loaded
  useEffect(() => {
    if (session?.tenant?.trialEndsAt) {
      const trialEnd = new Date(session.tenant.trialEndsAt);
      const now = new Date();
      const diffTime = trialEnd.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setTrialDaysRemaining(diffDays);
    }
  }, [session]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = '/login';
    } catch {
      setError('Failed to logout');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatPercentage = (num: number) => {
    return num.toFixed(1) + '%';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {session && session.role === 'SUPER_ADMIN' && (
        <div className="bg-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center text-sm font-medium hover:text-purple-100"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Go to Super Admin Dashboard
            </Link>
          </div>
        </div>
      )}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Trial Warning Banners */}
      {trialExpired && (
        <div className="bg-red-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                Your free trial has ended. Please choose a plan to continue.
              </p>
              <Link
                href="/dashboard/billing"
                className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
              >
                Choose a Plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {!trialExpired && trialDaysRemaining !== null && trialDaysRemaining <= 2 && session?.tenant?.subscriptionStatus !== 'ACTIVE' && (
        <div className="bg-yellow-500 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                Your free trial ends in {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'}. Subscribe now to avoid interruption.
              </p>
              <Link
                href="/dashboard/billing"
                className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-white hover:bg-yellow-50"
              >
                Subscribe Now
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Metrics Summary */}
        {quickMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-sm text-gray-600 mb-1">Total Messages</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(quickMetrics.totalMessages)}</p>
              <p className="text-sm text-gray-500 mt-1">All time</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-sm text-gray-600 mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{formatPercentage(quickMetrics.successRate)}</p>
              <p className="text-sm text-gray-500 mt-1">All time</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-sm text-gray-600 mb-1">Today&apos;s Messages</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(quickMetrics.todayMessages)}</p>
              <p className="text-sm text-gray-500 mt-1">Today</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-sm text-gray-600 mb-1">Today&apos;s Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{formatPercentage(quickMetrics.todaySuccessRate)}</p>
              <p className="text-sm text-gray-500 mt-1">Today</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Welcome back!</h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Email:</span> {session?.user.email}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Name:</span> {session?.user.name || 'Not set'}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Organization:</span> {session?.tenant.name}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Role:</span> {session?.role}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Status:</span> {session?.tenant.status}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/dashboard/inbox"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-green-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Inbox</h3>
            <p className="text-sm text-gray-600">
              Manage customer conversations and send interactive messages.
            </p>
          </Link>

          <Link
            href="/dashboard/connect-whatsapp"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect WhatsApp</h3>
            <p className="text-sm text-gray-600">
              Connect your WhatsApp Business API account to start sending messages.
            </p>
          </Link>

          <Link
            href="/dashboard/templates"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Templates</h3>
            <p className="text-sm text-gray-600">
              Sync and manage your WhatsApp message templates.
            </p>
          </Link>

          <Link
            href="/dashboard/campaigns"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaigns</h3>
            <p className="text-sm text-gray-600">
              Create and manage bulk messaging campaigns.
            </p>
          </Link>

          <Link
            href="/dashboard/messages"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Message Logs</h3>
            <p className="text-sm text-gray-600">
              View message send history and delivery status.
            </p>
          </Link>

          <Link
            href="/dashboard/analytics"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-blue-200"
          >
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
            </div>
            <p className="text-sm text-gray-600">
              View detailed analytics, cost tracking, and performance metrics.
            </p>
          </Link>

          {session && session.role !== UserRole.AGENT && (
            <Link
              href="/dashboard/billing"
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-yellow-200"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing & Subscription</h3>
              <p className="text-sm text-gray-600">
                Manage your subscription plan, view billing history, and upgrade your account.
              </p>
            </Link>
          )}

          {session && session.role !== UserRole.AGENT && (
            <Link
              href="/dashboard/settings"
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-purple-200"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Settings</h3>
              <p className="text-sm text-gray-600">
                Configure AI Fallback and other platform settings.
              </p>
            </Link>
          )}

          {session && session.role !== UserRole.AGENT && (
            <Link
              href="/dashboard/team"
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-indigo-200"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Management</h3>
              <p className="text-sm text-gray-600">
                Invite team members and manage their roles.
              </p>
            </Link>
          )}

          <Link
            href="/dashboard/contacts"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-green-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Contacts</h3>
            <p className="text-sm text-gray-600">
              Manage contacts and import from CSV files.
            </p>
          </Link>

          <Link
            href="/dashboard/leads"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-purple-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Lead Pipeline</h3>
            <p className="text-sm text-gray-600">
              Manage sales leads through a visual Kanban board.
            </p>
          </Link>

          <Link
            href="/dashboard/api-docs"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-indigo-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Documentation</h3>
            <p className="text-sm text-gray-600">
              View interactive API documentation and integration guides.
            </p>
          </Link>

          <Link
            href="/dashboard/support"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-pink-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Support</h3>
            <p className="text-sm text-gray-600">
              Create and manage support tickets.
            </p>
          </Link>

          {session && session.role !== UserRole.AGENT && (
            <Link
              href="/dashboard/api-keys"
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-orange-200"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">API Keys</h3>
              <p className="text-sm text-gray-600">
                Manage API keys for programmatic access to the WhatsApp API.
              </p>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
