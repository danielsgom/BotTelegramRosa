import { Box, Flex, Text, Separator } from '@radix-ui/themes'
import {
  LayersIcon,
  ChatBubbleIcon,
  Link2Icon,
  PersonIcon,
  TimerIcon,
  FileTextIcon,
  HeartIcon,
  GearIcon,
  LightningBoltIcon,
} from '@radix-ui/react-icons'
import { NavLink } from 'react-router-dom'
import type { ComponentType } from 'react'

interface NavItem {
  to: string
  label: string
  Icon: ComponentType<{ width?: string | number; height?: string | number }>
}

const navItems: NavItem[] = [
  { to: '/lotes',          label: 'Lotes',             Icon: LayersIcon },
  { to: '/mensajes',       label: 'Mensajes Manuales', Icon: ChatBubbleIcon },
  { to: '/links',          label: 'Links de Pago',     Icon: Link2Icon },
  { to: '/usuarios',       label: 'Usuarios',          Icon: PersonIcon },
  { to: '/quick-messages', label: 'Mensajes Rápidos',  Icon: LightningBoltIcon },
  { to: '/scheduler',      label: 'Scheduler',         Icon: TimerIcon },
  { to: '/logs',           label: 'Logs',              Icon: FileTextIcon },
  { to: '/vip',            label: 'Mensaje VIP',       Icon: HeartIcon },
  { to: '/configuracion',  label: 'Configuración',     Icon: GearIcon },
]

export default function Sidebar() {
  return (
    <Box
      style={{
        width: 220,
        minWidth: 220,
        background: 'var(--color-panel-solid)',
        borderRight: '1px solid var(--gray-4)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Brand */}
      <Box px="4" py="4">
        <Text size="4" weight="bold" style={{ color: 'var(--accent-9)' }}>
          🌸 Rosa Bot
        </Text>
      </Box>
      <Separator size="4" />

      {/* Nav links */}
      <Flex direction="column" gap="1" p="2" style={{ flex: 1, overflowY: 'auto' }}>
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent-11)' : 'var(--gray-11)',
              background: isActive ? 'var(--accent-3)' : 'transparent',
              transition: 'background 0.15s',
            })}
          >
            <Icon width={15} height={15} />
            {label}
          </NavLink>
        ))}
      </Flex>
    </Box>
  )
}
