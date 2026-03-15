import { Suspense } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { SimulationControl } from '@/components/supervisor/SimulationControl';
import { DashboardTabs } from '@/components/supervisor/DashboardTabs';
import { WorkOrderBar } from '@/components/dashboard/WorkOrderBar';
import { DowntimeAlertBanner } from '@/components/dashboard/DowntimeAlertBanner';
import { KPISection } from '@/components/dashboard/KPISection';
import { ProductionFlowSection } from '@/components/dashboard/ProductionFlowSection';
import { AIRecommendationsPanel } from '@/components/dashboard/AIRecommendationsPanel';
import { AlertsSidebar } from '@/components/dashboard/AlertsSidebar';
import { TrendChartsSection } from '@/components/dashboard/TrendChartsSection';
import { RecentUnitsSection } from '@/components/dashboard/RecentUnitsSection';
import { ShiftSummarySection } from '@/components/dashboard/ShiftSummarySection';
import {
  WorkOrderBarSkeleton,
  KPISkeleton,
  ProductionFlowSkeleton,
  AIRecommendationsSkeleton,
  AlertsSidebarSkeleton,
  TrendChartsSkeleton,
  RecentUnitsSkeleton,
  ShiftSummarySkeleton,
} from '@/components/dashboard/skeletons';

export const revalidate = 30;

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Compact Header */}
      <header className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                <Icons.station className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                  WestMag Production Dashboard
                </h1>
                <p className="text-xs text-slate-500">Motor Assembly Plant</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 live-indicator" />
                <span className="text-green-700 text-[11px] font-medium">Online</span>
              </div>
              <AutoRefresh intervalSeconds={30} />
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Icons.settings className="h-3.5 w-3.5" />
                Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Navigation Tabs */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <DashboardTabs />
        </div>
      </div>

      {/* Work Order Bar */}
      <Suspense fallback={<WorkOrderBarSkeleton />}>
        <WorkOrderBar />
      </Suspense>

      {/* Downtime Alert — Top-level urgency */}
      <Suspense fallback={null}>
        <DowntimeAlertBanner />
      </Suspense>

      {/* Production Flow — Full Width */}
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <Suspense fallback={<ProductionFlowSkeleton />}>
          <ProductionFlowSection />
        </Suspense>
      </div>

      {/* KPI Metrics Row — varied sizes */}
      <Suspense fallback={<KPISkeleton />}>
        <KPISection />
      </Suspense>

      {/* Trend Mini Charts */}
      <Suspense fallback={<TrendChartsSkeleton />}>
        <TrendChartsSection />
      </Suspense>

      {/* Bottom: Recent Units + Shift Summary */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left Column — Primary Content (8/12) */}
          <div className="lg:col-span-8 space-y-5">
            <Suspense fallback={<RecentUnitsSkeleton />}>
              <RecentUnitsSection />
            </Suspense>
          </div>

          {/* Right Column — Sidebar (4/12) */}
          <div className="lg:col-span-4 space-y-5">
            <Suspense fallback={<ShiftSummarySkeleton />}>
              <ShiftSummarySection />
            </Suspense>

            {/* Alerts */}
            <Suspense fallback={<AlertsSidebarSkeleton />}>
              <AlertsSidebar />
            </Suspense>

            {/* AI Recommendations — Collapsible */}
            <Suspense fallback={<AIRecommendationsSkeleton />}>
              <AIRecommendationsPanel />
            </Suspense>

            {/* Quick Actions */}
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <h3 className="text-section-title">Quick Actions</h3>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                <Link
                  href="/station"
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Icons.scan className="h-3.5 w-3.5" />
                  Operator View
                </Link>
                <Link
                  href="/dashboard/ncr"
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Icons.qualityFail className="h-3.5 w-3.5" />
                  NCR Log
                </Link>
                <Link
                  href="/dashboard/traceability"
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Icons.search className="h-3.5 w-3.5" />
                  Traceability
                </Link>
                <Link
                  href="/dashboard/shift-report"
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Icons.history className="h-3.5 w-3.5" />
                  Shift Report
                </Link>
              </div>
            </div>

            {/* Simulation Controls — Collapsed */}
            <details className="rounded-lg border border-slate-200 bg-white">
              <summary className="px-4 py-2.5 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 select-none">
                Demo Controls
              </summary>
              <div className="px-4 pb-3 border-t border-slate-100 pt-3">
                <SimulationControl />
              </div>
            </details>
          </div>
        </div>
      </main>
    </div>
  );
}
