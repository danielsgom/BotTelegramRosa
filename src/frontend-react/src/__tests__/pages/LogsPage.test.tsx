import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Theme } from '@radix-ui/themes'
import LogsPage from '../../pages/LogsPage'

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

describe('LogsPage', () => {
  it('renders heading', () => {
    render(<LogsPage />, { wrapper: Wrapper })
    expect(screen.getByText('Logs del Sistema')).toBeInTheDocument()
  })

  it('shows log entry after loading', async () => {
    render(<LogsPage />, { wrapper: Wrapper })
    await waitFor(() => {
      // MSW returns a log with msg 'Health OK'
      expect(screen.getByText('Health OK')).toBeInTheDocument()
    })
  })

  it('shows INFO badge for info log', async () => {
    render(<LogsPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('INFO')).toBeInTheDocument()
    })
  })

  it('shows log count', async () => {
    render(<LogsPage />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('1 entradas')).toBeInTheDocument()
    })
  })
})
