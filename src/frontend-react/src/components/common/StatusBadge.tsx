import { Badge } from '@radix-ui/themes'

interface Props {
  active?: boolean
  vip?: boolean
  label?: string
}

export default function StatusBadge({ active, vip, label }: Props) {
  if (vip !== undefined) {
    return (
      <Badge color={vip ? 'pink' : 'gray'} variant="soft" radius="full">
        {label ?? (vip ? 'VIP' : 'Normal')}
      </Badge>
    )
  }
  return (
    <Badge color={active ? 'green' : 'red'} variant="soft" radius="full">
      {label ?? (active ? 'Activo' : 'Inactivo')}
    </Badge>
  )
}
