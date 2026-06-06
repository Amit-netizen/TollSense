FROM golang:1.21-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o tollsense ./cmd/server

FROM alpine:3.18
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /app/tollsense .

EXPOSE 8080
CMD ["./tollsense"]
