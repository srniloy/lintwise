import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary',
        secondary: 'bg-secondary text-secondary-foreground',
        critical: 'bg-destructive/15 text-destructive',
        high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
        medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
        low: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        info: 'bg-muted text-muted-foreground',
        success: 'bg-green-500/15 text-green-600 dark:text-green-400',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
