import {
  Box, Flex, Heading, Card, Button, Text, TextField, TextArea,
  Dialog, IconButton, Badge, Callout, Separator, Checkbox, ScrollArea,
} from '@radix-ui/themes'
import {
  PlusIcon, Pencil1Icon, TrashIcon, ChevronDownIcon, ChevronUpIcon,
  CheckIcon, LayersIcon, EyeOpenIcon,
} from '@radix-ui/react-icons'
import { useState } from 'react'
import {
  useBatches, useCreateBatch, useUpdateBatch, useDeleteBatch, useActivateBatch,
  useBatchMessages, useAddMessage, useUpdateMessage, useDeleteMessage,
} from '../hooks/useBatches'
import { useStripeLinks } from '../hooks/useStripeLinks'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StatusBadge from '../components/common/StatusBadge'
import LoadingCard from '../components/common/LoadingCard'
import type { Batch, BatchMessage, StripLink } from '../api/types'

// ─── Message Detail Dialog ───────────────────────────────────────────────────

function MessageDetailDialog({ msg, open, onOpenChange }: { msg: BatchMessage | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!msg) return null
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>#{msg.sequence_order} — {msg.title}</Dialog.Title>
        <ScrollArea style={{ maxHeight: '70vh' }}>
          <Flex direction="column" gap="3" mt="2">
            {msg.image_url && (
              <img
                src={msg.image_url}
                alt={msg.title}
                style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }}
              />
            )}
            <Box>
              <Text size="1" color="gray" weight="medium">🇪🇸 Español</Text>
              <Text as="p" size="2" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                {msg.text_translations?.es ?? msg.text}
              </Text>
            </Box>
            {msg.text_translations?.en && (
              <Box>
                <Text size="1" color="gray" weight="medium">🇬🇧 English</Text>
                <Text as="p" size="2" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{msg.text_translations.en}</Text>
              </Box>
            )}
            {msg.text_translations?.pt && (
              <Box>
                <Text size="1" color="gray" weight="medium">🇧🇷 Português</Text>
                <Text as="p" size="2" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{msg.text_translations.pt}</Text>
              </Box>
            )}
            {msg.strip_links && msg.strip_links.length > 0 && (
              <Box>
                <Text size="1" color="gray" weight="medium" mb="1">Links adjuntos</Text>
                <Flex gap="1" wrap="wrap">
                  {msg.strip_links.map((l) => (
                    <Badge key={l.id} color="blue" variant="soft">{l.name}</Badge>
                  ))}
                </Flex>
              </Box>
            )}
          </Flex>
        </ScrollArea>
        <Flex justify="end" mt="4">
          <Dialog.Close><Button variant="soft" color="gray">Cerrar</Button></Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

// ─── Link checkbox selector ───────────────────────────────────────────────────

function LinkCheckboxList({
  links, selectedIds, onChange,
}: { links: StripLink[]; selectedIds: number[]; onChange: (ids: number[]) => void }) {
  const toggle = (id: number) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  return (
    <Flex direction="column" gap="2">
      <Text size="1" color="gray" weight="medium">Links de pago</Text>
      {links.map((l) => (
        <Flex key={l.id} align="center" gap="2" asChild>
          <label style={{ cursor: 'pointer' }}>
            <Checkbox
              checked={selectedIds.includes(l.id)}
              onCheckedChange={() => toggle(l.id)}
            />
            <Text size="2">{l.name}</Text>
            <Text size="1" color="gray">({l.duration_days}d)</Text>
          </label>
        </Flex>
      ))}
      {links.length === 0 && <Text size="1" color="gray">Sin links creados.</Text>}
    </Flex>
  )
}

// ─── Batch Messages sub-panel ────────────────────────────────────────────────

