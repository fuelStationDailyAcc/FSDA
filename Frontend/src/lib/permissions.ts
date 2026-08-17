export type PermissionArea = 'accounts' | 'ledger' | 'settings'
export type PermissionAction = 'read' | 'write'
export type PermissionKey = `${PermissionArea}.${PermissionAction}`

export type StaffPermissions = {
  accounts: { read: boolean; write: boolean }
  ledger: { read: boolean; write: boolean }
  settings: { read: boolean; write: boolean }
}

export type PermissionUser = {
  role?: string
  ownerId?: string | null
  isOwner?: boolean
  permissions?: StaffPermissions
}

export const PERMISSION_AREAS: Array<{
  key: PermissionArea
  label: string
  hint: string
}> = [
  {
    key: 'accounts',
    label: 'Daily Accounts',
    hint: 'Meter readings, cash, expenses, and closing the day',
  },
  {
    key: 'ledger',
    label: 'Ledger',
    hint: 'Customers, udhaar, and party balances',
  },
  {
    key: 'settings',
    label: 'Settings',
    hint: 'Fuel products, payment methods, and categories',
  },
]

export const EMPTY_PERMISSIONS: StaffPermissions = {
  accounts: { read: false, write: false },
  ledger: { read: false, write: false },
  settings: { read: false, write: false },
}

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  accounts: { read: true, write: true },
  ledger: { read: true, write: false },
  settings: { read: false, write: false },
}

export const FULL_PERMISSIONS: StaffPermissions = {
  accounts: { read: true, write: true },
  ledger: { read: true, write: true },
  settings: { read: true, write: true },
}

export function normalizePermissions(input?: StaffPermissions | null): StaffPermissions {
  const source = input || EMPTY_PERMISSIONS
  const next: StaffPermissions = {
    accounts: {
      read: Boolean(source.accounts?.read),
      write: Boolean(source.accounts?.write),
    },
    ledger: {
      read: Boolean(source.ledger?.read),
      write: Boolean(source.ledger?.write),
    },
    settings: {
      read: Boolean(source.settings?.read),
      write: Boolean(source.settings?.write),
    },
  }
  for (const area of Object.keys(next) as PermissionArea[]) {
    if (next[area].write) next[area].read = true
  }
  return next
}

export function isOwner(user: PermissionUser | null | undefined) {
  if (!user) return false
  if (typeof user.isOwner === 'boolean') return user.isOwner
  if (user.ownerId) return false
  const role = String(user.role || '').toLowerCase()
  if (role === 'staff') return false
  return role === 'admin' || role === 'manager'
}

export function hasPermission(user: PermissionUser | null | undefined, key: PermissionKey) {
  if (!user) return false
  if (isOwner(user)) return true
  const [area, action] = key.split('.') as [PermissionArea, PermissionAction]
  const permissions = normalizePermissions(user.permissions)
  return Boolean(permissions[area]?.[action])
}

export function setPermission(
  current: StaffPermissions,
  area: PermissionArea,
  action: PermissionAction,
  value: boolean
): StaffPermissions {
  const next = normalizePermissions(current)
  next[area][action] = value
  if (action === 'write' && value) next[area].read = true
  if (action === 'read' && !value) next[area].write = false
  return next
}
