import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchVipConfig, saveVipConfig } from '../api/vip'

const KEY = 'vip-config'

export const useVipConfig = () =>
  useQuery({ queryKey: [KEY], queryFn: fetchVipConfig })

export const useSaveVipConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveVipConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
