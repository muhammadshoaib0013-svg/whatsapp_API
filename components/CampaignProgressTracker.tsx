'use client';

/**
 * Campaign Progress Tracker Component
 * Real-time progress monitoring for bulk campaigns with SSE integration
 */

import { useCampaignProgress } from '@/hooks/useCampaignProgress';
import { Wifi, CheckCircle, XCircle, Clock, PauseCircle } from 'lucide-react';

interface CampaignProgressTrackerProps {
  campaignId: string;
  initialProgress?: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    percentage: number;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PAUSED';
  };
}

export default function CampaignProgressTracker({ campaignId, initialProgress }: CampaignProgressTrackerProps) {
  const { isConnected, progress } = useCampaignProgress({
    campaignId,
    enabled: true,
    onProgress: (event) => {
      console.log('[Campaign Progress] Update received:', event);
    },
  });

  const currentProgress = progress?.data || initialProgress;

  if (!currentProgress) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'RUNNING':
        return <Wifi className="w-5 h-5 text-blue-500" />;
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'PAUSED':
        return <PauseCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-700';
      case 'RUNNING':
        return 'bg-blue-100 text-blue-700';
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Campaign Progress</h3>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(currentProgress.status)}`}>
            {getStatusIcon(currentProgress.status)}
            <span className="text-sm font-medium">{currentProgress.status}</span>
          </div>
          {isConnected && (
            <div className="flex items-center gap-1 text-green-600">
              <Wifi className="w-4 h-4" />
              <span className="text-xs">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Progress</span>
          <span className="text-sm font-semibold text-gray-900">{currentProgress.percentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-in-out"
            style={{ width: `${currentProgress.percentage}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{currentProgress.total}</p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-600">Sent</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{currentProgress.sent}</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">Delivered</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{currentProgress.delivered}</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-600">Read</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{currentProgress.read}</p>
        </div>

        <div className="bg-red-50 rounded-lg p-4 col-span-2 md:col-span-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-gray-600">Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{currentProgress.failed}</p>
          </div>
        </div>
      </div>

      {/* Delivery Rate */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Delivery Rate</span>
          <span className="text-sm font-semibold text-gray-900">
            {currentProgress.sent > 0
              ? ((currentProgress.delivered / currentProgress.sent) * 100).toFixed(1)
              : 0}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-green-500 h-full transition-all duration-300 ease-in-out"
            style={{
              width: `${
                currentProgress.sent > 0
                  ? (currentProgress.delivered / currentProgress.sent) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
