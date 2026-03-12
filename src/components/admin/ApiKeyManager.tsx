'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { revokeApiKey, rotateApiKey } from '@/lib/actions/api-keys';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
  createdAt: string;
  createdBy: {
    name: string;
    email: string;
  };
}

interface ApiKeyManagerProps {
  initialKeys: ApiKeyRow[];
}

export function ApiKeyManager({ initialKeys }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [isPending, startTransition] = useTransition();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rotatedKey, setRotatedKey] = useState<{ id: string; rawKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleRevoke(id: string) {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return;
    }

    setActioningId(id);
    startTransition(async () => {
      try {
        await revokeApiKey(id);
        setKeys((prev) =>
          prev.map((k) => (k.id === id ? { ...k, active: false } : k))
        );
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to revoke key');
      } finally {
        setActioningId(null);
      }
    });
  }

  function handleRotate(id: string) {
    if (!confirm('This will revoke the current key and generate a new one. Continue?')) {
      return;
    }

    setActioningId(id);
    startTransition(async () => {
      try {
        const result = await rotateApiKey(id);
        setRotatedKey({ id: result.id, rawKey: result.rawKey });
        // Mark old key as inactive, add new key
        setKeys((prev) => [
          {
            id: result.id,
            name: result.name,
            keyPrefix: result.keyPrefix,
            permissions: result.permissions,
            expiresAt: result.expiresAt ? new Date(result.expiresAt).toISOString() : null,
            lastUsedAt: null,
            active: true,
            createdAt: new Date(result.createdAt).toISOString(),
            createdBy: prev.find((k) => k.id === id)?.createdBy ?? { name: 'Admin', email: '' },
          },
          ...prev.map((k) => (k.id === id ? { ...k, active: false } : k)),
        ]);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to rotate key');
      } finally {
        setActioningId(null);
      }
    });
  }

  async function handleCopyRotated() {
    if (rotatedKey) {
      await navigator.clipboard.writeText(rotatedKey.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function isExpired(expiresAt: string | null) {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  return (
    <div className="space-y-6">
      {/* Rotated key banner */}
      {rotatedKey && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800 mb-2">
            New API key generated. Copy it now — it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-amber-300 rounded px-3 py-2 font-mono break-all select-all">
              {rotatedKey.rawKey}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyRotated}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRotatedKey(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">
            {keys.filter((k) => k.active).length} active key{keys.filter((k) => k.active).length !== 1 ? 's' : ''}
          </p>
        </div>
        <CreateApiKeyDialog />
      </div>

      {/* Keys table */}
      {keys.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="font-medium">No API keys yet</p>
          <p className="text-sm mt-1">Create an API key to enable external integrations.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Key</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Permissions</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Last Used</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Created</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((key) => (
                <tr key={key.id} className={!key.active ? 'opacity-50 bg-slate-50' : ''}>
                  <td className="px-4 py-3 font-medium">{key.name}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-slate-100 rounded px-2 py-1 font-mono">
                      {key.keyPrefix}...
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {key.permissions.map((p) => (
                        <Badge key={p} variant="secondary" className="text-xs">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!key.active ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : isExpired(key.expiresAt) ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                    )}
                    {key.expiresAt && key.active && !isExpired(key.expiresAt) && (
                      <p className="text-xs text-slate-500 mt-1">
                        Expires {formatDate(key.expiresAt)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(key.lastUsedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    <div>{formatDate(key.createdAt)}</div>
                    <div className="text-xs">{key.createdBy.name}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {key.active && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRotate(key.id)}
                          disabled={isPending && actioningId === key.id}
                        >
                          Rotate
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(key.id)}
                          disabled={isPending && actioningId === key.id}
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
