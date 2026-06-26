import {
  Box, Flex, Heading, Card, Button, Text, TextField, TextArea,
  Dialog, Table, IconButton, Badge, Callout, Select, Checkbox,
} from '@radix-ui/themes'
import { PlusIcon, Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import { useVipConfig, useSaveVipConfig } from '../hooks/useVip'
import LoadingCard from '../components/common/LoadingCard'
import { CheckIcon } from '@radix-ui/react-icons'

export default function VipConfigPage() {
  const { data: config, isLoading, error } = useVipConfig()
  const save = useSaveVipConfig()

  const [textEs, setTextEs] = useState('')
  const [textEn, setTextEn] = useState('')
  const [textPt, setTextPt] = useState('')
  const [btnEs, setBtnEs] = useState('')
  const [btnEn, setBtnEn] = useState('')
  const [btnPt, setBtnPt] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  if (config && !initialized) {
    setTextEs(config.text_translations?.es ?? '')
    setTextEn(config.text_translations?.en ?? '')
    setTextPt(config.text_translations?.pt ?? '')
    setBtnEs(config.button_text_translations?.es ?? '')
    setBtnEn(config.button_text_translations?.en ?? '')
    setBtnPt(config.button_text_translations?.pt ?? '')
    setInviteUrl(config.invite_url ?? '')
    setInitialized(true)
  }

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        text_es: textEs, text_en: textEn, text_pt: textPt,
        button_text_es: btnEs, button_text_en: btnEn, button_text_pt: btnPt,
        invite_url: inviteUrl, image: imageFile,
      })
      setFeedback({ ok: true, msg: 'Configuración VIP guardada.' })
    } catch (e) {
      setFeedback({ ok: false, msg: (e as Error).message })
    }
    setTimeout(() => setFeedback(null), 3000)
  }

  if (isLoading) return <LoadingCard lines={6} />
  if (error) return <Callout.Root color="red"><Callout.Text>{(error as Error).message}</Callout.Text></Callout.Root>

  return (
    <Box>
      <Heading size="5" mb="4">Mensaje VIP</Heading>

      {feedback && (
        <Callout.Root color={feedback.ok ? 'green' : 'red'} mb="3">
          <Callout.Text>{feedback.msg}</Callout.Text>
        </Callout.Root>
      )}

      {config?.image_url && (
        <Card mb="4">
          <Text size="2" color="gray" mb="2" as="p">Imagen actual:</Text>
          <img
            src={config.image_url}
            alt="VIP"
            style={{ maxWidth: 240, borderRadius: 8, display: 'block' }}
          />
        </Card>
      )}

      <Card>
        <Flex direction="column" gap="3">
          <Heading size="3">Texto del mensaje</Heading>
          <TextArea placeholder="Texto ES" rows={3} value={textEs} onChange={(e) => setTextEs(e.target.value)} />
          <TextArea placeholder="Texto EN" rows={3} value={textEn} onChange={(e) => setTextEn(e.target.value)} />
          <TextArea placeholder="Texto PT" rows={3} value={textPt} onChange={(e) => setTextPt(e.target.value)} />

          <Heading size="3" mt="2">Botón</Heading>
          <TextField.Root placeholder="Texto botón ES" value={btnEs} onChange={(e) => setBtnEs(e.target.value)} />
          <TextField.Root placeholder="Texto botón EN" value={btnEn} onChange={(e) => setBtnEn(e.target.value)} />
          <TextField.Root placeholder="Texto botón PT" value={btnPt} onChange={(e) => setBtnPt(e.target.value)} />
          <TextField.Root placeholder="URL de invitación" value={inviteUrl} onChange={(e) => setInviteUrl(e.target.value)} />

          <Heading size="3" mt="2">Imagen</Heading>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13 }}
          />

          <Flex justify="end">
            <Button onClick={handleSave} loading={save.isPending}>
              <CheckIcon /> Guardar configuración
            </Button>
          </Flex>
        </Flex>
      </Card>
    </Box>
  )
}
