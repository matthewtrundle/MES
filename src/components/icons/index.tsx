/**
 * Industrial Icon Library for MES
 * Clean, professional SVG icons - no emojis
 */

import {
  Factory,
  Cog,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Package,
  Boxes,
  ClipboardCheck,
  ClipboardX,
  Settings,
  Users,
  BarChart3,
  Activity,
  Gauge,
  Wrench,
  Timer,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowDown,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  RefreshCw,
  Zap,
  ThermometerSun,
  Scale,
  ScanLine,
  CircleDot,
  Info,
  X,
  ListOrdered,
  MoreHorizontal,
  Layers,
  FileText,
  Brain,
  History,
  Plus,
  type LucideIcon,
} from 'lucide-react';

// Re-export icons with semantic names for MES context
export const Icons = {
  // Station/Production icons
  station: Factory,
  machine: Cog,
  settings: Settings,
  wrench: Wrench,

  // Status icons
  running: PlayCircle,
  stopped: PauseCircle,
  warning: AlertTriangle,
  pass: CheckCircle2,
  fail: XCircle,
  rework: RotateCcw,

  // Time/Duration icons
  clock: Clock,
  timer: Timer,

  // Unit/Material icons
  unit: Package,
  material: Boxes,
  scan: ScanLine,

  // Quality icons
  qualityPass: ClipboardCheck,
  qualityFail: ClipboardX,
  gauge: Gauge,
  measurement: Scale,
  temperature: ThermometerSun,

  // Analytics icons
  chart: BarChart3,
  activity: Activity,
  trendUp: TrendingUp,
  trendDown: TrendingDown,

  // Navigation icons
  arrowRight: ArrowRight,
  arrowDown: ArrowDown,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,

  // Action icons
  search: Search,
  refresh: RefreshCw,

  // People icons
  users: Users,

  // Other
  power: Zap,
  dot: CircleDot,
  info: Info,
  close: X,
  plus: Plus,

  // Navigation/UI icons
  chevronDown: ChevronDown,
  list: ListOrdered,
  more: MoreHorizontal,
  layers: Layers,
  document: FileText,
  ai: Brain,
  history: History,
} as const;

export type IconName = keyof typeof Icons;

// Status indicator component
interface StatusIndicatorProps {
  status: 'running' | 'idle' | 'downtime' | 'error';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function StatusIndicator({ status, size = 'md', pulse = false }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const colorClasses = {
    running: 'bg-green-500',
    idle: 'bg-gray-400',
    downtime: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <span className="relative flex">
      <span
        className={`${sizeClasses[size]} ${colorClasses[status]} rounded-full ${
          pulse && status === 'running' ? 'animate-pulse' : ''
        }`}
      />
      {pulse && status === 'running' && (
        <span
          className={`absolute ${sizeClasses[size]} ${colorClasses[status]} animate-ping rounded-full opacity-75`}
        />
      )}
    </span>
  );
}

// Station status badge
interface StationStatusBadgeProps {
  status: 'running' | 'idle' | 'downtime' | 'maintenance';
  className?: string;
}

export function StationStatusBadge({ status, className = '' }: StationStatusBadgeProps) {
  const config = {
    running: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      label: 'Running',
      Icon: Icons.running,
    },
    idle: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-200',
      label: 'Idle',
      Icon: Icons.stopped,
    },
    downtime: {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      border: 'border-amber-200',
      label: 'Downtime',
      Icon: Icons.warning,
    },
    maintenance: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      label: 'Maintenance',
      Icon: Icons.wrench,
    },
  };

  const { bg, text, border, label, Icon } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${bg} ${text} ${border} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

// Unit status badge
interface UnitStatusBadgeProps {
  status: 'created' | 'in_progress' | 'completed' | 'scrapped' | 'rework';
  className?: string;
}

export function UnitStatusBadge({ status, className = '' }: UnitStatusBadgeProps) {
  const config = {
    created: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: 'Created',
    },
    in_progress: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: 'In Progress',
    },
    completed: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Completed',
    },
    scrapped: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Scrapped',
    },
    rework: {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      label: 'Rework',
    },
  };

  const { bg, text, label } = config[status];

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${bg} ${text} ${className}`}
    >
      {label}
    </span>
  );
}

// Quality result badge
interface QualityBadgeProps {
  result: 'pass' | 'fail';
  className?: string;
}

export function QualityBadge({ result, className = '' }: QualityBadgeProps) {
  const config = {
    pass: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      Icon: Icons.pass,
    },
    fail: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200',
      Icon: Icons.fail,
    },
  };

  const { bg, text, border, Icon } = config[result];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium uppercase ${bg} ${text} ${border} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {result}
    </span>
  );
}

export type { LucideIcon };
