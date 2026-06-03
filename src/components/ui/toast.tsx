// Re-exports Sonner's Toaster with LintWise theme defaults
// Usage: import { toast } from 'sonner'
//        toast.success('Done!') / toast.error('Oops')
import { Toaster as SonnerToaster } from 'sonner'
import { useTheme } from '@/hooks/useTheme'

export function Toaster() {
  const { theme } = useTheme()
  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-lg border border-border bg-background text-foreground shadow-lg',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted-foreground',
          closeButton: 'text-muted-foreground hover:text-foreground',
        },
      }}
    />
  )
}

// Re-export toast function so consumers import from one place
export { toast } from 'sonner'
