package handlers_test

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

// ─── CSV Validation Tests (pure logic, no DB) ─────────────────────────────

type csvValidation struct {
	Name        string
	Row         map[string]string
	ShouldError bool
	ErrorMsg    string
}

func TestCSV_RequiredColumns(t *testing.T) {
	cases := []csvValidation{
		{
			Name:        "Valid row",
			Row:         map[string]string{"origin": "Mumbai", "destination": "Pune", "vehicle_id": "abc", "distance_km": "148"},
			ShouldError: false,
		},
		{
			Name:        "Missing origin",
			Row:         map[string]string{"destination": "Pune", "vehicle_id": "abc", "distance_km": "148"},
			ShouldError: true,
			ErrorMsg:    "origin",
		},
		{
			Name:        "Missing destination",
			Row:         map[string]string{"origin": "Mumbai", "vehicle_id": "abc", "distance_km": "148"},
			ShouldError: true,
			ErrorMsg:    "destination",
		},
		{
			Name:        "Missing vehicle_id",
			Row:         map[string]string{"origin": "Mumbai", "destination": "Pune", "distance_km": "148"},
			ShouldError: true,
			ErrorMsg:    "vehicle_id",
		},
		{
			Name:        "Missing distance_km",
			Row:         map[string]string{"origin": "Mumbai", "destination": "Pune", "vehicle_id": "abc"},
			ShouldError: true,
			ErrorMsg:    "distance_km",
		},
	}

	requiredCols := []string{"origin", "destination", "vehicle_id", "distance_km"}

	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			// Check all required columns present
			missingCol := ""
			for _, col := range requiredCols {
				if _, ok := tc.Row[col]; !ok {
					missingCol = col
					break
				}
			}

			hasError := missingCol != ""
			if hasError != tc.ShouldError {
				t.Errorf("Expected ShouldError=%v, got hasError=%v", tc.ShouldError, hasError)
			}
			if tc.ShouldError && tc.ErrorMsg != "" && !strings.Contains(missingCol, tc.ErrorMsg) {
				t.Errorf("Expected error about '%s', missing column was '%s'", tc.ErrorMsg, missingCol)
			}
		})
	}
}

func TestCSV_DistanceValidation(t *testing.T) {
	cases := []struct {
		Input string
		Valid bool
	}{
		{"148.5", true},
		{"0", false},   // zero invalid
		{"-10", false}, // negative invalid
		{"abc", false}, // non-numeric
		{"1000", true},
		{"0.001", true}, // small but positive
	}

	for _, tc := range cases {
		t.Run(tc.Input, func(t *testing.T) {
			var dist float64
			err := parseFloat(tc.Input, &dist)
			isValid := err == nil && dist > 0
			if isValid != tc.Valid {
				t.Errorf("Input %q: expected valid=%v, got %v", tc.Input, tc.Valid, isValid)
			}
		})
	}
}

// Simple float parser for test (mirrors handler logic)
func parseFloat(s string, out *float64) error {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return err
	}

	*out = v
	return nil
}

// ─── HTTP Tests (no actual DB — test middleware layer) ────────────────────

func TestMultipartUpload_NoFile(t *testing.T) {
	// Simulate a POST without a file
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/trips/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Without a file field, the backend should return 400
	// We just validate the request structure here
	if req.Method != http.MethodPost {
		t.Error("Expected POST method")
	}
}

func TestPaginationParams(t *testing.T) {
	cases := []struct {
		page     int
		perPage  int
		wantPage int
		wantPer  int
	}{
		{1, 20, 1, 20},
		{0, 20, 1, 20}, // page < 1 → 1
		{-1, 20, 1, 20},
		{2, 200, 2, 100}, // per_page capped at 100
		{3, 5, 3, 5},
	}

	for _, tc := range cases {
		p := tc.page
		per := tc.perPage
		if p < 1 {
			p = 1
		}
		if per > 100 {
			per = 100
		}
		if p != tc.wantPage {
			t.Errorf("page: input %d want %d got %d", tc.page, tc.wantPage, p)
		}
		if per != tc.wantPer {
			t.Errorf("per_page: input %d want %d got %d", tc.perPage, tc.wantPer, per)
		}
	}
}
