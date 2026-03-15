import { prisma } from '@/lib/db/prisma';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { AIInsightsPanel } from '@/components/supervisor/AIInsightsPanel';
import { AIChatWidget } from '@/components/supervisor/AIChatWidget';

export const revalidate = 60;

async function getAIStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalInsights,
    criticalInsights,
    warningInsights,
    infoInsights,
    unacknowledgedCount,
    recentInsights,
    insightsToday,
  ] = await Promise.all([
    prisma.aIInsight.count(),
    prisma.aIInsight.count({ where: { severity: 'critical', acknowledged: false } }),
    prisma.aIInsight.count({ where: { severity: 'warning', acknowledged: false } }),
    prisma.aIInsight.count({ where: { severity: 'info', acknowledged: false } }),
    prisma.aIInsight.count({ where: { acknowledged: false } }),
    prisma.aIInsight.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { station: { select: { name: true } } },
    }),
    prisma.aIInsight.count({ where: { createdAt: { gte: today } } }),
  ]);

  return {
    totalInsights,
    criticalInsights,
    warningInsights,
    infoInsights,
    unacknowledgedCount,
    recentInsights,
    insightsToday,
  };
}

export default async function AIDashboardPage() {
  const stats = await getAIStats();

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="AI Monitoring" subtitle="Powered by Claude 3.5 Sonnet">
        <AutoRefresh intervalSeconds={60} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Critical Alerts"
            value={stats.criticalInsights}
            icon="warning"
            color="red"
            subtitle={stats.criticalInsights > 0 ? 'Requires attention' : 'All clear'}
          />
          <StatCard
            title="Warnings"
            value={stats.warningInsights}
            icon="warning"
            color="amber"
            subtitle="Monitor closely"
          />
          <StatCard
            title="Insights Today"
            value={stats.insightsToday}
            icon="chart"
            color="purple"
            subtitle="New analysis results"
          />
          <StatCard
            title="Total Unread"
            value={stats.unacknowledgedCount}
            icon="info"
            color="blue"
            subtitle={`of ${stats.totalInsights} total`}
          />
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Insights Panel - Takes 2 columns */}
          <div className="lg:col-span-2">
            <AIInsightsPanel
              showAnalyzeButton
              maxInsights={20}
              autoRefresh
              refreshInterval={60000}
            />
          </div>

          {/* Chat Widget - Takes 1 column */}
          <div>
            <AIChatWidget position="inline" defaultOpen />
          </div>
        </div>

        {/* How it Works Section */}
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">How AI Monitoring Works</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex gap-4">
              <div className="flex-shrink-0 rounded-lg bg-slate-100 p-3">
                <Icons.search className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900">Anomaly Detection</h3>
                <p className="mt-1 text-sm text-slate-500">
                  AI analyzes production data to identify deviations from normal patterns,
                  unusual downtime, or quality issues.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 rounded-lg bg-slate-100 p-3">
                <Icons.chart className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900">Proactive Insights</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Get actionable recommendations to improve efficiency, reduce downtime,
                  and maintain quality standards.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 rounded-lg bg-slate-100 p-3">
                <Icons.clock className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900">Interactive Q&A</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Ask questions about production status, bottlenecks, or issues
                  and get instant, context-aware answers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: number;
  icon: 'warning' | 'chart' | 'info';
  color: 'red' | 'amber' | 'purple' | 'blue';
  subtitle: string;
}) {
  const colorStyles = {
    red: {
      bg: 'bg-slate-100',
      icon: 'text-red-600',
      value: value > 0 ? 'text-red-700' : 'text-slate-900',
      border: value > 0 ? 'border-red-200' : 'border-slate-200',
    },
    amber: {
      bg: 'bg-slate-100',
      icon: 'text-amber-600',
      value: value > 0 ? 'text-amber-700' : 'text-slate-900',
      border: value > 0 ? 'border-amber-200' : 'border-slate-200',
    },
    purple: {
      bg: 'bg-slate-100',
      icon: 'text-purple-600',
      value: 'text-purple-700',
      border: 'border-slate-200',
    },
    blue: {
      bg: 'bg-slate-100',
      icon: 'text-blue-600',
      value: 'text-blue-700',
      border: 'border-slate-200',
    },
  };

  const iconMap = {
    warning: Icons.warning,
    chart: Icons.chart,
    info: Icons.info,
  };

  const Icon = iconMap[icon];
  const styles = colorStyles[color];

  return (
    <div className={`rounded-lg border bg-white p-4 ${styles.border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className={`mt-1 text-xl font-semibold ${styles.value}`}>{value}</p>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className={`rounded-lg p-3 ${styles.bg}`}>
          <Icon className={`h-6 w-6 ${styles.icon}`} />
        </div>
      </div>
    </div>
  );
}
