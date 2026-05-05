import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  FolderOpen,
  Folder,
  Pencil,
  Trash2,
  Share2,
  Link,
  X,
  FileCode2,
  GitBranch,
  Check,
  Search,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { loadLanguage } from '@uiw/codemirror-extensions-langs'
import type { LanguageName } from '@uiw/codemirror-extensions-langs'
import { useThemeStore } from '@/store/themeStore'
import { collectionService } from '@/services/collectionService'
import { reviewService } from '@/services/reviewService'
import { snippetService } from '@/services/snippetService'
import type { Collection, CollectionItem, CollectionItemType, Snippet, SnippetVersion } from '@/types/snippet'
import { ROUTES } from '@/constants/routes'
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
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

type ModalType =
  | 'create'
  | 'rename'
  | 'delete-coll'
  | 'add-item'
  | 'share'
  | 'delete-items'
  | 'snippet-detail'
  | null

// ── Item type icon ─────────────────────────────────────────────────────────────

function ItemTypeIcon({ type }: { type: CollectionItemType }) {
  return type === 'SNIPPET'
    ? <FileCode2 className="h-4 w-4 text-muted-foreground shrink-0" />
    : <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
}

// ── CollectionsPage ────────────────────────────────────────────────────────────

export default function CollectionsPage() {
  // Collections list
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  // Selected collection & its items
  const [selected, setSelected] = useState<Collection | null>(null)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  // Modal state
  const [modal, setModal] = useState<ModalType>(null)
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null)

  // Form: create / rename
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [nameError, setNameError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form: add item
  const [addType, setAddType] = useState<CollectionItemType>('REVIEW')
  const [addItems, setAddItems] = useState<{ id: string; title: string; subtitle: string }[]>([])
  const [addItemsLoading, setAddItemsLoading] = useState(false)
  const [addItemSearch, setAddItemSearch] = useState('')
  const [addSelectedId, setAddSelectedId] = useState<string | null>(null)
  const [addSelectedTitle, setAddSelectedTitle] = useState('')

  // Share
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)

  // Snippet detail modal
  const [snippetDetail, setSnippetDetail] = useState<Snippet | null>(null)
  const [snippetDetailLoading, setSnippetDetailLoading] = useState(false)
  const [snippetVersions, setSnippetVersions] = useState<SnippetVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<SnippetVersion | null>(null)

  const navigate = useNavigate()
  const cmTheme = useThemeStore((s) => (s.theme === 'dark' ? 'dark' : 'light')) as 'dark' | 'light'
  const snippetExtension = useMemo(() => {
    if (!snippetDetail) return []
    const lang = loadLanguage(snippetDetail.language as LanguageName)
    return lang ? [lang] : []
  }, [snippetDetail])

  // Fetch collections
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    collectionService
      .list()
      .then((data) => { if (!cancelled) setCollections(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setCollections([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Fetch items when a collection is selected
  async function selectCollection(coll: Collection) {
    setSelected(coll)
    setCheckedItems(new Set())
    setItemsLoading(true)
    try {
      const detail = await collectionService.getById(coll.id)
      setItems(detail.items ?? [])
    } catch {
      setItems([])
    } finally {
      setItemsLoading(false)
    }
  }

  // ── Create collection ──────────────────────────────────────────────────────

  function openCreate() {
    setFormName('')
    setFormDesc('')
    setNameError('')
    setModal('create')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) { setNameError('Name is required'); return }
    setNameError('')
    setSubmitting(true)
    try {
      const created = await collectionService.create({
        name: formName.trim(),
        description: formDesc.trim() || undefined,
      })
      setCollections((prev) => [created, ...prev])
      toast.success('Collection created')
      setModal(null)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to create collection')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Rename collection ──────────────────────────────────────────────────────

  function openRename(coll: Collection) {
    setActiveCollection(coll)
    setFormName(coll.name)
    setFormDesc(coll.description ?? '')
    setNameError('')
    setModal('rename')
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) { setNameError('Name is required'); return }
    if (!activeCollection) return
    setNameError('')
    setSubmitting(true)
    try {
      const updated = await collectionService.update(activeCollection.id, {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
      })
      setCollections((prev) => prev.map((c) => c.id === updated.id ? updated : c))
      if (selected?.id === updated.id) setSelected(updated)
      toast.success('Collection renamed')
      setModal(null)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to rename collection')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete collection ──────────────────────────────────────────────────────

  function openDeleteColl(coll: Collection) {
    setActiveCollection(coll)
    setModal('delete-coll')
  }

  async function handleDeleteColl() {
    if (!activeCollection) return
    setSubmitting(true)
    try {
      await collectionService.deleteById(activeCollection.id)
      setCollections((prev) => prev.filter((c) => c.id !== activeCollection.id))
      if (selected?.id === activeCollection.id) {
        setSelected(null)
        setItems([])
      }
      toast.success('Collection deleted')
      setModal(null)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to delete collection')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Add item ───────────────────────────────────────────────────────────────

  async function fetchAddItems(type: CollectionItemType) {
    setAddItemsLoading(true)
    setAddSelectedId(null)
    setAddSelectedTitle('')
    setAddItemSearch('')
    try {
      if (type === 'REVIEW') {
        const data = await reviewService.list({ limit: 100 })
        setAddItems(
          data.reviews.map((r) => ({
            id: r.id,
            title: r.title || `Review ${r.id.slice(0, 8)}`,
            subtitle: r.language,
          })),
        )
      } else {
        const data = await snippetService.list({ limit: 100 })
        setAddItems(
          data.snippets.map((s) => ({
            id: s.id,
            title: s.title,
            subtitle: s.language,
          })),
        )
      }
    } catch {
      setAddItems([])
    } finally {
      setAddItemsLoading(false)
    }
  }

  function openAddItem() {
    setAddType('REVIEW')
    setAddItems([])
    setAddItemSearch('')
    setAddSelectedId(null)
    setAddSelectedTitle('')
    setModal('add-item')
    void fetchAddItems('REVIEW')
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !addSelectedId) return

    setSubmitting(true)
    try {
      const item = await collectionService.addItem(selected.id, {
        type: addType,
        referenceId: addSelectedId,
        title: addSelectedTitle,
      })
      setItems((prev) => [...prev, item])
      setCollections((prev) =>
        prev.map((c) => c.id === selected.id ? { ...c, itemCount: c.itemCount + 1 } : c),
      )
      toast.success('Item added to collection')
      setModal(null)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to add item')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Remove individual item ─────────────────────────────────────────────────

  async function removeItem(item: CollectionItem) {
    if (!selected) return
    try {
      await collectionService.removeItem(selected.id, item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setCollections((prev) =>
        prev.map((c) => c.id === selected.id ? { ...c, itemCount: Math.max(0, c.itemCount - 1) } : c),
      )
      toast.success('Item removed')
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to remove item')
    }
  }

  // ── Bulk delete items ──────────────────────────────────────────────────────

  async function handleBulkDelete() {
    if (!selected || checkedItems.size === 0) return
    setSubmitting(true)
    const ids = Array.from(checkedItems)
    try {
      await Promise.all(ids.map((id) => collectionService.removeItem(selected.id, id)))
      setItems((prev) => prev.filter((i) => !checkedItems.has(i.id)))
      setCollections((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, itemCount: Math.max(0, c.itemCount - ids.length) }
            : c,
        ),
      )
      setCheckedItems(new Set())
      toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} removed`)
      setModal(null)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to remove items')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Share collection ───────────────────────────────────────────────────────

  async function openShare(coll: Collection) {
    setActiveCollection(coll)
    setShareUrl('')
    setCopied(false)
    setModal('share')
    setSubmitting(true)
    try {
      const result = await collectionService.share(coll.id)
      setShareUrl(result.shareUrl)
      setCollections((prev) =>
        prev.map((c) => c.id === coll.id ? { ...c, shareToken: result.shareToken } : c),
      )
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to generate share link')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  // ── Checkbox helpers ───────────────────────────────────────────────────────

  function toggleItem(id: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (checkedItems.size === items.length) {
      setCheckedItems(new Set())
    } else {
      setCheckedItems(new Set(items.map((i) => i.id)))
    }
  }

  // ── Item click ────────────────────────────────────────────────────────────

  async function openSnippetDetail(referenceId: string) {
    setSnippetDetail(null)
    setSnippetVersions([])
    setSelectedVersion(null)
    setSnippetDetailLoading(true)
    setModal('snippet-detail')
    try {
      const [snippet, versions] = await Promise.all([
        snippetService.getById(referenceId),
        snippetService.getVersions(referenceId),
      ])
      setSnippetDetail(snippet)
      setSnippetVersions(versions)
      setSelectedVersion(versions[0] ?? null)
    } catch {
      toast.error('Failed to load snippet')
      setModal(null)
    } finally {
      setSnippetDetailLoading(false)
    }
  }

  function handleItemClick(item: CollectionItem) {
    if (item.type === 'REVIEW') {
      navigate(ROUTES.REVIEW_DETAIL(item.referenceId))
    } else {
      void openSnippetDetail(item.referenceId)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const filteredAddItems = addItems.filter((item) =>
    item.title.toLowerCase().includes(addItemSearch.toLowerCase()),
  )

  return (
    <div className="p-8 space-y-6 w-full max-w-480">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Collections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize reviews and snippets into shareable folders.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Collection
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className={cn('flex gap-6', selected ? 'items-start' : '')}>
        {/* ── Collections grid ── */}
        <div className={cn('flex-1', selected ? 'max-w-xs' : '')}>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FolderOpen className="h-14 w-14 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No collections yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a collection to start organizing your reviews and snippets.
              </p>
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                New Collection
              </Button>
            </div>
          ) : (
            <div className={cn('grid gap-4', selected ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3')}>
              {collections.map((coll) => (
                <div
                  key={coll.id}
                  className={cn(
                    'group rounded-lg border bg-card p-4 transition-all cursor-pointer',
                    selected?.id === coll.id
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-primary/50',
                  )}
                  onClick={() => selectCollection(coll)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder className="h-5 w-5 shrink-0 text-primary" />
                      <p className="font-medium text-foreground truncate">{coll.name}</p>
                    </div>
                    {/* Actions */}
                    <div
                      className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openShare(coll)}
                        title="Share"
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openRename(coll)}
                        title="Rename"
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteColl(coll)}
                        title="Delete"
                        className="rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {coll.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                      {coll.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="secondary">{coll.itemCount} item{coll.itemCount !== 1 ? 's' : ''}</Badge>
                    {coll.shareToken && (
                      <Badge variant="info">
                        <Link className="h-3 w-3" />
                        Shared
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{formatDate(coll.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-card">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <Folder className="h-4 w-4 shrink-0 text-primary" />
                <h2 className="font-semibold text-foreground truncate">{selected.name}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {checkedItems.size > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setModal('delete-items')}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Remove {checkedItems.size}
                  </Button>
                )}
                <Button size="sm" onClick={openAddItem}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Item
                </Button>
                <button
                  onClick={() => { setSelected(null); setItems([]); setCheckedItems(new Set()) }}
                  className="ml-1 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Items list */}
            {itemsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">This collection is empty</p>
                <p className="text-xs text-muted-foreground mt-1">Add reviews or snippets to get started.</p>
                <Button size="sm" className="mt-3" onClick={openAddItem}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Item
                </Button>
              </div>
            ) : (
              <div>
                {/* Select all row */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
                  <input
                    type="checkbox"
                    checked={checkedItems.size === items.length && items.length > 0}
                    onChange={toggleAll}
                    className="rounded border-border"
                    aria-label="Select all items"
                  />
                  <span className="text-xs text-muted-foreground">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checkedItems.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="rounded border-border shrink-0"
                      aria-label={`Select ${item.title}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left hover:text-primary transition-colors"
                    >
                      <ItemTypeIcon type={item.type} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.type === 'SNIPPET' ? 'Snippet' : 'Review'} · {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => removeItem(item)}
                      title="Remove from collection"
                      className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Create Collection Modal ── */}
      <Modal open={modal === 'create'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>New Collection</ModalTitle>
            <ModalDescription>Create a folder to organize your reviews and snippets.</ModalDescription>
          </ModalHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Name"
              placeholder="e.g. Auth helpers"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              error={nameError}
            />
            <Input
              label="Description (optional)"
              placeholder="What is this collection for?"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ── Rename Collection Modal ── */}
      <Modal open={modal === 'rename'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Rename Collection</ModalTitle>
            <ModalDescription>Update the name and description of this collection.</ModalDescription>
          </ModalHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <Input
              label="Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              error={nameError}
            />
            <Input
              label="Description (optional)"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ── Delete Collection Modal ── */}
      <Modal open={modal === 'delete-coll'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Delete Collection</ModalTitle>
            <ModalDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{activeCollection?.name}</strong>?{' '}
              The items themselves won't be deleted, only the collection folder.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="danger" disabled={submitting} onClick={handleDeleteColl}>
              {submitting ? 'Deleting…' : 'Delete'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Add Item Modal ── */}
      <Modal open={modal === 'add-item'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Add Item</ModalTitle>
            <ModalDescription>
              Select a review or snippet to add to{' '}
              <strong className="text-foreground">{selected?.name}</strong>.
            </ModalDescription>
          </ModalHeader>
          <form onSubmit={handleAddItem} className="space-y-3">
            <Select
              value={addType}
              onValueChange={(v) => {
                const t = v as CollectionItemType
                setAddType(t)
                void fetchAddItems(t)
              }}
            >
              <SelectTrigger label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REVIEW">Review</SelectItem>
                <SelectItem value="SNIPPET">Snippet</SelectItem>
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder={`Search ${addType === 'REVIEW' ? 'reviews' : 'snippets'}…`}
                value={addItemSearch}
                onChange={(e) => setAddItemSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Picker list */}
            <div className="rounded-md border border-border overflow-y-auto max-h-52">
              {addItemsLoading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded" />
                  ))}
                </div>
              ) : filteredAddItems.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  No {addType === 'REVIEW' ? 'reviews' : 'snippets'} found
                </div>
              ) : (
                filteredAddItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setAddSelectedId(item.id); setAddSelectedTitle(item.title) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm border-b border-border last:border-0 transition-colors',
                      addSelectedId === item.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50 text-foreground',
                    )}
                  >
                    {addType === 'SNIPPET'
                      ? <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                    {addSelectedId === item.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))
              )}
            </div>

            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !addSelectedId}>
                {submitting ? 'Adding…' : 'Add'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ── Share Modal ── */}
      <Modal open={modal === 'share'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Share Collection</ModalTitle>
            <ModalDescription>
              Anyone with this link can view{' '}
              <strong className="text-foreground">{activeCollection?.name}</strong>.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-3">
            {submitting ? (
              <Skeleton className="h-9 w-full rounded-md" />
            ) : shareUrl ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground truncate">
                  {shareUrl}
                </div>
                <Button size="sm" variant="secondary" onClick={copyShareUrl}>
                  {copied ? <Check className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Failed to generate link.</p>
            )}
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Bulk Delete Items Modal ── */}
      <Modal open={modal === 'delete-items'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Remove Items</ModalTitle>
            <ModalDescription>
              Remove{' '}
              <strong className="text-foreground">
                {checkedItems.size} item{checkedItems.size !== 1 ? 's' : ''}
              </strong>{' '}
              from this collection? The items themselves won't be deleted.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="danger" disabled={submitting} onClick={handleBulkDelete}>
              {submitting ? 'Removing…' : 'Remove'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Snippet Detail Modal ── */}
      <Modal open={modal === 'snippet-detail'} onOpenChange={(open) => !open && setModal(null)}>
        <ModalContent className="max-w-4xl">
          <ModalHeader>
            <ModalTitle>{snippetDetail?.title ?? 'Snippet'}</ModalTitle>
            <ModalDescription>
              {snippetDetail
                ? `${snippetDetail.language} · v${snippetDetail.version}`
                : 'Loading snippet…'}
            </ModalDescription>
          </ModalHeader>
          {snippetDetailLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-6 w-1/3 rounded" />
              <Skeleton className="h-64 w-full rounded-md" />
            </div>
          ) : snippetDetail ? (
            <div className="flex gap-4" style={{ height: '340px' }}>
              {/* Version list */}
              <div className="w-36 shrink-0 space-y-1 overflow-y-auto">
                {snippetVersions.map((v) => (
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
                ))}
              </div>
              {/* Code preview */}
              <div className="flex-1 overflow-hidden rounded-md border border-border">
                {selectedVersion ? (
                  <CodeMirror
                    value={selectedVersion.code}
                    theme={cmTheme}
                    extensions={snippetExtension}
                    readOnly
                    height="340px"
                    basicSetup={{ lineNumbers: true, foldGutter: false }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Select a version to preview
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
