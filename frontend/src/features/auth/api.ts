import { http } from '@/lib/http'

export interface Session {
  username: string
}

export const authApi = {
  me: () => http.get<Session>('/auth/me'),
  login: (credentials: { username: string; password: string }) =>
    http.post<Session>('/auth/login', credentials),
  logout: () => http.post<void>('/auth/logout'),
}
