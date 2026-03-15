import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Factory,
  BarChart3,
  Settings,
  ShieldCheck,
  Search,
  Activity,
  Zap,
  ArrowRight,
} from 'lucide-react';

const clerkEnabled =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('REPLACE_ME');

export default async function HomePage() {
  // Demo mode: redirect to dashboard
  if (!clerkEnabled) {
    redirect('/dashboard');
  }

  const { auth } = await import('@clerk/nextjs/server');
  const { userId, sessionClaims } = await auth();

  // If not logged in, show welcome page
  if (!userId) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 pt-28 pb-20">
          {/* Hero Section */}
          <div className="text-center mb-20 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.08] px-4 py-1.5 mb-8 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">Production Ready</span>
            </div>
            <div className="text-sm font-bold tracking-[0.3em] uppercase text-red-500 mb-4">WESTMAG</div>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
              <span className="text-white">Manufacturing</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                Execution System
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-400/90 max-w-lg mx-auto leading-relaxed">
              Event-driven motor assembly tracking aligned with ISA-95.
              From shop floor to real-time dashboard.
            </p>

            {/* CTA inline with hero */}
            <div className="flex justify-center gap-3 mt-10">
              <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-100 px-7 font-semibold shadow-lg shadow-white/10 transition-all hover:shadow-white/20">
                <Link href="/sign-in">Get Started</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/[0.06]">
                <Link href="/sign-up">Create Account</Link>
              </Button>
            </div>
          </div>

          {/* Capabilities — subtle inline, not boxy */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-20">
            {[
              { label: 'Quality Control', Icon: ShieldCheck },
              { label: 'Full Traceability', Icon: Search },
              { label: 'Live Analytics', Icon: Activity },
              { label: 'Event-Driven', Icon: Zap },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-slate-500">
                <item.Icon className="h-4 w-4 text-slate-600" />
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Role Cards — glassmorphism with varied visual weight */}
          <div className="grid gap-5 sm:grid-cols-3 mb-16">
            {[
              {
                title: 'Operator',
                desc: 'Tablet-first station interface for scanning, production tracking, and quality capture.',
                href: '/sign-in',
                Icon: Factory,
                gradient: 'from-emerald-500/20 to-emerald-500/0',
                iconBg: 'bg-emerald-500/10',
                iconColor: 'text-emerald-400',
                borderHover: 'hover:border-emerald-500/30',
              },
              {
                title: 'Supervisor',
                desc: 'Real-time dashboards with KPIs, AI-powered alerts, and production flow visualization.',
                href: '/sign-in',
                Icon: BarChart3,
                gradient: 'from-blue-500/20 to-blue-500/0',
                iconBg: 'bg-blue-500/10',
                iconColor: 'text-blue-400',
                borderHover: 'hover:border-blue-500/30',
              },
              {
                title: 'Administrator',
                desc: 'Full system configuration — stations, routing, quality checks, users, and audit trails.',
                href: '/sign-in',
                Icon: Settings,
                gradient: 'from-violet-500/20 to-violet-500/0',
                iconBg: 'bg-violet-500/10',
                iconColor: 'text-violet-400',
                borderHover: 'hover:border-violet-500/30',
              },
            ].map((role) => (
              <Link key={role.title} href={role.href} className="group">
                <div className={`relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-6 h-full transition-all duration-300 ${role.borderHover} hover:bg-white/[0.05]`}>
                  {/* Gradient accent at top */}
                  <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${role.gradient}`} />

                  <div className={`inline-flex rounded-xl ${role.iconBg} p-3 mb-4`}>
                    <role.Icon className={`h-5 w-5 ${role.iconColor}`} />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{role.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5">{role.desc}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 group-hover:text-white transition-colors">
                    Enter
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Bottom stats — more understated */}
          <div className="flex justify-center gap-12 text-center">
            {[
              { value: '6', label: 'Stations' },
              { value: 'ISA-95', label: 'Compliant' },
              { value: '47', label: 'Pages' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-slate-600 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Get role from session claims (typed via globals.d.ts)
  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  const role = metadata?.role;

  // Redirect based on role
  if (role === 'admin') {
    redirect('/admin');
  } else if (role === 'supervisor') {
    redirect('/dashboard');
  } else {
    // Default to operator station selection
    redirect('/station');
  }
}
