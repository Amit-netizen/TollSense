package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
	"tollsense/internal/db"

	"github.com/gofiber/websocket/v2"
)

type TripEvent struct {
	Type      string `json:"type"`
	TripID    string `json:"trip_id"`
	TripNum   int    `json:"trip_num"`
	Origin    string `json:"origin"`
	Dest      string `json:"destination"`
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

type Hub struct {
	clients map[*websocket.Conn]bool
	mu      sync.RWMutex
}

var GlobalHub = &Hub{
	clients: make(map[*websocket.Conn]bool),
}

func (h *Hub) AddClient(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = true
}

func (h *Hub) RemoveClient(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, conn)
}

func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for conn := range h.clients {
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("WS write error: %v", err)
		}
	}
}

func Handler(c *websocket.Conn) {
	GlobalHub.AddClient(c)
	defer func() {
		GlobalHub.RemoveClient(c)
		c.Close()
	}()

	// Send welcome message
	welcome := TripEvent{
		Type:      "connected",
		Status:    "Live trip feed active",
		Timestamp: time.Now().Format(time.RFC3339),
	}
	if data, err := json.Marshal(welcome); err == nil {
		c.WriteMessage(websocket.TextMessage, data)
	}

	// Keep connection alive, read messages (ping/pong)
	for {
		_, _, err := c.ReadMessage()
		if err != nil {
			break
		}
	}
}

// StartBroadcaster runs in a goroutine, emitting simulated events every 3s
func StartBroadcaster() {
	ticker := time.NewTicker(3 * time.Second)
	statuses := []string{"in_progress", "completed", "pending", "in_progress", "completed"}
	statusIdx := 0

	go func() {
		for range ticker.C {
			// Fetch a real trip from DB to simulate
			var trips []struct {
				ID          string `db:"id"`
				Origin      string `db:"origin"`
				Destination string `db:"destination"`
			}
			db.DB.Select(&trips, `
				SELECT id, origin, destination FROM trips 
				ORDER BY RANDOM() LIMIT 1
			`)

			if len(trips) == 0 {
				continue
			}

			trip := trips[0]
			status := statuses[statusIdx%len(statuses)]
			statusIdx++

			// Update DB status
			db.DB.Exec("UPDATE trips SET status = $1, updated_at = NOW() WHERE id = $2", status, trip.ID)

			event := TripEvent{
				Type:      "trip_update",
				TripID:    trip.ID,
				TripNum:   statusIdx,
				Origin:    trip.Origin,
				Dest:      trip.Destination,
				Status:    status,
				Timestamp: time.Now().Format(time.RFC3339),
			}
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}

			GlobalHub.Broadcast(data)
			fmt.Printf("📡 Broadcast: Trip %s → %s [%s]\n", trip.Origin, trip.Destination, status)
		}
	}()
}
