import { ApiDocumentation } from '@/components/admin/ApiDocumentation';

export default function ApiDocsPage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">API Documentation</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          REST API reference for integrating with the MES system.
        </p>
      </div>
      <ApiDocumentation />
    </div>
  );
}
