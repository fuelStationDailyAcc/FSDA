import { USERS_API } from "./proxy"

export type AuthUser = {
  _id: string
  username: string
  email: string
  role?: string
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
}) {
  return request<{ user: AuthUser; accessToken: string }>("/register", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function loginRequest(input: {
  email: string
  password: string
}) {
  return request<{ user: AuthUser; accessToken: string }>("/login", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function logoutRequest() {
  return request("/logout", { method: "POST" })
}

export async function meRequest() {
  return request<AuthUser>("/me")
}
