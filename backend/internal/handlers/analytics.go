package handlers

import (
	"tollsense/internal/db"
	"tollsense/internal/models"

	"github.com/gofiber/fiber/v2"
)

func GetAnalyticsSummary(c *fiber.Ctx) error {
	var summary models.AnalyticsSummary

	err := db.DB.Get(&summary, `
		SELECT
			COUNT(DISTINCT t.id) AS total_trips,
			COALESCE(SUM(te.toll_amount), 0) AS total_toll_spend,
			COALESCE(AVG(te.toll_amount), 0) AS avg_cost_per_trip,
			COUNT(DISTINCT CASE WHEN te.flagged THEN t.id END) AS flagged_routes
		FROM trips t
		LEFT JOIN toll_estimates te ON te.trip_id = t.id
	`)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to compute summary"})
	}

	return c.JSON(summary)
}

func GetSpendOverTime(c *fiber.Ctx) error {
	var data []models.SpendDataPoint
	err := db.DB.Select(&data, `
		SELECT 
			TO_CHAR(t.created_at::date, 'YYYY-MM-DD') AS date,
			COALESCE(SUM(te.toll_amount), 0) AS spend
		FROM trips t
		LEFT JOIN toll_estimates te ON te.trip_id = t.id
		WHERE t.created_at >= NOW() - INTERVAL '30 days'
		GROUP BY t.created_at::date
		ORDER BY t.created_at::date ASC
	`)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch spend data"})
	}
	return c.JSON(data)
}

func GetTopCorridors(c *fiber.Ctx) error {
	var corridors []models.Corridor
	err := db.DB.Select(&corridors, `
		SELECT * FROM corridors
		ORDER BY avg_toll DESC
		LIMIT 5
	`)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch corridors"})
	}
	return c.JSON(corridors)
}
