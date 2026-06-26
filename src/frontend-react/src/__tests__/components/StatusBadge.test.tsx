import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Theme } from '@radix-ui/themes'
import StatusBadge from '../../components/common/StatusBadge'

function wrap(ui: React.ReactElement) {
  return render(<Theme>{ui}</Theme>)
}

describe('StatusBadge', () => {
  it('shows Activo when active=true', () => {
    wrap(<StatusBadge active={true} />)
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('shows Inactivo when active=false', () => {
    wrap(<StatusBadge active={false} />)
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('shows VIP when vip=true', () => {
    wrap(<StatusBadge vip={true} />)
    expect(screen.getByText('VIP')).toBeInTheDocument()
  })

  it('shows Normal when vip=false', () => {
    wrap(<StatusBadge vip={false} />)
    expect(screen.getByText('Normal')).toBeInTheDocument()
  })

  it('shows custom label', () => {
    wrap(<StatusBadge active={true} label="Funcionando" />)
    expect(screen.getByText('Funcionando')).toBeInTheDocument()
  })
})
