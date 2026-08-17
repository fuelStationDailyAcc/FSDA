import { USERS_API } from "./proxy"

import type { StaffPermissions } from '../lib/permissions'

export type AuthUser = {
  _id: string
  username: string
  email?: string | null
  role?: string
  stationName?: string | null
  ownerId?: string | null
  isOwner?: boolean
  permissions?: StaffPermissions
}

type ApiSuccess<T> = {
  success: boolean
  message: string
  data: T
}

async function request<T>(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("accessToken")
  const response = await fetch(`${USERS_API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const payload = (await response.json()) as ApiSuccess<T> & { message?: string }

  if (!response.ok) {
    throw new Error(payload.message || "Request failed")
  }

  return payload
}

export async function registerRequest(input: {
  username: string
  email: string
  password: string
  stationName: string
}) {
  return request<{ user: AuthUser; accessToken: string }>("/register", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function loginRequest(input: {
  identifier: string
  password: string
}) {
  const identifier = input.identifier.trim()
  return request<{ user: AuthUser; accessToken: string }>("/login", {
    method: "POST",
    body: JSON.stringify({
      username: identifier,
      email: identifier,
      password: input.password,
    }),
  })
}

export async function logoutRequest() {
  return request("/logout", { method: "POST" })
}

export async function meRequest() {
  return request<AuthUser>("/me")
}

export async function deleteAccountRequest() {
  return request("/me", { method: "DELETE" })
}
