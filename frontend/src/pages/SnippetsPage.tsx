import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  FileCode2,
} from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { loadLanguage } from '@uiw/codemirror-extensions-langs'
import type { LanguageName } from '@uiw/codemirror-extensions-langs'
import { useThemeStore } from '@/store/themeStore'
import { snippetService } from '@/services/snippetService'
import type { Snippet, SnippetVersion } from '@/types/snippet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '@/components/ui/modal'
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

// ── Language groups ────────────────────────────────────────────────────────────

interface LangOption { label: string; value: string }

const LANGUAGE_GROUPS: { label: string; options: LangOption[] }[] = [
  {
    label: 'Web',
    options: [
      { label: 'JavaScript', value: 'javascript' },
      { label: 'TypeScript', value: 'typescript' },
      { label: 'JSX',        value: 'jsx' },
      { label: 'TSX',        value: 'tsx' },
      { label: 'HTML',       value: 'html' },
      { label: 'CSS',        value: 'css' },
      { label: 'SCSS / Sass',value: 'sass' },
      { label: 'GraphQL',    value: 'graphql' },
      { label: 'Svelte',     value: 'svelte' },
    ],
  },
  {
    label: 'Backend',
    options: [
      { label: 'Python', value: 'python' },
      { label: 'Java',   value: 'java' },
      { label: 'Go',     value: 'go' },
      { label: 'Rust',   value: 'rust' },
      { label: 'C#',     value: 'csharp' },
      { label: 'PHP',    value: 'php' },
      { label: 'Ruby',   value: 'ruby' },
      { label: 'Swift',  value: 'swift' },
      { label: 'Kotlin', value: 'kotlin' },
    ],
  },
  {
    label: 'Systems',
    options: [
      { label: 'C',   value: 'c' },
      { label: 'C++', value: 'cpp' },
    ],
  },
  {
    label: 'Data & Config',
    options: [
      { label: 'SQL',      value: 'sql' },
      { label: 'JSON',     value: 'json' },
      { label: 'YAML',     value: 'yaml' },
      { label: 'Markdown', value: 'markdown' },
    ],
  },
  {
    label: 'Scripting & Shell',
    options: [
      { label: 'Bash / Shell', value: 'bash' },
      { label: 'PowerShell',   value: 'powershell' },
    ],
  },
  {
    label: 'Other',
    options: [
      { label: 'Dockerfile', value: 'dockerfile' },
      { label: 'Solidity',   value: 'solidity' },
      { label: 'Diff',       value: 'diff' },
    ],
  },
]

const ALL_LANGUAGES = LANGUAGE_GROUPS.flatMap((g) => g.options)

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function getLangLabel(value: string): string {
  return ALL_LANGUAGES.find((l) => l.value === value)?.label ?? value
}

const LIMIT = 10

type ModalType = 'create-edit' | 'history' | 'delete' | null

// ── SnippetsPage ───────────────────────────────────────────────────────────────

