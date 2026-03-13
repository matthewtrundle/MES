'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons, type IconName } from '@/components/icons';
import type { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  badge?: number | string;
  badgeStatus?: 'normal' | 'warning' | 'critical';
}

// Props no longer needed - KPI cards handle NCR/Inventory badges
export function DashboardTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Primary tabs (always visible) - removed duplicates covered by KPI cards
  const primaryTabs: Tab[] = [
    { id: 'production', label: 'Production', href: '/dashboard/production', icon: 'pass' },
    { id: 'oee', label: 'OEE', href: '/dashboard/oee', icon: 'gauge' },
    { id: 'downtime', label: 'Downtime', href: '/dashboard/downtime', icon: 'clock' },
    { id: 'traceability', label: 'Traceability', href: '/dashboard/traceability', icon: 'search' },
    { id: 'events', label: 'Events', href: '/dashboard/events', icon: 'activity' },
  ];

  // Secondary tabs (in "More" dropdown)
  const secondaryTabs: Tab[] = [
    { id: 'analytics', label: 'Pareto Analysis', href: '/dashboard/analytics', icon: 'chart' },
    { id: 'spc', label: 'SPC Analytics', href: '/dashboard/spc', icon: 'measurement' },
    { id: 'fpy', label: 'FPY Analysis', href: '/dashboard/fpy', icon: 'pass' },
    { id: 'ncr-analytics', label: 'NCR Analytics', href: '/dashboard/ncr-analytics', icon: 'qualityFail' },
    { id: 'supplier-quality', label: 'Supplier Quality', href: '/dashboard/supplier-quality', icon: 'gauge' },
    { id: 'operator-productivity', label: 'Operator Productivity', href: '/dashboard/operator-productivity', icon: 'users' },
    { id: 'production-history', label: 'Production History', href: '/dashboard/production-history', icon: 'history' },
    { id: 'inventory-reports', label: 'Inventory Reports', href: '/dashboard/inventory-reports', icon: 'material' },
    { id: 'shift', label: 'Shift Report', href: '/dashboard/shift-report', icon: 'document' },
    { id: 'ai', label: 'AI Insights', href: '/dashboard/ai', icon: 'ai' },
    { id: 'quality', label: 'Quality', href: '/dashboard/quality', icon: 'qualityPass' },
    { id: 'lead-times', label: 'Lead Times', href: '/dashboard/lead-times', icon: 'clock' },
  ];

  const isActive = (href: string) => pathname === href;
  const isSecondaryActive = secondaryTabs.some((tab) => pathname === tab.href);

  return (
    <nav className="flex items-center gap-1 py-2">
      {/* Primary tabs */}
      {primaryTabs.map((tab) => {
        const Icon = Icons[tab.icon] as LucideIcon;
        const active = isActive(tab.href);

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`tab-industrial ${active ? 'active' : ''}`}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`tab-badge tab-badge-${tab.badgeStatus || 'normal'}`}>
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}

      {/* More dropdown */}
      <div className="relative ml-auto" ref={dropdownRef}>
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={`tab-industrial ${isSecondaryActive ? 'active' : ''}`}
        >
          <Icons.more className="h-4 w-4" />
          <span>More</span>
          <Icons.chevronDown className={`h-3 w-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
        </button>

        {moreOpen && (
          <div className="tab-dropdown">
            {secondaryTabs.map((tab) => {
              const Icon = Icons[tab.icon] as LucideIcon;
              const active = isActive(tab.href);

              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`tab-dropdown-item ${active ? 'bg-blue-50 text-blue-700' : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
