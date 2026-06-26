import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Theme } from '@radix-ui/themes'
import SettingsPage from '../../pages/SettingsPage'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <Theme>{children}</Theme>
    </MemoryRouter>
  )
}

describe('SettingsPage', () => {
  it('renders heading', () => {
    render(<SettingsPage />, { wrapper: Wrapper })
    expect(screen.getByText('Configuración')).toBeInTheDocument()
  })

  it('renders token input', () => {
    render(<SettingsPage />, { wrapper: Wrapper })
    const input = screen.getByPlaceholderText('Introduce el token…')
    expect(input).toBeInTheDocument()
  })

  it('save button is disabled when token unchanged', () => {
    localStorage.setItem('adminToken', 'existing-token')
    render(<SettingsPage />, { wrapper: Wrapper })
    const btn = screen.getByText('Guardar token').closest('button')
    // Input starts with current value → button disabled
    expect(btn).toBeDisabled()
  })

  it('save button enabled when token changed', () => {
    localStorage.setItem('adminToken', '')
    render(<SettingsPage />, { wrapper: Wrapper })
    const input = screen.getByPlaceholderText('Introduce el token…')
    fireEvent.change(input, { target: { value: 'new-token' } })
    const btn = screen.getByText('Guardar token').closest('button')
    expect(btn).not.toBeDisabled()
  })

  it('saves token to localStorage on click', () => {
    localStorage.setItem('adminToken', '')
    render(<SettingsPage />, { wrapper: Wrapper })
    const input = screen.getByPlaceholderText('Introduce el token…')
    fireEvent.change(input, { target: { value: 'my-new-token' } })
    fireEvent.click(screen.getByText('Guardar token'))
    expect(localStorage.getItem('adminToken')).toBe('my-new-token')
  })
})
