package api

import (
	"net/http"
	"path"
	"strings"
)

// contentSecurityPolicy allows only this origin's own scripts, styles, fonts,
// images and API calls. Inline styles are allowed because the animation and
// toast libraries set style attributes and inject a <style> tag; inline
// scripts are not. The page can't be framed or submit forms elsewhere.
const contentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
	"img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; " +
	"base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

// staticHandler serves the built frontend from dir, for running the whole app
// from one server (the Docker image). Only files are served: no directory
// listings, and http.Dir keeps every path inside dir.
func staticHandler(dir string) http.Handler {
	root := http.Dir(dir)
	files := http.FileServer(root)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			writeAPIError(w, &apiError{http.StatusMethodNotAllowed, "method_not_allowed",
				"method " + r.Method + " not allowed, use GET"})
			return
		}

		name := path.Clean("/" + r.URL.Path)
		if name != "/" {
			f, err := root.Open(name)
			if err != nil {
				notFoundHandler(w, r)
				return
			}
			info, err := f.Stat()
			f.Close()
			if err != nil || info.IsDir() {
				notFoundHandler(w, r)
				return
			}
		}

		h := w.Header()
		h.Set("Content-Security-Policy", contentSecurityPolicy)
		if strings.HasPrefix(name, "/assets/") {
			// Vite puts a content hash in every asset name: safe to cache forever.
			h.Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			// index.html and other top-level files: always check for a new build.
			h.Set("Cache-Control", "no-cache")
		}
		files.ServeHTTP(w, r)
	})
}
