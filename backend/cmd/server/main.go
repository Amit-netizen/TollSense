package main

import (
	"fmt"
	"log"
	"os"
	"tollsense/internal/db"
	"tollsense/internal/handlers"
	"tollsense/internal/middleware"
	"tollsense/internal/ws"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	fiberws "github.com/gofiber/websocket/v2"
)

func main() {
	db.Connect()

	app := fiber.New(fiber.Config{
		AppName:       "TollSense API v1.0",
		BodyLimit:     10 * 1024 * 1024, // 10MB
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	// Global middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} | ${status} | ${latency} | ${method} ${path}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Authorization",
	}))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "tollsense-api"})
	})

	// Auth routes (public)
	auth := app.Group("/auth")
	auth.Post("/login", handlers.Login)
	auth.Post("/refresh", handlers.RefreshToken)

	// WebSocket (before JWT middleware)
	app.Use("/ws", func(c *fiber.Ctx) error {
		if fiberws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws/trips", fiberws.New(ws.Handler))

	// Protected API routes
	api := app.Group("/api", middleware.JWTProtected())

	// Trips
	api.Get("/trips", handlers.GetTrips)
	api.Get("/trips/:id", handlers.GetTripByID)
	api.Get("/trips/:id/route", handlers.GetTripRoute)
	api.Post("/trips/upload", handlers.UploadTrips)

	// Vehicles
	api.Get("/vehicles", handlers.GetVehicles)

	// Analytics
	api.Get("/analytics/summary", handlers.GetAnalyticsSummary)
	api.Get("/analytics/spend", handlers.GetSpendOverTime)
	api.Get("/analytics/corridors", handlers.GetTopCorridors)

	// Start WebSocket broadcaster
	ws.StartBroadcaster()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 TollSense API running on :%s\n", port)
	log.Fatal(app.Listen(":" + port))
}
