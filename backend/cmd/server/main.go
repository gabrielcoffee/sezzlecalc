// Command server runs the calculator HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gabrielcoffee/sezzlecalc/backend/internal/api"
)

type config struct {
	port      string
	rateRPS   float64
	rateBurst int
	// ipHeader names a header with the real client IP, for use behind a
	// proxy that overwrites it (X-Real-IP on Vercel). Empty: use RemoteAddr.
	ipHeader string
	// staticDir, when set, holds the built frontend to serve (Docker image).
	staticDir string
}

// loadConfig reads settings from the environment, falling back to defaults.
func loadConfig(getenv func(string) string) (config, error) {
	cfg := config{
		port:      "8080",
		rateRPS:   10,
		rateBurst: 20,
		ipHeader:  getenv("CLIENT_IP_HEADER"),
		staticDir: getenv("STATIC_DIR"),
	}
	if v := getenv("PORT"); v != "" {
		cfg.port = v
	}
	if v := getenv("RATE_LIMIT_RPS"); v != "" {
		rps, err := strconv.ParseFloat(v, 64)
		if err != nil || rps <= 0 {
			return cfg, fmt.Errorf("RATE_LIMIT_RPS must be a positive number, got %q", v)
		}
		cfg.rateRPS = rps
	}
	if v := getenv("RATE_LIMIT_BURST"); v != "" {
		burst, err := strconv.Atoi(v)
		if err != nil || burst <= 0 {
			return cfg, fmt.Errorf("RATE_LIMIT_BURST must be a positive integer, got %q", v)
		}
		cfg.rateBurst = burst
	}
	return cfg, nil
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	limiter := api.NewRateLimiter(cfg.rateRPS, cfg.rateBurst, 3*time.Minute)
	limiter.IPHeader = cfg.ipHeader
	go limiter.Run(ctx, time.Minute)

	srv := &http.Server{
		Addr:              ":" + cfg.port,
		Handler:           api.NewHandler(api.Config{Logger: logger, RateLimiter: limiter, StaticDir: cfg.staticDir}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", srv.Addr)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	logger.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-errCh; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
