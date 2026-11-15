package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// fakeClock lets tests move time forward without sleeping.
type fakeClock struct{ t time.Time }

func (c *fakeClock) Now() time.Time          { return c.t }
func (c *fakeClock) Advance(d time.Duration) { c.t = c.t.Add(d) }

func newTestLimiter(rps float64, burst int) (*RateLimiter, *fakeClock) {
	clock := &fakeClock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	rl := NewRateLimiter(rps, burst, time.Minute)
	rl.now = clock.Now
	return rl, clock
}

func requestFrom(t *testing.T, h http.Handler, remoteAddr, path string) *httptest.ResponseRecorder {
	t.Helper()
	method := http.MethodPost
	if path == "/health" {
		method = http.MethodGet
	}
	req := httptest.NewRequest(method, path, strings.NewReader(`{"a":1,"b":2}`))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = remoteAddr
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestRateLimitBurstExceeded(t *testing.T) {
	rl, _ := newTestLimiter(1, 2)
	h := NewHandler(Config{RateLimiter: rl})

	for i := range 2 {
		if rec := requestFrom(t, h, "10.0.0.1:1000", "/api/v1/add"); rec.Code != http.StatusOK {
			t.Fatalf("request %d: status = %d", i+1, rec.Code)
		}
	}
	rec := requestFrom(t, h, "10.0.0.1:1000", "/api/v1/add")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", rec.Code)
	}
	if got := rec.Header().Get("Retry-After"); got != "1" {
		t.Fatalf("Retry-After = %q, want 1", got)
	}
	if got := decode[errorResponse](t, rec); got.Error.Code != "rate_limited" {
		t.Fatalf("code = %q, want rate_limited", got.Error.Code)
	}
}

func TestRateLimitRetryAfterRoundsUp(t *testing.T) {
	rl, _ := newTestLimiter(0.1, 1) // one token every 10s
	h := NewHandler(Config{RateLimiter: rl})
	requestFrom(t, h, "10.0.0.1:1000", "/api/v1/add")
	rec := requestFrom(t, h, "10.0.0.1:1000", "/api/v1/add")
	if got := rec.Header().Get("Retry-After"); got != "10" {
		t.Fatalf("Retry-After = %q, want 10", got)
	}
}

func TestRateLimitPerIP(t *testing.T) {
	rl, _ := newTestLimiter(1, 1)
	h := NewHandler(Config{RateLimiter: rl})

	requestFrom(t, h, "10.0.0.1:1000", "/api/v1/add")
	if rec := requestFrom(t, h, "10.0.0.1:2000", "/api/v1/add"); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("same IP, different port: status = %d, want 429", rec.Code)
	}
	if rec := requestFrom(t, h, "10.0.0.2:1000", "/api/v1/add"); rec.Code != http.StatusOK {
		t.Fatalf("other IP: status = %d, want 200", rec.Code)
	}
}

func TestRateLimitIgnoresForwardedFor(t *testing.T) {
	rl, _ := newTestLimiter(1, 1)
	h := NewHandler(Config{RateLimiter: rl})
	requestFrom(t, h, "10.0.0.1:1000", "/api/v1/add")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/add", strings.NewReader(`{"a":1,"b":2}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", "203.0.113.9")
	req.RemoteAddr = "10.0.0.1:1000"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("spoofed X-Forwarded-For bypassed the limit: status = %d", rec.Code)
	}
}

func TestRateLimitRefills(t *testing.T) {
	rl, clock := newTestLimiter(1, 1)
	h := NewHandler(Config{RateLimiter: rl})

	requestFrom(t, h, "10.0.0.1:1000", "/api/v1/add")
	if rec := requestFrom(t, h, "10.0.0.1:1000", "/api/v1/add"); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", rec.Code)
	}
	clock.Advance(time.Second)
	if rec := requestFrom(t, h, "10.0.0.1:1000", "/api/v1/add"); rec.Code != http.StatusOK {
		t.Fatalf("after refill: status = %d, want 200", rec.Code)
	}
}

