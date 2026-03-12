'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ExportType =
  | 'work-orders'
  | 'units'
  | 'ncrs'
  | 'inventory'
  | 'shipments'
  | 'production-history'
  | 'quality-checks';

interface ExportButtonProps {
  type: ExportType;
  filters?: Record<string, string>;
  label?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ExportButton({
  type,
  filters,
  label,
  variant = 'outline',
  size = 'default',
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value) params.set(key, value);
        }
      }

      const query = params.toString();
      const url = `/api/v1/export/${type}${query ? `?${query}` : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Extract filename from Content-Disposition or build a default
      const disposition = response.headers.get('Content-Disposition');
      let filename = `${type}-export.csv`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Trigger browser download
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Export error:', error);
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {label ?? 'Export CSV'}
    </Button>
  );
}
