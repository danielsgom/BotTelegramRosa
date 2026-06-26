import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchStripeLinks,
  createStripeLink,
  updateStripeLink,
  deleteStripeLink,
  fetchAdminStripeLinks,
} from '../api/stripeLinks'

const KEY = 'stripe-links'

export const useStripeLinks = () =>
  useQuery({ queryKey: [KEY], queryFn: fetchStripeLinks })

export const useAdminStripeLinks = () =>
  useQuery({ queryKey: [KEY, 'admin'], queryFn: fetchAdminStripeLinks })

export const useCreateStripeLink = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createStripeLink,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export const useUpdateStripeLink = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateStripeLink>[1] }) =>
      updateStripeLink(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export const useDeleteStripeLink = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteStripeLink,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
