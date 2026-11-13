package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("invalid JSON response %q: %v", rec.Body.String(), err)
	}
	return v
}

func TestOperationsSuccess(t *testing.T) {
	h := NewHandler(Config{})
	tests := []struct {
		path, body string
		want       float64
	}{
		{"/api/v1/add", `{"a":2,"b":3}`, 5},
		{"/api/v1/add", `{"a":0.1,"b":0.2}`, 0.3},
		{"/api/v1/add", `{"a":0,"b":5}`, 5}, // zero is a value, not a missing operand
		{"/api/v1/subtract", `{"a":10,"b":4}`, 6},
		{"/api/v1/multiply", `{"a":6,"b":7}`, 42},
		{"/api/v1/divide", `{"a":10,"b":4}`, 2.5},
		{"/api/v1/power", `{"a":2,"b":10}`, 1024},
		{"/api/v1/power", `{"a":0,"b":0}`, 1},
		{"/api/v1/percentage", `{"a":10,"b":50}`, 5},
	}
	for _, tt := range tests {
		t.Run(tt.path+" "+tt.body, func(t *testing.T) {
			rec := do(t, h, http.MethodPost, tt.path, tt.body)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
			}
			got := decode[operationResponse](t, rec)
			wantOp := strings.TrimPrefix(tt.path, "/api/v1/")
			if got.Operation != wantOp || got.Result != tt.want || got.B == nil {
				t.Fatalf("got %+v, want operation %q result %v", got, wantOp, tt.want)
			}
		})
	}
}

