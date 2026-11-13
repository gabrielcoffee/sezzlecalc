package calc

import (
	"errors"
	"math"
	"testing"
)

func TestBinaryOperations(t *testing.T) {
	tests := []struct {
		name    string
		op      func(a, b float64) (float64, error)
		a, b    float64
		want    float64
		wantErr error
	}{
		{"add integers", Add, 2, 3, 5, nil},
		{"add negatives", Add, -2, -3, -5, nil},
		{"add rounds float noise", Add, 0.1, 0.2, 0.3, nil},
		{"add overflow", Add, math.MaxFloat64, math.MaxFloat64, 0, ErrOverflow},

		{"subtract", Subtract, 10, 4, 6, nil},
		{"subtract to negative", Subtract, 4, 10, -6, nil},
		{"subtract rounds float noise", Subtract, 0.3, 0.1, 0.2, nil},
		{"subtract overflow", Subtract, -math.MaxFloat64, math.MaxFloat64, 0, ErrOverflow},

		{"multiply", Multiply, 6, 7, 42, nil},
		{"multiply by zero", Multiply, 123.45, 0, 0, nil},
		{"multiply negative zero normalized", Multiply, -5, 0, 0, nil},
		{"multiply rounds float noise", Multiply, 1.1, 3, 3.3, nil},
		{"multiply overflow", Multiply, 1e200, 1e200, 0, ErrOverflow},
		{"multiply underflow is zero", Multiply, 1e-200, 1e-200, 0, nil},

		{"divide", Divide, 10, 4, 2.5, nil},
		{"divide repeating decimal", Divide, 1, 3, 0.333333333333333, nil},
		{"divide by zero", Divide, 1, 0, 0, ErrDivisionByZero},
		{"divide zero by zero", Divide, 0, 0, 0, ErrDivisionByZero},
		{"divide by negative zero", Divide, 1, math.Copysign(0, -1), 0, ErrDivisionByZero},
		{"divide overflow", Divide, math.MaxFloat64, 0.5, 0, ErrOverflow},

		{"power", Power, 2, 10, 1024, nil},
		{"power zero to zero", Power, 0, 0, 1, nil},
		{"power zero to positive", Power, 0, 5, 0, nil},
		{"power zero to negative", Power, 0, -1, 0, ErrDivisionByZero},
		{"power negative exponent", Power, 2, -2, 0.25, nil},
		{"power fractional exponent", Power, 9, 0.5, 3, nil},
		{"power negative base integer exponent", Power, -2, 3, -8, nil},
		{"power negative base fractional exponent", Power, -8, 0.5, 0, ErrNotReal},
		{"power overflow", Power, 10, 400, 0, ErrOverflow},
		{"power underflow is zero", Power, 2, -2000, 0, nil},

		{"percentage", Percentage, 10, 50, 5, nil},
		{"percentage of negative", Percentage, -10, 50, -5, nil},
		{"percentage zero", Percentage, 0, 50, 0, nil},
		{"percentage over 100", Percentage, 150, 20, 30, nil},
		{"percentage huge operands survive", Percentage, 1e300, 1e10, 1e308, nil},
		{"percentage overflow", Percentage, math.MaxFloat64, 1000, 0, ErrOverflow},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.op(tt.a, tt.b)
			assertResult(t, got, err, tt.want, tt.wantErr)
		})
	}
}

func TestSqrt(t *testing.T) {
	tests := []struct {
		name    string
		a       float64
		want    float64
		wantErr error
	}{
		{"perfect square", 9, 3, nil},
		{"irrational", 2, 1.4142135623731, nil},
		{"zero", 0, 0, nil},
		{"negative zero normalized", math.Copysign(0, -1), 0, nil},
		{"fraction", 0.25, 0.5, nil},
		{"negative", -4, 0, ErrNegativeSqrt},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Sqrt(tt.a)
			assertResult(t, got, err, tt.want, tt.wantErr)
		})
	}
}

func TestFinalizeKeepsValuesNearMaxFloat(t *testing.T) {
	// Rounding math.MaxFloat64 to 15 digits overflows float64; the unrounded
	// value must be returned instead of an error.
	got, err := Add(math.MaxFloat64, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != math.MaxFloat64 {
		t.Fatalf("got %v, want %v", got, math.MaxFloat64)
	}
}

func assertResult(t *testing.T, got float64, err error, want float64, wantErr error) {
	t.Helper()
	if wantErr != nil {
		if !errors.Is(err, wantErr) {
			t.Fatalf("error = %v, want %v", err, wantErr)
		}
		return
	}
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != want {
		t.Fatalf("got %v, want %v", got, want)
	}
	if math.Signbit(got) && got == 0 {
		t.Fatalf("got -0, want 0")
	}
}
