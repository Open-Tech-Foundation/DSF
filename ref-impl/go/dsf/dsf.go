package dsf

import (
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type TokenKind int

const (
	TokenEOF TokenKind = iota
	TokenComment
	TokenString
	TokenConstructor
	TokenBraceOpen
	TokenBraceClose
	TokenBracketOpen
	TokenBracketClose
	TokenColon
	TokenComma
	TokenNumber
	TokenBoolT
	TokenBoolF
	TokenNullN
	TokenKey
)

type Token struct {
	Kind  TokenKind
	Value string
}

type Lexer struct {
	input string
	pos   int
}

func NewLexer(input string) *Lexer {
	return &Lexer{input: input}
}

func (l *Lexer) NextToken() (Token, error) {
	l.skipWhitespace()
	if l.pos >= len(l.input) {
		return Token{Kind: TokenEOF}, nil
	}

	ch := l.input[l.pos]
	if ch == '/' && l.peek() == '/' {
		l.pos += 2
		for l.pos < len(l.input) && l.input[l.pos] != '\n' {
			l.pos++
		}
		return l.NextToken() // Skip comment
	}

	if ch == '{' {
		l.pos++
		return Token{Kind: TokenBraceOpen, Value: "{"}, nil
	}
	if ch == '}' {
		l.pos++
		return Token{Kind: TokenBraceClose, Value: "}"}, nil
	}
	if ch == '[' {
		l.pos++
		return Token{Kind: TokenBracketOpen, Value: "["}, nil
	}
	if ch == ']' {
		l.pos++
		return Token{Kind: TokenBracketClose, Value: "]"}, nil
	}
	if ch == ':' {
		l.pos++
		return Token{Kind: TokenColon, Value: ":"}, nil
	}
	if ch == ',' {
		l.pos++
		return Token{Kind: TokenComma, Value: ","}, nil
	}
	if ch == '`' {
		start := l.pos
		l.pos++
		for l.pos < len(l.input) && l.input[l.pos] != '`' {
			l.pos++
		}
		if l.pos >= len(l.input) {
			return Token{}, errors.New("unterminated string")
		}
		l.pos++
		return Token{Kind: TokenString, Value: l.input[start:l.pos]}, nil
	}

	// Try Number
	if unicode.IsDigit(rune(ch)) || ch == '-' {
		// We need to check if it's really a number or start of a key
		// Actually identifiers can start with digits.
		// If it looks like a number AND is followed by non-identifier char, it's a number.
		numMatch := regexp.MustCompile(`^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?`).FindString(l.input[l.pos:])
		if numMatch != "" {
			endPos := l.pos + len(numMatch)
			if endPos >= len(l.input) || !isIdentifierChar(rune(l.input[endPos])) {
				l.pos = endPos
				return Token{Kind: TokenNumber, Value: numMatch}, nil
			}
		}
	}

	// Try Identifier (Key or Bool or Null or Constructor)
	if isIdentifierChar(rune(ch)) {
		start := l.pos
		for l.pos < len(l.input) && isIdentifierChar(rune(l.input[l.pos])) {
			l.pos++
		}
		val := l.input[start:l.pos]
		if l.pos < len(l.input) && l.input[l.pos] == '(' {
			// Constructor
			l.pos++
			for l.pos < len(l.input) && l.input[l.pos] != ')' {
				if unicode.IsSpace(rune(l.input[l.pos])) || l.input[l.pos] == '(' {
					return Token{}, fmt.Errorf("invalid character in constructor payload: %c", l.input[l.pos])
				}
				l.pos++
			}
			if l.pos >= len(l.input) {
				return Token{}, errors.New("unterminated constructor")
			}
			l.pos++
			return Token{Kind: TokenConstructor, Value: l.input[start:l.pos]}, nil
		}

		if val == "T" {
			return Token{Kind: TokenBoolT, Value: "T"}, nil
		}
		if val == "F" {
			return Token{Kind: TokenBoolF, Value: "F"}, nil
		}
		if val == "N" {
			return Token{Kind: TokenNullN, Value: "N"}, nil
		}
		return Token{Kind: TokenKey, Value: val}, nil
	}

	return Token{}, fmt.Errorf("unexpected character at position %d: %c", l.pos, ch)
}

func (l *Lexer) skipWhitespace() {
	for l.pos < len(l.input) && unicode.IsSpace(rune(l.input[l.pos])) {
		l.pos++
	}
}

func (l *Lexer) peek() byte {
	if l.pos+1 < len(l.input) {
		return l.input[l.pos+1]
	}
	return 0
}

func isIdentifierChar(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_'
}

type Parser struct {
	lexer *Lexer
	token Token
	err   error
}

func NewParser(input string) *Parser {
	p := &Parser{lexer: NewLexer(input)}
	p.nextToken()
	return p
}

func (p *Parser) nextToken() {
	if p.err != nil {
		return
	}
	p.token, p.err = p.lexer.NextToken()
}

func (p *Parser) Parse() (interface{}, error) {
	val, err := p.parseObject()
	if err != nil {
		return nil, err
	}
	if p.token.Kind != TokenEOF {
		return nil, fmt.Errorf("trailing data: %v", p.token)
	}
	return val, nil
}

func (p *Parser) parseValue() (interface{}, error) {
	switch p.token.Kind {
	case TokenBraceOpen:
		return p.parseObject()
	case TokenBracketOpen:
		return p.parseArray()
	case TokenString:
		v := p.token.Value[1 : len(p.token.Value)-1]
		p.nextToken()
		return v, nil
	case TokenNumber:
		v := p.token.Value
		p.nextToken()
		if strings.Contains(v, ".") || strings.ContainsAny(v, "eE") {
			return strconv.ParseFloat(v, 64)
		}
		return strconv.ParseInt(v, 10, 64)
	case TokenBoolT:
		p.nextToken()
		return true, nil
	case TokenBoolF:
		p.nextToken()
		return false, nil
	case TokenNullN:
		p.nextToken()
		return nil, nil
	case TokenConstructor:
		v := p.token.Value
		p.nextToken()
		return p.parseConstructor(v)
	default:
		return nil, fmt.Errorf("unexpected token in value position: %v", p.token)
	}
}

func (p *Parser) parseObject() (map[string]interface{}, error) {
	if p.token.Kind != TokenBraceOpen {
		return nil, fmt.Errorf("expected {, got %v", p.token)
	}
	p.nextToken()
	obj := make(map[string]interface{})
	for p.token.Kind != TokenBraceClose && p.token.Kind != TokenEOF {
		if p.token.Kind != TokenKey && p.token.Kind != TokenBoolT && p.token.Kind != TokenBoolF && p.token.Kind != TokenNullN {
			return nil, fmt.Errorf("expected key, got %v", p.token)
		}
		key := p.token.Value
		if _, ok := obj[key]; ok {
			return nil, fmt.Errorf("duplicate key: %s", key)
		}
		p.nextToken()
		if p.token.Kind != TokenColon {
			return nil, fmt.Errorf("expected :, got %v", p.token)
		}
		p.nextToken()
		val, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		obj[key] = val
		if p.token.Kind == TokenComma {
			p.nextToken()
		} else if p.token.Kind != TokenBraceClose {
			return nil, fmt.Errorf("expected , or }, got %v", p.token)
		}
	}
	if p.token.Kind != TokenBraceClose {
		return nil, errors.New("expected }")
	}
	p.nextToken()
	return obj, nil
}

func (p *Parser) parseArray() ([]interface{}, error) {
	p.nextToken()
	arr := make([]interface{}, 0)
	for p.token.Kind != TokenBracketClose && p.token.Kind != TokenEOF {
		val, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		arr = append(arr, val)
		if p.token.Kind == TokenComma {
			p.nextToken()
		} else if p.token.Kind != TokenBracketClose {
			return nil, fmt.Errorf("expected , or ], got %v", p.token)
		}
	}
	if p.token.Kind != TokenBracketClose {
		return nil, errors.New("expected ]")
	}
	p.nextToken()
	return arr, nil
}

func (p *Parser) parseConstructor(full string) (interface{}, error) {
	idx := strings.Index(full, "(")
	if idx == -1 {
		return nil, fmt.Errorf("invalid constructor: %s", full)
	}
	typeName := full[:idx]
	payload := full[idx+1 : len(full)-1]

	switch typeName {
	case "D":
		t, err := time.Parse(time.RFC3339, payload)
		if err != nil {
			t, err = time.Parse("2006-01-02", payload)
			if err != nil {
				return payload, nil // Fallback
			}
		}
		return t, nil
	case "BN":
		bi := new(big.Int)
		if _, ok := bi.SetString(payload, 10); !ok {
			return nil, fmt.Errorf("invalid BN: %s", payload)
		}
		return bi, nil
	case "B":
		b, err := hex.DecodeString(payload)
		if err != nil {
			return nil, fmt.Errorf("invalid B(hex): %s", payload)
		}
		return b, nil
	default:
		return nil, fmt.Errorf("unknown constructor: %s", typeName)
	}
}

func Stringify(v interface{}, indent string) string {
	return stringifyRecursive(v, indent, 0)
}

func stringifyRecursive(v interface{}, indent string, level int) string {
	sp := strings.Repeat(indent, level)
	switch val := v.(type) {
	case map[string]interface{}:
		if len(val) == 0 {
			return "{}"
		}
		var keys []string
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		var items []string
		for _, k := range keys {
			items = append(items, fmt.Sprintf("%s%s%s: %s", sp, indent, k, stringifyRecursive(val[k], indent, level+1)))
		}
		sep := ""
		if indent != "" {
			sep = "\n"
		}
		inner := strings.Join(items, ","+sep)
		if indent != "" {
			return fmt.Sprintf("{\n%s,\n%s}", inner, sp)
		}
		return fmt.Sprintf("{%s}", inner)
	case []interface{}:
		if len(val) == 0 {
			return "[]"
		}
		var items []string
		for _, item := range val {
			items = append(items, fmt.Sprintf("%s%s%s", sp, indent, stringifyRecursive(item, indent, level+1)))
		}
		sep := ""
		if indent != "" {
			sep = "\n"
		}
		inner := strings.Join(items, ","+sep)
		if indent != "" {
			return fmt.Sprintf("[\n%s,\n%s]", inner, sp)
		}
		return fmt.Sprintf("[%s]", inner)
	case string:
		return fmt.Sprintf("`%s`", val)
	case bool:
		if val {
			return "T"
		}
		return "F"
	case nil:
		return "N"
	case int, int64:
		return fmt.Sprintf("%d", val)
	case float64:
		return fmt.Sprintf("%g", val)
	case *big.Int:
		return fmt.Sprintf("BN(%s)", val.String())
	case []byte:
		return fmt.Sprintf("B(%s)", strings.ToUpper(hex.EncodeToString(val)))
	case time.Time:
		iv := val.Format(time.RFC3339)
		if strings.HasSuffix(iv, "Z") {
			// standard ISO
		}
		return fmt.Sprintf("D(%s)", iv)
	default:
		return fmt.Sprintf("?%T?", v)
	}
}

func Parse(input string) (interface{}, error) {
	p := NewParser(input)
	return p.Parse()
}
