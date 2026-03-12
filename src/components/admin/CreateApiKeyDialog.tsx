'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { createApiKey } from '@/lib/actions/api-keys';
import { API_PERMISSIONS, type ApiPermission } from '@/lib/validation/api-key-schemas';

const PERMISSION_LABELS: Record<ApiPermission, string> = {
  'work_orders:read': 'Work Orders (Read)',
  'work_orders:write': 'Work Orders (Write)',
  'units:read': 'Units (Read)',
  'inventory:read': 'Inventory (Read)',
  'quality:read': 'Quality / NCRs (Read)',
  'shipments:read': 'Shipments (Read)',
  'purchase_orders:read': 'Purchase Orders (Read)',
};

export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<ApiPermission[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function togglePermission(perm: ApiPermission) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  function selectAll() {
    setPermissions([...API_PERMISSIONS]);
  }

  function selectNone() {
    setPermissions([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await createApiKey({
        name,
        permissions,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });
      setCreatedKey(result.rawKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose() {
    setOpen(false);
    // Reset form after close animation
    setTimeout(() => {
      setName('');
      setPermissions([]);
      setExpiresAt('');
      setError(null);
      setCreatedKey(null);
      setCopied(false);
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button>
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create API Key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {createdKey ? 'API Key Created' : 'Create New API Key'}
          </DialogTitle>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Copy this key now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border border-amber-300 rounded px-3 py-2 font-mono break-all select-all">
                  {createdKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., ERP Integration, Dashboard Read-Only"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Permissions</Label>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                    Select all
                  </button>
                  <button type="button" onClick={selectNone} className="text-xs text-blue-600 hover:underline">
                    Clear
                  </button>
                </div>
              </div>
              <div className="space-y-2 border rounded-lg p-3">
                {API_PERMISSIONS.map((perm) => (
                  <label
                    key={perm}
                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-2 py-1"
                  >
                    <Checkbox
                      checked={permissions.includes(perm)}
                      onCheckedChange={() => togglePermission(perm)}
                    />
                    <span className="text-sm">{PERMISSION_LABELS[perm]}</span>
                    <code className="text-xs text-slate-400 ml-auto">{perm}</code>
                  </label>
                ))}
              </div>
              {permissions.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Select at least one permission</p>
              )}
            </div>

            <div>
              <Label htmlFor="key-expires">Expires At (optional)</Label>
              <Input
                id="key-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">
                Leave empty for a non-expiring key
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !name || permissions.length === 0}
              >
                {loading ? 'Creating...' : 'Create API Key'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
