import { AlertDialog, Button, Flex } from '@radix-ui/themes'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onConfirm: () => void
  confirmLabel?: string
  confirmColor?: 'red' | 'orange' | 'green' | 'blue'
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Confirmar acción',
  description = '¿Estás seguro? Esta acción no se puede deshacer.',
  onConfirm,
  confirmLabel = 'Confirmar',
  confirmColor = 'red',
  loading = false,
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{description}</AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" disabled={loading}>
              Cancelar
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button color={confirmColor} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  )
}
