'use client';

import { useState, useTransition } from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTransactionsSummary } from '@/lib/actions/inventory-ledger';

interface Transaction {
  id: string;
  transactionType: string;
  quantity: number;
  previousQty: number;
  newQty: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  timestamp: Date;
  materialLot: {
    lotNumber: string;
    materialCode: string;
    description: string | null;
  };
  operator: {
    name: string;
  };
}

interface TransactionLedgerProps {
  initialTransactions: Transaction[];
  initialTotal: number;
}

const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  receive: 'bg-green-100 text-green-800 border-green-200',
  issue: 'bg-red-100 text-red-800 border-red-200',
  return: 'bg-blue-100 text-blue-800 border-blue-200',
  scrap: 'bg-gray-100 text-gray-800 border-gray-200',
  adjustment: 'bg-amber-100 text-amber-800 border-amber-200',
  transfer: 'bg-purple-100 text-purple-800 border-purple-200',
};

const PAGE_SIZE = 20;

export function TransactionLedger({
  initialTransactions,
  initialTotal,
}: TransactionLedgerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchPage = (newOffset: number, type?: string) => {
    startTransition(async () => {
      const filterType = type ?? typeFilter;
      const result = await getTransactionsSummary({
        transactionType: filterType === 'all' ? undefined : filterType as 'receive' | 'issue' | 'return' | 'scrap' | 'adjustment' | 'transfer',
        limit: PAGE_SIZE,
        offset: newOffset,
      });
      setTransactions(result.transactions as unknown as Transaction[]);
      setTotal(result.total);
      setOffset(newOffset);
    });
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    fetchPage(0, value);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Type:</span>
          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-[160px] h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="receive">Receive</SelectItem>
              <SelectItem value="issue">Issue</SelectItem>
              <SelectItem value="return">Return</SelectItem>
              <SelectItem value="scrap">Scrap</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-gray-500">
          {total} transaction{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          No transactions recorded yet
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Lot Number</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Qty Change</TableHead>
                <TableHead className="text-right">Before</TableHead>
                <TableHead className="text-right">After</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Operator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                    {new Date(txn.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        TRANSACTION_TYPE_COLORS[txn.transactionType] ?? ''
                      }
                    >
                      {txn.transactionType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {txn.materialLot.lotNumber}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-mono">{txn.materialLot.materialCode}</span>
                    {txn.materialLot.description && (
                      <span className="text-gray-400 ml-1 text-xs">
                        ({txn.materialLot.description})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    <span
                      className={
                        txn.quantity > 0
                          ? 'text-green-600'
                          : txn.quantity < 0
                            ? 'text-red-600'
                            : ''
                      }
                    >
                      {txn.quantity > 0 ? '+' : ''}
                      {txn.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-gray-500">
                    {txn.previousQty}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {txn.newQty}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {txn.referenceType ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
                    {txn.reason ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {txn.operator.name}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || isPending}
              onClick={() => fetchPage(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || isPending}
              onClick={() => fetchPage(offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
