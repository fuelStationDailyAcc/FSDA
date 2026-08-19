import { apiRequest } from './client'

export type SalaryEntry = {
  id: string
  name: string
  salaryPaise: number
  notes: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export async function fetchSalaries(activeOnly = false) {
  return apiRequest<SalaryEntry[]>(
    `/salaries${activeOnly ? '?activeOnly=true' : ''}`
  )
}

export async function createSalary(input: {
  name: string
  salaryRupees: string | number
  notes?: string
}) {
  return apiRequest<SalaryEntry>('/salaries', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSalary(
  id: string,
  input: {
    name?: string
    salaryRupees?: string | number
    notes?: string
    isActive?: boolean
  }
) {
  return apiRequest<SalaryEntry>(`/salaries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteSalary(id: string) {
  return apiRequest<SalaryEntry>(`/salaries/${id}`, { method: 'DELETE' })
}
