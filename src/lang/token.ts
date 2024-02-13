export interface Position {
  /** Line number, zero indexed */
  readonly line: number;

  /** Column number, zero indexed */
  readonly column: number;

  /** UTF-16 offset */
  readonly index: number;
};

export interface Range {
  readonly start: Position;
  readonly end: Position;
};

// From: https://docs.oracle.com/javase/specs/jls/se17/html/jls-3.html#jls-Keyword

export const ReservedKeywords = [
  "abstract", "continue", "for", "new", "switch",
  "assert", "default", "if", "package", "synchronized",
  "boolean", "do", "goto", "private", "this",
  "break", "double", "implements", "protected", "throw",
  "byte", "else", "import", "public", "throws",
  "case", "enum", "instanceof", "return", "transient",
  "catch", "extends", "int", "short", "try",
  "char", "final", "interface", "static", "void",
  "class", "finally", "long", "strictfp", "volatile",
  "const", "float", "native", "super", "while",
  "_",   // underscore

  // literal values (technically not "keywords")
  "true", "false", "null",
] as const;

export const ContextualKeywords = [
  "exports", "opens", "requires", "uses",
  "module", "permits", "sealed", "var",
  "non-sealed", "provides", "to", "with",
  "open", "record", "transitive", "yield",
] as const;

export const Symbols = [
  // separators
  "(", ")", "{", "}", "[", "]", ";", ",", ".", "...", "@", "::",

  // operators
  "=", ">", "<", "!", "~", "?", ":", "->",
  "==", ">=", "<=", "!=", "&&", "||", "++", "--",
  "+", "-", "*", "/", "&", "|", "^", "%", "<<", ">>", ">>>",
  "+=", "-=", "*=", "/=", "&=", "|=", "^=", "%=", "<<=", ">>=", ">>>=  ",
] as const;

export type TokenTypeReservedKeyword = typeof ReservedKeywords[number];
export type TokenTypeContextualKeyword = typeof ContextualKeywords[number];
export type TokenTypeSymbol = typeof Symbols[number];
export type TokenType = (
  'ERROR-UNRECOGNIZED-TOKEN' | 'ERROR-BAD-STRING-LITERAL' | 'ERROR-UNSUPPORTED-NUMBER-LITERAL' |
  'ERROR-BAD-ESCAPE-SEQUENCE' | 'ERROR-BAD-CHAR-LITERAL' |
  'EOF' |
  'IDENTIFIER' |
  'INT' | 'LONG' | 'FLOAT' | 'DOUBLE' |
  'STRING' | 'CHAR' |
  TokenTypeReservedKeyword | TokenTypeSymbol
);
export type TokenValue = null | boolean | number | string;

export const SymbolsMap: Map<string, TokenTypeSymbol> = new Map(
  Symbols.map(symbol => [symbol, symbol])
);

export const ReservedKeywordsMap: Map<string, TokenTypeReservedKeyword> = new Map(
  ReservedKeywords.map(keyword => [keyword, keyword])
);

export const ContextualKeywordsMap: Map<string, TokenTypeContextualKeyword> = new Map(
  ContextualKeywords.map(keyword => [keyword, keyword])
);

export interface Token {
  readonly range: Range;
  readonly type: TokenType;
  readonly value: TokenValue;
};
