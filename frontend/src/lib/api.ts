import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        localStorage.setItem('access_token', data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
}

export const tripsApi = {
  list: (page = 1, perPage = 20, status = '') =>
    api.get('/api/trips', { params: { page, per_page: perPage, status } }),
  getById: (id: string) => api.get(`/api/trips/${id}`),
  getRoute: (id: string) => api.get(`/api/trips/${id}/route`),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/trips/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  vehicles: () => api.get('/api/vehicles'),
}

export const analyticsApi = {
  summary: () => api.get('/api/analytics/summary'),
  spend: () => api.get('/api/analytics/spend'),
  corridors: () => api.get('/api/analytics/corridors'),
}
