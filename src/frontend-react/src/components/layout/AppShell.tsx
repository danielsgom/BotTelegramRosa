import { Box, Flex, IconButton, Text } from '@radix-ui/themes'
import { HamburgerMenuIcon } from '@radix-ui/react-icons'
import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import { useIsMobile } from '../../hooks/useIsMobile'

export default function AppShell() {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <Flex style={{ minHeight: '100vh', background: 'var(--gray-2)' }}>
      {/* Desktop sidebar — always visible */}
      {!isMobile && <Sidebar />}

      {/* Mobile sidebar — overlay drawer */}
      {isMobile && sidebarOpen && (
        <>
          {/* backdrop */}
          <Box
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              zIndex: 99,
            }}
          />
          <Box style={{ position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 100 }}>
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </Box>
        </>
      )}

      {/* Main content */}
      <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* TopBar — only on mobile */}
        {isMobile && (
          <Flex
            align="center"
            gap="3"
            px="3"
            style={{
              height: 52,
              background: 'var(--color-panel-solid)',
              borderBottom: '1px solid var(--gray-4)',
              position: 'sticky',
              top: 0,
              zIndex: 50,
              flexShrink: 0,
            }}
          >
            <IconButton variant="ghost" size="2" onClick={() => setSidebarOpen(true)}>
              <HamburgerMenuIcon width={20} height={20} />
            </IconButton>
            <Text size="4" weight="bold" style={{ color: 'var(--accent-9)' }}>🌸 Rosa Bot</Text>
          </Flex>
        )}

        <Box style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 20 }}>
          <Outlet />
        </Box>
      </Box>
    </Flex>
  )
}
