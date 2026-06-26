import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Theme } from '@radix-ui/themes'
import SchedulerPage from '../../pages/SchedulerPage'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <Theme>{children}</Theme>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('SchedulerPage', () => {
  it('renders heading', () => {
    render(<SchedulerPage />, { wrapper: Wrapper })
    expect(screen.getByText('Scheduler')).toBeInTheDocument()
  })

  it('shows schedule state after loading', async () => {
    render(<SchedulerPage />, { wrapper: Wrapper })
    await waitFor(() => {
      // MSW returns mockScheduleState with current_batch.name = 'Lote 1'
      expect(screen.getByText(/Lote 1/)).toBeInTheDocument()
    })
  })

  it('shows scheduler job name', async () => {
    render(<SchedulerPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('send_messages')).toBeInTheDocument()
    })
  })

  it('shows active users count', async () => {
    render(<SchedulerPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument()
    })
  })
})
