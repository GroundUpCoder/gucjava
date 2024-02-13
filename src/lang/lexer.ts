import { ReservedKeywordsMap, SymbolsMap, Token, TokenType } from "./token";

function isSpace(c: string): boolean {
  switch (c) {
    case ' ':    // SP space
    case '\t':   // HT horizontal tab
    case '\r':   // CR carriage return
    case '\n':   // LF line feed
    case '\x0c': // FF form feed
      return true;
  }
  return false;
}

function isJavaLetter(c: string): boolean {
  return /[_A-Za-z]/.test(c);
}

function isJavaLetterOrDigit(c: string): boolean {
  return /[_A-Za-z0-9]/.test(c);
}

function isDigit(c: string): boolean {
  return /[0-9]/.test(c);
}

function isOctalDigit(c: string): boolean {
  return /[0-7]/.test(c);
}

function isHexDigit(c: string): boolean {
  return /[0-9A-Fa-f]/.test(c);
}

function isDigitOrUnderscore(c: string): boolean {
  return /[_0-9]/.test(c);
}

function isHexDigitOrUnderscore(c: string): boolean {
  return /[_0-9A-Fa-f]/.test(c);
}

export function lex(s: string): Token[] {
  const len = s.length;
  const tokens: Token[] = [];

  let line = 0;
  let column = 0;
  let index = 0;

  function incr() {
    if (index < len) {
      if (s[index] === '\n') {
        line++;
        column = 0;
      } else {
        column++;
      }
      index++;
    }
  }
  function eof() { return index >= len; }
  function skipWhitespace() {
    while (index < len) {
      if (s[index] === '\n') {
        line++;
        column = 0;
        index++;
        continue;
      }
      if (isSpace(s[index])) {
        column++;
        index++;
        continue;
      }
      if (s.startsWith('//', index)) {
        while (index < len && s[index] !== '\n') {
          column++;
          index++;
        }
        continue;
      }
      if (s.startsWith('/*', index)) {
        column += 2;
        index += 2;
        while (index < len && !s.startsWith('*/', index)) {
          incr();
        }
        if (s.startsWith('*/', index)) {
          column += 2;
          index += 2;
        }
      }
      break;
    }
    while (index < len &&
      (isSpace(s[index]) || s.startsWith('//', index) || s.startsWith('/*', index))) {
      if (s[index] === '\n') {
        line++;
        column = 0;
      } else {
        column++;
      }
      index++;
    }
  }
  function translateEscapeSequence(): string {
    const escapeStart = { line, column, index };
    if (index >= s.length || s[index] !== '\\') {
      return ''; // no escape
    }
    index++;
    column++;
    let value: string = '';
    switch (s[index]) {
      case 'b': value = '\b'; break;
      case 's': value = ' '; break;
      case 't': value = '\t'; break;
      case 'n': value = '\n'; break;
      case 'f': value = '\f'; break;
      case 'r': value = '\r'; break;
      case '"': value = '"'; break;
      case "'": value = "'"; break;
      case '\\': value = '\\'; break;
    }
    if (value === '') {
      if (isOctalDigit(s[index])) {
        const start = index;
        for (let i = 0; i < 3 && index < len && isOctalDigit(s[index]); i++) {
          index++;
          column++;
        }
        value = String.fromCodePoint(parseInt(s.substring(start, index), 8));
      } else if (s[index] === 'u') {
        while (index < len && s[index] === 'u') {
          index++;
          column++;
        }
        const start = index;
        for (let i = 0; i < 4 && index < len && isHexDigit(s[index]); i++) {
          index++;
          column++;
        }
        value = String.fromCodePoint(parseInt(s.substring(start, index), 16));
      } else {
        tokens.push({
          range: { start: escapeStart, end: { line, column, index } },
          type: 'ERROR-BAD-ESCAPE-SEQUENCE',
          value: null,
        });
        return '';
      }
    } else {
      // increment for the single character escapes
      index++;
      column++;
    }
    return value;
  }

  while (!eof()) {
    skipWhitespace();
    const tokenStartIndex = index;
    const tokenStart = { line, column, index: tokenStartIndex };
    if (index >= len) {
      tokens.push({
        range: { start: tokenStart, end: tokenStart },
        type: 'EOF',
        value: null,
      });
      break;
    }

    // identifiers and keywords
    if (isJavaLetter(s[index])) {
      index++;
      column++;
      while (index < len && isJavaLetterOrDigit(s[index])) {
        index++;
        column++;
      }
      const value = s.substring(tokenStartIndex, index);
      const type = ReservedKeywordsMap.get(value) || 'IDENTIFIER';
      tokens.push({
        range: { start: tokenStart, end: { line, column, index } },
        type,
        value: type === 'IDENTIFIER' ? value : null,
      });
      continue;
    }

    // number literals
    if (isDigit(s[index]) || (index + 1 < len && s[index] === '.' && isDigit(s[index + 1]))) {
      const radix = s.startsWith('0x') ? 16 : s.startsWith('0b') ? 2 : s[index] === '0' ? 8 : 10;
      if (radix !== 10) {
        if (radix !== 8) {
          index++;
          column++;
        }
        index++;
        column++;
      }
      const digitStart = index;
      while (index < len &&
        (radix === 16 ? isHexDigitOrUnderscore(s[index]) : isDigitOrUnderscore(s[index]))) {
        index++;
        column++;
      }
      let type: TokenType = "INT";
      let value: number = 0;
      if (index < len && (s[index] === '.' || s[index] === 'e' || s[index] === 'E')) {
        type = "DOUBLE";
        if (radix !== 10) {
          tokens.push({
            range: { start: tokenStart, end: { line, column, index } },
            type: "ERROR-UNSUPPORTED-NUMBER-LITERAL",
            value: `Floating literals must have base 10 but got ${radix}`,
          });
        }
        if (index < len && s[index] === '.') {
          index++;
          column++;
        }
        while (index < len && isDigitOrUnderscore(s[index])) {
          index++;
          column++;
        }
        if (index < len && (s[index] === 'e' || s[index] === 'E')) {
          index++;
          column++;
          if (index < len && (s[index] === '+' || s[index] === '-')) {
            index++;
            column++;
          }
          while (index < len && isDigitOrUnderscore(s[index])) {
            index++;
            column++;
          }
        }
        const valueString = s.substring(digitStart, index).replaceAll('_', '');
        value = parseFloat(valueString);
        if (index < len && (s[index] === 'f' || s[index] === 'F')) {
          type = "FLOAT";
          index++;
          column++;
        }
      } else {
        if (index < len && (s[index] === 'l' || s[index] === 'L')) {
          index++;
          column++;
          type = "LONG";
        }
        const valueString = s.substring(digitStart, index).replaceAll('_', '');
        value = parseInt(valueString, radix);
      }
      tokens.push({
        range: { start: tokenStart, end: { line, column, index } },
        type,
        value,
      });
      continue;
    }

    // Character literal
    if (s[index] === "'") {
      index++;
      column++;
      let value = '';
      if (s[index] === '\\') {
        value = translateEscapeSequence();
      } else {
        value = s[index];
        incr();
      }
      if (s[index] === "'") {
        index++;
        column++;
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: 'CHAR',
          value,
        });
      } else {
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: "ERROR-BAD-CHAR-LITERAL",
          value,
        });
      }
      continue;
    }

    // String literal
    if (s[index] === '"') {
      const quote = s.startsWith('"""', index) ? '"""' : '"';
      index += quote.length;
      column += quote.length;
      let value = '';
      while (index < len && !s.startsWith(quote, index)) {
        if (s[index] === '\\') {
          value += translateEscapeSequence();
        } else {
          value += s[index];
          incr();
        }
      }
      if (!s.startsWith(quote, index)) {
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: "ERROR-BAD-STRING-LITERAL",
          value: "Unterminated string literal",
        });
        continue;
      }
      index += quote.length;
      column += quote.length;

      if (quote === '"""') {
        // TOOD: This might not be perfectly correct... fix this
        let i = 0;
        while (i < value.length && isSpace(value[i])) {
          i++;
        }
        let j = i;
        while (j > 0 && value[j - 1] !== '\n') {
          j--;
        }
        if (j > 0) {
          const indent = value.substring(j - 1, i);
          value = value.replaceAll(indent, '\n');
          if (value.startsWith('\n')) {
            value = value.substring(1);
          }
        }
      }

      tokens.push({
        range: { start: tokenStart, end: { line, column, index } },
        type: "STRING",
        value,
      });
      continue;
    }

    // 3 character separators and operators
    if (index + 3 <= len) {
      const sym3 = SymbolsMap.get(s.substring(index, index + 3));
      if (sym3) {
        index += 3;
        column += 3;
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: sym3,
          value: null,
        });
        continue;
      }
    }

    // 2 character separators and operators
    if (index + 2 <= len) {
      const sym2 = SymbolsMap.get(s.substring(index, index + 2));
      if (sym2) {
        index += 2;
        column += 2;
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: sym2,
          value: null,
        });
        continue;
      }
    }

    // 1 character separators and operators
    if (index < len) {
      const sym1 = SymbolsMap.get(s[index]);
      if (sym1) {
        index++;
        column++;
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: sym1,
          value: null,
        });
        continue;
      }
    }

    // unrecognized token
    while (index < len && !/[ \t\r\n]/.test(s[index])) {
      index++;
      column++;
    }
    tokens.push({
      range: { start: tokenStart, end: { line, column, index } },
      type: 'ERROR-UNRECOGNIZED-TOKEN',
      value: s.substring(tokenStartIndex, index),
    });
  }

  return tokens;
}