func TestSqrtSuccess(t *testing.T) {
	rec := do(t, NewHandler(Config{}), http.MethodPost, "/api/v1/sqrt", `{"a":9}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	if want := `{"operation":"sqrt","a":9,"result":3}`; strings.TrimSpace(rec.Body.String()) != want {
		t.Fatalf("body = %s, want %s", rec.Body, want)
	}
}

func TestEvaluateSuccess(t *testing.T) {
	rec := do(t, NewHandler(Config{}), http.MethodPost, "/api/v1/evaluate", `{"expression":"2 + 3 * 4"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	got := decode[evaluateResponse](t, rec)
	if got.Expression != "2 + 3 * 4" || got.Result != 14 {
		t.Fatalf("got %+v", got)
	}
}

func TestNegativeZeroEncodesAsZero(t *testing.T) {
	rec := do(t, NewHandler(Config{}), http.MethodPost, "/api/v1/multiply", `{"a":-5,"b":0}`)
	if !strings.Contains(rec.Body.String(), `"result":0}`) {
		t.Fatalf("body = %s, want result 0", rec.Body)
	}
}

func TestHealth(t *testing.T) {
	rec := do(t, NewHandler(Config{}), http.MethodGet, "/health", "")
	if rec.Code != http.StatusOK || decode[map[string]string](t, rec)["status"] != "ok" {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
}

func TestErrors(t *testing.T) {
	h := NewHandler(Config{})
	tests := []struct {
		name        string
		method      string
		path        string
		contentType string
		body        string
		wantStatus  int
		wantCode    string
		wantMsg     string // substring
	}{
		// math errors: 422
		{"divide by zero", "POST", "/api/v1/divide", "", `{"a":1,"b":0}`, 422, "division_by_zero", "cannot divide by zero"},
		{"sqrt negative", "POST", "/api/v1/sqrt", "", `{"a":-4}`, 422, "negative_sqrt", "square root"},
		{"power not real", "POST", "/api/v1/power", "", `{"a":-8,"b":0.5}`, 422, "not_real", "not a real number"},
		{"power zero to negative", "POST", "/api/v1/power", "", `{"a":0,"b":-1}`, 422, "division_by_zero", ""},
		{"overflow", "POST", "/api/v1/multiply", "", `{"a":1e200,"b":1e200}`, 422, "overflow", "out of range"},
		{"expression syntax", "POST", "/api/v1/evaluate", "", `{"expression":"2 +"}`, 422, "invalid_expression", "position 4"},
		{"expression math", "POST", "/api/v1/evaluate", "", `{"expression":"1/(2-2)"}`, 422, "division_by_zero", ""},
		{"expression empty", "POST", "/api/v1/evaluate", "", `{"expression":""}`, 422, "invalid_expression", "empty"},

		// missing fields: 400
		{"missing a", "POST", "/api/v1/add", "", `{"b":1}`, 400, "missing_operand", `"a"`},
		{"missing b", "POST", "/api/v1/add", "", `{"a":1}`, 400, "missing_operand", `"b"`},
		{"null operand", "POST", "/api/v1/add", "", `{"a":null,"b":1}`, 400, "missing_operand", `"a"`},
		{"null body", "POST", "/api/v1/add", "", `null`, 400, "missing_operand", ""},
		{"sqrt missing a", "POST", "/api/v1/sqrt", "", `{}`, 400, "missing_operand", `"a"`},
		{"missing expression", "POST", "/api/v1/evaluate", "", `{}`, 400, "missing_expression", ""},

		// malformed input: 400
		{"string operand", "POST", "/api/v1/add", "", `{"a":"1","b":2}`, 400, "invalid_type", `field "a" must be a number`},
		{"bool operand", "POST", "/api/v1/add", "", `{"a":1,"b":true}`, 400, "invalid_type", `field "b" must be a number`},
		{"number expression", "POST", "/api/v1/evaluate", "", `{"expression":5}`, 400, "invalid_type", `must be a string`},
		{"number out of range", "POST", "/api/v1/add", "", `{"a":1e400,"b":1}`, 400, "number_out_of_range", `"a"`},
		{"unknown field", "POST", "/api/v1/sqrt", "", `{"a":4,"b":2}`, 400, "unknown_field", `unknown field "b"`},
		{"trailing object", "POST", "/api/v1/add", "", `{"a":1,"b":2}{}`, 400, "invalid_json", "single JSON object"},
		{"trailing garbage", "POST", "/api/v1/add", "", `{"a":1,"b":2} x`, 400, "invalid_json", "single JSON object"},
		{"truncated", "POST", "/api/v1/add", "", `{"a":1,`, 400, "invalid_json", "unexpected end"},
		{"bad syntax", "POST", "/api/v1/add", "", `{a:1}`, 400, "invalid_json", "malformed JSON at byte"},
		{"empty body", "POST", "/api/v1/add", "application/json", ``, 400, "invalid_json", "empty"},
		{"array body", "POST", "/api/v1/add", "", `[1,2]`, 400, "invalid_json", "must be a JSON object"},

		// content type: 415
		{"no content type", "POST", "/api/v1/add", "none", `{"a":1,"b":2}`, 415, "unsupported_media_type", ""},
		{"form content type", "POST", "/api/v1/add", "application/x-www-form-urlencoded", `a=1&b=2`, 415, "unsupported_media_type", ""},

		// body size: 413
		{"oversized body", "POST", "/api/v1/evaluate", "", `{"expression":"` + strings.Repeat("1", MaxBodyBytes) + `"}`, 413, "body_too_large", "4096 bytes"},
		{"oversized trailing whitespace", "POST", "/api/v1/add", "", `{"a":1,"b":2}` + strings.Repeat(" ", MaxBodyBytes), 413, "body_too_large", ""},

		// routing: 404, 405
		{"unknown route", "GET", "/api/v1/modulo", "", ``, 404, "not_found", "/api/v1/modulo"},
		{"root", "GET", "/", "", ``, 404, "not_found", ""},
		{"GET on operation", "GET", "/api/v1/add", "", ``, 405, "method_not_allowed", "use POST"},
		{"POST on health", "POST", "/health", "", ``, 405, "method_not_allowed", "use GET"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
			switch tt.contentType {
			case "":
				req.Header.Set("Content-Type", "application/json")
			case "none":
			default:
				req.Header.Set("Content-Type", tt.contentType)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
			got := decode[errorResponse](t, rec)
			if got.Error.Code != tt.wantCode {
				t.Fatalf("code = %q, want %q", got.Error.Code, tt.wantCode)
			}
			if !strings.Contains(got.Error.Message, tt.wantMsg) {
				t.Fatalf("message = %q, want it to contain %q", got.Error.Message, tt.wantMsg)
			}
			if tt.wantStatus == http.StatusMethodNotAllowed && rec.Header().Get("Allow") == "" {
				t.Fatal("405 response without Allow header")
			}
		})
	}
}

func TestContentTypeWithCharsetAccepted(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/v1/add", strings.NewReader(`{"a":1,"b":2}`))
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	rec := httptest.NewRecorder()
	NewHandler(Config{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
}

func TestCalcErrorUnknownIsInternal(t *testing.T) {
	e := calcError(errUnexpected{})
	if e.status != http.StatusInternalServerError || e.message != "internal server error" {
		t.Fatalf("got %+v", e)
	}
}

type errUnexpected struct{}

func (errUnexpected) Error() string { return "secret detail" }
