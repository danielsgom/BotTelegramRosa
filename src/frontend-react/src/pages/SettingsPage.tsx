import {
  Box, Flex, Heading, Card, Text, TextField, Button, Callout,
} from '@radix-ui/themes'
import { CheckIcon, EyeOpenIcon, EyeNoneIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import { useApiToken } from '../store/auth'

export default function SettingsPage() {
  const { token, setToken } = useApiToken()
  const [draft, setDraft] = useState(token)
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setToken(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Box>
      <Heading size="5" mb="4">Configuración</Heading>

      <Card style={{ maxWidth: 480 }}>
        <Heading size="3" mb="3">Token de API</Heading>
        <Text size="2" color="gray" mb="3" as="p">
          El token se envía en la cabecera <code>X-API-Token</code> en todas las peticiones al
          backend. Se guarda en <code>localStorage</code> bajo la clave{' '}
          <code>adminToken</code>.
        </Text>

        <Flex gap="2" mb="3">
          <TextField.Root
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setSaved(false) }}
            placeholder="Introduce el token…"
            style={{ flex: 1 }}
          />
          <Button variant="ghost" size="2" onClick={() => setShow((s) => !s)} title={show ? 'Ocultar' : 'Mostrar'}>
            {show ? <EyeNoneIcon /> : <EyeOpenIcon />}
          </Button>
        </Flex>

        <Button onClick={handleSave} disabled={draft.trim() === token}>
          Guardar token
        </Button>

        {saved && (
          <Callout.Root color="green" mt="3">
            <Callout.Icon>
              <CheckIcon />
            </Callout.Icon>
            <Callout.Text>Token guardado correctamente.</Callout.Text>
          </Callout.Root>
        )}
      </Card>
    </Box>
  )
}
