import {
  Box, Flex, Heading, Card, Button, Text, TextField, TextArea,
  Dialog, Table, IconButton, Badge, Callout, Switch,
} from '@radix-ui/themes'
import { PlusIcon, Pencil1Icon, TrashIcon, ReloadIcon, PlayIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import { useUsers, useUpdateUser, useDeleteUser, useResumeSequence } from '../hooks/useUsers'
import StatusBadge from '../components/common/StatusBadge'
import ConfirmDialog from '../components/common/ConfirmDialog'
import LoadingCard from '../components/common/LoadingCard'
import type { User } from '../api/types'

function fmt(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('es-ES')
}

export default function UsersPage() {
  const { data: users = [], isLoading, error, refetch, isFetching } = useUsers()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const resumeSeq = useResumeSequence()

  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', language: '', is_active: true, is_vip: false })
  const [deleting, setDeleting] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      first_name: u.first_name ?? '', last_name: u.last_name ?? '',
      username: u.username ?? '', language: u.language ?? '',
      is_active: u.is_active, is_vip: u.is_vip,
    })
  }

  const handleSave = async () => {
    if (!editing) return
    try {
      await updateUser.mutateAsync({ id: editing.id, data: form })
      setEditing(null)
      setFeedback({ ok: true, msg: 'Usuario actualizado.' })
    } catch (e) { setFeedback({ ok: false, msg: (e as Error).message }) }
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleDelete = async () => {
    if (!deleting) return
    try { await deleteUser.mutateAsync(deleting.id) } catch { /* ignore */ }
    setDeleting(null)
  }

  const handleResume = async (id: number) => {
    try {
      await resumeSeq.mutateAsync(id)
      setFeedback({ ok: true, msg: 'Secuencia reanudada.' })
    } catch (e) { setFeedback({ ok: false, msg: (e as Error).message }) }
    setTimeout(() => setFeedback(null), 3000)
  }

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      String(u.telegram_id).includes(q) ||
      (u.first_name ?? '').toLowerCase().includes(q) ||
      (u.last_name ?? '').toLowerCase().includes(q) ||
      (u.username ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <Box>
      <Flex align="center" justify="between" mb="4" gap="3" wrap="wrap">
        <Heading size="5">Usuarios ({users.length})</Heading>
        <Flex gap="2">
          <TextField.Root placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
          <Button variant="soft" size="2" onClick={() => refetch()} loading={isFetching}>
            <ReloadIcon />
          </Button>
        </Flex>
      </Flex>

      {feedback && (
        <Callout.Root color={feedback.ok ? 'green' : 'red'} mb="3">
          <Callout.Text>{feedback.msg}</Callout.Text>
        </Callout.Root>
      )}

      {isLoading ? <LoadingCard lines={5} /> : error ? (
        <Callout.Root color="red"><Callout.Text>{(error as Error).message}</Callout.Text></Callout.Root>
      ) : (
        <Card>
          <Box style={{ overflowX: 'auto' }}>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>ID Telegram</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Nombre</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Usuario</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Idioma</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Estado</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>VIP</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Lote</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Msgs enviados</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Alta</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filtered.map((u) => (
                  <Table.Row key={u.id}>
                    <Table.Cell><Text size="2">{u.telegram_id}</Text></Table.Cell>
                    <Table.Cell><Text size="2">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</Text></Table.Cell>
                    <Table.Cell><Text size="2">{u.username ? `@${u.username}` : '—'}</Text></Table.Cell>
                    <Table.Cell><Badge size="1">{u.language}</Badge></Table.Cell>
                    <Table.Cell><StatusBadge active={u.is_active} /></Table.Cell>
                    <Table.Cell><StatusBadge vip={u.is_vip} /></Table.Cell>
                    <Table.Cell>
                      <Text size="2">{u.current_batch_name ?? '—'}</Text>
                      {u.current_batch_name && <Text size="1" color="gray"> ({u.current_message_step})</Text>}
                    </Table.Cell>
                    <Table.Cell><Badge size="1" color="blue">{u.messages_sent_count}</Badge></Table.Cell>
                    <Table.Cell><Text size="1" color="gray">{fmt(u.joined_at)}</Text></Table.Cell>
                    <Table.Cell>
                      <Flex gap="1">
                        <IconButton size="1" variant="ghost" title="Reanudar secuencia" onClick={() => handleResume(u.id)} loading={resumeSeq.isPending}>
                          <PlayIcon />
                        </IconButton>
                        <IconButton size="1" variant="ghost" onClick={() => openEdit(u)}><Pencil1Icon /></IconButton>
                        <IconButton size="1" variant="ghost" color="red" onClick={() => setDeleting(u)}><TrashIcon /></IconButton>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
                {filtered.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={10}><Text color="gray" size="2">Sin usuarios.</Text></Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Root>
          </Box>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>Editar usuario</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <TextField.Root placeholder="Nombre" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            <TextField.Root placeholder="Apellido" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            <TextField.Root placeholder="Username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
            <TextField.Root placeholder="Idioma (es/en/pt)" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} />
            <Flex align="center" gap="3">
              <Text size="2">Activo</Text>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Text size="2">VIP</Text>
              <Switch checked={form.is_vip} onCheckedChange={(v) => setForm((f) => ({ ...f, is_vip: v }))} />
            </Flex>
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Cancelar</Button></Dialog.Close>
            <Button onClick={handleSave} loading={updateUser.isPending}>Guardar</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar usuario"
        description={`¿Eliminar a ${deleting?.first_name ?? ''} (${deleting?.telegram_id})?`}
        onConfirm={handleDelete} loading={deleteUser.isPending}
      />
    </Box>
  )
}
