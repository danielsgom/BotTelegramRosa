import { Box, Flex, Heading, Text, Card, Button, Badge, DataList, Callout } from '@radix-ui/themes'
import { useSendNextBatchMessage, useScheduleState } from '../hooks/useBatches'
import { ReloadIcon, PaperPlaneIcon } from '@radix-ui/react-icons'
import LoadingCard from '../components/common/LoadingCard'

function fmt(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-ES')
}

export default function SchedulerPage() {
  const state = useScheduleState()
  const sendNext = useSendNextBatchMessage()

  return (
    <Box>
      <Flex align="center" justify="between" mb="4">
        <Heading size="5">Envío Manual de Lotes</Heading>
        <Button
          variant="soft"
          size="2"
          onClick={() => { state.refetch() }}
          loading={state.isFetching}
        >
          <ReloadIcon /> Actualizar
        </Button>
      </Flex>

      <Callout.Root color="blue" mb="4">
        <Callout.Text>
          El envío automático está <strong>desactivado</strong>. Pulsa el botón
          "Enviar siguiente mensaje" para entregar manualmente el siguiente
          mensaje del lote activo a todos los usuarios activos (no VIP).
        </Callout.Text>
      </Callout.Root>

      <Button
        size="3"
        color="green"
        mb="4"
        onClick={() => sendNext.mutate()}
        loading={sendNext.isPending}
        disabled={!state.data?.current_batch}
      >
        <PaperPlaneIcon /> Enviar siguiente mensaje
      </Button>

      {sendNext.isSuccess && (
        <Callout.Root color="green" mb="4">
          <Callout.Text>Envío manual iniciado correctamente.</Callout.Text>
        </Callout.Root>
      )}
      {sendNext.isError && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>Error: {(sendNext.error as Error).message}</Callout.Text>
        </Callout.Root>
      )}

      {/* Schedule State */}
      <Heading size="3" mb="2">Estado del Lote Activo</Heading>
      {state.isLoading ? (
        <LoadingCard lines={5} />
      ) : state.error ? (
        <Callout.Root color="red" mb="4">
          <Callout.Text>Error: {(state.error as Error).message}</Callout.Text>
        </Callout.Root>
      ) : (
        <Card mb="5">
          {state.data ? (
            <DataList.Root>
              <DataList.Item>
                <DataList.Label>Lote activo</DataList.Label>
                <DataList.Value>
                  {state.data.current_batch
                    ? `${state.data.current_batch.name} (${state.data.current_batch.total_messages} msgs)`
                    : '—'}
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Mensaje actual</DataList.Label>
                <DataList.Value>
                  {state.data.current_message
                    ? `Mensaje Global #${state.data.current_message_index + 1} de ${state.data.current_batch?.total_messages} — ${state.data.current_message.title}`
                    : '—'}
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Usuarios activos</DataList.Label>
                <DataList.Value>
                  <Badge color="green">{state.data.active_users}</Badge>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Intervalo configurado</DataList.Label>
                <DataList.Value>{state.data.hours_interval}h</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Último envío</DataList.Label>
                <DataList.Value>{fmt(state.data.last_sent_at)}</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Próximo envío programado</DataList.Label>
                <DataList.Value>
                  <Badge color="gray" variant="soft">Modo manual — no programado</Badge>
                </DataList.Value>
              </DataList.Item>
            </DataList.Root>
          ) : (
            <Text color="gray" size="2">No hay estado de scheduler disponible.</Text>
          )}
        </Card>
      )}
    </Box>
  )
}
