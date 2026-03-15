import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AIInsightCard } from './AIInsightCard';

export async function AIRecommendationsPanel() {
  const aiInsights = await prisma.aIInsight.findMany({
    where: { acknowledged: false },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { station: { select: { name: true } } },
  });

  if (aiInsights.length === 0) return null;

  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="px-4 py-2.5 cursor-pointer hover:bg-slate-50 select-none">
        <div className="inline-flex items-center gap-2">
          <Icons.ai className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-800">
            AI Recommendations
          </span>
          <span className="rounded-full bg-purple-200 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
            {aiInsights.length}
          </span>
        </div>
      </summary>
      <div className="p-3 space-y-2 border-t border-slate-100">
        {aiInsights.slice(0, 3).map((insight) => (
          <AIInsightCard
            key={insight.id}
            id={insight.id}
            title={insight.title}
            description={insight.description}
            severity={insight.severity}
            stationName={insight.station?.name}
          />
        ))}
        <div className="pt-1 text-center">
          <Link
            href="/dashboard/ai"
            className="text-xs font-medium text-purple-600 hover:text-purple-800"
          >
            View all recommendations
          </Link>
        </div>
      </div>
    </details>
  );
}
