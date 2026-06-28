'use client';

/**
 * Anomaly Alert Banner Component
 * Displays real-time anomaly alerts with actionable recommendations
 * Strict tenant isolation enforced
 */

import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useState } from 'react';

export interface Anomaly {
  type: 'high_failure_rate' | 'low_read_rate' | 'sudden_failure_spike' | 'template_revocation';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: string | Date;
  metrics: {
    current: number;
    historical: number;
    threshold: number;
    deviation: number;
  };
  recommendation: string;
}

interface AnomalyAlertBannerProps {
  anomalies: Anomaly[];
  onDismiss?: (anomalyId: string) => void;
  onDismissAll?: () => void;
}

export default function AnomalyAlertBanner({ anomalies, onDismiss, onDismissAll }: AnomalyAlertBannerProps) {
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());

  // Helper function to safely get timestamp from detectedAt
  const getDetectedAtTimestamp = (detectedAt: string | Date): number => {
    try {
      const date = detectedAt instanceof Date ? detectedAt : new Date(detectedAt);
      return date.getTime();
    } catch {
      return Date.now(); // Fallback to current time if invalid
    }
  };

  const visibleAnomalies = anomalies.filter((a) => !dismissedAnomalies.has(`${a.type}-${getDetectedAtTimestamp(a.detectedAt)}`));

  if (visibleAnomalies.length === 0) {
    return null;
  }

  const handleDismiss = (anomaly: Anomaly) => {
    const key = `${anomaly.type}-${getDetectedAtTimestamp(anomaly.detectedAt)}`;
    setDismissedAnomalies((prev) => new Set(prev).add(key));
    onDismiss?.(key);
  };

  const handleDismissAll = () => {
    const allKeys = visibleAnomalies.map((a) => `${a.type}-${getDetectedAtTimestamp(a.detectedAt)}`);
    setDismissedAnomalies((prev) => new Set([...prev, ...allKeys]));
    onDismissAll?.();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getAnomalyTypeLabel = (type: string) => {
    switch (type) {
      case 'high_failure_rate':
        return 'High Failure Rate';
      case 'low_read_rate':
        return 'Low Read Rate';
      case 'sudden_failure_spike':
        return 'Sudden Failure Spike';
      case 'template_revocation':
        return 'Template Revocation';
      default:
        return 'Unknown Anomaly';
    }
  };

  const overallSeverity = visibleAnomalies.some((a) => a.severity === 'high')
    ? 'high'
    : visibleAnomalies.some((a) => a.severity === 'medium')
    ? 'medium'
    : 'low';

  return (
    <div className={`border-l-4 p-4 mb-4 ${getSeverityColor(overallSeverity)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {getSeverityIcon(overallSeverity)}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">Anomaly Detected</h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white bg-opacity-50">
                {visibleAnomalies.length} alert{visibleAnomalies.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {visibleAnomalies.map((anomaly) => (
                <div key={`${anomaly.type}-${getDetectedAtTimestamp(anomaly.detectedAt)}`} className="bg-white bg-opacity-50 rounded p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(anomaly.severity)}
                      <span className="font-medium text-sm">{getAnomalyTypeLabel(anomaly.type)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white bg-opacity-70 uppercase">
                        {anomaly.severity}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDismiss(anomaly)}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm mb-2">{anomaly.description}</p>
                  <div className="text-xs space-y-1 mb-2">
                    <div className="flex justify-between">
                      <span>Current:</span>
                      <span className="font-medium">{anomaly.metrics.current.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Historical:</span>
                      <span className="font-medium">{anomaly.metrics.historical.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deviation:</span>
                      <span className={`font-medium ${anomaly.metrics.deviation > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {anomaly.metrics.deviation > 0 ? '+' : ''}{anomaly.metrics.deviation.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-300 border-opacity-30">
                    <p className="text-sm font-medium">Recommendation:</p>
                    <p className="text-sm">{anomaly.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {visibleAnomalies.length > 1 && (
          <button
            onClick={handleDismissAll}
            className="text-sm font-medium hover:underline ml-4"
          >
            Dismiss All
          </button>
        )}
      </div>
    </div>
  );
}
