package calc

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Limits that keep a hostile expression from using unbounded time or stack.
const (
	MaxExpressionLength = 256 // characters
	MaxDepth            = 32  // nested parentheses, stacked prefix operators and ^ chains
)

// SyntaxError reports malformed input. Pos is the 1-based character position
// the problem was found at.
type SyntaxError struct {
	Pos int
	Msg string
}

func (e *SyntaxError) Error() string {
	return fmt.Sprintf("syntax error at position %d: %s", e.Pos, e.Msg)
}

// Evaluate parses and computes an arithmetic expression such as "2 + 3 * 4".
//
// Supported, from lowest to highest precedence:
//
//	addition, subtraction      a + b, a - b   left-associative
//	multiplication, division   a * b, a / b   left-associative
//	prefix minus, plus, root   -a, +a, √a     "sqrt" is accepted for √
//	power                      a ^ b          right-associative: -2^2 = -4, 2^3^2 = 512
//	postfix percent            a%             50% = 0.5
//	grouping                   (a)
//
// The symbols × ÷ − are accepted as aliases for * / -. Numbers may use
// scientific notation (2.5e-3). Implicit multiplication such as 2(3) is a
// syntax error.
//
// The whole expression is parsed before anything is computed, so a syntax
// error is always reported ahead of a math error.
func Evaluate(expr string) (float64, error) {
	tokens, err := lex(expr)
	if err != nil {
		return 0, err
	}
	p := parser{tokens: tokens}
	tree, err := p.parse()
	if err != nil {
		return 0, err
	}
	return finalize(tree.eval())
}

// ---- lexer ----

type tokenKind int

const (
	tokNumber tokenKind = iota
	tokOp
	tokEOF
)

type token struct {
	kind tokenKind
	op   rune    // for tokOp: one of + - * / ^ % √ ( )
	num  float64 // for tokNumber
	pos  int     // 1-based character position
}

var aliases = map[rune]rune{'×': '*', '÷': '/', '−': '-'}

func lex(input string) ([]token, error) {
	if n := utf8.RuneCountInString(input); n > MaxExpressionLength {
		return nil, &SyntaxError{Pos: MaxExpressionLength + 1,
			Msg: fmt.Sprintf("expression is longer than %d characters", MaxExpressionLength)}
	}
	if strings.TrimSpace(input) == "" {
		return nil, &SyntaxError{Pos: 1, Msg: "expression is empty"}
	}

	runes := []rune(input)
	var tokens []token
	for i := 0; i < len(runes); {
		r := runes[i]
		pos := i + 1
		switch {
		case unicode.IsSpace(r):
			i++
		case isDigit(r) || r == '.':
			end, err := scanNumber(runes, i)
			if err != nil {
				return nil, err
			}
			v, perr := strconv.ParseFloat(string(runes[i:end]), 64)
			if perr != nil && math.IsInf(v, 0) {
				return nil, ErrOverflow
			}
			// Any other ParseFloat error is an underflow; v is then the
			// nearest representable value (possibly 0), which is fine.
			tokens = append(tokens, token{kind: tokNumber, num: v, pos: pos})
			i = end
		case r == 's' && strings.HasPrefix(string(runes[i:]), "sqrt"):
			tokens = append(tokens, token{kind: tokOp, op: '√', pos: pos})
			i += len("sqrt")
		case strings.ContainsRune("+-*/^%√()", r):
			tokens = append(tokens, token{kind: tokOp, op: r, pos: pos})
			i++
		default:
			if alias, ok := aliases[r]; ok {
				tokens = append(tokens, token{kind: tokOp, op: alias, pos: pos})
				i++
				continue
			}
			return nil, &SyntaxError{Pos: pos, Msg: fmt.Sprintf("unexpected character %q", r)}
		}
	}
	return append(tokens, token{kind: tokEOF, pos: len(runes) + 1}), nil
}

// scanNumber returns the index just past the number starting at runes[start].
// Accepted forms: 12, 1.5, .5, 5., 1e21, 2.5E-3.
func scanNumber(runes []rune, start int) (int, error) {
	i := start
	digits := 0
	for i < len(runes) && isDigit(runes[i]) {
		i++
		digits++
	}
	if i < len(runes) && runes[i] == '.' {
		i++
		for i < len(runes) && isDigit(runes[i]) {
			i++
			digits++
		}
	}
	if digits == 0 {
		return 0, &SyntaxError{Pos: start + 1, Msg: "invalid number"}
	}
	if i < len(runes) && (runes[i] == 'e' || runes[i] == 'E') {
		j := i + 1
		if j < len(runes) && (runes[j] == '+' || runes[j] == '-') {
			j++
		}
		if j >= len(runes) || !isDigit(runes[j]) {
			return 0, &SyntaxError{Pos: i + 1, Msg: "invalid exponent"}
		}
		for j < len(runes) && isDigit(runes[j]) {
			j++
		}
		i = j
	}
	if i < len(runes) && runes[i] == '.' {
		return 0, &SyntaxError{Pos: i + 1, Msg: "invalid number"}
	}
	return i, nil
}