function BatchMessagesPanel({ batch }: { batch: Batch }) {
  const { data: msgs = [], isLoading } = useBatchMessages(batch.id)
  const { data: links = [] } = useStripeLinks()
  const addMsg = useAddMessage()
  const updMsg = useUpdateMessage()
  const delMsg = useDeleteMessage()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<BatchMessage | null>(null)
  const [viewing, setViewing] = useState<BatchMessage | null>(null)
  const [form, setForm] = useState({
    title: '', text_es: '', text_en: '', text_pt: '', sequence_order: '',
    image: null as File | null,
  })
  const [selectedLinkIds, setSelectedLinkIds] = useState<number[]>([])
  const [deleting, setDeleting] = useState<BatchMessage | null>(null)
  const [err, setErr] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const resetForm = () => {
    setForm({ title: '', text_es: '', text_en: '', text_pt: '', sequence_order: '', image: null })
    setSelectedLinkIds([])
    setErr('')
  }

  const openAdd = () => { resetForm(); setEditing(null); setOpen(true) }

  const openEdit = (m: BatchMessage) => {
    setForm({
      title: m.title,
      text_es: m.text_translations?.es ?? m.text ?? '',
      text_en: m.text_translations?.en ?? '',
      text_pt: m.text_translations?.pt ?? '',
      sequence_order: String(m.sequence_order),
      image: null,
    })
    setSelectedLinkIds(m.strip_links?.map((l) => l.id) ?? [])
    setErr('')
    setEditing(m)
    setOpen(true)
  }

  const handleSave = async () => {
    try {
      const payload = {
        title: form.title,
        text_es: form.text_es,
        text_en: form.text_en || undefined,
        text_pt: form.text_pt || undefined,
        sequence_order: form.sequence_order ? Number(form.sequence_order) : undefined,
        strip_link_ids: selectedLinkIds.length ? selectedLinkIds.join(',') : '',
        image: form.image ?? undefined,
      }
      if (editing) {
        await updMsg.mutateAsync({ batchId: batch.id, messageId: editing.id, data: payload })
      } else {
        await addMsg.mutateAsync({ batchId: batch.id, data: payload })
      }
      setOpen(false); resetForm(); setEditing(null)
    } catch (e) { setErr((e as Error).message) }
  }

  const isPending = editing ? updMsg.isPending : addMsg.isPending

  if (isLoading) return <LoadingCard lines={2} />

  return (
    <Box mt="3">
      <Flex align="center" justify="between" mb="2">
        <Text size="2" weight="medium" color="gray">Mensajes ({msgs.length})</Text>
        <Button size="1" variant="soft" onClick={openAdd}>
          <PlusIcon /> Añadir
        </Button>
      </Flex>

      <Flex direction="column" gap="1">
        {msgs.map((m) => (
          <Flex key={m.id} align="center" gap="2" py="1" style={{ borderBottom: '1px solid var(--gray-3)' }}>
            <Badge size="1" color="gray">#{m.sequence_order}</Badge>
            <Text size="2" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</Text>
            {m.image_url && <Badge size="1" color="blue" variant="soft">img</Badge>}
            {m.strip_links?.length > 0 && <Badge size="1" color="purple" variant="soft">{m.strip_links.length} links</Badge>}
            <IconButton size="1" variant="ghost" title="Ver detalle" onClick={() => setViewing(m)}><EyeOpenIcon /></IconButton>
            <IconButton size="1" variant="ghost" title="Editar" onClick={() => openEdit(m)}><Pencil1Icon /></IconButton>
            <IconButton size="1" variant="ghost" color="red" onClick={() => setDeleting(m)}><TrashIcon /></IconButton>
          </Flex>
        ))}
        {msgs.length === 0 && <Text size="2" color="gray">Sin mensajes.</Text>}
      </Flex>

      {/* Detail viewer */}
      <MessageDetailDialog msg={viewing} open={!!viewing} onOpenChange={(v) => !v && setViewing(null)} />

      {/* Add / Edit message dialog */}
      <Dialog.Root open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null) } }}>
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>{editing ? `Editar: ${editing.title}` : 'Añadir mensaje al lote'}</Dialog.Title>
          {err && <Callout.Root color="red" mb="2"><Callout.Text>{err}</Callout.Text></Callout.Root>}
          <ScrollArea style={{ maxHeight: '65vh' }}>
            <Flex direction="column" gap="3" mt="3" pr="2">
              <TextField.Root placeholder="Título" value={form.title} onChange={set('title')} />
              <TextArea placeholder="Texto ES *" rows={4} value={form.text_es} onChange={set('text_es')} />
              <TextArea placeholder="Texto EN" rows={3} value={form.text_en} onChange={set('text_en')} />
              <TextArea placeholder="Texto PT" rows={3} value={form.text_pt} onChange={set('text_pt')} />
              <TextField.Root type="number" placeholder="Orden (opcional)" value={form.sequence_order} onChange={set('sequence_order')} />
              <Separator size="4" />
              <LinkCheckboxList links={links} selectedIds={selectedLinkIds} onChange={setSelectedLinkIds} />
              <Separator size="4" />
              <Box>
                <Text size="1" color="gray" weight="medium" mb="1">
                  {editing ? 'Nueva imagen (deja vacío para mantener la actual)' : 'Imagen (opcional)'}
                </Text>
                {editing && editing.image_url && (
                  <img src={editing.image_url} alt="actual" style={{ maxWidth: 120, borderRadius: 6, display: 'block', marginBottom: 6 }} />
                )}
                <input type="file" accept="image/*"
                  onChange={(e) => setForm((f) => ({ ...f, image: e.target.files?.[0] ?? null }))}
                  style={{ fontSize: 13 }} />
              </Box>
            </Flex>
          </ScrollArea>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Cancelar</Button></Dialog.Close>
            <Button onClick={handleSave} loading={isPending}>
              {editing ? 'Guardar cambios' : 'Añadir'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar mensaje" description={`¿Eliminar "${deleting?.title}"?`}
        onConfirm={async () => {
          if (deleting) {
            await delMsg.mutateAsync({ batchId: batch.id, messageId: deleting.id })
            setDeleting(null)
          }
        }}
        loading={delMsg.isPending}
      />
    </Box>
  )
}

