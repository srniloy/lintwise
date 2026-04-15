import { useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Upload, X, FileCode2, AlertCircle } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { loadLanguage } from '@uiw/codemirror-extensions-langs'
import type { LanguageName } from '@uiw/codemirror-extensions-langs'
import { useThemeStore } from '@/store/themeStore'
import { ROUTES } from '@/constants/routes'
import { reviewService } from '@/services/reviewService'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILES = 5
const MAX_TOTAL_BYTES = 10 * 1024 * 1024 // 10 MB

interface LangOption {
  label: string
  value: string
}

const LANGUAGE_GROUPS: { label: string; options: LangOption[] }[] = [
  {
    label: 'Web',
    options: [
      { label: 'JavaScript',   value: 'javascript' },
      { label: 'TypeScript',   value: 'typescript' },
      { label: 'JSX',          value: 'jsx' },
      { label: 'TSX',          value: 'tsx' },
      { label: 'HTML',         value: 'html' },
      { label: 'CSS',          value: 'css' },
      { label: 'SCSS / Sass',  value: 'sass' },
      { label: 'Less',         value: 'less' },
      { label: 'GraphQL',      value: 'graphql' },
      { label: 'Svelte',       value: 'svelte' },
    ],
  },
  {
    label: 'Backend',
    options: [
      { label: 'Python',   value: 'python' },
      { label: 'Java',     value: 'java' },
      { label: 'Go',       value: 'go' },
      { label: 'Rust',     value: 'rust' },
      { label: 'C#',       value: 'csharp' },
      { label: 'PHP',      value: 'php' },
      { label: 'Ruby',     value: 'ruby' },
      { label: 'Swift',    value: 'swift' },
      { label: 'Kotlin',   value: 'kotlin' },
    ],
  },
  {
    label: 'Systems',
    options: [
      { label: 'C',   value: 'c' },
      { label: 'C++', value: 'cpp' },
      { label: 'Zig', value: 'zig' },
    ],
  },
  {
    label: 'JVM / Functional',
    options: [
      { label: 'Scala',   value: 'scala' },
      { label: 'Groovy',  value: 'groovy' },
      { label: 'Clojure', value: 'clojure' },
      { label: 'Haskell', value: 'haskell' },
      { label: 'Erlang',  value: 'erlang' },
      { label: 'OCaml',   value: 'ocaml' },
    ],
  },
  {
    label: 'Data & Config',
    options: [
      { label: 'SQL',        value: 'sql' },
      { label: 'PostgreSQL', value: 'pgsql' },
      { label: 'JSON',       value: 'json' },
      { label: 'XML',        value: 'xml' },
      { label: 'YAML',       value: 'yaml' },
      { label: 'TOML',       value: 'toml' },
      { label: 'Markdown',   value: 'markdown' },
    ],
  },
  {
    label: 'Scripting & Shell',
    options: [
      { label: 'Bash / Shell', value: 'bash' },
      { label: 'PowerShell',   value: 'powershell' },
      { label: 'Perl',         value: 'perl' },
      { label: 'Lua',          value: 'lua' },
      { label: 'R',            value: 'r' },
      { label: 'Julia',        value: 'julia' },
    ],
  },
  {
    label: 'Mobile',
    options: [
      { label: 'Dart',        value: 'dart' },
      { label: 'Objective-C', value: 'objectivec' },
    ],
  },
  {
    label: 'Other',
    options: [
      { label: 'Dockerfile',  value: 'dockerfile' },
      { label: 'Nginx',       value: 'nginx' },
      { label: 'Protobuf',    value: 'protobuf' },
      { label: 'Solidity',    value: 'solidity' },
      { label: 'WebAssembly', value: 'wast' },
      { label: 'Verilog',     value: 'verilog' },
      { label: 'Diff',        value: 'diff' },
    ],
  },
]

const ALL_LANGUAGES = LANGUAGE_GROUPS.flatMap((g) => g.options)

const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  html: 'html', htm: 'html',
  css: 'css',
  scss: 'sass', sass: 'sass',
  less: 'less',
  graphql: 'graphql', gql: 'graphql',
  svelte: 'svelte',
  py: 'python', pyw: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  swift: 'swift',
  kt: 'kotlin', kts: 'kotlin',
  c: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  h: 'c',
  zig: 'zig',
  scala: 'scala',
  groovy: 'groovy',
  clj: 'clojure', cljs: 'clojure',
  hs: 'haskell',
  erl: 'erlang',
  ml: 'ocaml', mli: 'ocaml',
  sql: 'sql',
  json: 'json', jsonc: 'json',
  xml: 'xml', xsl: 'xml', xsd: 'xml',
  yaml: 'yaml', yml: 'yaml',
  toml: 'toml',
  md: 'markdown', mdx: 'markdown',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  ps1: 'powershell',
  pl: 'perl', pm: 'perl',
  lua: 'lua',
  r: 'r',
  jl: 'julia',
  dart: 'dart',
  m: 'objectivec',
  proto: 'protobuf',
  sol: 'solidity',
  wat: 'wast',
  v: 'verilog',
}

function detectLang(files: File[]): string | null {
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (EXT_TO_LANG[ext]) return EXT_TO_LANG[ext]
  }
  return null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) ?? '')
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// ── LanguageSelector ──────────────────────────────────────────────────────────

function LanguageSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger label="Language">
        <SelectValue placeholder="Select language…" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {LANGUAGE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

// ── DropZone ──────────────────────────────────────────────────────────────────

interface DropZoneProps {
  files: File[]
  onAdd: (files: File[]) => void
  onRemove: (index: number) => void
}

function DropZone({ files, onAdd, onRemove }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming)
      const next = [...files, ...arr]
      if (next.length > MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files allowed`)
        return
      }
      const nextBytes = next.reduce((s, f) => s + f.size, 0)
      if (nextBytes > MAX_TOTAL_BYTES) {
        toast.error('Total file size exceeds 10 MB')
        return
      }
      onAdd(arr)
    },
    [files, onAdd],
  )

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    // only clear when leaving the zone itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }

  const usedPercent = Math.min(100, (totalBytes / MAX_TOTAL_BYTES) * 100)

  return (
    <div className="space-y-3">
      {/* Drop area */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed',
          'cursor-pointer px-6 py-14 text-center transition-colors duration-150',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40',
        )}
      >
        <Upload
          className={cn(
            'mb-3 h-9 w-9 transition-colors',
            isDragging ? 'text-primary' : 'text-muted-foreground',
          )}
        />
        <p className="text-sm font-medium text-foreground">
          Drag &amp; drop files here, or{' '}
          <span className="text-primary underline underline-offset-2">click to browse</span>
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Up to {MAX_FILES} files · 10 MB total · Text &amp; source files
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {/* Usage bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{files.length}/{MAX_FILES} files</span>
              <span>{formatBytes(totalBytes)} / 10 MB</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usedPercent > 80 ? 'bg-orange-500' : 'bg-primary',
                )}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>

          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ReviewNewPage ─────────────────────────────────────────────────────────────

export default function ReviewNewPage() {
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)

  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste')
  const [language, setLanguage] = useState('javascript')
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load the CodeMirror language extension for the selected language
  const langExtension = useMemo(() => {
    const ext = loadLanguage(language as LanguageName)
    return ext ? [ext] : []
  }, [language])

  const langLabel = ALL_LANGUAGES.find((l) => l.value === language)?.label ?? language

  function handleAddFiles(incoming: File[]) {
    setFiles((prev) => {
      const next = [...prev, ...incoming]
      // Auto-detect language from file extensions if still on default
      if (language === 'javascript') {
        const detected = detectLang(next)
        if (detected) setLanguage(detected)
      }
      return next
    })
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    let finalCode = ''

    if (activeTab === 'paste') {
      if (code.trim().length < 10) {
        toast.error('Please paste at least 10 characters of code')
        return
      }
      finalCode = code.trim()
    } else {
      if (files.length === 0) {
        toast.error('Please upload at least one file')
        return
      }
      try {
        const contents = await Promise.all(files.map(readFileAsText))
        finalCode = files
          .map((file, i) => `// ═══ ${file.name} ═══\n\n${contents[i]}`)
          .join('\n\n')
      } catch {
        toast.error('Failed to read file contents')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const review = await reviewService.create({
        title: title.trim() || undefined,
        language,
        code: finalCode,
      })
      toast.success('Review submitted! Analyzing your code…')
      navigate(ROUTES.REVIEW_STATUS(review.id))
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to submit review. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Code Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste your code or upload files to get an AI-powered review.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Optional title */}
        <Input
          label="Title (optional)"
          type="text"
          placeholder="e.g. Auth service refactor, Login bug fix…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          helperText={title ? `${title.length}/120` : undefined}
        />

        {/* Input mode tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'paste' | 'upload')}>
          <TabsList>
            <TabsTrigger value="paste">Paste Code</TabsTrigger>
            <TabsTrigger value="upload">Upload Files</TabsTrigger>
          </TabsList>

          {/* ── Paste Code tab ── */}
          <TabsContent value="paste" className="space-y-4 mt-4">
            <LanguageSelector value={language} onChange={setLanguage} />

            <div className="overflow-hidden rounded-md border border-border">
              <CodeMirror
                value={code}
                height="420px"
                extensions={langExtension}
                theme={theme === 'dark' ? 'dark' : 'light'}
                onChange={setCode}
                placeholder={`// Paste your ${langLabel} code here…`}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                  autocompletion: true,
                }}
              />
            </div>

            {code.trim().length > 0 && code.trim().length < 10 && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Minimum 10 characters required
              </p>
            )}

            {code.trim().length >= 10 && (
              <p className="text-xs text-muted-foreground text-right">
                {code.length.toLocaleString()} characters
              </p>
            )}
          </TabsContent>

          {/* ── Upload Files tab ── */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            <LanguageSelector value={language} onChange={setLanguage} />
            <DropZone
              files={files}
              onAdd={handleAddFiles}
              onRemove={handleRemoveFile}
            />
          </TabsContent>
        </Tabs>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Results are usually ready in under 30 seconds.
          </p>
          <Button type="submit" size="lg" loading={isSubmitting} disabled={isSubmitting}>
            Submit for Review
          </Button>
        </div>
      </form>
    </div>
  )
}
