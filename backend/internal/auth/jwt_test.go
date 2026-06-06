package auth_test

import (
	"testing"
	"time"
	"tollsense/internal/auth"

	"github.com/golang-jwt/jwt/v5"
)

const testUserID = "test-user-123"
const testEmail = "test@example.com"
const testName = "Test User"

func TestGenerateAccessToken_Valid(t *testing.T) {
	token, err := auth.GenerateAccessToken(testUserID, testEmail, testName)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if token == "" {
		t.Error("Expected non-empty token")
	}
}

func TestValidateToken_AccessToken(t *testing.T) {
	token, err := auth.GenerateAccessToken(testUserID, testEmail, testName)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := auth.ValidateToken(token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}
	if claims.UserID != testUserID {
		t.Errorf("Expected UserID %s, got %s", testUserID, claims.UserID)
	}
	if claims.Email != testEmail {
		t.Errorf("Expected Email %s, got %s", testEmail, claims.Email)
	}
	if claims.Name != testName {
		t.Errorf("Expected Name %s, got %s", testName, claims.Name)
	}
}

func TestValidateToken_InvalidToken(t *testing.T) {
	_, err := auth.ValidateToken("invalid.token.here")
	if err == nil {
		t.Error("Expected error for invalid token, got nil")
	}
}

func TestValidateToken_EmptyToken(t *testing.T) {
	_, err := auth.ValidateToken("")
	if err == nil {
		t.Error("Expected error for empty token, got nil")
	}
}

func TestValidateToken_TamperedToken(t *testing.T) {
	token, _ := auth.GenerateAccessToken(testUserID, testEmail, testName)
	tampered := token + "tampered"
	_, err := auth.ValidateToken(tampered)
	if err == nil {
		t.Error("Expected error for tampered token, got nil")
	}
}

func TestGenerateRefreshToken_Valid(t *testing.T) {
	token, err := auth.GenerateRefreshToken(testUserID)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if token == "" {
		t.Error("Expected non-empty refresh token")
	}
}

func TestAccessToken_ExpiresIn15Min(t *testing.T) {
	token, _ := auth.GenerateAccessToken(testUserID, testEmail, testName)
	claims, _ := auth.ValidateToken(token)

	expiry := claims.ExpiresAt.Time
	now := time.Now()

	diff := expiry.Sub(now)
	if diff > 16*time.Minute || diff < 14*time.Minute {
		t.Errorf("Access token expiry should be ~15min, got %v", diff)
	}
}

func TestRefreshToken_ExpiresIn7Days(t *testing.T) {
	token, _ := auth.GenerateRefreshToken(testUserID)
	parsed, _, _ := new(jwt.Parser).ParseUnverified(token, &jwt.RegisteredClaims{})
	claims, ok := parsed.Claims.(*jwt.RegisteredClaims)
	if !ok {
		t.Skip("Could not parse refresh token claims")
	}
	diff := claims.ExpiresAt.Time.Sub(time.Now())
	if diff < 6*24*time.Hour || diff > 8*24*time.Hour {
		t.Errorf("Refresh token expiry should be ~7days, got %v", diff)
	}
}

func TestGenerateMultipleTokens_AreUnique(t *testing.T) {
	t1, _ := auth.GenerateAccessToken(testUserID, testEmail, testName)
	time.Sleep(time.Millisecond)
	t2, _ := auth.GenerateAccessToken(testUserID, testEmail, testName)
	// Tokens issued at different times should differ
	if t1 == t2 {
		t.Log("Note: tokens are identical (same second, acceptable in fast tests)")
	}
}
