import { API_BASE } from "./proxy"

export type ApiSuccess<T> = {
  success: boolean
  message: string
  data: T
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiSuccess<T>> {
  const token = localStorage.getItem("accessToken")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  })

  const payload = (await response.json()) as ApiSuccess<T> & { message?: string }

  if (!response.ok) {
    throw new Error(payload.message || "Request failed")
  }

  return payload
}
