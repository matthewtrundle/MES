'use client';

import Link from 'next/link';
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
  href?: string;
  size?: 'lg' | 'md' | 'sm';
  timeBreakdown?: {
    lastHour: string;
    today: string;
    direction: 'up' | 'down' | 'neutral';
  };
  // Target comparison - shows "value / target" format
  target?: {
    value: number | string;
    label?: string; // e.g., "by now", "max", "min"
    comparison?: 'above' | 'below' | 'equal'; // What's good?
  };
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  status = 'normal',
  className = '',
  href,
  size = 'md',
  timeBreakdown,
  target,
}: KPICardProps) {
  const Icon = Icons[icon] as LucideIcon;

  const statusStyles = {
    normal: {
      border: 'border-slate-200',
      iconBg: 'bg-gradient-to-br from-slate-100 to-slate-200',
      iconColor: 'text-slate-600',
      valueColor: 'text-slate-900',
      glow: '',
    },
    warning: {
      border: 'border-amber-300',
      iconBg: 'bg-gradient-to-br from-amber-100 to-amber-200',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700',
      glow: 'status-glow-amber',
    },
    critical: {
      border: 'border-red-300',
      iconBg: 'bg-gradient-to-br from-red-100 to-red-200',
      iconColor: 'text-red-600',
      valueColor: 'text-red-700',
      glow: 'status-glow-red',
    },
    success: {
      border: 'border-green-300',
      iconBg: 'bg-gradient-to-br from-green-100 to-green-200',
      iconColor: 'text-green-600',
      valueColor: 'text-green-700',
      glow: 'status-glow-green',
    },
  };

  const styles = statusStyles[status];

  const sizeStyles = {
    lg: { value: 'text-4xl', padding: 'p-5', icon: 'h-7 w-7', iconWrap: 'p-3' },
    md: { value: 'text-3xl', padding: 'p-4', icon: 'h-6 w-6', iconWrap: 'p-2.5' },
    sm: { value: 'text-2xl', padding: 'p-3', icon: 'h-5 w-5', iconWrap: 'p-2' },
  };
  const sz = sizeStyles[size];

  const cardContent = size === 'sm' ? (
    <div className="flex items-center justify-between gap-3">
      <div className={`rounded-lg ${sz.iconWrap} shadow-sm ${styles.iconBg} flex-shrink-0`}>
        <Icon className={`${sz.icon} ${styles.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">{title}</p>
        <div className="flex items-baseline gap-2">
          <span className={`data-readout ${sz.value} ${styles.valueColor}`}>{value}</span>
          {trend && (
            <span className={`flex items-center text-xs font-medium ${
              trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-slate-500'
            }`}>
              {trend.direction === 'up' ? <Icons.trendUp className="mr-0.5 h-3 w-3" /> : trend.direction === 'down' ? <Icons.trendDown className="mr-0.5 h-3 w-3" /> : null}
              {trend.value}
            </span>
          )}
        </div>
        {timeBreakdown && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            <span className="font-medium">{timeBreakdown.lastHour}</span> last hr · <span className="font-medium">{timeBreakdown.today}</span> today
          </p>
        )}
      </div>
      {href && <Icons.chevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />}
    </div>
  ) : (
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`data-readout ${sz.value} ${styles.valueColor}`}>
              {value}
            </span>
            {trend && (
              <span
                className={`flex items-center text-sm font-medium ${
                  trend.direction === 'up'
                    ? 'text-green-600'
                    : trend.direction === 'down'
                      ? 'text-red-600'
                      : 'text-slate-500'
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
          {timeBreakdown && (
            <p className="text-[10px] text-slate-400 mt-1">
              <span className="font-medium">{timeBreakdown.lastHour}</span> last hr · <span className="font-medium">{timeBreakdown.today}</span> today
            </p>
          )}
          {/* Target comparison - turns numbers into performance signals */}
          {target && (
            <p className="mt-1 text-xs">
              <span className="text-slate-400">Target: </span>
              <span className={`font-semibold ${
                status === 'success' ? 'text-green-600' :
                status === 'warning' ? 'text-amber-600' :
                status === 'critical' ? 'text-red-600' :
                'text-slate-600'
              }`}>
                {target.comparison === 'above' ? '≥' : target.comparison === 'below' ? '≤' : ''}{target.value}
              </span>
              {target.label && <span className="text-slate-400"> {target.label}</span>}
            </p>
          )}
          {subtitle && !target && (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          )}
          {subtitle && target && (
            <p className="text-[10px] text-slate-400">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`rounded-xl ${sz.iconWrap} shadow-sm ${styles.iconBg}`}>
            <Icon className={`${sz.icon} ${styles.iconColor}`} />
          </div>
          {href && <Icons.chevronRight className="h-5 w-5 text-slate-300" />}
        </div>
      </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`block industrial-card ${sz.padding} transition-all hover:shadow-lg hover:scale-[1.02] ${styles.border} ${className}`}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      className={`industrial-card ${sz.padding} ${styles.border} ${className}`}
    >
      {cardContent}
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
