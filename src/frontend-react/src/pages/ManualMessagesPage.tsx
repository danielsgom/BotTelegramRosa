import {
  Box, Flex, Heading, Card, Button, Text, TextField, TextArea,
  Badge, Callout, ScrollArea, Dialog, IconButton, Separator,
} from '@radix-ui/themes'
import {
  PaperPlaneIcon, PersonIcon, MagnifyingGlassIcon,
  ImageIcon, FileIcon, Link2Icon, LightningBoltIcon, LayersIcon,
} from '@radix-ui/react-icons'
import { useState, useRef, useEffect } from 'react'
import {
  useAdminUsers, useChatHistory, useSendMessage, useMarkRead,
  useQuickMessages, useMessageBlocks, useSendMessageBlock,
  usePredefinedAssets,
} from '../hooks/useAdmin'
import { useAdminStripeLinks } from '../hooks/useStripeLinks'
import LoadingCard from '../components/common/LoadingCard'
import type { AdminUser, ChatMessage, QuickMessage, MessageBlock, PredefinedAsset, StripLink } from '../api/types'

// ─── Helper ──────────────────────────────────────────────────────────────────

function timeStr(ts: string) {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function fmtName(u: AdminUser) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || `ID ${u.telegram_id}`
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const isAdmin = msg.sent_by === 'admin'
  return (
    <Flex justify={isAdmin ? 'end' : 'start'} mb="2">
      <Box
        style={{
          maxWidth: '70%',
          padding: '8px 12px',
          borderRadius: isAdmin ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          background: isAdmin ? 'var(--accent-9)' : 'var(--gray-4)',
          color: isAdmin ? 'white' : 'inherit',
        }}
      >
        {msg.type === 'text' && <Text size="2">{msg.content}</Text>}
        {msg.type === 'image' && msg.attachment_url && (
          <img src={msg.attachment_url} alt="img" style={{ maxWidth: 200, borderRadius: 6, display: 'block' }} />
        )}
        {msg.type === 'audio' && msg.attachment_url && (
          <audio controls src={msg.attachment_url} style={{ maxWidth: 200 }} />
        )}
        {msg.type === 'video' && msg.attachment_url && (
          <video controls src={msg.attachment_url} style={{ maxWidth: 200 }} />
        )}
        {msg.type === 'document' && msg.attachment_url && (
          <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ color: isAdmin ? 'white' : 'var(--accent-9)' }}>
            📎 Documento
          </a>
        )}
        {msg.type === 'stripe_links' && msg.content && (
          <Text size="2">🔗 {msg.content}</Text>
        )}
        <Text size="1" style={{ opacity: 0.65, marginTop: 4, display: 'block', textAlign: 'right' }}>
          {timeStr(msg.created_at)}
        </Text>
      </Box>
    </Flex>
  )
}

// ─── User List Item ───────────────────────────────────────────────────────────

