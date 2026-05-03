import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-2',
        'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
        'border-b border-yellow-500/20 text-sm font-medium',
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      You are offline. Some features may be unavailable.
    </div>
  )
}
