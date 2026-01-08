'use client';

import { Icons, type IconName } from '@/components/icons';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: IconName;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  status?: 'normal' | 'warning' | 'critical' | 'success';
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  status = 'normal',
  className = '',
}: KPICardProps) {
  const Icon = Icons[icon] as LucideIcon;

  const statusStyles = {
    normal: {
      border: 'border-gray-200',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      valueColor: 'text-gray-900',
    },
    warning: {
      border: 'border-amber-200',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700',
    },
    critical: {
      border: 'border-red-200',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      valueColor: 'text-red-700',
    },
    success: {
      border: 'border-green-200',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      valueColor: 'text-green-700',
    },
  };

  const styles = statusStyles[status];

  return (
    <div
      className={`rounded-lg border bg-white p-4 ${styles.border} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${styles.valueColor}`}>
              {value}
            </span>
            {trend && (
              <span
                className={`flex items-center text-sm font-medium ${
                  trend.direction === 'up'
                    ? 'text-green-600'
                    : trend.direction === 'down'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {trend.direction === 'up' ? (
                  <Icons.trendUp className="mr-0.5 h-4 w-4" />
                ) : trend.direction === 'down' ? (
                  <Icons.trendDown className="mr-0.5 h-4 w-4" />
                ) : null}
                {trend.value}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-lg p-2 ${styles.iconBg}`}>
          <Icon className={`h-6 w-6 ${styles.iconColor}`} />
        </div>
      </div>
    </div>
  );
}

// Compact KPI for inline displays
interface CompactKPIProps {
  label: string;
  value: number | string;
  icon?: IconName;
  status?: 'normal' | 'warning' | 'critical' | 'success';
}

export function CompactKPI({ label, value, icon, status = 'normal' }: CompactKPIProps) {
  const Icon = icon ? (Icons[icon] as LucideIcon) : null;

  const statusColors = {
    normal: 'text-gray-900',
    warning: 'text-amber-600',
    critical: 'text-red-600',
    success: 'text-green-600',
  };

  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-gray-400" />}
      <span className="text-sm text-gray-500">{label}:</span>
      <span className={`font-semibold ${statusColors[status]}`}>{value}</span>
    </div>
  );
}

// KPI Grid for consistent layouts
interface KPIGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function KPIGrid({ children, columns = 4, className = '' }: KPIGridProps) {
  const colClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid gap-4 ${colClasses[columns]} ${className}`}>
      {children}
    </div>
  );
}