function UserItem({ user, selected, onSelect }: { user: AdminUser; selected: boolean; onSelect: () => void }) {
  return (
    <Box
      onClick={onSelect}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        borderRadius: 6,
        background: selected ? 'var(--accent-3)' : 'transparent',
        borderLeft: selected ? '3px solid var(--accent-9)' : '3px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <Flex align="center" gap="2">
        <PersonIcon width={14} />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Flex align="center" gap="1">
            <Text size="2" weight={selected ? 'bold' : 'regular'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fmtName(user)}
            </Text>
            {user.is_vip && <Badge size="1" color="pink">VIP</Badge>}
          </Flex>
          {user.last_message_preview && (
            <Text size="1" color="gray" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {user.last_message_preview}
            </Text>
          )}
        </Box>
        {user.unread_count > 0 && (
          <Badge size="1" color="red" variant="solid" style={{ minWidth: 20, justifyContent: 'center' }}>
            {user.unread_count}
          </Badge>
        )}
      </Flex>
    </Box>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManualMessagesPage() {
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(0)
  const [messageText, setMessageText] = useState('')

  // Quick message picker
  const [quickOpen, setQuickOpen] = useState(false)
  // Block picker
  const [blockOpen, setBlockOpen] = useState(false)
  // Asset picker
  const [assetOpen, setAssetOpen] = useState(false)
  const [assetType, setAssetType] = useState<string>('')
  // Stripe link picker
  const [linkOpen, setLinkOpen] = useState(false)
  const [selectedLinkIds, setSelectedLinkIds] = useState<number[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: users = [], isLoading: usersLoading } = useAdminUsers(search ? { search } : undefined)
  const { data: chatData, isLoading: chatLoading } = useChatHistory(selectedUserId)
  const sendMessage = useSendMessage()
  const markRead = useMarkRead()
  const sendBlock = useSendMessageBlock()
  const { data: quickMsgs = [] } = useQuickMessages()
  const { data: blocks = [] } = useMessageBlocks()
  const { data: assets = [] } = usePredefinedAssets(assetType || undefined)
  const { data: stripeLinks = [] } = useAdminStripeLinks()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatData?.messages])

  // Mark as read when opening a chat
  useEffect(() => {
    if (selectedUserId > 0) markRead.mutate(selectedUserId)
  }, [selectedUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectUser = (id: number) => {
    setSelectedUserId(id)
    setMessageText('')
  }

  const handleSendText = async () => {
    if (!messageText.trim() || !selectedUserId) return
    try {
      await sendMessage.mutateAsync({ userId: selectedUserId, data: { message: messageText } })
      setMessageText('')
    } catch { /* show in UI */ }
  }

  const handleSendFile = async (file: File) => {
    if (!selectedUserId) return
    await sendMessage.mutateAsync({ userId: selectedUserId, data: { file } })
  }

  const handleSendAsset = async (asset: PredefinedAsset) => {
    setAssetOpen(false)
    if (!selectedUserId) return
    await sendMessage.mutateAsync({ userId: selectedUserId, data: { asset_id: asset.id } })
  }

  const handleSendLinks = async () => {
    setLinkOpen(false)
    if (!selectedUserId || selectedLinkIds.length === 0) return
    await sendMessage.mutateAsync({
      userId: selectedUserId,
      data: { strip_link_ids: selectedLinkIds.join(',') },
    })
    setSelectedLinkIds([])
  }

  const handleSendBlock = async (blockId: number) => {
    setBlockOpen(false)
    if (!selectedUserId) return
    await sendBlock.mutateAsync({ blockId, userId: selectedUserId })
  }

  const selectedUser = users.find((u) => u.id === selectedUserId)
  const messages = chatData?.messages ?? []

  return (
    <Box style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <Heading size="5" mb="3">Mensajes Manuales</Heading>

      <Flex style={{ flex: 1, minHeight: 0, gap: 12 }}>
        {/* User List */}
        <Card style={{ width: 260, minWidth: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box pb="2">
            <TextField.Root
              placeholder="Buscar usuario…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="2"
            >
              <TextField.Slot>
                <MagnifyingGlassIcon />
              </TextField.Slot>
            </TextField.Root>
          </Box>
          <ScrollArea style={{ flex: 1 }}>
            {usersLoading ? (
              <LoadingCard lines={4} />
            ) : users.length === 0 ? (
              <Box p="2"><Text size="2" color="gray">Sin usuarios.</Text></Box>
            ) : (
              <Flex direction="column" gap="1">
                {users.map((u) => (
                  <UserItem
                    key={u.id}
                    user={u}
                    selected={u.id === selectedUserId}
                    onSelect={() => handleSelectUser(u.id)}
                  />
                ))}
              </Flex>
            )}
          </ScrollArea>
        </Card>

        {/* Chat Area */}
        <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {!selectedUserId ? (
            <Flex align="center" justify="center" style={{ flex: 1 }} direction="column" gap="2">
              <PersonIcon width={40} height={40} color="var(--gray-8)" />
              <Text color="gray">Selecciona un usuario para chatear.</Text>
            </Flex>
          ) : (
            <>
              {/* Header */}
              <Flex align="center" gap="2" pb="3" style={{ borderBottom: '1px solid var(--gray-4)' }}>
                <PersonIcon />
                <Text weight="bold">{selectedUser ? fmtName(selectedUser) : '…'}</Text>
                {selectedUser?.is_vip && <Badge color="pink" size="1">VIP</Badge>}
                {selectedUser?.username && (
                  <Text size="1" color="gray">@{selectedUser.username}</Text>
                )}
              </Flex>

              {/* Messages */}
              <ScrollArea style={{ flex: 1, padding: '12px 0' }}>
                {chatLoading ? (
                  <LoadingCard lines={5} />
                ) : messages.length === 0 ? (
                  <Box p="2"><Text color="gray" size="2">Sin mensajes.</Text></Box>
                ) : (
                  <Box px="3">
                    {messages.map((m) => <Bubble key={m.id} msg={m} />)}
                    <div ref={messagesEndRef} />
                  </Box>
                )}
              </ScrollArea>

              {/* Input area */}
              <Box style={{ borderTop: '1px solid var(--gray-4)', paddingTop: 12 }}>
                {/* Toolbar */}
                <Flex gap="1" mb="2">
                  <IconButton
                    size="1" variant="ghost" title="Imagen / Asset"
                    onClick={() => { setAssetType('image'); setAssetOpen(true) }}
                  >
                    <ImageIcon />
                  </IconButton>
                  <IconButton
                    size="1" variant="ghost" title="Archivo"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileIcon />
                  </IconButton>
                  <IconButton
                    size="1" variant="ghost" title="Links de pago"
                    onClick={() => setLinkOpen(true)}
                  >
                    <Link2Icon />
                  </IconButton>
                  <IconButton
                    size="1" variant="ghost" title="Mensaje rápido"
                    onClick={() => setQuickOpen(true)}
                  >
                    <LightningBoltIcon />
                  </IconButton>
                  <IconButton
                    size="1" variant="ghost" title="Bloque de mensajes"
                    onClick={() => setBlockOpen(true)}
                  >
                    <LayersIcon />
                  </IconButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files?.[0]) handleSendFile(e.target.files[0]) }}
                  />
                </Flex>

                <Flex gap="2">
                  <TextArea
                    placeholder="Escribe un mensaje…"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText() } }}
                    rows={2}
                    style={{ flex: 1, resize: 'none' }}
                  />
                  <Button onClick={handleSendText} loading={sendMessage.isPending} style={{ alignSelf: 'flex-end' }}>
                    <PaperPlaneIcon />
                  </Button>
                </Flex>
              </Box>
            </>
          )}
        </Card>
      </Flex>

      {/* Quick message picker */}
      <Dialog.Root open={quickOpen} onOpenChange={setQuickOpen}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>Mensajes Rápidos</Dialog.Title>
          <Flex direction="column" gap="2" mt="3">
            {quickMsgs.map((qm) => (
              <Card
                key={qm.id}
                style={{ cursor: 'pointer' }}
                onClick={() => { setMessageText(qm.text_es); setQuickOpen(false) }}
              >
                <Text weight="medium" size="2">{qm.name}</Text>
                <Text size="1" color="gray">{qm.text_es.slice(0, 100)}…</Text>
              </Card>
            ))}
            {quickMsgs.length === 0 && <Text color="gray" size="2">Sin mensajes rápidos.</Text>}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Block picker */}
      <Dialog.Root open={blockOpen} onOpenChange={setBlockOpen}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>Bloques de Mensajes</Dialog.Title>
          <Flex direction="column" gap="2" mt="3">
            {blocks.map((b) => (
              <Card key={b.id}>
                <Flex align="center" justify="between">
                  <Box>
                    <Text weight="medium" size="2">{b.name}</Text>
                    <Text size="1" color="gray">{b.steps.length} pasos</Text>
                  </Box>
                  <Button size="1" onClick={() => handleSendBlock(b.id)} loading={sendBlock.isPending}>
                    Enviar
                  </Button>
                </Flex>
              </Card>
            ))}
            {blocks.length === 0 && <Text color="gray" size="2">Sin bloques.</Text>}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Asset picker */}
      <Dialog.Root open={assetOpen} onOpenChange={setAssetOpen}>
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>Assets predefinidos</Dialog.Title>
          <Flex gap="2" mb="3" mt="3" wrap="wrap">
            {['', 'image', 'audio', 'video', 'link'].map((t) => (
              <Button
                key={t}
                size="1"
                variant={assetType === t ? 'solid' : 'soft'}
                onClick={() => setAssetType(t)}
              >
                {t || 'Todos'}
              </Button>
            ))}
          </Flex>
          <Flex direction="column" gap="2">
            {assets.map((a) => (
              <Card key={a.id} style={{ cursor: 'pointer' }} onClick={() => handleSendAsset(a)}>
                <Flex align="center" gap="2">
                  <Badge size="1">{a.asset_type}</Badge>
                  <Text size="2">{a.name}</Text>
                  {a.category && <Text size="1" color="gray">({a.category})</Text>}
                </Flex>
              </Card>
            ))}
            {assets.length === 0 && <Text color="gray" size="2">Sin assets.</Text>}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Stripe link picker */}
      <Dialog.Root open={linkOpen} onOpenChange={setLinkOpen}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>Links de Pago</Dialog.Title>
          <Flex direction="column" gap="2" mt="3">
            {stripeLinks.map((l) => (
              <Flex key={l.id} align="center" gap="2">
                <input
                  type="checkbox"
                  checked={selectedLinkIds.includes(l.id)}
                  onChange={(e) =>
                    setSelectedLinkIds((ids) =>
                      e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id),
                    )
                  }
                />
                <Text size="2">{l.name}</Text>
                <Text size="1" color="gray">({l.duration_days}d)</Text>
              </Flex>
            ))}
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Cancelar</Button></Dialog.Close>
            <Button onClick={handleSendLinks} disabled={selectedLinkIds.length === 0}>
              Enviar ({selectedLinkIds.length})
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
