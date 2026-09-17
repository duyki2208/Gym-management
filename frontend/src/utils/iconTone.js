const DEFAULT_ICON_TONE = 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary';

const ICON_TONES = {
  Activity: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  AlertCircle: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  AlertTriangle: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  Award: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  BarChart2: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  ChartNoAxesColumn: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  Calendar: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  ClipboardCheck: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
  ClipboardList: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
  Clock: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  CheckCircle2: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
  CircleAlert: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  CircleCheck: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
  CircleX: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  CreditCard: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  DollarSign: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  Dumbbell: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400',
  Package: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  ShoppingCart: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  Target: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  TriangleAlert: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  TrendingUp: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  UserCheck: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
  Users: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  XCircle: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
};

export const getIconTone = (Icon) => {
  const iconName = Icon?.displayName || Icon?.name;
  return ICON_TONES[iconName] || DEFAULT_ICON_TONE;
};

export const getIconColor = (Icon) => getIconTone(Icon)
  .split(' ')
  .filter((className) => className.startsWith('text-') || className.startsWith('dark:text-'))
  .join(' ');
