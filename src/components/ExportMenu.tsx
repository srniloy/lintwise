import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FileJson, FileText, FileSpreadsheet, FileType2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { ExportFormat } from '@/services/reviewService'

interface FormatOption {
  value: ExportFormat
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
}

const FORMATS: FormatOption[] = [
  { value: 'pdf',      label: 'PDF',       description: 'Printable report',       Icon: FileType2        },
  { value: 'markdown', label: 'Markdown',  description: 'Shareable .md document', Icon: FileText         },
  { value: 'json',     label: 'JSON',      description: 'Structured data',        Icon: FileJson         },
  { value: 'csv',      label: 'CSV',       description: 'Issues spreadsheet',     Icon: FileSpreadsheet  },
]

interface ExportMenuProps {
  onExport: (format: ExportFormat) => void | Promise<void>
  disabled?: boolean
  loading?: boolean
  label?: string
  size?: 'sm' | 'md'
  align?: 'left' | 'right'
}

export function ExportMenu({
  onExport,
  disabled,
  loading,
  label = 'Export',
  size = 'sm',
  align = 'right',
}: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  async function handleSelect(format: ExportFormat) {
    setOpen(false)
    await onExport(format)
  }

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {loading ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-1 w-56 overflow-hidden rounded-md border border-border bg-popover shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            Choose format
          </div>
          <ul className="py-1">
            {FORMATS.map(({ value, label, description, Icon }) => (
              <li key={value}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(value)}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight text-foreground">{label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
