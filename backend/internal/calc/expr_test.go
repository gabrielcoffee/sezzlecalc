package calc

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"testing"
)

func TestEvaluate(t *testing.T) {
	tests := []struct {
		expr string
		want float64
	}{
		// single values and whitespace
		{"42", 42},
		{"  7  ", 7},
		{"1.5", 1.5},
		{".5", 0.5},
		{"5.", 5},
		{"1e3", 1000},
		{"2.5E-3", 0.0025},
		{"1e+2", 100},
		{"1e-400", 0}, // underflows to zero

		// precedence and associativity
		{"2 + 3 * 4", 14},
		{"(2 + 3) * 4", 20},
		{"10 - 4 - 3", 3},
		{"100 / 10 / 2", 5},
		{"2 * 3 + 4 * 5", 26},
		{"2^3^2", 512}, // right-associative: 2^(3^2)
		{"2 * 3^2", 18},

		// unary operators
		{"-5", -5},
		{"+5", 5},
		{"--5", 5},
		{"-2^2", -4},
		{"(-2)^2", 4},
		{"2^-1", 0.5},
		{"3 - -2", 5},
		{"-(2 + 3)", -5},
		{"-0", 0},

		// square root
		{"√9", 3},
		{"sqrt 16", 4},
		{"sqrt(16)", 4},
		{"√4 * 2", 4},
		{"√9 + 1", 4},
		{"√√16", 2},

		// percent
		{"10%", 0.1},
		{"50%", 0.5},
		{"200 * 50%", 100},
		{"10%%", 0.001},
		{"(10 + 40)%", 0.5},

		// aliases
		{"6 × 7", 42},
		{"10 ÷ 4", 2.5},
		{"10 − 3", 7},

		// rounding happens once at the end
		{"0.1 + 0.2", 0.3},
		{"1 / 3 * 3", 1},

		// nesting
		{"((((1))))", 1},
		{"(1 + (2 * (3 + (4 - 1))))", 13},
	}
	for _, tt := range tests {
		t.Run(tt.expr, func(t *testing.T) {
			got, err := Evaluate(tt.expr)
			if err != nil {
				t.Fatalf("Evaluate(%q) error: %v", tt.expr, err)
			}
			if got != tt.want || (got == 0 && math.Signbit(got)) {
				t.Fatalf("Evaluate(%q) = %v, want %v", tt.expr, got, tt.want)
			}
		})
	}
}

func TestEvaluateSyntaxErrors(t *testing.T) {
	tests := []struct {
		expr    string
		wantPos int
		wantMsg string
	}{
		{"", 1, "expression is empty"},
		{"   ", 1, "expression is empty"},
		{"2 +", 4, "unexpected end of expression"},
		{"* 2", 1, `unexpected '*'`},
		{"2 * * 3", 5, `unexpected '*'`},
		{"(2 + 3", 7, "expected ')'"},
		{"2 + 3)", 6, `unexpected ')'`},
		{"()", 2, `unexpected ')'`},
		{"2(3)", 2, `unexpected '('`},
		{"2 3", 3, "unexpected number"},
		{"2 + a", 5, `unexpected character 'a'`},
		{"2 & 3", 3, `unexpected character '&'`},
		{".", 1, "invalid number"},
		{"1.2.3", 4, "invalid number"},
		{"1e", 2, "invalid exponent"},
		{"1e+", 2, "invalid exponent"},
		{"sqr 4", 1, `unexpected character 's'`},
		{"%5", 1, `unexpected '%'`},
		{strings.Repeat("1", MaxExpressionLength+1), MaxExpressionLength + 1, "expression is longer than 256 characters"},
		{strings.Repeat("(", MaxDepth+1) + "1" + strings.Repeat(")", MaxDepth+1), MaxDepth + 1, "expression is nested too deeply"},
		{strings.Repeat("-", MaxDepth+1) + "1", MaxDepth + 1, "expression is nested too deeply"},
		{"2" + strings.Repeat("^2", MaxDepth+1), 2*MaxDepth + 2, "expression is nested too deeply"},
		// a syntax error wins over a math error that appears earlier
		{"1/0 +", 6, "unexpected end of expression"},
	}
	for _, tt := range tests {
		name := tt.expr
		if len(name) > 40 {
			name = name[:40] + "..."
		}
		t.Run(name, func(t *testing.T) {
			_, err := Evaluate(tt.expr)
			var se *SyntaxError
			if !errors.As(err, &se) {
				t.Fatalf("Evaluate(%q) error = %v, want *SyntaxError", tt.expr, err)
			}
			if se.Pos != tt.wantPos || se.Msg != tt.wantMsg {
				t.Fatalf("Evaluate(%q) = {Pos:%d Msg:%q}, want {Pos:%d Msg:%q}",
					tt.expr, se.Pos, se.Msg, tt.wantPos, tt.wantMsg)
			}
			if !IsSyntaxError(err) {
				t.Fatalf("IsSyntaxError(%v) = false", err)
			}
			if want := fmt.Sprintf("syntax error at position %d: %s", tt.wantPos, tt.wantMsg); err.Error() != want {
				t.Fatalf("Error() = %q, want %q", err.Error(), want)
			}
		})
	}
}

func TestEvaluateLimitsAreInclusive(t *testing.T) {
	atLength := strings.Repeat("1", MaxExpressionLength)
	if _, err := Evaluate(atLength); err != nil {
		t.Errorf("expression of %d chars: %v", len(atLength), err)
	}
	atDepth := strings.Repeat("(", MaxDepth) + "1" + strings.Repeat(")", MaxDepth)
	if _, err := Evaluate(atDepth); err != nil {
		t.Errorf("depth %d: %v", MaxDepth, err)
	}
}

func TestEvaluateMathErrors(t *testing.T) {
	tests := []struct {
		expr    string
		wantErr error
	}{
		{"1 / 0", ErrDivisionByZero},
		{"5 / (2 - 2)", ErrDivisionByZero},
		{"0 ^ -1", ErrDivisionByZero},
		{"√-4", ErrNegativeSqrt},
		{"sqrt(1 - 2)", ErrNegativeSqrt},
		{"(-8) ^ 0.5", ErrNotReal},
		{"10 ^ 400", ErrOverflow},
		{"1e308 * 10", ErrOverflow},
		{"1e308 + 1e308", ErrOverflow},
		{"-1e308 - 1e308", ErrOverflow},
		{"1e400", ErrOverflow},
	}
	for _, tt := range tests {
		t.Run(tt.expr, func(t *testing.T) {
			_, err := Evaluate(tt.expr)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Evaluate(%q) error = %v, want %v", tt.expr, err, tt.wantErr)
			}
			if IsSyntaxError(err) {
				t.Fatalf("math error reported as syntax error: %v", err)
			}
		})
	}
}

func FuzzEvaluate(f *testing.F) {
	for _, seed := range []string{
		"2 + 3 * 4", "(1 + 2) ^ -3", "√9%", "-(-(-1))", "1e308 * 10",
		"10 ÷ 0", "((((", "2(3)", "1.2.3", "sqrt", "", "×÷−√",
	} {
		f.Add(seed)
	}
	f.Fuzz(func(t *testing.T, expr string) {
		got, err := Evaluate(expr)
		if err == nil && (math.IsInf(got, 0) || math.IsNaN(got)) {
			t.Fatalf("Evaluate(%q) = %v without error", expr, got)
		}
	})
}
