import {
  Box, Flex, Heading, Text, Card, Badge, Select, Button, Code,
  ScrollArea, Switch, Callout,
} from '@radix-ui/themes'
import { useLogs } from '../hooks/useLogs'
import { ReloadIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import type { LogEntry } from '../api/types'

const LEVEL_COLORS: Record<string, 'blue' | 'green' | 'orange' | 'red' | 'crimson' | 'gray'> = {
  DEBUG:    'blue',
  INFO:     'green',
  WARNING:  'orange',
  ERROR:    'red',
  CRITICAL: 'crimson',
}

function LogRow({ entry }: { entry: LogEntry }) {
  const color = LEVEL_COLORS[entry.level] ?? 'gray'
  return (
    <Flex gap="3" py="1" style={{ borderBottom: '1px solid var(--gray-3)', fontFamily: 'monospace', fontSize: 12 }}>
      <Text size="1" color="gray" style={{ whiteSpace: 'nowrap', minWidth: 160 }}>
        {new Date(entry.ts).toLocaleTimeString('es-ES', { hour12: false })}
      </Text>
      <Badge color={color} variant="soft" style={{ minWidth: 60, justifyContent: 'center' }}>
        {entry.level}
      </Badge>
      <Text size="1" color="gray" style={{ minWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {entry.name}
      </Text>
      <Text size="1" style={{ wordBreak: 'break-word' }}>{entry.msg}</Text>
    </Flex>
  )
}

const LEVELS = ['', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']

export default function LogsPage() {
  const [level, setLevel] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: logs = [], isLoading, isFetching, error, refetch } = useLogs(
    level ? { level } : undefined,
  )

  return (
    <Box>
      <Flex align="center" justify="between" mb="4" gap="3" wrap="wrap">
        <Heading size="5">Logs del Sistema</Heading>
        <Flex align="center" gap="3">
          <Text size="2" color="gray">
            Auto-refresh
          </Text>
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />

          <Select.Root value={level} onValueChange={setLevel}>
            <Select.Trigger placeholder="Todos los niveles" />
            <Select.Content>
              {LEVELS.map((l) => (
                <Select.Item key={l} value={l}>
                  {l || 'Todos'}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Button variant="soft" size="2" onClick={() => refetch()} loading={isFetching}>
            <ReloadIcon /> Refrescar
          </Button>
        </Flex>
      </Flex>

      {error && (
        <Callout.Root color="red" mb="3">
          <Callout.Text>Error: {(error as Error).message}</Callout.Text>
        </Callout.Root>
      )}

      <Card>
        <Flex align="center" justify="between" mb="2">
          <Text size="2" color="gray">{logs.length} entradas</Text>
          {isFetching && !isLoading && (
            <Badge color="blue" variant="soft" size="1">Actualizando…</Badge>
          )}
        </Flex>
        <ScrollArea style={{ height: 560 }}>
          {isLoading ? (
            <Text size="2" color="gray">Cargando…</Text>
          ) : logs.length === 0 ? (
            <Text size="2" color="gray">No hay logs disponibles.</Text>
          ) : (
            <Box>
              {[...logs].reverse().map((entry, i) => (
                <LogRow key={i} entry={entry} />
              ))}
            </Box>
          )}
        </ScrollArea>
      </Card>
    </Box>
  )
}
