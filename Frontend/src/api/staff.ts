import { apiRequest } from './client'
import type { StaffPermissions } from '../lib/permissions'

export type StaffAccount = {
  _id: string
  username: string
  email?: string | null
  role?: string
  stationName?: string | null
  ownerId?: string | null
  permissions: StaffPermissions
  createdAt?: string
  updatedAt?: string
}

export async function fetchStaff() {
  return apiRequest<StaffAccount[]>('/staff')
}

export async function createStaff(input: {
  username: string
  password: string
  permissions: StaffPermissions
}) {
  return apiRequest<StaffAccount>('/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateStaff(
  id: string,
  input: {
    username?: string
    password?: string
    permissions?: StaffPermissions
  }
) {
  return apiRequest<StaffAccount>(`/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteStaff(id: string) {
  return apiRequest(`/staff/${id}`, { method: 'DELETE' })
}
