import {
  Box, Flex, Heading, Card, Button, Text, TextField, TextArea,
  Dialog, Table, IconButton, Badge, Callout, Tabs,
} from '@radix-ui/themes'
import { PlusIcon, Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import {
  useQuickMessages, useCreateQuickMessage, useUpdateQuickMessage, useDeleteQuickMessage,
  useMessageBlocks, useCreateMessageBlock, useUpdateMessageBlock, useDeleteMessageBlock,
} from '../hooks/useAdmin'
import ConfirmDialog from '../components/common/ConfirmDialog'
import LoadingCard from '../components/common/LoadingCard'
import type { QuickMessage, MessageBlock, MessageBlockStep } from '../api/types'

// ─── Quick Messages ──────────────────────────────────────────────────────────

function QuickMessagesTab() {
  const { data: msgs = [], isLoading, error } = useQuickMessages()
  const create = useCreateQuickMessage()
  const update = useUpdateQuickMessage()
  const remove = useDeleteQuickMessage()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<QuickMessage | null>(null)
  const [form, setForm] = useState({ name: '', text_es: '', text_en: '', text_pt: '' })
  const [deleting, setDeleting] = useState<QuickMessage | null>(null)
  const [err, setErr] = useState('')

  const openNew = () => { setEditing(null); setForm({ name: '', text_es: '', text_en: '', text_pt: '' }); setOpen(true) }
  const openEdit = (m: QuickMessage) => {
    setEditing(m)
    setForm({ name: m.name, text_es: m.text_es, text_en: m.text_en, text_pt: m.text_pt })
    setOpen(true)
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: form })
      else await create.mutateAsync(form)
      setOpen(false); setErr('')
    } catch (e) { setErr((e as Error).message) }
  }

  if (isLoading) return <LoadingCard />
  if (error) return <Callout.Root color="red"><Callout.Text>{(error as Error).message}</Callout.Text></Callout.Root>

  return (
    <Box>
      <Flex justify="end" mb="3">
        <Button onClick={openNew}><PlusIcon /> Nuevo</Button>
      </Flex>
      <Card>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Nombre</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Texto ES</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {msgs.map((m) => (
              <Table.Row key={m.id}>
                <Table.Cell><Text weight="medium">{m.name}</Text></Table.Cell>
                <Table.Cell><Text size="2" color="gray">{m.text_es.slice(0, 80)}…</Text></Table.Cell>
                <Table.Cell>
                  <Flex gap="2">
                    <IconButton size="1" variant="ghost" onClick={() => openEdit(m)}><Pencil1Icon /></IconButton>
                    <IconButton size="1" variant="ghost" color="red" onClick={() => setDeleting(m)}><TrashIcon /></IconButton>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
            {msgs.length === 0 && <Table.Row><Table.Cell colSpan={3}><Text color="gray" size="2">Sin mensajes.</Text></Table.Cell></Table.Row>}
          </Table.Body>
        </Table.Root>
      </Card>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>{editing ? 'Editar mensaje' : 'Nuevo mensaje rápido'}</Dialog.Title>
          {err && <Callout.Root color="red" mb="2"><Callout.Text>{err}</Callout.Text></Callout.Root>}
          <Flex direction="column" gap="3" mt="3">
            <TextField.Root placeholder="Nombre" value={form.name} onChange={set('name')} />
            <TextArea placeholder="Texto ES" rows={3} value={form.text_es} onChange={set('text_es')} />
            <TextArea placeholder="Texto EN" rows={3} value={form.text_en} onChange={set('text_en')} />
            <TextArea placeholder="Texto PT" rows={3} value={form.text_pt} onChange={set('text_pt')} />
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Cancelar</Button></Dialog.Close>
            <Button onClick={handleSave} loading={create.isPending || update.isPending}>Guardar</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar mensaje" description={`¿Eliminar "${deleting?.name}"?`}
        onConfirm={async () => { if (deleting) { await remove.mutateAsync(deleting.id); setDeleting(null) } }}
        loading={remove.isPending}
      />
    </Box>
  )
}

// ─── Message Blocks ──────────────────────────────────────────────────────────

function emptyStep(order: number): Omit<MessageBlockStep, 'id'> {
  return { step_order: order, text_es: '', text_en: '', text_pt: '' }
}

function MessageBlocksTab() {
  const { data: blocks = [], isLoading, error } = useMessageBlocks()
  const create = useCreateMessageBlock()
  const remove = useDeleteMessageBlock()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: '' })
  const [steps, setSteps] = useState<Array<Omit<MessageBlockStep, 'id'>>>([emptyStep(1)])
  const [deleting, setDeleting] = useState<MessageBlock | null>(null)
  const [err, setErr] = useState('')

  const openNew = () => {
    setForm({ name: '', description: '', category: '' })
    setSteps([emptyStep(1)])
    setOpen(true)
    setErr('')
  }

  const handleSave = async () => {
    try {
      await create.mutateAsync({ ...form, steps })
      setOpen(false)
    } catch (e) { setErr((e as Error).message) }
  }

  if (isLoading) return <LoadingCard />
  if (error) return <Callout.Root color="red"><Callout.Text>{(error as Error).message}</Callout.Text></Callout.Root>

  return (
    <Box>
      <Flex justify="end" mb="3">
        <Button onClick={openNew}><PlusIcon /> Nuevo bloque</Button>
      </Flex>
      <Flex direction="column" gap="3">
        {blocks.map((b) => (
          <Card key={b.id}>
            <Flex align="start" justify="between">
              <Box>
                <Text weight="bold">{b.name}</Text>
                {b.category && <Badge size="1" color="pink" ml="2">{b.category}</Badge>}
                <Text size="2" color="gray" as="p" mt="1">{b.description}</Text>
                <Text size="1" color="gray">{b.steps.length} pasos</Text>
              </Box>
              <IconButton size="1" variant="ghost" color="red" onClick={() => setDeleting(b)}><TrashIcon /></IconButton>
            </Flex>
          </Card>
        ))}
        {blocks.length === 0 && <Text color="gray" size="2">Sin bloques.</Text>}
      </Flex>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="560px">
          <Dialog.Title>Nuevo bloque de mensajes</Dialog.Title>
          {err && <Callout.Root color="red" mb="2"><Callout.Text>{err}</Callout.Text></Callout.Root>}
          <Flex direction="column" gap="3" mt="3">
            <TextField.Root placeholder="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextField.Root placeholder="Descripción" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <TextField.Root placeholder="Categoría" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            <Heading size="2">Pasos</Heading>
            {steps.map((step, i) => (
              <Card key={i}>
                <Text size="1" color="gray" mb="2">Paso {i + 1}</Text>
                <Flex direction="column" gap="2">
                  <TextArea placeholder="Texto ES" rows={2} value={step.text_es}
                    onChange={(e) => setSteps((s) => s.map((x, j) => j === i ? { ...x, text_es: e.target.value } : x))} />
                  <TextArea placeholder="Texto EN" rows={2} value={step.text_en}
                    onChange={(e) => setSteps((s) => s.map((x, j) => j === i ? { ...x, text_en: e.target.value } : x))} />
                  <TextArea placeholder="Texto PT" rows={2} value={step.text_pt}
                    onChange={(e) => setSteps((s) => s.map((x, j) => j === i ? { ...x, text_pt: e.target.value } : x))} />
                </Flex>
              </Card>
            ))}
            <Button variant="soft" size="1" onClick={() => setSteps((s) => [...s, emptyStep(s.length + 1)])}>
              + Añadir paso
            </Button>
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Cancelar</Button></Dialog.Close>
            <Button onClick={handleSave} loading={create.isPending}>Crear bloque</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar bloque" description={`¿Eliminar "${deleting?.name}"?`}
        onConfirm={async () => { if (deleting) { await remove.mutateAsync(deleting.id); setDeleting(null) } }}
        loading={remove.isPending}
      />
    </Box>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QuickMessagesPage() {
  return (
    <Box>
      <Heading size="5" mb="4">Mensajes Rápidos &amp; Bloques</Heading>
      <Tabs.Root defaultValue="quick">
        <Tabs.List mb="4">
          <Tabs.Trigger value="quick">Mensajes Rápidos</Tabs.Trigger>
          <Tabs.Trigger value="blocks">Bloques</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="quick"><QuickMessagesTab /></Tabs.Content>
        <Tabs.Content value="blocks"><MessageBlocksTab /></Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}
