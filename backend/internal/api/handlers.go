package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"reflect"
	"strings"

	"github.com/gabrielcoffee/sezzlecalc/backend/internal/calc"
)

// ---- request and response bodies ----

// Operands are pointers so a missing field can be told apart from 0.
type binaryRequest struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

type unaryRequest struct {
	A *float64 `json:"a"`
}

type evaluateRequest struct {
	Expression *string `json:"expression"`
}

type operationResponse struct {
	Operation string   `json:"operation"`
	A         float64  `json:"a"`
	B         *float64 `json:"b,omitempty"`
	Result    float64  `json:"result"`
}

type evaluateResponse struct {
	Expression string  `json:"expression"`
	Result     float64 `json:"result"`
}

type errorResponse struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// apiError is a failure that already knows its HTTP status and error code.
type apiError struct {
	status  int
	code    string
	message string
}

func badRequest(code, format string, args ...any) *apiError {
	return &apiError{status: http.StatusBadRequest, code: code, message: fmt.Sprintf(format, args...)}
}

// ---- handlers ----

// binaryOperations maps each two-operand route to its calc function. Adding an
// operation is one line here.
var binaryOperations = map[string]func(a, b float64) (float64, error){
	"add":        calc.Add,
	"subtract":   calc.Subtract,
	"multiply":   calc.Multiply,
	"divide":     calc.Divide,
	"power":      calc.Power,
	"percentage": calc.Percentage,
}

func binaryHandler(name string, op func(a, b float64) (float64, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req binaryRequest
		if err := decodeJSON(r, &req); err != nil {
			writeAPIError(w, err)
			return
		}
		if req.A == nil {
			writeAPIError(w, badRequest("missing_operand", `field "a" is required`))
			return
		}
		if req.B == nil {
			writeAPIError(w, badRequest("missing_operand", `field "b" is required`))
			return
		}
		result, err := op(*req.A, *req.B)
		if err != nil {
			writeAPIError(w, calcError(err))
			return
		}
		writeJSON(w, http.StatusOK, operationResponse{Operation: name, A: *req.A, B: req.B, Result: result})
	}
}

func sqrtHandler(w http.ResponseWriter, r *http.Request) {
	var req unaryRequest
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, err)
		return
	}
	if req.A == nil {
		writeAPIError(w, badRequest("missing_operand", `field "a" is required`))
		return
	}
	result, err := calc.Sqrt(*req.A)
	if err != nil {
		writeAPIError(w, calcError(err))
		return
	}
	writeJSON(w, http.StatusOK, operationResponse{Operation: "sqrt", A: *req.A, Result: result})
}

func evaluateHandler(w http.ResponseWriter, r *http.Request) {
	var req evaluateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, err)
		return
	}
	if req.Expression == nil {
		writeAPIError(w, badRequest("missing_expression", `field "expression" is required`))
		return
	}
	result, err := calc.Evaluate(*req.Expression)
	if err != nil {
		writeAPIError(w, calcError(err))
		return
	}
	writeJSON(w, http.StatusOK, evaluateResponse{Expression: *req.Expression, Result: result})
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func notFoundHandler(w http.ResponseWriter, r *http.Request) {
	writeAPIError(w, &apiError{http.StatusNotFound, "not_found", fmt.Sprintf("no route for %s", r.URL.Path)})
}

// ---- errors ----

// calcError maps a calc error to an HTTP error. Requests that are well formed
// but cannot be computed are 422 Unprocessable Entity.
func calcError(err error) *apiError {
	code := "internal_error"
	switch {
	case errors.Is(err, calc.ErrDivisionByZero):
		code = "division_by_zero"
	case errors.Is(err, calc.ErrNegativeSqrt):
		code = "negative_sqrt"
	case errors.Is(err, calc.ErrNotReal):
		code = "not_real"
	case errors.Is(err, calc.ErrOverflow):
		code = "overflow"
	case calc.IsSyntaxError(err):
		code = "invalid_expression"
	default:
		return &apiError{http.StatusInternalServerError, code, "internal server error"}
	}
	return &apiError{http.StatusUnprocessableEntity, code, err.Error()}
}

// ---- JSON helpers ----

// decodeJSON decodes exactly one JSON object into dst and rejects anything
// else: wrong content type, unknown fields, wrong types, trailing data and
// oversized bodies (the size cap is set by the bodyLimit middleware).
func decodeJSON(r *http.Request, dst any) *apiError {
	mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if mediaType != "application/json" {
		return &apiError{http.StatusUnsupportedMediaType, "unsupported_media_type",
			"Content-Type must be application/json"}
	}

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return decodeError(err)
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return decodeError(err)
		}
		return badRequest("invalid_json", "request body must contain a single JSON object")
	}
	return nil
}

func decodeError(err error) *apiError {
	var (
		syntaxErr *json.SyntaxError
		typeErr   *json.UnmarshalTypeError
		tooLarge  *http.MaxBytesError
	)
	switch {
	case errors.As(err, &tooLarge):
		return &apiError{http.StatusRequestEntityTooLarge, "body_too_large",
			fmt.Sprintf("request body must not exceed %d bytes", tooLarge.Limit)}
	case errors.Is(err, io.EOF):
		return badRequest("invalid_json", "request body is empty")
	case errors.As(err, &syntaxErr):
		return badRequest("invalid_json", "malformed JSON at byte %d", syntaxErr.Offset)
	case errors.Is(err, io.ErrUnexpectedEOF):
		return badRequest("invalid_json", "malformed JSON: unexpected end of body")
	case errors.As(err, &typeErr):
		if typeErr.Field == "" {
			return badRequest("invalid_json", "request body must be a JSON object")
		}
		want := jsonTypeName(typeErr.Type)
		if want == "number" && strings.HasPrefix(typeErr.Value, "number") {
			// A JSON number where a number belongs that still failed: it does
			// not fit in a float64, e.g. 1e400.
			return badRequest("number_out_of_range", "field %q is out of range", typeErr.Field)
		}
		return badRequest("invalid_type", "field %q must be a %s", typeErr.Field, want)
	case strings.HasPrefix(err.Error(), "json: unknown field "):
		// encoding/json has no typed error for unknown fields.
		return badRequest("unknown_field", "%s", strings.TrimPrefix(err.Error(), "json: "))
	default:
		return badRequest("invalid_json", "malformed JSON")
	}
}

func jsonTypeName(t reflect.Type) string {
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	switch t.Kind() {
	case reflect.Float32, reflect.Float64:
		return "number"
	case reflect.String:
		return "string"
	default:
		return t.Kind().String()
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v) // the status is already sent; nothing useful to do on error
}

func writeAPIError(w http.ResponseWriter, e *apiError) {
	writeJSON(w, e.status, errorResponse{Error: errorDetail{Code: e.code, Message: e.message}})
}
