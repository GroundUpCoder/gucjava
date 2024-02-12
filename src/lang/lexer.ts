import { ReservedKeywordsMap, SymbolsMap, Token } from "./token";

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
  return /[_A-Za-z0-9]/.test(c);
}

function isJavaLetterOrDigit(c: string): boolean {
  return /[_A-Za-z0-9]/.test(c);
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
