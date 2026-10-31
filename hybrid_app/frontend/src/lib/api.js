/**
 * Thin fetch wrapper. Rejects on non-2xx or a non-success status so callers
 * can treat a resolved promise as "it worked".
 *
 * When the SPA is hosted separately from Flask (e.g. GitHub Pages), set
 * VITE_API_BASE_URL at build time to the backend origin. Empty means
 * same-origin, which is what local development uses.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function toApiUrl(path) {
  if (!API_BASE_URL) return path
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

async function request(path, options = {}) {
  const { method = 'GET', body, signal } = options
  const headers = {}
  let payload

  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(toApiUrl(path), { method, headers, body: payload, signal })
  } catch {
    throw new Error('Network error — is the FoodSave server running?')
  }

  let data = {}
  try {
    data = await response.json()
  } catch {
    data = {}
  }

  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
  if (data && Object.prototype.hasOwnProperty.call(data, 'status') && data.status !== 'success') {
    throw new Error(data.message || 'Request failed')
  }
  return data
}

export const apiGet = (path, options) => request(path, { ...options, method: 'GET' })
export const apiSend = (path, method, body) => request(path, { method, body })