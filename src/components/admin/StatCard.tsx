import { cn } from '@/lib/utils/cn'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'default' | 'accent' | 'warning' | 'danger'
}

export default function StatCard({ label, value, sub, icon, trend, trendValue, color = 'default' }: StatCardProps) {
  const iconBg = {
    default: 'bg-bg-elevated text-text-secondary',
    accent: 'bg-accent/10 text-accent',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  }[color]

  return (
    <div className="bg-bg-card border border-bg-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
          {icon}
        </div>
        {trend && trendValue && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            trend === 'up' && 'bg-accent/10 text-accent',
            trend === 'down' && 'bg-danger/10 text-danger',
            trend === 'neutral' && 'bg-bg-elevated text-text-muted',
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '–'} {trendValue}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-text tabular-nums">{value}</p>
        <p className="text-sm text-text-secondary mt-0.5">{label}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
