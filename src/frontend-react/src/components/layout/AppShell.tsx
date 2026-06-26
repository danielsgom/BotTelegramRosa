import { Box, Flex, ScrollArea } from '@radix-ui/themes'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppShell() {
  return (
    <Flex style={{ minHeight: '100vh', background: 'var(--gray-2)' }}>
      <Sidebar />
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ScrollArea style={{ flex: 1 }}>
          <Box p="5">
            <Outlet />
          </Box>
        </ScrollArea>
      </Box>
    </Flex>
  )
}
