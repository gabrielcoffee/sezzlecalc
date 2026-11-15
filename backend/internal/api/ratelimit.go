package api

import (
	"context"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// RateLimiter applies a token bucket per client IP to /api/ requests.
//
// By default the client IP is the connection's RemoteAddr. X-Forwarded-For
// is ignored because any client can set it. The trade-off: behind a proxy or
// NAT, clients sharing an address share one bucket.
type RateLimiter struct {
	// IPHeader, when set, names a header holding the client IP. Set it only
	// behind a proxy that overwrites the header on every request, e.g.
	// "X-Real-IP" on Vercel; otherwise clients could spoof their IP.
	IPHeader string

	limit   rate.Limit
	burst   int
	idleTTL time.Duration
	now     func() time.Time

	mu      sync.Mutex
	clients map[string]*client
}

type client struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// NewRateLimiter allows each IP rps requests per second with bursts of up to
// burst. IPs idle for longer than idleTTL are forgotten by Sweep.
func NewRateLimiter(rps float64, burst int, idleTTL time.Duration) *RateLimiter {
	return &RateLimiter{
		limit:   rate.Limit(rps),
		burst:   burst,
		idleTTL: idleTTL,
		now:     time.Now,
		clients: make(map[string]*client),
	}
}

// allow reports whether ip may make a request now. When it may not, it also
// returns how long until the next token is available.
func (rl *RateLimiter) allow(ip string) (bool, time.Duration) {
	now := rl.now()
	rl.mu.Lock()
	defer rl.mu.Unlock()

	c, ok := rl.clients[ip]
	if !ok {
		c = &client{limiter: rate.NewLimiter(rl.limit, rl.burst)}
		rl.clients[ip] = c
	}
	c.lastSeen = now
	if c.limiter.AllowN(now, 1) {
		return true, 0
	}
	r := c.limiter.ReserveN(now, 1)
	delay := r.DelayFrom(now)
	r.CancelAt(now) // only measuring; give the token back
	return false, delay
}

// Sweep forgets IPs that have been idle for longer than idleTTL.
func (rl *RateLimiter) Sweep() {
	now := rl.now()
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for ip, c := range rl.clients {
		if now.Sub(c.lastSeen) > rl.idleTTL {
			delete(rl.clients, ip)
		}
	}
}

// Run calls Sweep every interval until ctx is cancelled.
func (rl *RateLimiter) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rl.Sweep()
		}
	}
}

// Middleware rejects /api/ requests over the limit with a JSON 429 and a
// Retry-After header. Other paths pass through.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}
		ok, retryAfter := rl.allow(rl.clientIP(r))
		if !ok {
			seconds := max(1, int(math.Ceil(retryAfter.Seconds())))
			w.Header().Set("Retry-After", strconv.Itoa(seconds))
			writeAPIError(w, &apiError{http.StatusTooManyRequests, "rate_limited",
				"too many requests, retry in " + strconv.Itoa(seconds) + "s"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) clientIP(r *http.Request) string {
	if rl.IPHeader != "" {
		// A proxy may append a chain ("client, proxy1"); the first entry is the client.
		first, _, _ := strings.Cut(r.Header.Get(rl.IPHeader), ",")
		if ip := strings.TrimSpace(first); ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
