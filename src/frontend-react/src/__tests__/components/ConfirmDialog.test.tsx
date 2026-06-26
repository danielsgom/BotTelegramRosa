import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Theme } from '@radix-ui/themes'
import ConfirmDialog from '../../components/common/ConfirmDialog'

function wrap(ui: React.ReactElement) {
  return render(<Theme>{ui}</Theme>)
}

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    wrap(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Eliminar registro"
        description="¿Estás seguro?"
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByText('Eliminar registro')).toBeInTheDocument()
    expect(screen.getByText('¿Estás seguro?')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    wrap(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Hidden"
        description="Not visible"
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    wrap(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Confirmar acción"
        onConfirm={onConfirm}
        confirmLabel="Aceptar"
      />,
    )
    fireEvent.click(screen.getByText('Aceptar'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('shows custom confirm label', () => {
    wrap(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Borrar definitivamente"
      />,
    )
    expect(screen.getByText('Borrar definitivamente')).toBeInTheDocument()
  })

  it('disables cancel button when loading', () => {
    wrap(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        loading={true}
      />,
    )
    const cancelBtn = screen.getByText('Cancelar')
    expect(cancelBtn.closest('button')).toBeDisabled()
  })
})
