import {
  Box, Flex, Heading, Text, Card, Badge, Select, Button,
  ScrollArea, Switch, Callout,
} from '@radix-ui/themes'
import { useLogs } from '../hooks/useLogs'
import { ReloadIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import type { LogEntry } from '../api/types'

const LEVEL_COLORS: Record<string, 'blue' | 'green' | 'orange' | 'red' | 'crimson' | 'gray'> = {
  DEBUG:    'blue',
  INFO:     'green',
  WARNING:  'orange',
  ERROR:    'red',
  CRITICAL: 'crimson',
}

/** Format ts safely — handles both ISO strings and bare HH:MM:SS strings */
function fmtTs(ts: string, showDate: boolean): string {
  // ISO string (e.g. "2026-06-26T14:30:45.123456")
  const d = new Date(ts)
  if (!isNaN(d.getTime())) {
    if (showDate) {
      return d.toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      })
    }
    return d.toLocaleTimeString('es-ES', { hour12: false })
  }
  // Fallback: already a plain time string
  return ts
}

// ─── Desktop row ──────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const color = LEVEL_COLORS[entry.level] ?? 'gray'
  return (
    <Flex gap="2" py="1" style={{ borderBottom: '1px solid var(--gray-3)', fontFamily: 'monospace', fontSize: 12, alignItems: 'flex-start' }}>
      <Text size="1" color="gray" style={{ whiteSpace: 'nowrap', minWidth: 70, flexShrink: 0 }}>
        {fmtTs(entry.ts, false)}
      </Text>
      <Badge color={color} variant="soft" size="1" style={{ minWidth: 58, justifyContent: 'center', flexShrink: 0 }}>
        {entry.level}
      </Badge>
      <Text size="1" color="gray" style={{ minWidth: 100, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
        {entry.name}
      </Text>
      <Text size="1" style={{ wordBreak: 'break-word', flex: 1 }}>{entry.msg}</Text>
    </Flex>
  )
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

function LogCard({ entry }: { entry: LogEntry }) {
  const color = LEVEL_COLORS[entry.level] ?? 'gray'
  const isError = entry.level === 'ERROR' || entry.level === 'CRITICAL'
  return (
    <Box
      py="2"
      px="2"
      style={{
        borderBottom: '1px solid var(--gray-3)',
        borderLeft: isError ? '3px solid var(--red-9)' : '3px solid transparent',
        background: isError ? 'var(--red-2)' : undefined,
      }}
    >
      <Flex align="center" gap="2" mb="1">
        <Badge color={color} variant="soft" size="1" style={{ minWidth: 58, justifyContent: 'center' }}>
          {entry.level}
        </Badge>
        <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
          {fmtTs(entry.ts, false)}
        </Text>
        <Text size="1" color="gray" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {entry.name}
        </Text>
      </Flex>
      <Text size="2" style={{ wordBreak: 'break-word', lineHeight: '1.5' }}>{entry.msg}</Text>
    </Box>
  )
}

const LEVELS = ['', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']

export default function LogsPage() {
  const isMobile = useIsMobile()
  const [level, setLevel] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: logs = [], isLoading, isFetching, error, refetch } = useLogs(
    level ? { level } : undefined,
  )

  const reversed = [...logs].reverse()

  return (
    <Box>
      {/* Header */}
      <Flex align={isMobile ? 'start' : 'center'} justify="between" mb="3" gap="2"
        direction={isMobile ? 'column' : 'row'}>
        <Heading size={isMobile ? '4' : '5'}>Logs del Sistema</Heading>

        <Flex align="center" gap="2" wrap="wrap">
          <Flex align="center" gap="2">
            <Text size="2" color="gray">Auto</Text>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </Flex>

          <Select.Root value={level} onValueChange={setLevel}>
            <Select.Trigger placeholder="Todos" style={isMobile ? { width: 110 } : undefined} />
            <Select.Content>
              {LEVELS.map((l) => (
                <Select.Item key={l} value={l}>{l || 'Todos'}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Button variant="soft" size="2" onClick={() => refetch()} loading={isFetching}>
            <ReloadIcon />
            {!isMobile && ' Refrescar'}
          </Button>
        </Flex>
      </Flex>

      {error && (
        <Callout.Root color="red" mb="3">
          <Callout.Text>Error: {(error as Error).message}</Callout.Text>
        </Callout.Root>
      )}

      <Card style={{ padding: isMobile ? 0 : undefined }}>
        <Flex align="center" justify="between" mb="2" px={isMobile ? '2' : undefined} pt={isMobile ? '2' : undefined}>
          <Text size="2" color="gray">{logs.length} entradas</Text>
          {isFetching && !isLoading && (
            <Badge color="blue" variant="soft" size="1">Actualizando…</Badge>
          )}
        </Flex>

        <ScrollArea style={{ height: isMobile ? 'calc(100vh - 200px)' : 560 }}>
          {isLoading ? (
            <Box p="3"><Text size="2" color="gray">Cargando…</Text></Box>
          ) : logs.length === 0 ? (
            <Box p="3"><Text size="2" color="gray">No hay logs disponibles.</Text></Box>
          ) : isMobile ? (
            <Box>
              {reversed.map((entry, i) => <LogCard key={i} entry={entry} />)}
            </Box>
          ) : (
            <Box>
              {reversed.map((entry, i) => <LogRow key={i} entry={entry} />)}
            </Box>
          )}
        </ScrollArea>
      </Card>
    </Box>
  )
}