// ─── Batch Card ───────────────────────────────────────────────────────────────

function BatchCard({
  batch,
  onEdit,
  onDelete,
  onActivate,
}: {
  batch: Batch
  onEdit: (b: Batch) => void
  onDelete: (b: Batch) => void
  onActivate: (b: Batch) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card mb="3">
      <Flex align="center" gap="3">
        <Box style={{ flex: 1 }}>
          <Flex align="center" gap="2" mb="1">
            <Text weight="bold" size="3">{batch.name}</Text>
            <StatusBadge active={batch.is_active} />
            <Badge size="1" color="gray">#{batch.order}</Badge>
            <Badge size="1">{batch.message_count} msgs</Badge>
          </Flex>
          {batch.description && <Text size="2" color="gray">{batch.description}</Text>}
        </Box>
        <Flex gap="1">
          {!batch.is_active && (
            <Button size="1" variant="soft" color="green" onClick={() => onActivate(batch)}>
              <CheckIcon /> Activar
            </Button>
          )}
          <IconButton size="1" variant="ghost" onClick={() => onEdit(batch)}><Pencil1Icon /></IconButton>
          <IconButton size="1" variant="ghost" color="red" onClick={() => onDelete(batch)}><TrashIcon /></IconButton>
          <IconButton size="1" variant="ghost" onClick={() => setExpanded((e) => !e)}>
            {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </IconButton>
        </Flex>
      </Flex>
      {expanded && (
        <>
          <Separator size="4" mt="3" mb="1" />
          <BatchMessagesPanel batch={batch} />
        </>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchesPage() {
  const { data: batches = [], isLoading, error } = useBatches()
  const createBatch = useCreateBatch()
  const updateBatch = useUpdateBatch()
  const deleteBatch = useDeleteBatch()
  const activateBatch = useActivateBatch()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Batch | null>(null)
  const [form, setForm] = useState({ name: '', description: '', order: '' })
  const [deleting, setDeleting] = useState<Batch | null>(null)
  const [activating, setActivating] = useState<Batch | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const openNew = () => { setEditing(null); setForm({ name: '', description: '', order: '' }); setOpen(true) }
  const openEdit = (b: Batch) => {
    setEditing(b)
    setForm({ name: b.name, description: b.description ?? '', order: String(b.order) })
    setOpen(true)
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    const data = {
      name: form.name,
      description: form.description || undefined,
      order: form.order ? Number(form.order) : undefined,
    }
    try {
      if (editing) await updateBatch.mutateAsync({ id: editing.id, data })
      else await createBatch.mutateAsync(data)
      setOpen(false)
      setFeedback({ ok: true, msg: editing ? 'Lote actualizado.' : 'Lote creado.' })
    } catch (e) { setFeedback({ ok: false, msg: (e as Error).message }) }
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleActivate = async () => {
    if (!activating) return
    try {
      await activateBatch.mutateAsync(activating.id)
      setFeedback({ ok: true, msg: `Lote "${activating.name}" activado.` })
    } catch (e) { setFeedback({ ok: false, msg: (e as Error).message }) }
    setActivating(null)
    setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <Box>
      <Flex align="center" justify="between" mb="4">
        <Heading size="5">Lotes de Mensajes</Heading>
        <Button onClick={openNew}><PlusIcon /> Nuevo lote</Button>
      </Flex>

      {feedback && (
        <Callout.Root color={feedback.ok ? 'green' : 'red'} mb="3">
          <Callout.Text>{feedback.msg}</Callout.Text>
        </Callout.Root>
      )}

      {isLoading ? <LoadingCard /> : error ? (
        <Callout.Root color="red"><Callout.Text>{(error as Error).message}</Callout.Text></Callout.Root>
      ) : batches.length === 0 ? (
        <Card>
          <Flex align="center" direction="column" gap="3" py="6">
            <LayersIcon width={32} height={32} color="var(--gray-8)" />
            <Text color="gray">No hay lotes. Crea el primero.</Text>
          </Flex>
        </Card>
      ) : (
        batches.map((b) => (
          <BatchCard
            key={b.id}
            batch={b}
            onEdit={openEdit}
            onDelete={setDeleting}
            onActivate={setActivating}
          />
        ))
      )}

      {/* Form Dialog */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="440px">
          <Dialog.Title>{editing ? 'Editar lote' : 'Nuevo lote'}</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <TextField.Root placeholder="Nombre *" value={form.name} onChange={set('name')} />
            <TextArea placeholder="Descripción" rows={3} value={form.description} onChange={set('description')} />
            <TextField.Root type="number" placeholder="Orden" value={form.order} onChange={set('order')} />
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Cancelar</Button></Dialog.Close>
            <Button onClick={handleSave} loading={createBatch.isPending || updateBatch.isPending}>
              Guardar
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar lote"
        description={`¿Eliminar el lote "${deleting?.name}"? Se eliminarán todos sus mensajes.`}
        onConfirm={async () => { if (deleting) { await deleteBatch.mutateAsync(deleting.id); setDeleting(null) } }}
        loading={deleteBatch.isPending}
      />

      {/* Activate confirm */}
      <ConfirmDialog
        open={!!activating} onOpenChange={(o) => !o && setActivating(null)}
        title="Activar lote"
        description={`¿Activar el lote "${activating?.name}"? Pasará a ser el lote de envío activo.`}
        onConfirm={handleActivate}
        confirmLabel="Activar"
        confirmColor="green"
        loading={activateBatch.isPending}
      />
    </Box>
  )
}
