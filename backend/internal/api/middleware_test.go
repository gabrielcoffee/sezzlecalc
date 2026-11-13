package api

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSecurityHeaders(t *testing.T) {
	h := NewHandler(Config{})
	for _, path := range []string{"/health", "/api/v1/add", "/nope"} {
		rec := do(t, h, http.MethodGet, path, "")
		want := map[string]string{
			"X-Content-Type-Options": "nosniff",
			"X-Frame-Options":        "DENY",
			"Referrer-Policy":        "no-referrer",
			"Cache-Control":          "no-store",
		}
		for k, v := range want {
			if got := rec.Header().Get(k); got != v {
				t.Errorf("%s: %s = %q, want %q", path, k, got, v)
			}
		}
	}
}

func TestRecoverPanics(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	h := recoverPanics(logger, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("secret internal detail")
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	got := decode[errorResponse](t, rec)
	if got.Error.Code != "internal_error" || strings.Contains(rec.Body.String(), "secret") {
		t.Fatalf("body = %s, want generic internal_error", rec.Body)
	}
	if !strings.Contains(logs.String(), "secret internal detail") {
		t.Fatal("panic value was not logged")
	}
}

func TestRecoverPanicsRethrowsAbort(t *testing.T) {
	h := recoverPanics(slog.New(slog.NewTextHandler(io.Discard, nil)),
		http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic(http.ErrAbortHandler) }))
	defer func() {
		if v := recover(); v != http.ErrAbortHandler {
			t.Fatalf("recovered %v, want http.ErrAbortHandler", v)
		}
	}()
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
}

func TestRequestLog(t *testing.T) {
	var logs bytes.Buffer
	h := NewHandler(Config{Logger: slog.New(slog.NewTextHandler(&logs, nil))})
	do(t, h, http.MethodGet, "/missing", "")
	for _, want := range []string{"method=GET", "path=/missing", "status=404"} {
		if !strings.Contains(logs.String(), want) {
			t.Errorf("log %q missing %q", logs.String(), want)
		}
	}
}
