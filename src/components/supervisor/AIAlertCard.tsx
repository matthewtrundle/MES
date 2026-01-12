'use client';

import { useState } from 'react';
import { Icons } from '@/components/icons';

interface AIInsight {
  id: string;
  insightType: string;
  severity: string;
  title: string;
  description: string;
  confidence: number;
  acknowledged: boolean;
  createdAt: string;
  station?: {
    id: string;
    name: string;
  } | null;
}

interface AIAlertCardProps {
  insight: AIInsight;
  onAcknowledge?: (id: string) => void;
  onDismiss?: (id: string) => void;
  compact?: boolean;
  className?: string;
}

export function AIAlertCard({
  insight,
  onAcknowledge,
  onDismiss,
  compact = false,
  className = '',
}: AIAlertCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const severityStyles = {
    critical: {
      border: 'border-red-300',
      bg: 'bg-red-50',
      icon: 'text-red-600',
      badge: 'bg-red-100 text-red-800',
    },
    warning: {
      border: 'border-amber-300',
      bg: 'bg-amber-50',
      icon: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-800',
    },
    info: {
      border: 'border-blue-300',
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-800',
    },
  };

  const typeLabels = {
    anomaly: 'Anomaly Detected',
    recommendation: 'Recommendation',
    prediction: 'Prediction',
  };

  const styles = severityStyles[insight.severity as keyof typeof severityStyles] || severityStyles.info;
  const typeLabel = typeLabels[insight.insightType as keyof typeof typeLabels] || 'Insight';

  const handleAcknowledge = async () => {
    if (!onAcknowledge) return;
    setIsProcessing(true);
    await onAcknowledge(insight.id);
    setIsProcessing(false);
  };

  const handleDismiss = async () => {
    if (!onDismiss) return;
    setIsProcessing(true);
    await onDismiss(insight.id);
    setIsProcessing(false);
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-3 rounded-lg border ${styles.border} ${styles.bg} p-3 ${className}`}>
        <div className={`rounded-full p-1.5 ${styles.badge}`}>
          {insight.severity === 'critical' ? (
            <Icons.warning className="h-4 w-4" />
          ) : insight.severity === 'warning' ? (
            <Icons.warning className="h-4 w-4" />
          ) : (
            <Icons.info className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{insight.title}</p>
          {insight.station && (
            <p className="text-xs text-gray-500">{insight.station.name}</p>
          )}
        </div>
        {!insight.acknowledged && (
          <button
            onClick={handleAcknowledge}
            disabled={isProcessing}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            <Icons.pass className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border-2 ${styles.border} ${styles.bg} p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${styles.badge}`}>
          {insight.severity === 'critical' ? (
            <Icons.warning className="h-5 w-5" />
          ) : insight.severity === 'warning' ? (
            <Icons.warning className="h-5 w-5" />
          ) : (
            <Icons.chart className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
              {insight.severity.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500">{typeLabel}</span>
            {insight.station && (
              <span className="text-xs text-gray-500">
                • {insight.station.name}
              </span>
            )}
          </div>

          <h4 className="mt-1 font-semibold text-gray-900">{insight.title}</h4>
          <p className="mt-1 text-sm text-gray-700">{insight.description}</p>

          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Icons.clock className="h-3 w-3" />
              {new Date(insight.createdAt).toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Icons.gauge className="h-3 w-3" />
              {Math.round(insight.confidence * 100)}% confidence
            </div>
          </div>
        </div>

        {!insight.acknowledged && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAcknowledge}
              disabled={isProcessing}
              className="rounded-lg border border-green-300 bg-white px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50"
              title="Acknowledge"
            >
              <Icons.pass className="h-4 w-4" />
            </button>
            <button
              onClick={handleDismiss}
              disabled={isProcessing}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              title="Dismiss"
            >
              <Icons.close className="h-4 w-4" />
            </button>
          </div>
        )}

        {insight.acknowledged && (
          <span className="text-xs text-gray-400">Acknowledged</span>
        )}
      </div>
    </div>
  );
}

// Summary badge for showing insight counts
interface AIInsightBadgeProps {
  critical: number;
  warning: number;
  info: number;
  className?: string;
}

export function AIInsightBadge({ critical, warning, info, className = '' }: AIInsightBadgeProps) {
  const total = critical + warning + info;

  if (total === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Icons.chart className="h-4 w-4 text-purple-600" />
      <span className="text-sm font-medium text-gray-700">AI Insights:</span>
      {critical > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          {critical} critical
        </span>
      )}
      {warning > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          {warning} warning
        </span>
      )}
      {info > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
          {info} info
        </span>
      )}
    </div>
  );
}
