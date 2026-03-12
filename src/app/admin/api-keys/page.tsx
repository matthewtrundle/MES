import { listApiKeys } from '@/lib/actions/api-keys';
import { ApiKeyManager } from '@/components/admin/ApiKeyManager';

export default async function ApiKeysPage() {
  const apiKeys = await listApiKeys();

  // Serialize dates for client component
  const serializedKeys = apiKeys.map((key: typeof apiKeys[number]) => ({
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    permissions: key.permissions,
    expiresAt: key.expiresAt ? key.expiresAt.toISOString() : null,
    lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
    active: key.active,
    createdAt: key.createdAt.toISOString(),
    createdBy: key.createdBy,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage API keys for external integrations. Keys use Bearer token authentication
          with the <code className="bg-slate-100 px-1 rounded">Authorization: Bearer mes_...</code> header.
        </p>
      </div>

      <ApiKeyManager initialKeys={serializedKeys} />
    </div>
  );
}
