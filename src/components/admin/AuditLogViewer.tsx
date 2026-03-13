'use client';

import { useState, useCallback, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AuditLogDetail } from './AuditLogDetail';
import { getAuditLogs } from '@/lib/actions/admin/audit-logs';
import type { AuditLogEntry, AuditLogStats, PaginatedAuditLogs } from '@/lib/actions/admin/audit-logs';

interface AuditLogViewerProps {
  initialData: PaginatedAuditLogs;
  stats: AuditLogStats;
  filterOptions: {
    entityTypes: string[];
    actions: string[];
    users: { id: string; name: string }[];
  };
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  config_change: 'bg-amber-100 text-amber-800',
};

function formatTimestamp(ts: Date | string): string {
  const date = new Date(ts);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AuditLogViewer({ initialData, stats, filterOptions }: AuditLogViewerProps) {
  const [data, setData] = useState<PaginatedAuditLogs>(initialData);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entityId, setEntityId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(
    (page: number) => {
      startTransition(async () => {
        const filters = {
          entityType: entityType || undefined,
          action: action || undefined,
          userId: userId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          entityId: entityId || undefined,
          page,
          pageSize: 25,
        };
        const result = await getAuditLogs(filters);
        setData(result);
        setCurrentPage(page);
      });
    },
    [entityType, action, userId, dateFrom, dateTo, entityId]
  );

  const handleFilter = () => {
    setExpandedId(null);
    fetchData(1);
  };

  const handleClearFilters = () => {
    setEntityType('');
    setAction('');
    setUserId('');
    setDateFrom('');
    setDateTo('');
    setEntityId('');
    setExpandedId(null);
    startTransition(async () => {
      const result = await getAuditLogs({ page: 1, pageSize: 25 });
      setData(result);
      setCurrentPage(1);
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Entries (30d)</CardDescription>
            <CardTitle className="text-2xl">{stats.totalEntries.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Actions Breakdown</CardDescription>
            <CardContent className="p-0 pt-1">
              <div className="flex flex-wrap gap-1">
                {stats.byAction.map((a) => (
                  <Badge key={a.action} variant="secondary" className="text-xs">
                    {a.action}: {a.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top Entity Types</CardDescription>
            <CardContent className="p-0 pt-1">
              <div className="flex flex-wrap gap-1">
                {stats.byEntityType.slice(0, 4).map((e) => (
                  <Badge key={e.entityType} variant="outline" className="text-xs">
                    {e.entityType}: {e.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Most Active Users</CardDescription>
            <CardContent className="p-0 pt-1">
              <div className="space-y-0.5">
                {stats.mostActiveUsers.slice(0, 3).map((u) => (
                  <div key={u.userId} className="text-xs text-slate-600">
                    {u.userName}: <span className="font-medium">{u.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.entityTypes.map((et) => (
                  <SelectItem key={et} value={et}>
                    {et}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.actions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full"
            />

            <Input
              type="date"
              placeholder="To date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full"
            />

            <Input
              type="text"
              placeholder="Entity ID"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={handleFilter} disabled={isPending} size="sm">
              {isPending ? 'Searching...' : 'Apply Filters'}
            </Button>
            <Button onClick={handleClearFilters} variant="outline" size="sm" disabled={isPending}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Log Entries</CardTitle>
              <CardDescription>
                {data.pagination.total.toLocaleString()} total entries
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="w-[120px]">Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead className="w-[80px]">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                      No audit log entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((entry: AuditLogEntry) => (
                    <>
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => toggleExpand(entry.id)}
                      >
                        <TableCell className="text-xs text-slate-600 font-mono">
                          {formatTimestamp(entry.timestamp)}
                        </TableCell>
                        <TableCell className="text-sm">{entry.user.name}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              ACTION_COLORS[entry.action] ?? 'bg-slate-100 text-slate-800'
                            }
                          >
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entry.entityType}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500 max-w-[200px] truncate">
                          {entry.entityId}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(entry.id);
                            }}
                          >
                            <svg
                              className={`h-4 w-4 transition-transform ${
                                expandedId === entry.id ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedId === entry.id && (
                        <TableRow key={`${entry.id}-detail`}>
                          <TableCell colSpan={6} className="p-0">
                            <AuditLogDetail
                              beforeJson={entry.beforeJson}
                              afterJson={entry.afterJson}
                              userName={entry.user.name}
                              userEmail={entry.user.email}
                              timestamp={String(entry.timestamp)}
                              entityType={entry.entityType}
                              entityId={entry.entityId}
                              action={entry.action}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-slate-500">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1 || isPending}
                  onClick={() => fetchData(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= data.pagination.totalPages || isPending}
                  onClick={() => fetchData(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