func TestRateLimitSkipsNonAPI(t *testing.T) {
	rl, _ := newTestLimiter(1, 1)
	h := NewHandler(Config{RateLimiter: rl})
	for i := range 5 {
		if rec := requestFrom(t, h, "10.0.0.1:1000", "/health"); rec.Code != http.StatusOK {
			t.Fatalf("health request %d: status = %d", i+1, rec.Code)
		}
	}
}

func TestSweepEvictsIdleClients(t *testing.T) {
	rl, clock := newTestLimiter(1, 1)
	rl.allow("10.0.0.1")
	clock.Advance(50 * time.Second)
	rl.allow("10.0.0.2")
	clock.Advance(20 * time.Second) // .1 idle 70s, .2 idle 20s; TTL is 60s

	rl.Sweep()

	if _, ok := rl.clients["10.0.0.1"]; ok {
		t.Error("idle client 10.0.0.1 was not evicted")
	}
	if _, ok := rl.clients["10.0.0.2"]; !ok {
		t.Error("active client 10.0.0.2 was evicted")
	}
}

func TestRunSweepsUntilCancelled(t *testing.T) {
	rl, clock := newTestLimiter(1, 1)
	rl.allow("10.0.0.1")
	clock.Advance(time.Hour)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		rl.Run(ctx, time.Millisecond)
		close(done)
	}()

	deadline := time.Now().Add(2 * time.Second)
	for {
		rl.mu.Lock()
		n := len(rl.clients)
		rl.mu.Unlock()
		if n == 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("Run did not sweep the idle client")
		}
		time.Sleep(time.Millisecond)
	}

	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after cancel")
	}
}

func TestClientIP(t *testing.T) {
	tests := map[string]string{
		"10.0.0.1:1234": "10.0.0.1",
		"[::1]:8080":    "::1",
		"10.0.0.1":      "10.0.0.1", // no port
	}
	rl, _ := newTestLimiter(1, 1)
	for remote, want := range tests {
		r := &http.Request{RemoteAddr: remote}
		if got := rl.clientIP(r); got != want {
			t.Errorf("clientIP(%q) = %q, want %q", remote, got, want)
		}
	}
}

func TestClientIPFromTrustedHeader(t *testing.T) {
	rl, _ := newTestLimiter(1, 1)
	rl.IPHeader = "X-Real-IP"
	tests := []struct {
		header, want string
	}{
		{"203.0.113.9", "203.0.113.9"},
		{" 203.0.113.9 , 10.0.0.1", "203.0.113.9"},
		{"", "10.0.0.1"}, // header missing: fall back to RemoteAddr
	}
	for _, tt := range tests {
		r := &http.Request{RemoteAddr: "10.0.0.1:1234", Header: http.Header{}}
		if tt.header != "" {
			r.Header.Set("X-Real-IP", tt.header)
		}
		if got := rl.clientIP(r); got != tt.want {
			t.Errorf("header %q: clientIP = %q, want %q", tt.header, got, tt.want)
		}
	}
}

func TestRateLimitPerClientBehindProxy(t *testing.T) {
	rl, _ := newTestLimiter(1, 1)
	rl.IPHeader = "X-Real-IP"
	h := NewHandler(Config{RateLimiter: rl})
	send := func(ip string) int {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/add", strings.NewReader(`{"a":1,"b":2}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Real-IP", ip)
		req.RemoteAddr = "10.0.0.1:1000" // same proxy address for everyone
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	send("203.0.113.1")
	if code := send("203.0.113.1"); code != http.StatusTooManyRequests {
		t.Fatalf("same client: status = %d, want 429", code)
	}
	if code := send("203.0.113.2"); code != http.StatusOK {
		t.Fatalf("other client behind the same proxy: status = %d, want 200", code)
	}
}
