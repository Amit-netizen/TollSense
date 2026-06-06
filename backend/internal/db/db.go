package db

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

var DB *sqlx.DB

func Connect() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://tollsense:tollsense123@localhost:5432/tollsense_db?sslmode=disable"
	}

	var err error
	for i := 0; i < 10; i++ {
		DB, err = sqlx.Connect("postgres", dsn)
		if err == nil {
			break
		}
		log.Printf("DB connection attempt %d failed: %v. Retrying in 2s...", i+1, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	fmt.Println("✅ Database connected")
}
