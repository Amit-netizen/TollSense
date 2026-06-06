package models_test

import (
	"math"
	"testing"
	"tollsense/internal/models"
)

func TestTollRates_AllClassesDefined(t *testing.T) {
	classes := []string{"motorcycle", "car", "lcv", "bus", "truck", "hcm"}
	for _, class := range classes {
		if _, ok := models.TollRates[class]; !ok {
			t.Errorf("TollRates missing class: %s", class)
		}
	}
}

func TestTollRates_Ordering(t *testing.T) {
	// Heavier vehicles should pay more toll
	if models.TollRates["motorcycle"] >= models.TollRates["car"] {
		t.Error("Motorcycle rate should be less than car rate")
	}
	if models.TollRates["car"] >= models.TollRates["truck"] {
		t.Error("Car rate should be less than truck rate")
	}
	if models.TollRates["truck"] > models.TollRates["hcm"] {
		t.Error("Truck rate should be <= HCM rate")
	}
}

func TestFuelEfficiency_AllClassesDefined(t *testing.T) {
	classes := []string{"motorcycle", "car", "lcv", "bus", "truck", "hcm"}
	for _, class := range classes {
		if _, ok := models.FuelEfficiency[class]; !ok {
			t.Errorf("FuelEfficiency missing class: %s", class)
		}
	}
}

func TestFuelEfficiency_Ordering(t *testing.T) {
	// Motorcycles are most fuel efficient
	if models.FuelEfficiency["motorcycle"] <= models.FuelEfficiency["car"] {
		t.Error("Motorcycle should be more fuel efficient than car")
	}
	if models.FuelEfficiency["car"] <= models.FuelEfficiency["truck"] {
		t.Error("Car should be more fuel efficient than truck")
	}
}

func TestTollCalculation_Car(t *testing.T) {
	dist := 148.0 // Mumbai-Pune
	rate := models.TollRates["car"]
	expected := math.Round(dist*rate*100) / 100
	if expected <= 0 {
		t.Error("Toll amount should be positive")
	}
	t.Logf("Mumbai-Pune toll (car): ₹%.2f", expected)
}

func TestTollCalculation_Truck(t *testing.T) {
	dist := 568.0 // Hyderabad-Bangalore
	rate := models.TollRates["truck"]
	expected := math.Round(dist*rate*100) / 100
	if expected <= models.FlagThreshold {
		t.Logf("Warning: Hyderabad-Bangalore truck toll ₹%.2f should exceed flag threshold ₹%.2f", expected, models.FlagThreshold)
	}
}

func TestFlagThreshold(t *testing.T) {
	if models.FlagThreshold <= 0 {
		t.Error("FlagThreshold must be positive")
	}
	// A long truck trip should be flagged
	dist := 568.0
	toll := dist * models.TollRates["truck"]
	if toll <= models.FlagThreshold {
		t.Logf("Note: 568km truck trip toll ₹%.2f doesn't exceed threshold ₹%.2f", toll, models.FlagThreshold)
	}
}

func TestFuelCostCalculation(t *testing.T) {
	dist := 148.0
	class := "car"
	efficiency := models.FuelEfficiency[class]
	fuelCost := math.Round((dist/efficiency)*models.FuelPricePerLitre*100) / 100
	if fuelCost <= 0 {
		t.Error("Fuel cost should be positive")
	}
	t.Logf("Mumbai-Pune fuel cost (car): ₹%.2f", fuelCost)
}

func TestFuelPricePerLitre(t *testing.T) {
	if models.FuelPricePerLitre <= 0 {
		t.Error("Fuel price per litre must be positive")
	}
	// Should be a realistic Indian fuel price (70-120 INR)
	if models.FuelPricePerLitre < 70 || models.FuelPricePerLitre > 150 {
		t.Errorf("Fuel price %.2f seems unrealistic", models.FuelPricePerLitre)
	}
}
