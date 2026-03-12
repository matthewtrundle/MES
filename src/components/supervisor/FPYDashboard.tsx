'use client';

import { useState, useEffect } from 'react';
import { FPYChart, FPYBarChart } from './FPYChart';
import {
  getFPYByStation,
  getFPYTrend,
  getFPYByStep,
  getOverallFPY,
  type StationFPY,
  type FPYTrendPoint,
  type StepFPY,
  type OverallFPYResult,
} from '@/lib/actions/fpy-analytics';

export function FPYDashboard() {
  const [days, setDays] = useState(30);
  const [granularity, setGranularity] = useState<'day' | 'week'>('day');
  const [stationId, setStationId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [overall, setOverall] = useState<OverallFPYResult | null>(null);
  const [byStation, setByStation] = useState<StationFPY[]>([]);
  const [trend, setTrend] = useState<FPYTrendPoint[]>([]);
  const [byStep, setByStep] = useState<StepFPY[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getOverallFPY(days),
      getFPYByStation(days),
      getFPYTrend({ stationId, days, granularity }),
      getFPYByStep(days),
    ])
      .then(([overallData, stationData, trendData, stepData]) => {
        if (!cancelled) {
          setOverall(overallData);
          setByStation(stationData);
          setTrend(trendData);
          setByStep(stepData);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [days, granularity, stationId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 rounded-lg bg-gray-200" />
          <div className="h-24 rounded-lg bg-gray-200" />
          <div className="h-24 rounded-lg bg-gray-200" />
        </div>
        <div className="h-72 rounded-lg bg-gray-200" />
        <div className="h-64 rounded-lg bg-gray-200" />
      </div>
    );
  }

  const fpyColor = (fpy: number) =>
    fpy >= 95 ? 'text-green-600' : fpy >= 90 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Time Range</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Granularity</label>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as 'day' | 'week')}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Station Filter</label>
          <select
            value={stationId ?? ''}
            onChange={(e) => setStationId(e.target.value || undefined)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Stations</option>
            {byStation.map((s) => (
              <option key={s.stationId} value={s.stationId}>
                {s.stationName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Overall FPY</p>
          <p className={`text-4xl font-bold mt-1 ${fpyColor(overall?.fpy ?? 100)}`}>
            {overall?.fpy ?? 100}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {overall?.passedFirstPass ?? 0} of {overall?.totalFirstPass ?? 0} first-pass
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Best Station</p>
          {byStation.length > 0 ? (
            <>
              <p className={`text-4xl font-bold mt-1 ${fpyColor(Math.max(...byStation.map((s) => s.fpy)))}`}>
                {Math.max(...byStation.map((s) => s.fpy))}%
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {byStation.reduce((best, s) => (s.fpy > best.fpy ? s : best), byStation[0]).stationName}
              </p>
            </>
          ) : (
            <p className="text-4xl font-bold mt-1 text-gray-300">--</p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Worst Station</p>
          {byStation.length > 0 ? (
            <>
              <p className={`text-4xl font-bold mt-1 ${fpyColor(Math.min(...byStation.map((s) => s.fpy)))}`}>
                {Math.min(...byStation.map((s) => s.fpy))}%
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {byStation.reduce((worst, s) => (s.fpy < worst.fpy ? s : worst), byStation[0]).stationName}
              </p>
            </>
          ) : (
            <p className="text-4xl font-bold mt-1 text-gray-300">--</p>
          )}
        </div>
      </div>

      {/* FPY Trend Line Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-gray-900">
          FPY Trend
          {stationId && byStation.find((s) => s.stationId === stationId)
            ? ` - ${byStation.find((s) => s.stationId === stationId)!.stationName}`
            : ' - All Stations'}
        </h3>
        <FPYChart data={trend} height={280} target={95} />
      </div>

      {/* FPY by Station Bar Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-gray-900">FPY by Station</h3>
        <FPYBarChart
          data={byStation.map((s) => ({
            label: s.stationName,
            value: s.fpy,
            sublabel: `${s.passedFirstPass}/${s.totalFirstPass}`,
          }))}
          target={95}
        />
      </div>

      {/* FPY by Process Step Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="font-semibold text-gray-900">FPY by Process Step</h3>
        </div>
        {byStep.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No process step data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50/50">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2.5 text-left font-semibold">Step</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Station</th>
                  <th className="px-4 py-2.5 text-right font-semibold">FPY</th>
                  <th className="px-4 py-2.5 text-right font-semibold">First Pass</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Passed</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Failed/Rework</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byStep.map((step) => {
                  const failed = step.totalFirstPass - step.passedFirstPass;
                  return (
                    <tr key={step.sequence} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                        #{step.sequence}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{step.stationName}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${fpyColor(step.fpy)}`}>{step.fpy}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{step.totalFirstPass}</td>
                      <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">{step.passedFirstPass}</td>
                      <td className="px-4 py-3 text-right text-sm text-red-600 font-medium">{failed}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className={`h-full ${
                                step.fpy >= 95 ? 'bg-green-500' : step.fpy >= 90 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, step.fpy)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${
                            step.fpy >= 95 ? 'text-green-600' : step.fpy >= 90 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {step.fpy >= 95 ? 'Good' : step.fpy >= 90 ? 'Marginal' : 'Critical'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
