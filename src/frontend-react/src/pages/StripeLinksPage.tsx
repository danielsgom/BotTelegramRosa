import {
  Box, Flex, Heading, Card, Button, Text, TextField, TextArea,
  Dialog, Table, IconButton, Callout,
} from '@radix-ui/themes'
import { PlusIcon, Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import { useStripeLinks, useCreateStripeLink, useUpdateStripeLink, useDeleteStripeLink } from '../hooks/useStripeLinks'
import ConfirmDialog from '../components/common/ConfirmDialog'
import LoadingCard from '../components/common/LoadingCard'
import type { StripLink } from '../api/types'

interface FormState {
  name: string; url: string; language: string; duration_days: string
  stripe_link_id: string; name_es: string; name_en: string; name_pt: string
}

const EMPTY: FormState = { name: '', url: '', language: '', duration_days: '', stripe_link_id: '', name_es: '', name_en: '', name_pt: '' }

function toFormState(l: StripLink): FormState {
  return {
    name: l.name, url: l.url, language: l.language ?? '', duration_days: String(l.duration_days ?? ''),
    stripe_link_id: l.stripe_link_id ?? '',
    name_es: l.name_translations?.es ?? '',
    name_en: l.name_translations?.en ?? '',
    name_pt: l.name_translations?.pt ?? '',
  }
}

export default function StripeLinksPage() {
  const { data: links = [], isLoading, error } = useStripeLinks()
  const create = useCreateStripeLink()
  const update = useUpdateStripeLink()
  const remove = useDeleteStripeLink()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StripLink | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleting, setDeleting] = useState<StripLink | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (l: StripLink) => { setEditing(l); setForm(toFormState(l)); setOpen(true) }
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    const payload = {
      name: form.name, url: form.url, language: form.language || undefined,
      duration_days: form.duration_days ? Number(form.duration_days) : undefined,
      stripe_link_id: form.stripe_link_id || undefined,
      name_es: form.name_es || undefined, name_en: form.name_en || undefined, name_pt: form.name_pt || undefined,
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: payload })
      else await create.mutateAsync(payload)
      setOpen(false)
      setFeedback({ ok: true, msg: editing ? 'Link actualizado.' : 'Link creado.' })
    } catch (e) {
      setFeedback({ ok: false, msg: (e as Error).message })
    }
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleDelete = async () => {
    if (!deleting) return
    try { await remove.mutateAsync(deleting.id) } catch { /* ignore */ }
    setDeleting(null)
  }

  return (
    <Box>
      <Flex align="center" justify="between" mb="4">
        <Heading size="5">Links de Pago (Stripe)</Heading>
        <Button onClick={openNew}><PlusIcon /> Nuevo link</Button>
      </Flex>

      {feedback && (
        <Callout.Root color={feedback.ok ? 'green' : 'red'} mb="3">
          <Callout.Text>{feedback.msg}</Callout.Text>
        </Callout.Root>
      )}

      {isLoading ? <LoadingCard /> : error ? (
        <Callout.Root color="red"><Callout.Text>{(error as Error).message}</Callout.Text></Callout.Root>
      ) : (
        <Card>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Nombre</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>URL</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Idioma</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Días</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {links.map((l) => (
                <Table.Row key={l.id}>
                  <Table.Cell>{l.name}</Table.Cell>
                  <Table.Cell>
                    <Text size="1" style={{ wordBreak: 'break-all', maxWidth: 260, display: 'block' }}>{l.url}</Text>
                  </Table.Cell>
                  <Table.Cell>{l.language ?? '—'}</Table.Cell>
                  <Table.Cell>{l.duration_days ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <Flex gap="2">
                      <IconButton size="1" variant="ghost" onClick={() => openEdit(l)}><Pencil1Icon /></IconButton>
                      <IconButton size="1" variant="ghost" color="red" onClick={() => setDeleting(l)}><TrashIcon /></IconButton>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
              {links.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={5}><Text color="gray" size="2">Sin links.</Text></Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>{editing ? 'Editar link' : 'Nuevo link de pago'}</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <TextField.Root placeholder="Nombre" value={form.name} onChange={set('name')} />
            <TextField.Root placeholder="URL de pago" value={form.url} onChange={set('url')} />
            <TextField.Root placeholder="stripe_link_id" value={form.stripe_link_id} onChange={set('stripe_link_id')} />
            <TextField.Root placeholder="Idioma (es/en/pt)" value={form.language} onChange={set('language')} />
            <TextField.Root type="number" placeholder="Duración (días)" value={form.duration_days} onChange={set('duration_days')} />
            <TextField.Root placeholder="Nombre ES" value={form.name_es} onChange={set('name_es')} />
            <TextField.Root placeholder="Nombre EN" value={form.name_en} onChange={set('name_en')} />
            <TextField.Root placeholder="Nombre PT" value={form.name_pt} onChange={set('name_pt')} />
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Cancelar</Button></Dialog.Close>
            <Button onClick={handleSave} loading={create.isPending || update.isPending}>Guardar</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar link" description={`¿Eliminar "${deleting?.name}"?`}
        onConfirm={handleDelete} loading={remove.isPending}
      />
    </Box>
  )
}
