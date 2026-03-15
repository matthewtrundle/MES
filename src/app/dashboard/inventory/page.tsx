import { requireRole } from '@/lib/auth/rbac';
import {
  getInventorySummary,
  getLowStockMaterials,
  getExpiringLots,
  getAllLots,
} from '@/lib/actions/inventory';
import { getRecentTransactions } from '@/lib/actions/inventory-ledger';
import { getBuildableUnits } from '@/lib/actions/buildable-units';
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
  Layers,
  AlertTriangle,
  Clock,
  FileText,
} from 'lucide-react';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { InventoryAdjustButton } from '@/components/admin/InventoryAdjustButton';
import { TransactionLedger } from '@/components/admin/TransactionLedger';

export const revalidate = 60;

export default async function InventoryPage() {
  await requireRole(['admin', 'supervisor']);

  const [summary, lowStock, expiringLots, allLots, recentTransactions, buildableUnits] =
    await Promise.all([
      getInventorySummary(),
      getLowStockMaterials(7),
      getExpiringLots(14),
      getAllLots(),
      getRecentTransactions(20),
      getBuildableUnits(),
    ]);

  // Compute totals from summary
  const totalMaterials = summary.length;
  const totalOnHand = summary.reduce((sum, m) => sum + m.totalOnHand, 0);
  const totalCommitted = summary.reduce((sum, m) => sum + m.committed, 0);
  const totalAvailable = summary.reduce((sum, m) => sum + m.available, 0);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Inventory Dashboard" subtitle="Material levels, low stock alerts, and expiring lots">
        <AutoRefresh intervalSeconds={30} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-500">Total Materials</p>
            <p className="text-xl font-semibold text-slate-900 mt-1">{totalMaterials}</p>
            <p className="text-xs text-slate-500 mt-1">Unique material codes</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-500">Total On-Hand</p>
            <p className="text-xl font-semibold text-slate-900 mt-1">{totalOnHand.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Quantity across all lots</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-500">Total Committed</p>
            <p className="text-xl font-semibold text-slate-900 mt-1">{totalCommitted.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Reserved in kits</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-500">Total Available</p>
            <p className="text-xl font-semibold text-green-600 mt-1">{totalAvailable.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">On-hand minus committed</p>
          </div>
        </div>

        {/* Buildable Units */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              Buildable Units
              {buildableUnits.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {buildableUnits.length} product{buildableUnits.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </h3>
          </div>
          <div className="p-4">
            {buildableUnits.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                No routings with BOM defined
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {buildableUnits.map((bu) => (
                  <div
                    key={bu.routingId}
                    className="rounded-lg border bg-white p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {bu.routingName}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">
                          {bu.productCode}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-xl font-semibold ${
                            bu.buildableUnits === 0
                              ? 'text-red-600'
                              : bu.buildableUnits <= 5
                                ? 'text-amber-600'
                                : 'text-green-600'
                          }`}
                        >
                          {bu.buildableUnits}
                        </p>
                        <p className="text-xs text-slate-500">units</p>
                      </div>
                    </div>

                    {bu.limitingMaterial && (
                      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-medium text-amber-700">
                          Bottleneck
                        </p>
                        <p className="text-sm text-amber-900 font-mono">
                          {bu.limitingMaterial.materialCode}
                        </p>
                        <p className="text-xs text-amber-600">
                          {bu.limitingMaterial.availableQty} available /{' '}
                          {bu.limitingMaterial.qtyPerUnit} per unit
                        </p>
                      </div>
                    )}

                    {bu.materials.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                          BOM Components
                        </p>
                        {bu.materials.map((mat) => (
                          <div
                            key={mat.materialCode}
                            className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                              mat.isBottleneck
                                ? 'bg-red-50 border border-red-200'
                                : ''
                            }`}
                          >
                            <span className="font-mono text-xs">
                              {mat.materialCode}
                            </span>
                            <span className="text-xs text-slate-500">
                              {mat.availableQty} avail / {mat.qtyPerUnit} req
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inventory Table */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">
              Inventory by Material
            </h3>
          </div>
          <div className="p-4">
            {summary.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
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
                        <TableCell className="text-slate-500">
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
                            <span className="text-slate-400">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Alerts
              {lowStock.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {lowStock.length}
                </Badge>
              )}
            </h3>
          </div>
          <div className="p-4">
            {lowStock.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
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
          </div>
        </div>

        {/* Expiring Lots */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Expiring Lots (Next 14 Days)
              {expiringLots.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {expiringLots.length}
                </Badge>
              )}
            </h3>
          </div>
          <div className="p-4">
            {expiringLots.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
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
                      <TableHead className="text-right">Actions</TableHead>
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
                          <TableCell className="text-right">
                            <InventoryAdjustButton
                              lotId={lot.id}
                              currentQty={lot.qtyRemaining}
                              materialCode={lot.materialCode}
                              lotNumber={lot.lotNumber}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* All Lots (with Adjust) */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-500" />
              All Lots
              <Badge variant="outline" className="ml-2">
                {allLots.length}
              </Badge>
            </h3>
          </div>
          <div className="p-4">
            {allLots.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                No lots in inventory
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Qty Remaining</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell className="font-mono font-medium">
                          {lot.lotNumber}
                        </TableCell>
                        <TableCell>{lot.materialCode}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              lot.status === 'available'
                                ? 'outline'
                                : 'secondary'
                            }
                          >
                            {lot.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {lot.qtyRemaining.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {new Date(lot.receivedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {lot.expiresAt
                            ? new Date(lot.expiresAt).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <InventoryAdjustButton
                            lotId={lot.id}
                            currentQty={lot.qtyRemaining}
                            materialCode={lot.materialCode}
                            lotNumber={lot.lotNumber}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Ledger */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-500" />
              Inventory Transaction Ledger
              <Badge variant="outline" className="ml-2">
                Immutable
              </Badge>
            </h3>
          </div>
          <div className="p-4">
            <TransactionLedger
              initialTransactions={recentTransactions as never[]}
              initialTotal={recentTransactions.length}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
