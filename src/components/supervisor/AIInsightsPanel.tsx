'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icons } from '@/components/icons';
import { AIAlertCard } from './AIAlertCard';

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

interface InsightCounts {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

interface AIInsightsPanelProps {
  className?: string;
  showAnalyzeButton?: boolean;
  maxInsights?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function AIInsightsPanel({
  className = '',
  showAnalyzeButton = true,
  maxInsights = 10,
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute default
}: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [counts, setCounts] = useState<InsightCounts>({ critical: 0, warning: 0, info: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const fetchInsights = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.set('severity', filter);
      }
      params.set('acknowledged', String(showAcknowledged));
      params.set('limit', String(maxInsights));

      const response = await fetch(`/api/ai/insights?${params.toString()}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setInsights(data.insights);
        setCounts(data.counts);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch insights');
    } finally {
      setIsLoading(false);
    }
  }, [filter, showAcknowledged, maxInsights]);

  useEffect(() => {
    fetchInsights();

    if (autoRefresh) {
      const interval = setInterval(fetchInsights, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchInsights, autoRefresh, refreshInterval]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/analyze', { method: 'POST' });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        // Refresh insights after analysis
        await fetchInsights();
      }
    } catch (err) {
      setError('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId: id, action: 'acknowledge' }),
      });
      await fetchInsights();
    } catch (err) {
      console.error('Failed to acknowledge insight:', err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId: id, action: 'dismiss' }),
      });
      await fetchInsights();
    } catch (err) {
      console.error('Failed to dismiss insight:', err);
    }
  };

  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2">
            <Icons.chart className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Insights</h3>
            <p className="text-xs text-gray-500">Powered by Claude 3.5 Sonnet</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Counts badges */}
          <div className="flex items-center gap-1">
            {counts.critical > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {counts.critical}
              </span>
            )}
            {counts.warning > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                {counts.warning}
              </span>
            )}
            {counts.info > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                {counts.info}
              </span>
            )}
          </div>

          {showAnalyzeButton && (
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-50 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Icons.refresh className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Icons.chart className="h-4 w-4" />
                  Analyze Now
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 border-b border-gray-100 px-4 py-2">
        <div className="flex items-center gap-1">
          {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <label className="ml-auto flex items-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={showAcknowledged}
            onChange={(e) => setShowAcknowledged(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show acknowledged
        </label>
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Icons.refresh className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : insights.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Icons.pass className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-gray-500">No insights found</p>
            <p className="text-sm text-gray-400">
              {showAcknowledged
                ? 'All insights have been addressed'
                : 'Click "Analyze Now" to generate insights'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 p-4 space-y-4">
            {insights.map((insight) => (
              <AIAlertCard
                key={insight.id}
                insight={insight}
                onAcknowledge={handleAcknowledge}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
