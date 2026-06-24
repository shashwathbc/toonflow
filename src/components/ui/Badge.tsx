import { cn } from '@/lib/utils/cn'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'ongoing' | 'completed' | 'hiatus'
  className?: string
}

const VARIANT_STYLES: Record<string, string> = {
  default: 'bg-bg-elevated text-text-secondary border border-bg-border',
  accent: 'bg-accent/10 text-accent border border-accent/20',
  success: 'bg-success/10 text-success border border-success/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  danger: 'bg-danger/10 text-danger border border-danger/20',
  ongoing: 'bg-accent/10 text-accent border border-accent/20',
  completed: 'bg-bg-elevated text-text-secondary border border-bg-border',
  hiatus: 'bg-warning/10 text-warning border border-warning/20',
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        VARIANT_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
