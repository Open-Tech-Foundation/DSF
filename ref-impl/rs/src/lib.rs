use std::collections::HashMap;
use std::fmt;

#[derive(Debug)]
pub enum DSFError {
    UnexpectedChar(usize, char),
    UnexpectedEOF,
    InvalidNumber(String),
    InvalidConstructor(String),
    TrailingData(usize),
}

impl fmt::Display for DSFError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            DSFError::UnexpectedChar(pos, ch) => write!(f, "Unexpected char at {}: {}", pos, ch),
            DSFError::UnexpectedEOF => write!(f, "Unexpected end of file"),
            DSFError::InvalidNumber(s) => write!(f, "Invalid number: {}", s),
            DSFError::InvalidConstructor(s) => write!(f, "Invalid constructor: {}", s),
            DSFError::TrailingData(pos) => write!(f, "Trailing data at position {}", pos),
        }
    }
}

impl std::error::Error for DSFError {}

#[derive(Debug, Clone, PartialEq)]
pub enum DSFValue {
    String(String),
    Number(f64),
    Bool(bool),
    Null,
    BigInt(i64),
    Date(String),
    Bytes(Vec<u8>),
    Array(Vec<DSFValue>),
    Object(HashMap<String, DSFValue>),
}

pub struct DSFParser<'a> {
    input: &'a [u8],
    pos: usize,
}

