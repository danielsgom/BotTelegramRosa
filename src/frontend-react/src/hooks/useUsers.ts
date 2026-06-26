import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  resumeSequence,
} from '../api/users'

const KEY = 'users'

export const useUsers = (params?: { active?: boolean; vip?: boolean; status?: string }) =>
  useQuery({ queryKey: [KEY, params], queryFn: () => fetchUsers(params) })

export const useCreateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export const useUpdateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export const useDeleteUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export const useResumeSequence = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resumeSequence,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
