export class DSFError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DSFError';
    }
}

export type TokenKind =
    | 'COMMENT'
    | 'STRING'
    | 'CONSTRUCTOR'
    | 'BRACE_OPEN'
    | 'BRACE_CLOSE'
    | 'BRACKET_OPEN'
    | 'BRACKET_CLOSE'
    | 'COLON'
    | 'COMMA'
    | 'NUMBER'
    | 'BOOL_T'
    | 'BOOL_F'
    | 'NULL_N'
    | 'KEY'
    | 'WHITESPACE'
    | 'MISMATCH'
    | 'EOF';

export interface Token {
    kind: TokenKind;
    value: string | null;
}

export class DSFLexer {
    static TOKEN_SPEC: [TokenKind, RegExp][] = [
        ['COMMENT', /\/\/.*/],
        ['STRING', /`[^`]*`/],
        ['CONSTRUCTOR', /[A-Za-z0-9_]+\([^() \t\n\r]*\)/],
        ['BRACE_OPEN', /\{/],
        ['BRACE_CLOSE', /\}/],
        ['BRACKET_OPEN', /\[/],
        ['BRACKET_CLOSE', /\]/],
        ['COLON', /:/],
        ['COMMA', /,/],
        ['NUMBER', /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?(?![A-Za-z0-9_])/],
        ['BOOL_T', /\bT\b/],
        ['BOOL_F', /\bF\b/],
        ['NULL_N', /\bN\b/],
        ['KEY', /[A-Za-z0-9_]+/],
        ['WHITESPACE', /[ \t\r\n]+/],
        ['MISMATCH', /./],
    ];

    tokens: Token[] = [];

    constructor(text: string) {
        this.tokenize(text);
    }

    private tokenize(text: string) {
        const specs = DSFLexer.TOKEN_SPEC.map(([name, re]) => `(?<${name}>${re.source})`).join('|');
        const regex = new RegExp(specs, 'g');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
            const kind = Object.keys(match.groups!).find(key => match.groups![key] !== undefined) as TokenKind;
            const value = match[0];
            if (kind === 'WHITESPACE' || kind === 'COMMENT') continue;
            if (kind === 'MISMATCH') throw new DSFError(`Unexpected character: ${value}`);
            this.tokens.push({ kind, value });
        }
        this.tokens.push({ kind: 'EOF', value: null });
    }
}

export type DSFValue =
    | string
    | number
    | boolean
    | null
    | bigint
    | Date
    | Uint8Array
    | DSFValue[]
    | { [key: string]: DSFValue };

export class DSFParser {
    tokens: Token[];
    pos: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    private peek(): Token {
        return this.tokens[this.pos] || { kind: 'EOF', value: null };
    }

    private consume(expectedKind?: TokenKind): string {
        const token = this.peek();
        if (expectedKind && token.kind !== expectedKind) {
            throw new DSFError(`Expected ${expectedKind}, got ${token.kind}`);
        }
        this.pos++;
        return token.value!;
    }

    parse(): { [key: string]: DSFValue } {
        const result = this.parseObject();
        if (this.peek().kind !== 'EOF') {
            throw new DSFError(`Trailing data after root object: ${this.peek().kind}`);
        }
        return result;
    }

    private parseValue(): DSFValue {
        const token = this.peek();
        switch (token.kind) {
            case 'BRACE_OPEN':
                return this.parseObject();
            case 'BRACKET_OPEN':
                return this.parseArray();
            case 'STRING':
                this.consume();
                return token.value!.slice(1, -1);
            case 'NUMBER':
                this.consume();
                return Number(token.value);
            case 'BOOL_T':
                this.consume();
                return true;
            case 'BOOL_F':
                this.consume();
                return false;
            case 'NULL_N':
                this.consume();
                return null;
            case 'CONSTRUCTOR':
                this.consume();
                return this.parseConstructor(token.value!);
            default:
                throw new DSFError(`Unexpected token in value position: ${token.kind} (${token.value})`);
        }
    }

    private parseObject(): { [key: string]: DSFValue } {
        this.consume('BRACE_OPEN');
        const obj: { [key: string]: DSFValue } = {};
        while (this.peek().kind !== 'BRACE_CLOSE') {
            const token = this.peek();
            if (!['KEY', 'BOOL_T', 'BOOL_F', 'NULL_N', 'NUMBER'].includes(token.kind)) {
                // Number can be a key if it starts with digit but is matched as number?
                // Actually the spec says leading digits are allowed for keys.
                // Our lexer matches NUMBER with negative lookahead.
                throw new DSFError(`Expected key, got ${token.kind} (${token.value})`);
            }
            const key = this.consume();
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                throw new DSFError(`Duplicate key: ${key}`);
            }
            this.consume('COLON');
            obj[key] = this.parseValue();

            if (this.peek().kind === 'COMMA') {
                this.consume('COMMA');
            } else if (this.peek().kind !== 'BRACE_CLOSE') {
                throw new DSFError(`Expected ',' or '}' in object, got ${this.peek().kind}`);
            }
        }
        this.consume('BRACE_CLOSE');
        return obj;
    }

    private parseArray(): DSFValue[] {
        this.consume('BRACKET_OPEN');
        const arr: DSFValue[] = [];
        while (this.peek().kind !== 'BRACKET_CLOSE') {
            arr.push(this.parseValue());
            if (this.peek().kind === 'COMMA') {
                this.consume('COMMA');
            } else if (this.peek().kind !== 'BRACKET_CLOSE') {
                throw new DSFError(`Expected ',' or ']' in array, got ${this.peek().kind}`);
            }
        }
        this.consume('BRACKET_CLOSE');
        return arr;
    }

    private parseConstructor(fullValue: string): DSFValue {
        const match = fullValue.match(/([A-Za-z0-9_]+)\((.*)\)/);
        if (!match) throw new DSFError(`Invalid constructor format: ${fullValue}`);
        const typeName = match[1];
        const payload = match[2];

        if (typeName === 'D') {
            const date = new Date(payload!);
            if (isNaN(date.getTime())) return payload || '';
            return date;
        } else if (typeName === 'BN') {
            if (!payload || !/^-?[0-9]+$/.test(payload)) throw new DSFError(`Invalid BN payload: ${payload}`);
            return BigInt(payload);
        } else if (typeName === 'B') {
            if (!payload || !/^[0-9A-Fa-f]*$/.test(payload)) throw new DSFError(`Invalid B(hex) payload: ${payload}`);
            const bytes = new Uint8Array(payload.length / 2);
            for (let i = 0; i < payload.length; i += 2) {
                bytes[i / 2] = parseInt(payload.slice(i, i + 2), 16);
            }
            return bytes;
        } else {
            throw new DSFError(`Unknown constructor: ${typeName}`);
        }
    }
}

export function stringify(obj: DSFValue, indent: string | null = null): string {
    const _stringify = (o: DSFValue, level: number): string => {
        const sp = indent ? indent.repeat(level) : '';
        const newline = indent ? '\n' : '';
        const space = indent ? ' ' : '';

        if (Array.isArray(o)) {
            if (o.length === 0) return '[]';
            const items = o.map(item => (indent ? sp + indent : '') + _stringify(item, level + 1));
            return '[' + newline + items.join(',' + newline) + (indent ? ',' + newline + sp : '') + ']';
        } else if (o instanceof Date) {
            let val = o.toISOString();
            if (val.endsWith('.000Z')) val = val.slice(0, -5) + 'Z';
            return `D(${val})`;
        } else if (o instanceof Uint8Array) {
            const hex = Array.from(o).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
            return `B(${hex})`;
        } else if (typeof o === 'bigint') {
            return `BN(${o.toString()})`;
        } else if (o === null) {
            return 'N';
        } else if (typeof o === 'boolean') {
            return o ? 'T' : 'F';
        } else if (typeof o === 'number') {
            return o.toString();
        } else if (typeof o === 'string') {
            return `\`${o}\``;
        } else if (typeof o === 'object') {
            const keys = Object.keys(o as object).sort();
            if (keys.length === 0) return '{}';
            const items = keys.map(k => (indent ? sp + indent : '') + `${k}:${space}${_stringify((o as any)[k], level + 1)}`);
            return '{' + newline + items.join(',' + newline) + (indent ? ',' + newline + sp : '') + '}';
        }
        throw new DSFError(`Unsupported type for serialization: ${typeof o}`);
    };

    return _stringify(obj, 0);
}

export function parse(text: string): { [key: string]: DSFValue } {
    const lexer = new DSFLexer(text);
    const parser = new DSFParser(lexer.tokens);
    return parser.parse();
}
