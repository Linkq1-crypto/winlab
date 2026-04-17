/**
 * Skeleton Components — Instant perceived performance
 * Zero white screen, immediate visual feedback
 */

/**
 * Skeleton Card — placeholder for content cards
 */
export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 bg-slate-700 rounded-full" />
        <div className="flex-1">
          <div className="h-3 bg-slate-700 rounded w-3/4" />
          <div className="h-2 bg-slate-700 rounded w-1/2 mt-1" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-2 bg-slate-700 rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

/**
 * Skeleton Row — placeholder for list rows
 */
export function SkeletonRow({ count = 5, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-3 px-3 py-2.5">
          <div className="h-4 bg-slate-700 rounded w-8" />
          <div className="flex-1">
            <div className="h-3 bg-slate-700 rounded w-full" />
            <div className="h-2 bg-slate-700 rounded w-2/3 mt-1" />
          </div>
          <div className="h-4 bg-slate-700 rounded w-12" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Dashboard — full page skeleton for 3-column layout
 */
export function SkeletonDashboard() {
  return (
    <div className="flex h-screen bg-[#0b0f14] text-[#e5e7eb] animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-48 border-r border-[#1f2937] bg-[#111827] p-3 space-y-2">
        <div className="h-5 bg-slate-700 rounded w-3/4 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 bg-slate-700 rounded w-full" />
        ))}
      </div>

      {/* Inbox list skeleton */}
      <div className="w-80 border-r border-[#1f2937] bg-[#0b0f14]">
        <div className="p-3 border-b border-[#1f2937]">
          <div className="h-6 bg-slate-700 rounded w-full mb-2" />
          <div className="h-4 bg-slate-700 rounded w-1/2" />
        </div>
        <SkeletonRow count={8} />
      </div>

      {/* Thread detail skeleton */}
      <div className="flex-1 bg-[#0b0f14] p-5 space-y-4">
        <div className="h-6 bg-slate-700 rounded w-3/4" />
        <div className="h-4 bg-slate-700 rounded w-1/2" />
        <div className="h-32 bg-slate-700 rounded w-full" />
        <div className="h-48 bg-slate-700 rounded w-full" />
        <div className="h-8 bg-slate-700 rounded w-1/4" />
      </div>
    </div>
  );
}

/**
 * Skeleton Table — placeholder for data tables
 */
export function SkeletonTable({ rows = 5, cols = 4, className = '' }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {/* Header */}
      <div className="flex gap-3 px-3 py-2">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-700 rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 px-3 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3 bg-slate-700/60 rounded flex-1 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Metric Card — placeholder for KPI cards
 */
export function SkeletonMetric({ count = 4, className = '' }) {
  return (
    <div className={`grid gap-3 ${count <= 2 ? 'grid-cols-2' : count <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'} ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700 animate-pulse">
          <div className="h-2 bg-slate-700 rounded w-1/2 mb-2" />
          <div className="h-5 bg-slate-700 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

/**
 * Loading Spinner — minimal spinner for inline loading
 */
export function Spinner({ size = 'sm', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={`${sizes[size]} border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin ${className}`} role="status" aria-label="Loading" />
  );
}

/**
 * Inline Loading — text + spinner
 */
export function InlineLoading({ text = 'Loading...', className = '' }) {
  return (
    <div className={`flex items-center gap-2 text-[#9ca3af] text-xs ${className}`}>
      <Spinner size="sm" />
      <span>{text}</span>
    </div>
  );
}

export default {
  SkeletonCard,
  SkeletonRow,
  SkeletonDashboard,
  SkeletonTable,
  SkeletonMetric,
  Spinner,
  InlineLoading,
};