impl<'a> DSFParser<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            input: input.as_bytes(),
            pos: 0,
        }
    }

    #[inline]
    fn current(&self) -> Option<u8> {
        if self.pos < self.input.len() {
            Some(self.input[self.pos])
        } else {
            None
        }
    }

    #[inline]
    fn advance(&mut self) {
        self.pos += 1;
    }

    #[inline]
    fn skip_whitespace(&mut self) {
        while let Some(ch) = self.current() {
            match ch {
                b' ' | b'\t' | b'\r' | b'\n' => self.advance(),
                b'/' if self.peek_next() == Some(b'/') => {
                    // Skip comment
                    self.advance();
                    self.advance();
                    while let Some(ch) = self.current() {
                        self.advance();
                        if ch == b'\n' {
                            break;
                        }
                    }
                }
                _ => break,
            }
        }
    }

    #[inline]
    fn peek_next(&self) -> Option<u8> {
        if self.pos + 1 < self.input.len() {
            Some(self.input[self.pos + 1])
        } else {
            None
        }
    }

    pub fn parse(&mut self) -> Result<HashMap<String, DSFValue>, DSFError> {
        self.skip_whitespace();
        let result = self.parse_object()?;
        self.skip_whitespace();
        if self.pos < self.input.len() {
            return Err(DSFError::TrailingData(self.pos));
        }
        Ok(result)
    }

    fn parse_value(&mut self) -> Result<DSFValue, DSFError> {
        self.skip_whitespace();
        match self.current() {
            Some(b'{') => Ok(DSFValue::Object(self.parse_object()?)),
            Some(b'[') => Ok(DSFValue::Array(self.parse_array()?)),
            Some(b'`') => Ok(DSFValue::String(self.parse_string()?)),
            Some(b'-') | Some(b'0'..=b'9') => Ok(DSFValue::Number(self.parse_number()?)),
            Some(b'T') if self.peek_next() != Some(b'(') => {
                self.advance();
                Ok(DSFValue::Bool(true))
            }
            Some(b'F') if self.peek_next() != Some(b'(') => {
                self.advance();
                Ok(DSFValue::Bool(false))
            }
            Some(b'N') if self.peek_next() != Some(b'(') => {
                self.advance();
                Ok(DSFValue::Null)
            }
            Some(b'A'..=b'Z') | Some(b'a'..=b'z') | Some(b'_') => self.parse_constructor(),
            Some(ch) => Err(DSFError::UnexpectedChar(self.pos, ch as char)),
            None => Err(DSFError::UnexpectedEOF),
        }
    }

    fn parse_object(&mut self) -> Result<HashMap<String, DSFValue>, DSFError> {
        self.advance(); // skip '{'
        let mut map = HashMap::new();

        self.skip_whitespace();
        while self.current() != Some(b'}') {
            // Parse key
            let key = self.parse_key()?;
            self.skip_whitespace();

            if self.current() != Some(b':') {
                return Err(DSFError::UnexpectedChar(self.pos, self.current().unwrap() as char));
            }
            self.advance(); // skip ':'

            let value = self.parse_value()?;
            map.insert(key, value);

            self.skip_whitespace();
            if self.current() == Some(b',') {
                self.advance();
                self.skip_whitespace();
            }
        }

        self.advance(); // skip '}'
        Ok(map)
    }

    fn parse_array(&mut self) -> Result<Vec<DSFValue>, DSFError> {
        self.advance(); // skip '['
        let mut arr = Vec::new();

        self.skip_whitespace();
        while self.current() != Some(b']') {
            arr.push(self.parse_value()?);

            self.skip_whitespace();
            if self.current() == Some(b',') {
                self.advance();
                self.skip_whitespace();
            }
        }

        self.advance(); // skip ']'
        Ok(arr)
    }

    fn parse_key(&mut self) -> Result<String, DSFError> {
        let start = self.pos;
        while let Some(ch) = self.current() {
            if ch.is_ascii_alphanumeric() || ch == b'_' {
                self.advance();
            } else {
                break;
            }
        }
        Ok(String::from_utf8_lossy(&self.input[start..self.pos]).to_string())
    }

    fn parse_string(&mut self) -> Result<String, DSFError> {
        self.advance(); // skip opening '`'
        let start = self.pos;
        while let Some(ch) = self.current() {
            if ch == b'`' {
                break;
            }
            self.advance();
        }
        let result = String::from_utf8_lossy(&self.input[start..self.pos]).to_string();
        self.advance(); // skip closing '`'
        Ok(result)
    }

    fn parse_number(&mut self) -> Result<f64, DSFError> {
        let start = self.pos;

        // Optional negative sign
        if self.current() == Some(b'-') {
            self.advance();
        }

        // Integer part
        if self.current() == Some(b'0') {
            self.advance();
        } else if matches!(self.current(), Some(b'1'..=b'9')) {
            while matches!(self.current(), Some(b'0'..=b'9')) {
                self.advance();
            }
        }

        // Decimal part
        if self.current() == Some(b'.') {
            self.advance();
            while matches!(self.current(), Some(b'0'..=b'9')) {
                self.advance();
            }
        }

        // Exponent
        if matches!(self.current(), Some(b'e') | Some(b'E')) {
            self.advance();
            if matches!(self.current(), Some(b'+') | Some(b'-')) {
                self.advance();
            }
            while matches!(self.current(), Some(b'0'..=b'9')) {
                self.advance();
            }
        }

        let num_str = String::from_utf8_lossy(&self.input[start..self.pos]);
        num_str.parse::<f64>()
            .map_err(|_| DSFError::InvalidNumber(num_str.to_string()))
    }

    fn parse_constructor(&mut self) -> Result<DSFValue, DSFError> {
        let start = self.pos;
        while let Some(ch) = self.current() {
            if ch.is_ascii_alphanumeric() || ch == b'_' {
                self.advance();
            } else {
                break;
            }
        }
        let type_name = String::from_utf8_lossy(&self.input[start..self.pos]).to_string();

        if self.current() != Some(b'(') {
            return Err(DSFError::InvalidConstructor(type_name));
        }
        self.advance(); // skip '('

        let payload_start = self.pos;
        while self.current() != Some(b')') {
            if self.current().is_none() {
                return Err(DSFError::UnexpectedEOF);
            }
            self.advance();
        }
        let payload = String::from_utf8_lossy(&self.input[payload_start..self.pos]).to_string();
        self.advance(); // skip ')'

        match type_name.as_str() {
            "D" => Ok(DSFValue::Date(payload)),
            "BN" => {
                let num = payload.parse::<i64>()
                    .map_err(|_| DSFError::InvalidConstructor(format!("BN({})", payload)))?;
                Ok(DSFValue::BigInt(num))
            }
            "B" => {
                let mut bytes = Vec::new();
                for i in (0..payload.len()).step_by(2) {
                    let byte = u8::from_str_radix(&payload[i..i+2], 16)
                        .map_err(|_| DSFError::InvalidConstructor(format!("B({})", payload)))?;
                    bytes.push(byte);
                }
                Ok(DSFValue::Bytes(bytes))
            }
            _ => Err(DSFError::InvalidConstructor(type_name)),
        }
    }
}