func isDigit(r rune) bool { return r >= '0' && r <= '9' }

// ---- parser ----

type node interface {
	eval() (float64, error)
}

type numberNode float64

func (n numberNode) eval() (float64, error) { return float64(n), nil }

type unaryNode struct {
	op rune // '-', '+', '√' prefix or '%' postfix
	x  node
}

func (n unaryNode) eval() (float64, error) {
	v, err := n.x.eval()
	if err != nil {
		return 0, err
	}
	switch n.op {
	case '-':
		return -v, nil
	case '√':
		return sqrt(v)
	case '%':
		return v / 100, nil
	default: // '+'
		return v, nil
	}
}

type binaryNode struct {
	op   rune
	l, r node
}

func (n binaryNode) eval() (float64, error) {
	l, err := n.l.eval()
	if err != nil {
		return 0, err
	}
	r, err := n.r.eval()
	if err != nil {
		return 0, err
	}
	switch n.op {
	case '+':
		return add(l, r)
	case '-':
		return subtract(l, r)
	case '*':
		return multiply(l, r)
	case '/':
		return divide(l, r)
	default: // '^'
		return power(l, r)
	}
}

type parser struct {
	tokens []token
	i      int
	depth  int
}

func (p *parser) peek() token { return p.tokens[p.i] }

func (p *parser) next() token {
	t := p.tokens[p.i]
	if t.kind != tokEOF {
		p.i++
	}
	return t
}

func (p *parser) isOp(ops string) (token, bool) {
	t := p.peek()
	return t, t.kind == tokOp && strings.ContainsRune(ops, t.op)
}

func (p *parser) enter(pos int) error {
	p.depth++
	if p.depth > MaxDepth {
		return &SyntaxError{Pos: pos, Msg: "expression is nested too deeply"}
	}
	return nil
}

func (p *parser) leave() { p.depth-- }

func (p *parser) parse() (node, error) {
	n, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if t := p.peek(); t.kind != tokEOF {
		return nil, unexpected(t)
	}
	return n, nil
}

// expr = term { ("+" | "-") term }
func (p *parser) parseExpr() (node, error) {
	left, err := p.parseTerm()
	if err != nil {
		return nil, err
	}
	for {
		t, ok := p.isOp("+-")
		if !ok {
			return left, nil
		}
		p.next()
		right, err := p.parseTerm()
		if err != nil {
			return nil, err
		}
		left = binaryNode{op: t.op, l: left, r: right}
	}
}

// term = unary { ("*" | "/") unary }
func (p *parser) parseTerm() (node, error) {
	left, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	for {
		t, ok := p.isOp("*/")
		if !ok {
			return left, nil
		}
		p.next()
		right, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		left = binaryNode{op: t.op, l: left, r: right}
	}
}

// unary = ("-" | "+" | "√") unary | power
func (p *parser) parseUnary() (node, error) {
	t, ok := p.isOp("-+√")
	if !ok {
		return p.parsePower()
	}
	p.next()
	if err := p.enter(t.pos); err != nil {
		return nil, err
	}
	defer p.leave()
	x, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	return unaryNode{op: t.op, x: x}, nil
}

// power = postfix [ "^" unary ]
func (p *parser) parsePower() (node, error) {
	base, err := p.parsePostfix()
	if err != nil {
		return nil, err
	}
	t, ok := p.isOp("^")
	if !ok {
		return base, nil
	}
	p.next()
	if err := p.enter(t.pos); err != nil {
		return nil, err
	}
	defer p.leave()
	exp, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	return binaryNode{op: '^', l: base, r: exp}, nil
}

// postfix = primary { "%" }
func (p *parser) parsePostfix() (node, error) {
	n, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}
	for {
		if _, ok := p.isOp("%"); !ok {
			return n, nil
		}
		p.next()
		n = unaryNode{op: '%', x: n}
	}
}

// primary = number | "(" expr ")"
func (p *parser) parsePrimary() (node, error) {
	t := p.next()
	switch {
	case t.kind == tokNumber:
		return numberNode(t.num), nil
	case t.kind == tokOp && t.op == '(':
		if err := p.enter(t.pos); err != nil {
			return nil, err
		}
		defer p.leave()
		n, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		if _, ok := p.isOp(")"); !ok {
			return nil, &SyntaxError{Pos: p.peek().pos, Msg: "expected ')'"}
		}
		p.next()
		return n, nil
	default:
		return nil, unexpected(t)
	}
}

func unexpected(t token) error {
	switch t.kind {
	case tokEOF:
		return &SyntaxError{Pos: t.pos, Msg: "unexpected end of expression"}
	case tokNumber:
		return &SyntaxError{Pos: t.pos, Msg: "unexpected number"}
	default:
		return &SyntaxError{Pos: t.pos, Msg: fmt.Sprintf("unexpected %q", t.op)}
	}
}

// IsSyntaxError reports whether err is a *SyntaxError.
func IsSyntaxError(err error) bool {
	var se *SyntaxError
	return errors.As(err, &se)
}
