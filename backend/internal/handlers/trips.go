package handlers

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"tollsense/internal/db"
	"tollsense/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type PaginatedTrips struct {
	Data    []models.Trip `json:"data"`
	Total   int           `json:"total"`
	Page    int           `json:"page"`
	PerPage int           `json:"per_page"`
}

func GetTrips(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	perPage := c.QueryInt("per_page", 20)
	status := c.Query("status", "")
	if page < 1 {
		page = 1
	}
	if perPage > 100 {
		perPage = 100
	}
	offset := (page - 1) * perPage

	whereClause := ""
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		whereClause = fmt.Sprintf("WHERE t.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM trips t %s`, whereClause)
	var total int
	if err := db.DB.Get(&total, countQuery, args...); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to count trips"})
	}

	args = append(args, perPage, offset)
	query := fmt.Sprintf(`
		SELECT 
			t.id, t.vehicle_id, t.origin, t.destination, t.distance_km, t.status, 
			t.created_at, t.updated_at,
			v.name AS vehicle_name, v.class AS vehicle_class,
			te.toll_amount, te.fuel_cost, te.flagged
		FROM trips t
		LEFT JOIN vehicles v ON v.id = t.vehicle_id
		LEFT JOIN toll_estimates te ON te.trip_id = t.id
		%s
		ORDER BY t.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	var trips []models.Trip
	if err := db.DB.Select(&trips, query, args...); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch trips"})
	}

	return c.JSON(PaginatedTrips{
		Data:    trips,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	})
}

func GetTripByID(c *fiber.Ctx) error {
	id := c.Params("id")
	var trip models.Trip
	err := db.DB.Get(&trip, `
		SELECT 
			t.id, t.vehicle_id, t.origin, t.destination, t.distance_km, t.status,
			t.created_at, t.updated_at,
			v.name AS vehicle_name, v.class AS vehicle_class,
			te.toll_amount, te.fuel_cost, te.flagged
		FROM trips t
		LEFT JOIN vehicles v ON v.id = t.vehicle_id
		LEFT JOIN toll_estimates te ON te.trip_id = t.id
		WHERE t.id = $1
	`, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Trip not found"})
	}
	return c.JSON(trip)
}

type RouteDetail struct {
	Trip        models.Trip     `json:"trip"`
	Estimate    models.TollEstimate `json:"estimate"`
	Breakdown   []TollBreakdown `json:"breakdown"`
	FuelStops   []FuelStop      `json:"fuel_stops"`
}

type TollBreakdown struct {
	PlazaName  string  `json:"plaza_name"`
	Km         float64 `json:"km"`
	Amount     float64 `json:"amount"`
}

type FuelStop struct {
	Name     string  `json:"name"`
	Km       float64 `json:"km"`
	PricePerL float64 `json:"price_per_l"`
}

func GetTripRoute(c *fiber.Ctx) error {
	id := c.Params("id")

	var trip models.Trip
	err := db.DB.Get(&trip, `
		SELECT t.*, v.name AS vehicle_name, v.class AS vehicle_class
		FROM trips t
		LEFT JOIN vehicles v ON v.id = t.vehicle_id
		WHERE t.id = $1
	`, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Trip not found"})
	}

	var estimate models.TollEstimate
	db.DB.Get(&estimate, "SELECT * FROM toll_estimates WHERE trip_id = $1", id)

	// Simulate toll plaza breakdown
	plazaCount := int(math.Max(1, math.Round(trip.DistanceKM/80)))
	breakdowns := make([]TollBreakdown, 0, plazaCount)
	perPlaza := estimate.TollAmount / float64(plazaCount)
	for i := 0; i < plazaCount; i++ {
		km := (trip.DistanceKM / float64(plazaCount+1)) * float64(i+1)
		breakdowns = append(breakdowns, TollBreakdown{
			PlazaName: fmt.Sprintf("Plaza %d (%s corridor)", i+1, trip.Origin),
			Km:        math.Round(km*10) / 10,
			Amount:    math.Round(perPlaza*100) / 100,
		})
	}

	// Fuel stops every 150 km
	fuelStops := []FuelStop{}
	for km := 150.0; km < trip.DistanceKM; km += 150 {
		fuelStops = append(fuelStops, FuelStop{
			Name:      fmt.Sprintf("HP Petrol Pump (~%.0f km)", km),
			Km:        km,
			PricePerL: models.FuelPricePerLitre,
		})
	}

	return c.JSON(RouteDetail{
		Trip:      trip,
		Estimate:  estimate,
		Breakdown: breakdowns,
		FuelStops: fuelStops,
	})
}

type UploadResponse struct {
	Inserted int      `json:"inserted"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors"`
}

func UploadTrips(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No file uploaded"})
	}

	f, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to open file"})
	}
	defer f.Close()

	reader := csv.NewReader(bufio.NewReader(f))
	reader.TrimLeadingSpace = true

	// Read header
	header, err := reader.Read()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to read CSV header"})
	}

	colIdx := map[string]int{}
	for i, h := range header {
		colIdx[strings.ToLower(strings.TrimSpace(h))] = i
	}

	requiredCols := []string{"origin", "destination", "vehicle_id", "distance_km"}
	for _, col := range requiredCols {
		if _, ok := colIdx[col]; !ok {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Missing required column: %s", col),
			})
		}
	}

	var inserted, skipped int
	var errs []string
	rowNum := 1

	for {
		rowNum++
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			errs = append(errs, fmt.Sprintf("Row %d: parse error: %v", rowNum, err))
			skipped++
			continue
		}

		origin := strings.TrimSpace(row[colIdx["origin"]])
		destination := strings.TrimSpace(row[colIdx["destination"]])
		vehicleID := strings.TrimSpace(row[colIdx["vehicle_id"]])
		distStr := strings.TrimSpace(row[colIdx["distance_km"]])

		if origin == "" || destination == "" || vehicleID == "" {
			errs = append(errs, fmt.Sprintf("Row %d: missing required fields", rowNum))
			skipped++
			continue
		}

		dist, err := strconv.ParseFloat(distStr, 64)
		if err != nil || dist <= 0 {
			errs = append(errs, fmt.Sprintf("Row %d: invalid distance_km: %s", rowNum, distStr))
			skipped++
			continue
		}

		// Validate vehicle exists
		var vehicle models.Vehicle
		if err := db.DB.Get(&vehicle, "SELECT * FROM vehicles WHERE id = $1", vehicleID); err != nil {
			errs = append(errs, fmt.Sprintf("Row %d: vehicle_id not found: %s", rowNum, vehicleID))
			skipped++
			continue
		}

		// Insert trip
		tripID := uuid.New().String()
		_, err = db.DB.Exec(`
			INSERT INTO trips (id, vehicle_id, origin, destination, distance_km, status)
			VALUES ($1, $2, $3, $4, $5, 'pending')
		`, tripID, vehicleID, origin, destination, dist)
		if err != nil {
			errs = append(errs, fmt.Sprintf("Row %d: DB insert failed: %v", rowNum, err))
			skipped++
			continue
		}

		// Compute toll estimate
		rate := models.TollRates[vehicle.Class]
		efficiency := models.FuelEfficiency[vehicle.Class]
		tollAmt := math.Round(dist*rate*100) / 100
		fuelCost := math.Round((dist/efficiency)*models.FuelPricePerLitre*100) / 100
		flagged := tollAmt > models.FlagThreshold

		db.DB.Exec(`
			INSERT INTO toll_estimates (trip_id, toll_amount, fuel_cost, flagged)
			VALUES ($1, $2, $3, $4)
		`, tripID, tollAmt, fuelCost, flagged)

		// Update corridors
		corridorName := origin + " → " + destination
		db.DB.Exec(`
			INSERT INTO corridors (id, name, avg_toll, trip_count)
			VALUES ($1, $2, $3, 1)
			ON CONFLICT (name) DO UPDATE
			  SET avg_toll = (corridors.avg_toll * corridors.trip_count + EXCLUDED.avg_toll) / (corridors.trip_count + 1),
			      trip_count = corridors.trip_count + 1,
			      updated_at = NOW()
		`, uuid.New().String(), corridorName, tollAmt)

		inserted++
	}

	return c.JSON(UploadResponse{
		Inserted: inserted,
		Skipped:  skipped,
		Errors:   errs,
	})
}

func GetVehicles(c *fiber.Ctx) error {
	var vehicles []models.Vehicle
	if err := db.DB.Select(&vehicles, "SELECT * FROM vehicles ORDER BY name"); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch vehicles"})
	}
	return c.JSON(vehicles)
}
