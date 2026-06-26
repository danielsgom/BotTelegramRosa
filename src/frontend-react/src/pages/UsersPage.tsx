import {
  Box, Flex, Heading, Card, Button, Text, TextField,
  Dialog, Table, IconButton, Badge, Callout, Switch, DataList, ScrollArea,
} from '@radix-ui/themes'
import {
  PlusIcon, Pencil1Icon, TrashIcon, ReloadIcon, PlayIcon,
  PersonIcon, ChatBubbleIcon, HeartIcon, ExclamationTriangleIcon,
} from '@radix-ui/react-icons'
import { useState } from 'react'
import { useUsers, useUpdateUser, useDeleteUser, useResumeSequence } from '../hooks/useUsers'
import { useIsMobile } from '../hooks/useIsMobile'
import StatusBadge from '../components/common/StatusBadge'
import ConfirmDialog from '../components/common/ConfirmDialog'
import LoadingCard from '../components/common/LoadingCard'
import type { User } from '../api/types'

function fmt(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('es-ES')
}

function fmtName(u: User) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || `ID ${u.telegram_id}`
}

// ─── User Detail Dialog ───────────────────────────────────────────────────────

function UserDetailDialog({
  user, open, onOpenChange, onEdit, onResume,
}: {
  user: User | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onEdit: (u: User) => void
  onResume: (id: number) => void
}) {
  if (!user) return null
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>
          <Flex align="center" gap="2">
            <PersonIcon /> {fmtName(user)}
            {user.is_vip && <Badge color="pink" size="1">VIP</Badge>}
          </Flex>
        </Dialog.Title>
        <ScrollArea style={{ maxHeight: '65vh' }}>
          <DataList.Root mt="3" size="2">
            <DataList.Item>
              <DataList.Label>Telegram ID</DataList.Label>
              <DataList.Value><Text size="2" style={{ fontFamily: 'monospace' }}>{user.telegram_id}</Text></DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Username</DataList.Label>
              <DataList.Value>{user.username ? `@${user.username}` : '—'}</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Idioma</DataList.Label>
              <DataList.Value><Badge>{user.language}</Badge></DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Estado</DataList.Label>
              <DataList.Value><StatusBadge active={user.is_active} /></DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>VIP</DataList.Label>
              <DataList.Value><StatusBadge vip={user.is_vip} /></DataList.Value>
            </DataList.Item>
            {user.vip_expires_at && (
              <DataList.Item>
                <DataList.Label>VIP expira</DataList.Label>
                <DataList.Value>{fmt(user.vip_expires_at)}</DataList.Value>
              </DataList.Item>
            )}
            <DataList.Item>
              <DataList.Label>Lote actual</DataList.Label>
              <DataList.Value>{user.current_batch_name ?? '—'}</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Paso en lote</DataList.Label>
              <DataList.Value><Badge color="blue">{user.current_message_step ?? 0}</Badge></DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Mensajes enviados</DataList.Label>
              <DataList.Value><Badge color="green">{user.messages_sent_count}</Badge></DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Alta</DataList.Label>
              <DataList.Value>{fmt(user.joined_at)}</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Últ. actividad</DataList.Label>
              <DataList.Value>{fmt(user.last_message_at)}</DataList.Value>
            </DataList.Item>
            {user.send_error && (
              <DataList.Item>
                <DataList.Label>Error de envío</DataList.Label>
                <DataList.Value>
                  <Flex direction="column" gap="1">
                    <Badge color="red" size="1"><ExclamationTriangleIcon /> {user.send_error}</Badge>
                    <Text size="1" color="gray">{fmt(user.send_error_at)}</Text>
                  </Flex>
                </DataList.Value>
              </DataList.Item>
            )}
          </DataList.Root>
        </ScrollArea>
        <Flex gap="2" mt="4" wrap="wrap">
          <Button size="2" variant="soft" onClick={() => { onEdit(user); onOpenChange(false) }}>
            <Pencil1Icon /> Editar
          </Button>
          <Button size="2" variant="soft" color="green" onClick={() => { onResume(user.id); onOpenChange(false) }}>
            <PlayIcon /> Reanudar secuencia
          </Button>
          <Dialog.Close>
            <Button size="2" variant="soft" color="gray">Cerrar</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

// ─── Mobile user cards ────────────────────────────────────────────────────────

function UserCardList({
  users, onView, onEdit, onDelete, onResume,
}: {
  users: User[]
  onView: (u: User) => void
  onEdit: (u: User) => void
  onDelete: (u: User) => void
  onResume: (id: number) => void
}) {
  return (
    <Flex direction="column" gap="2">
      {users.map((u) => (
        <Card key={u.id} style={{ cursor: 'pointer' }} onClick={() => onView(u)}>
          <Flex align="center" gap="3">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Flex align="center" gap="1" mb="1">
                <Text size="3" weight="bold">{fmtName(u)}</Text>
                {u.is_vip && <Badge color="pink" size="1">VIP</Badge>}
                <StatusBadge active={u.is_active} />
                {u.send_error && <Badge color="red" size="1" title={u.send_error}><ExclamationTriangleIcon /></Badge>}
              </Flex>
              <Flex gap="2" wrap="wrap">
                <Text size="1" color="gray">{u.telegram_id}</Text>
                {u.username && <Text size="1" color="gray">@{u.username}</Text>}
                <Badge size="1" color="blue">{u.messages_sent_count} msgs</Badge>
                {u.current_batch_name && (
                  <Badge size="1" color="orange">{u.current_batch_name} / paso {u.current_message_step}</Badge>
                )}
              </Flex>
            </Box>
            <Flex gap="1" onClick={(e) => e.stopPropagation()}>
              <IconButton size="1" variant="ghost" color="green" onClick={() => onResume(u.id)} title="Reanudar">
                <PlayIcon />
              </IconButton>
              <IconButton size="1" variant="ghost" onClick={() => onEdit(u)}>
                <Pencil1Icon />
              </IconButton>
              <IconButton size="1" variant="ghost" color="red" onClick={() => onDelete(u)}>
                <TrashIcon />
              </IconButton>
            </Flex>
          </Flex>
        </Card>
      ))}
      {users.length === 0 && <Text size="2" color="gray">Sin usuarios.</Text>}
    </Flex>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const isMobile = useIsMobile()
  const [statusFilter, setStatusFilter] = useState<'' | 'error' | 'active'>('')
  const { data: users = [], isLoading, error, refetch, isFetching } = useUsers(statusFilter ? { status: statusFilter } : undefined)
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const resumeSeq = useResumeSequence()

  const [viewing, setViewing] = useState<User | null>(null)
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
        <Flex align="center" gap="3" wrap="wrap">
          <Heading size="5">Usuarios ({users.length})</Heading>
          <Flex gap="1">
            {(['', 'active', 'error'] as const).map((f) => (
              <Button
                key={f}
                size="1"
                variant={statusFilter === f ? 'solid' : 'soft'}
                color={f === 'error' ? 'red' : undefined}
                onClick={() => setStatusFilter(f)}
              >
                {f === '' ? 'Todos' : f === 'active' ? 'Activos' : <><ExclamationTriangleIcon /> Con error</>}
              </Button>
            ))}
          </Flex>
        </Flex>
        <Flex gap="2">
          <TextField.Root placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
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
      ) : isMobile ? (
        <UserCardList
          users={filtered}
          onView={setViewing}
          onEdit={openEdit}
          onDelete={setDeleting}
          onResume={handleResume}
        />
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
                  <Table.ColumnHeaderCell>Msgs</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Alta</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filtered.map((u) => (
                  <Table.Row
                    key={u.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setViewing(u)}
                  >
                    <Table.Cell><Text size="2">{u.telegram_id}</Text></Table.Cell>
                    <Table.Cell><Text size="2">{fmtName(u)}</Text></Table.Cell>
                    <Table.Cell><Text size="2">{u.username ? `@${u.username}` : '—'}</Text></Table.Cell>
                    <Table.Cell><Badge size="1">{u.language}</Badge></Table.Cell>
                    <Table.Cell>
                      <Flex align="center" gap="1">
                        <StatusBadge active={u.is_active} />
                        {u.send_error && (
                          <Badge color="red" size="1" title={u.send_error}>
                            <ExclamationTriangleIcon />
                          </Badge>
                        )}
                      </Flex>
                    </Table.Cell>
                    <Table.Cell><StatusBadge vip={u.is_vip} /></Table.Cell>
                    <Table.Cell>
                      <Text size="2">{u.current_batch_name ?? '—'}</Text>
                      {u.current_batch_name && <Text size="1" color="gray"> ({u.current_message_step})</Text>}
                    </Table.Cell>
                    <Table.Cell><Badge size="1" color="blue">{u.messages_sent_count}</Badge></Table.Cell>
                    <Table.Cell><Text size="1" color="gray">{fmt(u.joined_at)}</Text></Table.Cell>
                    <Table.Cell>
                      <Flex gap="1" onClick={(e) => e.stopPropagation()}>
                        <IconButton size="1" variant="ghost" title="Reanudar" onClick={() => handleResume(u.id)}>
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

      {/* User detail */}
      <UserDetailDialog
        user={viewing} open={!!viewing}
        onOpenChange={(v) => !v && setViewing(null)}
        onEdit={openEdit} onResume={handleResume}
      />

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

