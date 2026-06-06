'use client'

import { useEffect, useRef } from 'react'

// City coordinates lookup
const CITY_COORDS: Record<string, [number, number]> = {
  'Mumbai':     [19.0760, 72.8777],
  'Pune':       [18.5204, 73.8567],
  'Delhi':      [28.6139, 77.2090],
  'Agra':       [27.1767, 78.0081],
  'Bangalore':  [12.9716, 77.5946],
  'Chennai':    [13.0827, 80.2707],
  'Hyderabad':  [17.3850, 78.4867],
  'Vijayawada': [16.5062, 80.6480],
  'Coimbatore': [11.0168, 76.9558],
  'Surat':      [21.1702, 72.8311],
  'Jaipur':     [26.9124, 75.7873],
  'Nashik':     [19.9975, 73.7898],
  'Mysore':     [12.2958, 76.6394],
  'Nagpur':     [21.1458, 79.0882],
  'Chandigarh': [30.7333, 76.7794],
  'Madurai':    [9.9252, 78.1198],
  'Ahmedabad':  [23.0225, 72.5714],
  'Kolkata':    [22.5726, 88.3639],
  'Bhubaneswar':[20.2961, 85.8245],
}

function getCoords(city: string): [number, number] {
  return CITY_COORDS[city] || [20.5937, 78.9629] // India center fallback
}

interface RouteMapProps {
  origin: string
  destination: string
  tollBreakdowns?: { km: number; plaza_name: string; amount: number }[]
  fuelStops?: { km: number; name: string }[]
  distanceKm?: number
}

export function RouteMap({ origin, destination, tollBreakdowns, fuelStops, distanceKm }: RouteMapProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return
    if (mapRef.current) return // already initialized

    // Dynamic import to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default icon issue
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const originCoords = getCoords(origin)
      const destCoords = getCoords(destination)

      // Center map between origin and destination
      const centerLat = (originCoords[0] + destCoords[0]) / 2
      const centerLng = (originCoords[1] + destCoords[1]) / 2

      const map = L.map(containerRef.current!, { zoomControl: true }).setView([centerLat, centerLng], 6)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)

      // Origin marker (green)
      const greenIcon = L.divIcon({
        html: `<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(34,197,94,0.6)"></div>`,
        iconSize: [14, 14],
        className: '',
      })
      L.marker(originCoords, { icon: greenIcon }).addTo(map)
        .bindPopup(`<b>Origin:</b> ${origin}`)

      // Destination marker (red)
      const redIcon = L.divIcon({
        html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(239,68,68,0.6)"></div>`,
        iconSize: [14, 14],
        className: '',
      })
      L.marker(destCoords, { icon: redIcon }).addTo(map)
        .bindPopup(`<b>Destination:</b> ${destination}`)

      // Draw route polyline
      L.polyline([originCoords, destCoords], {
        color: '#22c55e',
        weight: 3,
        opacity: 0.8,
        dashArray: '8,4',
      }).addTo(map)

      // Toll plaza markers
      if (tollBreakdowns?.length) {
        tollBreakdowns.forEach((plaza) => {
          const ratio = plaza.km / (distanceKm || 300)
          const lat = originCoords[0] + (destCoords[0] - originCoords[0]) * ratio
          const lng = originCoords[1] + (destCoords[1] - originCoords[1]) * ratio
          const plazaIcon = L.divIcon({
            html: `<div style="background:#f59e0b;width:10px;height:10px;border-radius:2px;border:1.5px solid #fff;transform:rotate(45deg)"></div>`,
            iconSize: [10, 10],
            className: '',
          })
          L.marker([lat, lng], { icon: plazaIcon }).addTo(map)
            .bindPopup(`<b>${plaza.plaza_name}</b><br>Toll: ₹${plaza.amount}`)
        })
      }

      // Fuel stop markers
      if (fuelStops?.length) {
        fuelStops.forEach((stop) => {
          const ratio = stop.km / (distanceKm || 300)
          const lat = originCoords[0] + (destCoords[0] - originCoords[0]) * ratio
          const lng = originCoords[1] + (destCoords[1] - originCoords[1]) * ratio
          const fuelIcon = L.divIcon({
            html: `<div style="background:#3b82f6;width:10px;height:10px;border-radius:50%;border:1.5px solid #fff"></div>`,
            iconSize: [10, 10],
            className: '',
          })
          L.marker([lat, lng], { icon: fuelIcon }).addTo(map)
            .bindPopup(`<b>${stop.name}</b>`)
        })
      }
    })
  }, [origin, destination, tollBreakdowns, fuelStops, distanceKm])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-gray-900/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-xs space-y-1 z-[1000]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-500" />
          <span className="text-slate-300">Origin / Destination</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-400 rotate-45" />
          <span className="text-slate-300">Toll Plaza</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-slate-300">Fuel Stop</span>
        </div>
      </div>
    </div>
  )
}
