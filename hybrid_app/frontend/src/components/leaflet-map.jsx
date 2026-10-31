import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { riskTone } from '@/lib/format'

/**
 * Leaflet map of donor coordinates.
 * Colour encodes the safety band, radius encodes quantity.
 */
export function LeafletMap({ rows = [], className = '' }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return
    const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true }).setView([20.2961, 85.8245], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()

    const css = getComputedStyle(document.documentElement)
    const cssVar = (name) => css.getPropertyValue(name).trim()
    const bounds = []

    rows.forEach((r) => {
      const lat = Number(r.donor_latitude)
      const lng = Number(r.donor_longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

      const tone = riskTone(r.safe_hours)
      const color =
        tone === 'safe' ? cssVar('--safe') : tone === 'caution' ? cssVar('--caution') : tone === 'ok' ? cssVar('--foreground') : cssVar('--unsafe')
      const radius = Math.max(6, Math.min(16, 5 + Number(r.qty || 0) / 6))

      L.circleMarker([lat, lng], { radius, color, weight: 2, fillColor: color, fillOpacity: 0.3 })
        .bindPopup(
          `<b>${escapeHtml(r.food_name)}</b><br/>${escapeHtml(r.donor_name)}<br/>${r.qty} kg · safe ${Number(
            r.safe_hours,
          ).toFixed(1)}h${r.distance_km != null ? `<br/>${r.distance_km} km away` : ''}`,
        )
        .addTo(layer)

      bounds.push([lat, lng])
    })

    if (bounds.length && mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
    }
  }, [rows])

  return (
    <div
      ref={hostRef}
      className={`h-[520px] w-full overflow-hidden rounded-[10px] border border-[var(--hig-separator)] ${className}`}
      role="application"
      aria-label="Map of food listings"
    />
  )
}

export function MapLegend() {
  const items = [
    ['safe', '10h+ safe'],
    ['ok', '5–10h'],
    ['caution', '2–5h'],
    ['unsafe', 'under 2h'],
  ]
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
      {items.map(([tone, label]) => (
        <span key={tone} className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: `var(--${tone === 'ok' ? 'foreground' : tone})` }} />
          {label}
        </span>
      ))}
    </div>
  )
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
}