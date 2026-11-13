// Package calc implements the calculator's arithmetic. It has no knowledge of
// HTTP; every function is pure and returns a sentinel error for inputs that
// have no real, finite result.
package calc

import (
	"errors"
	"math"
	"strconv"
)

// Sentinel errors returned for results that cannot be computed.
var (
	ErrDivisionByZero = errors.New("cannot divide by zero")
	ErrNegativeSqrt   = errors.New("cannot take the square root of a negative number")
	ErrNotReal        = errors.New("result is not a real number")
	ErrOverflow       = errors.New("result is out of range")
)

// significantDigits is the precision results are rounded to. float64 holds
// 15-17 significant digits; rounding to 15 removes binary noise such as
// 0.1 + 0.2 = 0.30000000000000004 without losing meaningful precision.
const significantDigits = 15

// Add returns a + b.
func Add(a, b float64) (float64, error) { return finalize(add(a, b)) }

// Subtract returns a - b.
func Subtract(a, b float64) (float64, error) { return finalize(subtract(a, b)) }

// Multiply returns a * b.
func Multiply(a, b float64) (float64, error) { return finalize(multiply(a, b)) }

// Divide returns a / b, or ErrDivisionByZero when b is zero.
func Divide(a, b float64) (float64, error) { return finalize(divide(a, b)) }

// Power returns a raised to b. 0^0 is 1. 0 raised to a negative exponent is a
// division by zero, and a negative base with a non-integer exponent has no
// real result.
func Power(a, b float64) (float64, error) { return finalize(power(a, b)) }

// Sqrt returns the square root of a, or ErrNegativeSqrt when a is negative.
func Sqrt(a float64) (float64, error) { return finalize(sqrt(a)) }

// Percentage returns a percent of b, i.e. a/100*b.
func Percentage(a, b float64) (float64, error) { return finalize(percentage(a, b)) }

// The unexported operations below do not round, so the expression evaluator
// can chain them and round once at the end. They still reject non-finite
// intermediate values so an overflow is reported where it happens.

func add(a, b float64) (float64, error)      { return checked(a + b) }
func subtract(a, b float64) (float64, error) { return checked(a - b) }
func multiply(a, b float64) (float64, error) { return checked(a * b) }

func divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return checked(a / b)
}

func power(a, b float64) (float64, error) {
	if a == 0 && b < 0 {
		return 0, ErrDivisionByZero
	}
	if a < 0 && b != math.Trunc(b) {
		return 0, ErrNotReal
	}
	return checked(math.Pow(a, b))
}

func sqrt(a float64) (float64, error) {
	if a < 0 {
		return 0, ErrNegativeSqrt
	}
	return checked(math.Sqrt(a))
}

func percentage(a, b float64) (float64, error) {
	// Divide first so very large operands overflow as late as possible.
	return checked(a / 100 * b)
}

func checked(v float64) (float64, error) {
	if math.IsInf(v, 0) || math.IsNaN(v) {
		return 0, ErrOverflow
	}
	return v, nil
}

// finalize rounds a result to significantDigits and normalizes -0 to 0.
func finalize(v float64, err error) (float64, error) {
	if err != nil {
		return 0, err
	}
	if v == 0 {
		return 0, nil // also turns -0 into 0
	}
	rounded, err := strconv.ParseFloat(strconv.FormatFloat(v, 'g', significantDigits, 64), 64)
	if err != nil {
		// Only possible when rounding pushes a value next to math.MaxFloat64
		// past the float64 range; the unrounded value is still valid.
		return v, nil
	}
	return rounded, nil
}
