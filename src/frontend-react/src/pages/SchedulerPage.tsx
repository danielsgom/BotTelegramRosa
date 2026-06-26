import { Box, Flex, Heading, Text, Card, Button, Badge, DataList, Callout } from '@radix-ui/themes'
import { useSchedulerJobs } from '../hooks/useScheduler'
import { useScheduleState } from '../hooks/useBatches'
import { ReloadIcon, TimerIcon } from '@radix-ui/react-icons'
import LoadingCard from '../components/common/LoadingCard'

function fmt(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-ES')
}

export default function SchedulerPage() {
  const jobs = useSchedulerJobs()
  const state = useScheduleState()

  return (
    <Box>
      <Flex align="center" justify="between" mb="4">
        <Heading size="5">Scheduler</Heading>
        <Button
          variant="soft"
          size="2"
          onClick={() => { jobs.refetch(); state.refetch() }}
          loading={jobs.isFetching || state.isFetching}
        >
          <ReloadIcon /> Actualizar
        </Button>
      </Flex>

      {/* Schedule State */}
      <Heading size="3" mb="2">Estado del Envío Programado</Heading>
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
                    ? `#${state.data.current_message_index + 1} — ${state.data.current_message.title}`
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
                <DataList.Label>Intervalo</DataList.Label>
                <DataList.Value>{state.data.hours_interval}h</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Último envío</DataList.Label>
                <DataList.Value>{fmt(state.data.last_sent_at)}</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Próximo envío</DataList.Label>
                <DataList.Value>{fmt(state.data.next_send_at)}</DataList.Value>
              </DataList.Item>
            </DataList.Root>
          ) : (
            <Text color="gray" size="2">No hay estado de scheduler disponible.</Text>
          )}
        </Card>
      )}

      {/* APScheduler Jobs */}
      <Heading size="3" mb="2">Jobs APScheduler</Heading>
      {jobs.isLoading ? (
        <LoadingCard />
      ) : jobs.error ? (
        <Callout.Root color="red">
          <Callout.Text>Error cargando jobs: {(jobs.error as Error).message}</Callout.Text>
        </Callout.Root>
      ) : (
        <Flex direction="column" gap="2">
          {(jobs.data ?? []).length === 0 && (
            <Text color="gray" size="2">No hay jobs registrados.</Text>
          )}
          {(jobs.data ?? []).map((job) => (
            <Card key={job.id}>
              <Flex align="center" gap="3">
                <TimerIcon />
                <Box style={{ flex: 1 }}>
                  <Text weight="medium" size="2">{job.name}</Text>
                  <Text size="1" color="gray"> — {job.id}</Text>
                </Box>
                <Badge color={job.next_run_time ? 'green' : 'gray'} variant="soft">
                  {job.next_run_time ? fmt(job.next_run_time) : 'Pausado'}
                </Badge>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
    </Box>
  )
}
