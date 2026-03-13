'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface OpenApiSpec {
  info: {
    title: string;
    description: string;
    version: string;
  };
  tags: Array<{ name: string; description: string }>;
  paths: Record<string, Record<string, EndpointDef>>;
  components: {
    schemas: Record<string, SchemaObject>;
    responses: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}

interface EndpointDef {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  security?: Array<Record<string, string[]>>;
  parameters?: ParameterDef[];
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: SchemaObject; example?: unknown }>;
  };
  responses: Record<string, ResponseDef>;
}

interface ParameterDef {
  name: string;
  in: string;
  required?: boolean;
  schema: SchemaObject;
  description?: string;
}

interface ResponseDef {
  description: string;
  content?: Record<string, { schema: SchemaObject; example?: unknown }>;
  $ref?: string;
}

interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: string[];
  $ref?: string;
  description?: string;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  default?: unknown;
  example?: unknown;
}

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  get: {
    bg: 'bg-green-50 dark:bg-green-950/50',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  post: {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  put: {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
  patch: {
    bg: 'bg-orange-50 dark:bg-orange-950/50',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
  delete: {
    bg: 'bg-red-50 dark:bg-red-950/50',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
};

function MethodBadge({ method }: { method: string }) {
  const colors = METHOD_COLORS[method] ?? METHOD_COLORS.get;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider',
        colors.bg,
        colors.text,
      )}
    >
      {method}
    </span>
  );
}

function resolveRef(spec: OpenApiSpec, ref: string): SchemaObject {
  const parts = ref.replace('#/', '').split('/');
  let result: unknown = spec;
  for (const part of parts) {
    result = (result as Record<string, unknown>)[part];
  }
  return result as SchemaObject;
}

function resolveSchema(spec: OpenApiSpec, schema: SchemaObject): SchemaObject {
  if (schema.$ref) {
    return resolveRef(spec, schema.$ref);
  }
  return schema;
}

function SchemaDisplay({ spec, schema, depth = 0 }: { spec: OpenApiSpec; schema: SchemaObject; depth?: number }) {
  const resolved = resolveSchema(spec, schema);

  if (resolved.type === 'object' && resolved.properties) {
    return (
      <div className={cn('space-y-1', depth > 0 && 'ml-4 border-l-2 border-slate-200 dark:border-slate-700 pl-3')}>
        {Object.entries(resolved.properties).map(([name, prop]) => {
          const propResolved = resolveSchema(spec, prop);
          const isRequired = resolved.required?.includes(name);
          return (
            <div key={name} className="text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{name}</code>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {propResolved.type}
                  {propResolved.format ? ` (${propResolved.format})` : ''}
                  {propResolved.enum ? ` [${propResolved.enum.join(' | ')}]` : ''}
                </span>
                {isRequired && (
                  <span className="text-xs text-red-500 dark:text-red-400 font-medium">required</span>
                )}
                {propResolved.nullable && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">nullable</span>
                )}
              </div>
              {propResolved.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-2">{propResolved.description}</p>
              )}
              {propResolved.type === 'object' && propResolved.properties && depth < 3 && (
                <SchemaDisplay spec={spec} schema={propResolved} depth={depth + 1} />
              )}
              {propResolved.type === 'array' && propResolved.items && depth < 3 && (
                <div className="ml-2 mt-1">
                  <span className="text-xs text-slate-400 dark:text-slate-500">items:</span>
                  <SchemaDisplay spec={spec} schema={propResolved.items} depth={depth + 1} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (resolved.type === 'array' && resolved.items) {
    return (
      <div className="text-sm">
        <span className="text-xs text-slate-400 dark:text-slate-500">array of:</span>
        <SchemaDisplay spec={spec} schema={resolved.items} depth={depth + 1} />
      </div>
    );
  }

  return (
    <span className="text-xs text-slate-500 dark:text-slate-400">
      {resolved.type}
      {resolved.format ? ` (${resolved.format})` : ''}
      {resolved.enum ? ` [${resolved.enum.join(' | ')}]` : ''}
    </span>
  );
}

function buildCurlCommand(method: string, path: string, endpoint: EndpointDef): string {
  const url = `$\{BASE_URL\}/api${path}`;
  const parts: string[] = ['curl'];

  if (method !== 'get') {
    parts.push(`-X ${method.toUpperCase()}`);
  }

  if (endpoint.security && endpoint.security.length > 0) {
    parts.push("-H 'Authorization: Bearer $TOKEN'");
  }

  if (endpoint.requestBody) {
    parts.push("-H 'Content-Type: application/json'");
    const contentType = Object.keys(endpoint.requestBody.content)[0];
    const example = endpoint.requestBody.content[contentType]?.example;
    if (example) {
      parts.push(`-d '${JSON.stringify(example)}'`);
    } else {
      parts.push("-d '{}'");
    }
  }

  parts.push(`'${url}'`);
  return parts.join(' \\\n  ');
}

function EndpointCard({
  method,
  path,
  endpoint,
  spec,
}: {
  method: string;
  path: string;
  endpoint: EndpointDef;
  spec: OpenApiSpec;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const curlCommand = buildCurlCommand(method, path, endpoint);

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = curlCommand;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const colors = METHOD_COLORS[method] ?? METHOD_COLORS.get;
  const requiresAuth = endpoint.security && endpoint.security.length > 0;

  return (
    <div className={cn('rounded-lg border transition-all', colors.border, expanded && 'shadow-md')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-lg',
          expanded && 'rounded-b-none',
        )}
      >
        <MethodBadge method={method} />
        <code className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200">/api{path}</code>
        {requiresAuth && (
          <svg className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
        <span className="flex-1 text-sm text-slate-500 dark:text-slate-400 truncate">
          {endpoint.summary}
        </span>
        <svg
          className={cn(
            'h-4 w-4 text-slate-400 transition-transform shrink-0',
            expanded && 'rotate-180',
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4 space-y-4">
          {endpoint.description && (
            <p className="text-sm text-slate-600 dark:text-slate-300">{endpoint.description}</p>
          )}

          {/* Parameters */}
          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Parameters
              </h4>
              <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">In</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.parameters.map((param) => (
                      <tr key={param.name} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="px-3 py-2">
                          <code className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{param.name}</code>
                          {param.required && <span className="ml-1 text-xs text-red-500">*</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{param.in}</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {param.schema.type}
                          {param.schema.format ? ` (${param.schema.format})` : ''}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request Body */}
          {endpoint.requestBody && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Request Body
                {endpoint.requestBody.required && (
                  <span className="ml-1 text-red-500 text-xs normal-case">required</span>
                )}
              </h4>
              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
                {Object.entries(endpoint.requestBody.content).map(([, content]) => (
                  <div key="body">
                    <SchemaDisplay spec={spec} schema={content.schema} />
                    {content.example != null && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Example:</p>
                        <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-green-400 rounded-md p-3 overflow-x-auto">
                          {JSON.stringify(content.example, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Responses */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Responses
            </h4>
            <div className="space-y-2">
              {Object.entries(endpoint.responses).map(([code, response]) => {
                const resp = response.$ref
                  ? (resolveRef(spec, response.$ref) as unknown as ResponseDef)
                  : response;
                return (
                  <div key={code} className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold',
                          code.startsWith('2')
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                            : code.startsWith('4')
                              ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                              : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400',
                        )}
                      >
                        {code}
                      </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{resp.description}</span>
                    </div>
                    {resp.content && Object.entries(resp.content).map(([, content]) => (
                      <div key="resp-content" className="mt-2">
                        <SchemaDisplay spec={spec} schema={content.schema} />
                        {content.example != null && (
                          <pre className="mt-2 text-xs bg-slate-900 dark:bg-slate-950 text-green-400 rounded-md p-3 overflow-x-auto">
                            {JSON.stringify(content.example, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Try It (curl) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Try It
              </h4>
              <button
                onClick={handleCopyCurl}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy curl
                  </>
                )}
              </button>
            </div>
            <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-300 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
              {curlCommand}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApiDocumentation() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/openapi.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch API spec');
        return res.json();
      })
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const groupedEndpoints = useMemo(() => {
    if (!spec) return new Map<string, Array<{ method: string; path: string; endpoint: EndpointDef }>>();

    const groups = new Map<string, Array<{ method: string; path: string; endpoint: EndpointDef }>>();

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, endpoint] of Object.entries(methods)) {
        const tags = endpoint.tags ?? ['Other'];
        for (const tag of tags) {
          if (!groups.has(tag)) {
            groups.set(tag, []);
          }
          groups.get(tag)!.push({ method, path, endpoint });
        }
      }
    }

    return groups;
  }, [spec]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery && !selectedTag) return groupedEndpoints;

    const filtered = new Map<string, Array<{ method: string; path: string; endpoint: EndpointDef }>>();
    const query = searchQuery.toLowerCase();

    for (const [tag, endpoints] of groupedEndpoints) {
      if (selectedTag && tag !== selectedTag) continue;

      const matchingEndpoints = endpoints.filter((ep) => {
        if (!searchQuery) return true;
        return (
          ep.path.toLowerCase().includes(query) ||
          ep.method.toLowerCase().includes(query) ||
          ep.endpoint.summary?.toLowerCase().includes(query) ||
          ep.endpoint.description?.toLowerCase().includes(query)
        );
      });

      if (matchingEndpoints.length > 0) {
        filtered.set(tag, matchingEndpoints);
      }
    }

    return filtered;
  }, [groupedEndpoints, searchQuery, selectedTag]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-6 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load API documentation: {error ?? 'Unknown error'}
        </p>
      </div>
    );
  }

  const totalEndpoints = Array.from(groupedEndpoints.values()).reduce((sum, eps) => sum + eps.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{spec.info.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{spec.info.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
              v{spec.info.version}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {totalEndpoints} endpoints
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            OpenAPI JSON
          </a>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedTag(null)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              !selectedTag
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
            )}
          >
            All
          </button>
          {spec.tags.map((tag) => (
            <button
              key={tag.name}
              onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                selectedTag === tag.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
              )}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoints grouped by tag */}
      {filteredGroups.size === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No endpoints match your search.</p>
        </div>
      ) : (
        Array.from(filteredGroups.entries()).map(([tag, endpoints]) => {
          const tagDef = spec.tags.find((t) => t.name === tag);
          return (
            <div key={tag}>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{tag}</h3>
                {tagDef?.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{tagDef.description}</p>
                )}
              </div>
              <div className="space-y-2">
                {endpoints.map((ep) => (
                  <EndpointCard
                    key={`${ep.method}-${ep.path}`}
                    method={ep.method}
                    path={ep.path}
                    endpoint={ep.endpoint}
                    spec={spec}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Auth info */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Authentication</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          Endpoints marked with a lock icon require authentication. Include a Bearer token in the Authorization header:
        </p>
        <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-300 rounded-md p-3 overflow-x-auto">
          {`Authorization: Bearer <your-jwt-token>`}
        </pre>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Tokens are issued via Clerk authentication. For programmatic access, use Clerk API keys.
        </p>
      </div>
    </div>
  );
}
