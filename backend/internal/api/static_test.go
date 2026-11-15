package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// newStaticSite builds a fake frontend build inside a temp dir, with a
// secret file next to it (outside the served directory).
func newStaticSite(t *testing.T) http.Handler {
	t.Helper()
	base := t.TempDir()
	dist := filepath.Join(base, "dist")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(filepath.Join(dist, "assets"), 0o755))
	must(os.WriteFile(filepath.Join(dist, "index.html"), []byte("<!doctype html><title>calc</title>"), 0o644))
	must(os.WriteFile(filepath.Join(dist, "assets", "index-abc123.js"), []byte("console.log(1)"), 0o644))
	must(os.WriteFile(filepath.Join(base, "secret.txt"), []byte("top secret"), 0o644))
	return NewHandler(Config{StaticDir: dist})
}

func TestStaticServesIndexWithPolicy(t *testing.T) {
	rec := do(t, newStaticSite(t), http.MethodGet, "/", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "<title>calc</title>") {
		t.Fatalf("status = %d, body = %q", rec.Code, rec.Body)
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
		t.Errorf("Cache-Control = %q, want no-cache", got)
	}
	csp := rec.Header().Get("Content-Security-Policy")
	for _, want := range []string{"default-src 'self'", "script-src 'self'", "frame-ancestors 'none'"} {
		if !strings.Contains(csp, want) {
			t.Errorf("CSP %q missing %q", csp, want)
		}
	}
	if strings.Contains(csp, "script-src 'self' 'unsafe-inline'") {
		t.Error("CSP must not allow inline scripts")
	}
}

func TestStaticCachesHashedAssets(t *testing.T) {
	rec := do(t, newStaticSite(t), http.MethodGet, "/assets/index-abc123.js", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); !strings.Contains(got, "immutable") {
		t.Errorf("Cache-Control = %q, want immutable", got)
	}
}

func TestStaticRefusals(t *testing.T) {
	h := newStaticSite(t)
	tests := []struct {
		name, method, path string
		wantStatus         int
	}{
		{"directory listing", "GET", "/assets/", 404},
		{"missing file", "GET", "/nope.js", 404},
		{"encoded traversal", "GET", "/%2e%2e/secret.txt", 404},
		{"unknown API path stays JSON", "GET", "/api/v1/modulo", 404},
		{"write method", "POST", "/", 405},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, h, tt.method, tt.path, "")
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
			if strings.Contains(rec.Body.String(), "top secret") {
				t.Fatal("served a file outside the static directory")
			}
			decode[errorResponse](t, rec) // all refusals are JSON errors
		})
	}
}

func TestStaticLeavesAPIRoutesAlone(t *testing.T) {
	h := newStaticSite(t)
	if rec := do(t, h, http.MethodPost, "/api/v1/add", `{"a":2,"b":3}`); rec.Code != http.StatusOK {
		t.Fatalf("API with static dir: status = %d, body = %s", rec.Code, rec.Body)
	}
	if rec := do(t, h, http.MethodGet, "/health", ""); rec.Code != http.StatusOK {
		t.Fatalf("health with static dir: status = %d", rec.Code)
	}
}

// "../" can't climb out of the static directory: the router cleans the path
// and redirects to it, and the cleaned path is looked up inside the directory.
func TestStaticPathTraversal(t *testing.T) {
	h := newStaticSite(t)
	rec := do(t, h, http.MethodGet, "/../secret.txt", "")
	if strings.Contains(rec.Body.String(), "top secret") {
		t.Fatal("served a file outside the static directory")
	}
	if loc := rec.Header().Get("Location"); rec.Code == http.StatusTemporaryRedirect {
		rec = do(t, h, http.MethodGet, loc, "")
	}
	if rec.Code != http.StatusNotFound || strings.Contains(rec.Body.String(), "top secret") {
		t.Fatalf("status = %d, body = %q; want 404 without the secret", rec.Code, rec.Body)
	}
}
