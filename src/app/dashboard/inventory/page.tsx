import { requireRole } from '@/lib/auth/rbac';
import {
  getInventorySummary,
  getLowStockMaterials,
  getExpiringLots,
} from '@/lib/actions/inventory';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Layers,
  AlertTriangle,
  Clock,
  TrendingDown,
  BoxesIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';

export default async function InventoryPage() {
  await requireRole(['admin', 'supervisor']);

  const [summary, lowStock, expiringLots] = await Promise.all([
    getInventorySummary(),
    getLowStockMaterials(7),
    getExpiringLots(14),
  ]);

  // Compute totals from summary
  const totalMaterials = summary.length;
  const totalOnHand = summary.reduce((sum, m) => sum + m.totalOnHand, 0);
  const totalCommitted = summary.reduce((sum, m) => sum + m.committed, 0);
  const totalAvailable = summary.reduce((sum, m) => sum + m.available, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <Icons.chevronLeft className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-2">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Inventory Dashboard
                  </h1>
                  <p className="text-sm text-gray-500">
                    Material levels, low stock alerts, and expiring lots
                  </p>
                </div>
              </div>
            </div>
            <AutoRefresh intervalSeconds={30} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Materials
              </CardTitle>
              <Package className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {totalMaterials}
              </p>
              <p className="text-xs text-gray-500 mt-1">Unique material codes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total On-Hand
              </CardTitle>
              <Layers className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {totalOnHand.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Quantity across all lots</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Committed
              </CardTitle>
              <BoxesIcon className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {totalCommitted.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Reserved in kits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Available
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600 font-bold">
                {totalAvailable.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">On-hand minus committed</p>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventory by Material
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No materials in inventory
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">On-Hand</TableHead>
                      <TableHead className="text-right">Committed</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Lots</TableHead>
                      <TableHead className="text-right">Expiring</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((item) => (
                      <TableRow key={item.materialCode}>
                        <TableCell className="font-mono font-medium">
                          {item.materialCode}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {item.description ?? '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.totalOnHand.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.committed.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.available.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.lotCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.expiringCount > 0 ? (
                            <Badge variant="destructive">
                              {item.expiringCount}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Alerts
              {lowStock.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {lowStock.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No materials projected to run out within 7 days
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material Code</TableHead>
                      <TableHead className="text-right">Current On-Hand</TableHead>
                      <TableHead className="text-right">Daily Rate</TableHead>
                      <TableHead className="text-right">Days Remaining</TableHead>
                      <TableHead>Urgency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.map((item) => (
                      <TableRow key={item.materialCode}>
                        <TableCell className="font-mono font-medium">
                          {item.materialCode}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.currentOnHand.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.dailyConsumptionRate}/day
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.daysRemaining}
                        </TableCell>
                        <TableCell>
                          {item.daysRemaining <= 2 ? (
                            <Badge variant="destructive">Critical</Badge>
                          ) : item.daysRemaining <= 5 ? (
                            <Badge className="bg-amber-500 text-white border-transparent">
                              Warning
                            </Badge>
                          ) : (
                            <Badge variant="outline">Low</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Lots */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Expiring Lots (Next 14 Days)
              {expiringLots.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {expiringLots.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringLots.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No lots expiring within 14 days
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Material Code</TableHead>
                      <TableHead className="text-right">Qty Remaining</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Time Left</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringLots.map((lot) => {
                      const daysUntilExpiry = lot.expiresAt
                        ? Math.ceil(
                            (new Date(lot.expiresAt).getTime() - Date.now()) /
                              (1000 * 60 * 60 * 24)
                          )
                        : null;

                      return (
                        <TableRow key={lot.id}>
                          <TableCell className="font-mono font-medium">
                            {lot.lotNumber}
                          </TableCell>
                          <TableCell>{lot.materialCode}</TableCell>
                          <TableCell className="text-right">
                            {lot.qtyRemaining.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {lot.expiresAt
                              ? new Date(lot.expiresAt).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {daysUntilExpiry !== null ? (
                              daysUntilExpiry <= 3 ? (
                                <Badge variant="destructive">
                                  {daysUntilExpiry}d
                                </Badge>
                              ) : daysUntilExpiry <= 7 ? (
                                <Badge className="bg-amber-500 text-white border-transparent">
                                  {daysUntilExpiry}d
                                </Badge>
                              ) : (
                                <Badge variant="outline">{daysUntilExpiry}d</Badge>
                              )
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
