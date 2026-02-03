import axios from 'axios'

const API_BASE = 'http://localhost:8000/api'

const api = axios.create({ baseURL: API_BASE })


function getFromStorage(key) {
  return sessionStorage.getItem(key)
}


function clearAuthStorage() {
  sessionStorage.removeItem('access');
  sessionStorage.removeItem('refresh');
  sessionStorage.removeItem('user');
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
  localStorage.removeItem('user');
}


function setAccessPreservingStorage(access) {
  sessionStorage.setItem('access', access)
}

let refreshPromise = null

async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw new Error('No refresh token')
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE}/auth/refresh/`, { refresh: refreshToken })
      .then((res) => {
        const newAccess = res.data.access
        setAccessPreservingStorage(newAccess)
        return newAccess
      })
      .catch((e) => {
        clearAuthStorage()
        throw e
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.request.use((config) => {
  const access = getFromStorage('access')
  if (access) config.headers.Authorization = `Bearer ${access}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error?.response?.status
    const originalRequest = error?.config || {}

    // Avoid infinite retry loops
    if (status === 401 && !originalRequest._retry) {
      const refresh = getFromStorage('refresh')
      if (!refresh) {
        clearAuthStorage()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        originalRequest._retry = true
        const newAccess = await refreshAccessToken(refresh)
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccess}`
        return api.request(originalRequest)
      } catch (e) {
        clearAuthStorage()
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
