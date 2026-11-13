// Package api exposes the calculator over HTTP. It holds no math of its own:
// handlers decode and validate JSON, call package calc, and encode the result.
package api

import (
	"io"
	"log/slog"
	"net/http"
)

// MaxBodyBytes caps request bodies. Every valid request is far smaller.
const MaxBodyBytes = 4 << 10 // 4 KiB

// Config holds the handler's dependencies.
type Config struct {
	// Logger receives one line per request. Nil discards logs.
	Logger *slog.Logger
	// RateLimiter limits /api/ requests per client IP. Nil disables limiting.
	RateLimiter *RateLimiter
}

// NewHandler returns the complete HTTP handler: routes plus middleware.
//
// Middleware order, outermost first: recover, request log, security headers,
// rate limit (/api/ only), body size limit, router.
func NewHandler(cfg Config) http.Handler {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	}

	mux := http.NewServeMux()
	mux.Handle("/health", allowMethod(http.MethodGet, http.HandlerFunc(healthHandler)))
	for name, op := range binaryOperations {
		mux.Handle("/api/v1/"+name, allowMethod(http.MethodPost, binaryHandler(name, op)))
	}
	mux.Handle("/api/v1/sqrt", allowMethod(http.MethodPost, http.HandlerFunc(sqrtHandler)))
	mux.Handle("/api/v1/evaluate", allowMethod(http.MethodPost, http.HandlerFunc(evaluateHandler)))
	mux.HandleFunc("/", notFoundHandler)

	var h http.Handler = bodyLimit(MaxBodyBytes, mux)
	if cfg.RateLimiter != nil {
		h = cfg.RateLimiter.Middleware(h)
	}
	h = securityHeaders(h)
	h = requestLog(logger, h)
	h = recoverPanics(logger, h)
	return h
}

// allowMethod rejects other methods with a JSON 405. The method is checked
// here instead of in the mux pattern ("POST /path") because the mux would
// answer a wrong method with a plain-text body.
func allowMethod(method string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			w.Header().Set("Allow", method)
			writeAPIError(w, &apiError{http.StatusMethodNotAllowed, "method_not_allowed",
				"method " + r.Method + " not allowed, use " + method})
			return
		}
		next.ServeHTTP(w, r)
	})
}
