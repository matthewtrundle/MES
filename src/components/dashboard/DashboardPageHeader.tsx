import Link from 'next/link';

interface DashboardPageHeaderProps {
  title: string;
  subtitle: string;
  backHref?: string;
  children?: React.ReactNode;
}

export function DashboardPageHeader({
  title,
  subtitle,
  backHref = '/dashboard',
  children,
}: DashboardPageHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={backHref}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              &larr; Dashboard
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          {children && (
            <div className="flex items-center gap-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