// Stringifier
pub fn stringify(value: &DSFValue, indent: Option<&str>) -> String {
    let mut result = String::new();
    stringify_value(value, &mut result, indent, 0);
    result
}

fn stringify_value(value: &DSFValue, out: &mut String, indent: Option<&str>, level: usize) {
    match value {
        DSFValue::String(s) => {
            out.push('`');
            out.push_str(s);
            out.push('`');
        }
        DSFValue::Number(n) => out.push_str(&n.to_string()),
        DSFValue::Bool(true) => out.push('T'),
        DSFValue::Bool(false) => out.push('F'),
        DSFValue::Null => out.push('N'),
        DSFValue::BigInt(n) => {
            out.push_str("BN(");
            out.push_str(&n.to_string());
            out.push(')');
        }
        DSFValue::Date(s) => {
            out.push_str("D(");
            out.push_str(s);
            out.push(')');
        }
        DSFValue::Bytes(bytes) => {
            out.push_str("B(");
            for byte in bytes {
                out.push_str(&format!("{:02X}", byte));
            }
            out.push(')');
        }
        DSFValue::Array(arr) => {
            if arr.is_empty() {
                out.push_str("[]");
                return;
            }
            out.push('[');
            if let Some(ind) = indent {
                out.push('\n');
                for (_i, item) in arr.iter().enumerate() {
                    for _ in 0..=level {
                        out.push_str(ind);
                    }
                    stringify_value(item, out, indent, level + 1);
                    out.push_str(",\n");
                }
                for _ in 0..level {
                    out.push_str(ind);
                }
            } else {
                for (i, item) in arr.iter().enumerate() {
                    stringify_value(item, out, indent, level + 1);
                    if i < arr.len() - 1 {
                        out.push(',');
                    }
                }
            }
            out.push(']');
        }
        DSFValue::Object(map) => {
            if map.is_empty() {
                out.push_str("{}");
                return;
            }
            out.push('{');
            let mut keys: Vec<_> = map.keys().collect();
            keys.sort();
            
            if let Some(ind) = indent {
                out.push('\n');
                for key in keys {
                    for _ in 0..=level {
                        out.push_str(ind);
                    }
                    out.push_str(key);
                    out.push_str(": ");
                    stringify_value(&map[key], out, indent, level + 1);
                    out.push_str(",\n");
                }
                for _ in 0..level {
                    out.push_str(ind);
                }
            } else {
                for (i, key) in keys.iter().enumerate() {
                    out.push_str(key);
                    out.push(':');
                    stringify_value(&map[*key], out, indent, level + 1);
                    if i < keys.len() - 1 {
                        out.push(',');
                    }
                }
            }
            out.push('}');
        }
    }
}

// Public API
pub fn parse(input: &str) -> Result<HashMap<String, DSFValue>, DSFError> {
    let mut parser = DSFParser::new(input);
    parser.parse()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_object() {
        let input = "{name: `John`, age: 30}";
        let result = parse(input).unwrap();
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_array() {
        let input = "{items: [1, 2, 3]}";
        let result = parse(input).unwrap();
        if let Some(DSFValue::Array(arr)) = result.get("items") {
            assert_eq!(arr.len(), 3);
        } else {
            panic!("Expected array");
        }
    }
}
