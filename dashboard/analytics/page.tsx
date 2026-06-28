'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  dailyStats: Array<{
    date: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  }>;
  totals: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
}

const COLORS = {
  sent: '#3b82f6',
  delivered: '#22c55e',
  read: '#a855f7',
  failed: '#ef4444',
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics/overview');
      if (!res.ok) {
        throw new Error('Failed to fetch analytics');
      }
      const analyticsData = await res.json();
      setData(analyticsData);
    } catch (err) {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">{error || 'Failed to load analytics'}</p>
        </div>
      </div>
    );
  }

  const hasData = data.totals.sent > 0 || data.totals.delivered > 0 || data.totals.read > 0 || data.totals.failed > 0;

  // Prepare pie chart data
  const pieData = [
    { name: 'Sent', value: data.totals.sent, color: COLORS.sent },
    { name: 'Delivered', value: data.totals.delivered, color: COLORS.delivered },
    { name: 'Read', value: data.totals.read, color: COLORS.read },
    { name: 'Failed', value: data.totals.failed, color: COLORS.failed },
  ].filter((item) => item.value > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
                ← Back to Dashboard
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasData ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">Not enough data yet</p>
          </div>
        ) : (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Total Sent"
                value={formatNumber(data.totals.sent)}
                color="blue"
                borderColor="border-blue-500"
              />
              <MetricCard
                title="Total Delivered"
                value={formatNumber(data.totals.delivered)}
                color="green"
                borderColor="border-green-500"
              />
              <MetricCard
                title="Total Read"
                value={formatNumber(data.totals.read)}
                color="purple"
                borderColor="border-purple-500"
              />
              <MetricCard
                title="Total Failed"
                value={formatNumber(data.totals.failed)}
                color="red"
                borderColor="border-red-500"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Area Chart - Daily Message Volume */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Volume (Last 30 Days)</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        labelFormatter={(label) => typeof label === 'string' ? formatDate(label) : ''}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="sent"
                        stackId="1"
                        stroke={COLORS.sent}
                        fill={COLORS.sent}
                        fillOpacity={0.6}
                        name="Sent"
                      />
                      <Area
                        type="monotone"
                        dataKey="delivered"
                        stackId="1"
                        stroke={COLORS.delivered}
                        fill={COLORS.delivered}
                        fillOpacity={0.6}
                        name="Delivered"
                      />
                      <Area
                        type="monotone"
                        dataKey="read"
                        stackId="1"
                        stroke={COLORS.read}
                        fill={COLORS.read}
                        fillOpacity={0.6}
                        name="Read"
                      />
                      <Area
                        type="monotone"
                        dataKey="failed"
                        stackId="1"
                        stroke={COLORS.failed}
                        fill={COLORS.failed}
                        fillOpacity={0.6}
                        name="Failed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart - Message Status Distribution */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Status Distribution</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
  borderColor,
}: {
  title: string;
  value: string;
  color: string;
  borderColor: string;
}) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    red: 'text-red-600',
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-2 ${borderColor}`}>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className={`text-3xl font-bold text-gray-900 ${colorClasses[color as keyof typeof colorClasses]}`}>
        {value}
      </p>
    </div>
  );
}