export default function SnippetsPage() {
  const theme = useThemeStore((s) => s.theme)

  // List state
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [langFilter, setLangFilter] = useState('all')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Active item & modal
  const [activeSnippet, setActiveSnippet] = useState<Snippet | null>(null)
  const [modal, setModal] = useState<ModalType>(null)

  // Form state (create / edit)
  const [formTitle, setFormTitle] = useState('')
  const [formLang, setFormLang] = useState('javascript')
  const [formCode, setFormCode] = useState('')
  const [titleError, setTitleError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Version history
  const [versions, setVersions] = useState<SnippetVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<SnippetVersion | null>(null)

  // Delete
  const [deleting, setDeleting] = useState(false)

  const totalPages = Math.ceil(total / LIMIT)

  const editorExtension = useMemo(() => {
    const ext = loadLanguage(formLang as LanguageName)
    return ext ? [ext] : []
  }, [formLang])

  const previewExtension = useMemo(() => {
    if (!activeSnippet) return []
    const ext = loadLanguage(activeSnippet.language as LanguageName)
    return ext ? [ext] : []
  }, [activeSnippet])

  // Debounce search
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearch(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(1)
    }, 250)
  }

  // Fetch snippets
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    snippetService
      .list({
        page,
        limit: LIMIT,
        search: debouncedSearch || undefined,
        language: langFilter !== 'all' ? langFilter : undefined,
      })
      .then((data) => {
        if (!cancelled) {
          setSnippets(data.snippets)
          setTotal(data.total)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSnippets([])
          setTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, debouncedSearch, langFilter])

  function openCreate() {
    setActiveSnippet(null)
    setFormTitle('')
    setFormLang('javascript')
    setFormCode('')
    setTitleError('')
    setCodeError('')
    setModal('create-edit')
  }

  function openEdit(snippet: Snippet) {
    setActiveSnippet(snippet)
    setFormTitle(snippet.title)
    setFormLang(snippet.language)
    setFormCode(snippet.code)
    setTitleError('')
    setCodeError('')
    setModal('create-edit')
  }

  async function openHistory(snippet: Snippet) {
    setActiveSnippet(snippet)
    setVersions([])
    setSelectedVersion(null)
    setModal('history')
    setVersionsLoading(true)
    try {
      const data = await snippetService.getVersions(snippet.id)
      setVersions(data)
      if (data.length > 0) setSelectedVersion(data[0])
    } catch {
      toast.error('Failed to load version history')
    } finally {
      setVersionsLoading(false)
    }
  }

  function openDelete(snippet: Snippet) {
    setActiveSnippet(snippet)
    setModal('delete')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let valid = true
    if (!formTitle.trim()) {
      setTitleError('Title is required')
      valid = false
    } else {
      setTitleError('')
    }
    if (formCode.trim().length < 5) {
      setCodeError('Please enter at least 5 characters of code')
      valid = false
    } else {
      setCodeError('')
    }
    if (!valid) return

    setSubmitting(true)
    try {
      if (activeSnippet) {
        const updated = await snippetService.update(activeSnippet.id, {
          title: formTitle.trim(),
          language: formLang,
          code: formCode,
        })
        setSnippets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        toast.success('Snippet updated')
      } else {
        const created = await snippetService.create({
          title: formTitle.trim(),
          language: formLang,
          code: formCode,
        })
        setSnippets((prev) => [created, ...prev])
        setTotal((t) => t + 1)
        toast.success('Snippet created')
      }
      setModal(null)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to save snippet')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!activeSnippet) return
    setDeleting(true)
    try {
      await snippetService.deleteById(activeSnippet.id)
      setSnippets((prev) => prev.filter((s) => s.id !== activeSnippet.id))
      setTotal((t) => Math.max(0, t - 1))
      toast.success('Snippet deleted')
      setModal(null)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to delete snippet')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Code Snippets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Save and manage reusable code snippets with version history.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Snippet
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search snippets…"
            value={search}
            onChange={handleSearchChange}
            className={cn(
              'h-9 w-full rounded-md border border-input bg-background',
              'pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring',
            )}
          />
        </div>
        <Select value={langFilter} onValueChange={(v) => { setLangFilter(v); setPage(1) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All languages" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All languages</SelectItem>
            {LANGUAGE_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Language</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Version</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Created</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-8" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-7 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : snippets.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileCode2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-foreground">No snippets yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {debouncedSearch || langFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Create your first code snippet to get started'}
                    </p>
                    {!debouncedSearch && langFilter === 'all' && (
                      <Button className="mt-4" onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Snippet
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              snippets.map((snippet) => (
                <tr
                  key={snippet.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{snippet.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant="info">{getLangLabel(snippet.language)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    v{snippet.version}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {formatDate(snippet.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openHistory(snippet)}
                        title="Version history"
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(snippet)}
                        title="Edit"
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDelete(snippet)}
                        title="Delete"
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} snippet{total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modal === 'create-edit'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-3xl">
          <ModalHeader>
            <ModalTitle>{activeSnippet ? 'Edit Snippet' : 'New Snippet'}</ModalTitle>
            <ModalDescription>
              {activeSnippet
                ? 'Update your snippet — a new version will be saved automatically.'
                : 'Save a reusable piece of code for later.'}
            </ModalDescription>
          </ModalHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Title"
              placeholder="e.g. JWT middleware"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              error={titleError}
            />
            <Select value={formLang} onValueChange={setFormLang}>
              <SelectTrigger label="Language">
                <SelectValue placeholder="Select language…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {LANGUAGE_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Code</label>
              <div className={cn(
                'rounded-md border overflow-hidden',
                codeError ? 'border-destructive' : 'border-input',
              )}>
                <CodeMirror
                  value={formCode}
                  onChange={setFormCode}
                  theme={theme}
                  extensions={editorExtension}
                  height="300px"
                  basicSetup={{ lineNumbers: true, foldGutter: false }}
                />
              </div>
              {codeError && <p className="text-xs text-destructive">{codeError}</p>}
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : activeSnippet ? 'Update' : 'Create'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Version History Modal */}
      <Modal open={modal === 'history'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-4xl">
          <ModalHeader>
            <ModalTitle>Version History — {activeSnippet?.title}</ModalTitle>
            <ModalDescription>View all past versions of this snippet.</ModalDescription>
          </ModalHeader>
          <div className="flex gap-4" style={{ height: '320px' }}>
            {/* Version list */}
            <div className="w-40 shrink-0 space-y-1 overflow-y-auto">
              {versionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))
              ) : versions.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1 pt-1">No versions found.</p>
              ) : (
                versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersion(v)}
                    className={cn(
                      'w-full text-left rounded-md px-3 py-2 text-sm transition-colors',
                      selectedVersion?.id === v.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <p className="font-medium">v{v.version}</p>
                    <p className="text-xs opacity-70">{formatDate(v.createdAt)}</p>
                  </button>
                ))
              )}
            </div>
            {/* Code preview */}
            <div className="flex-1 overflow-hidden rounded-md border border-border">
              {selectedVersion ? (
                <CodeMirror
                  value={selectedVersion.code}
                  theme={theme}
                  extensions={previewExtension}
                  readOnly
                  height="320px"
                  basicSetup={{ lineNumbers: true, foldGutter: false }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Select a version to preview
                </div>
              )}
            </div>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={modal === 'delete'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Delete Snippet</ModalTitle>
            <ModalDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{activeSnippet?.title}</strong>?{' '}
              All versions will be permanently removed.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="danger" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
