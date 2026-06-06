package models

import (
	"time"
)

type Vehicle struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	Class     string    `db:"class" json:"class"`
	AxleCount int       `db:"axle_count" json:"axle_count"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type Trip struct {
	ID          string    `db:"id" json:"id"`
	VehicleID   string    `db:"vehicle_id" json:"vehicle_id"`
	Origin      string    `db:"origin" json:"origin"`
	Destination string    `db:"destination" json:"destination"`
	DistanceKM  float64   `db:"distance_km" json:"distance_km"`
	Status      string    `db:"status" json:"status"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`

	// Joined fields
	VehicleName  *string  `db:"vehicle_name" json:"vehicle_name,omitempty"`
	VehicleClass *string  `db:"vehicle_class" json:"vehicle_class,omitempty"`
	TollAmount   *float64 `db:"toll_amount" json:"toll_amount,omitempty"`
	FuelCost     *float64 `db:"fuel_cost" json:"fuel_cost,omitempty"`
	Flagged      *bool    `db:"flagged" json:"flagged,omitempty"`
}

type TollEstimate struct {
	ID         string    `db:"id" json:"id"`
	TripID     string    `db:"trip_id" json:"trip_id"`
	TollAmount float64   `db:"toll_amount" json:"toll_amount"`
	FuelCost   float64   `db:"fuel_cost" json:"fuel_cost"`
	Flagged    bool      `db:"flagged" json:"flagged"`
	ComputedAt time.Time `db:"computed_at" json:"computed_at"`
}

type Corridor struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	AvgToll   float64   `db:"avg_toll" json:"avg_toll"`
	TripCount int       `db:"trip_count" json:"trip_count"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type User struct {
	ID           string    `db:"id" json:"id"`
	Email        string    `db:"email" json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
	Name         string    `db:"name" json:"name"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// CSV import row
type TripCSVRow struct {
	Origin      string  `csv:"origin"`
	Destination string  `csv:"destination"`
	VehicleID   string  `csv:"vehicle_id"`
	DistanceKM  float64 `csv:"distance_km"`
}

// Analytics response
type AnalyticsSummary struct {
	TotalTrips     int     `json:"total_trips"`
	TotalTollSpend float64 `json:"total_toll_spend"`
	AvgCostPerTrip float64 `json:"avg_cost_per_trip"`
	FlaggedRoutes  int     `json:"flagged_routes"`
}

type SpendDataPoint struct {
	Date  string  `db:"date" json:"date"`
	Spend float64 `db:"spend" json:"spend"`
}

// Toll rate table (per km, by vehicle class)
var TollRates = map[string]float64{
	"motorcycle": 0.50,
	"car":        1.00,
	"lcv":        1.50,
	"bus":        2.00,
	"truck":      2.75,
	"hcm":        3.50,
}

// Fuel efficiency (km per litre, by vehicle class)
var FuelEfficiency = map[string]float64{
	"motorcycle": 45.0,
	"car":        18.0,
	"lcv":        14.0,
	"bus":        6.0,
	"truck":      4.5,
	"hcm":        3.5,
}

const FuelPricePerLitre = 102.0 // INR

// FlagThreshold — trips with toll > this amount get flagged
const FlagThreshold = 400.0
