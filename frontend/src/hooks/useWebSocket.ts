'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTripStore } from '@/store'
import type { TripEvent } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null)
  const addLiveEvent = useTripStore((s) => s.addLiveEvent)

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    try {
      ws.current = new WebSocket(`${WS_URL}/ws/trips`)

      ws.current.onopen = () => {
        console.log('✅ WS connected')
      }

      ws.current.onmessage = (e) => {
        try {
          const event: TripEvent = JSON.parse(e.data)
          addLiveEvent(event)
        } catch {
          console.warn('WS parse error', e.data)
        }
      }

      ws.current.onclose = () => {
        console.log('WS closed — reconnecting in 3s')
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.current.onerror = (err) => {
        console.error('WS error', err)
        ws.current?.close()
      }
    } catch (err) {
      console.error('WS connection failed', err)
      reconnectTimer.current = setTimeout(connect, 5000)
    }
  }, [addLiveEvent])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  return {
    connected: ws.current?.readyState === WebSocket.OPEN,
  }
}
