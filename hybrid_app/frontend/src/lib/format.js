export function formatNumber(value, digits) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? 1,
  })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatRelative(value) {
  if (!value) return ''
  const raw = String(value).replace(' ', 'T')
  const then = new Date(raw.length <= 19 && !raw.includes('Z') ? raw + 'Z' : raw).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDateTime(value)
}

export function formatCountdown(msLeft) {
  if (msLeft <= 0) return 'Expired'
  const totalMinutes = Math.floor(msLeft / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const secs = Math.floor((msLeft % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}h ${pad(mins)}m` : `${pad(mins)}m ${pad(secs)}s`
}

/* Food-safety severity, shared by every surface. Maps onto the
   --safe / --caution / --unsafe tokens. */
export function riskTone(safeHours) {
  const v = Number(safeHours)
  if (!Number.isFinite(v)) return 'unsafe'
  if (v <= 2) return 'unsafe'
  if (v <= 5) return 'caution'
  if (v <= 10) return 'ok'
  return 'safe'
}

export function riskLabel(safeHours) {
  return { unsafe: 'Unsafe', caution: 'Use fast', ok: 'Good', safe: 'Safest' }[riskTone(safeHours)]
}

/* Maps a risk tone onto a shadcn badge variant. */
export function riskBadgeVariant(safeHours) {
  const tone = riskTone(safeHours)
  if (tone === 'unsafe') return 'destructive'
  if (tone === 'caution') return 'secondary'
  if (tone === 'safe') return 'outline'
  return 'default'
}

export function safetyVar(safeHours) {
  const tone = riskTone(safeHours)
  return tone === 'safe' ? 'var(--safe)' : tone === 'caution' ? 'var(--caution)' : tone === 'ok' ? 'var(--foreground)' : 'var(--unsafe)'
}

export function safetySoftVar(safeHours) {
  const tone = riskTone(safeHours)
  return tone === 'safe' ? 'var(--safe-soft)' : tone === 'caution' ? 'var(--caution-soft)' : tone === 'ok' ? 'var(--muted)' : 'var(--unsafe-soft)'
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function escapeCsvCell(value) {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows, columns) {
  const head = columns.map((c) => escapeCsvCell(c.label)).join(',')
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(c.csv ? c.csv(row) : row[c.key])).join(','))
  return [head, ...lines].join('\n')
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 400)
}

export const titleCase = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())