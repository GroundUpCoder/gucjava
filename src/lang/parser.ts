import { Uri } from 'vscode';
import * as ast from './ast';
import { lex } from './lexer';
import { Position, Token, TokenType } from './token';
import { Location } from './location';
import { StaticError } from './error';

const PrecList: TokenType[][] = [
  [],
  ['||'],
  ['&&'],
  [],        // precedence for unary operator 'not'
  ['==', '!=', '<', '>', '<=', '>=', '!'],
  ['<<', '>>'],
  ['&'],
  ['^'],
  ['|'],
  ['+', '-'],
  ['*', '/', '%'],
  [],        // precedence for unary operators '-', '+' and '~'
  ['.', '(', '['],
];
const PrecMap: Map<TokenType, number> = new Map();
for (let i = 0; i < PrecList.length; i++) {
  for (const tokenType of PrecList[i]) {
    PrecMap.set(tokenType, i);
  }
}
const PREC_UNARY_NOT = PrecMap.get('&&')! + 1;
const PREC_UNARY_MINUS = PrecMap.get('*')! + 1;
const PREC_PRIMARY = PrecMap.get('.')! + 1;

export function parse(uri: Uri, s: string): ast.CompilationUnit {
  const errors: StaticError[] = [];
  const tokens = lex(s);
  let i = 0;

  function eof() {
    return i >= tokens.length || tokens[i].type === 'EOF';
  }

  function at(type: TokenType): boolean {
    return tokens[i].type === type;
  }

  function consume(type: TokenType): boolean {
    if (at(type)) {
      i++;
      return true;
    }
    return false;
  }

  function expect(type: TokenType): Token {
    if (at(type)) {
      return tokens[i++];
    }
    throw new StaticError(
      { uri, range: tokens[i].range },
      `Expected ${type} but got ${tokens[i].type}`);
  }

  function expectStatementDelimiter(): void {
    expect(';');
  }

  function parseIdentifier(): ast.Identifier {
    const tok = expect('IDENTIFIER');
    return new ast.Identifier(
      { uri, range: tok.range }, tok.value as string);
  }

  function parseQualifiedIdentifier(): ast.GeneralIdentifier {
    let lhs: ast.GeneralIdentifier = parseIdentifier();
    while (consume('.')) {
      const rhs = parseIdentifier();
      const location: Location = {
        uri,
        range: { start: lhs.location.range.start, end: rhs.location.range.end }
      };
      lhs = new ast.QualifiedIdentifier(location, lhs, rhs);
    }
    return lhs;
  }

  function parseBlock(): ast.Block {
    const start = expect('{').range.start;
    const statements: ast.Statement[] = [];
    while (consume(';'));
    while (!eof() && !at('}')) {
      try {
        statements.push(parseStatement());
      } catch (e) {
        // If we encounter a syntax error, try to recover
        // by skipping the rest of the statement
        if (e instanceof StaticError) {
          errors.push(e);
          while (!eof() && !at('}') && !at(';')) {
            i++;
          }
        } else {
          throw e;
        }
      }
      while (consume(';'));
    }
    const end = expect('}').range.end;
    return new ast.Block({ uri, range: { start, end } }, statements);
  }

  function parseIf(): ast.Node {
    const start = expect('if').range.start;
    const condition = parseExpression();
    const body = parseBlock();
    const other = consume('else') ?
      (at('if') ? parseIf() : parseBlock()) :
      new ast.Literal(body.location, null);
    const end = other.location.range.end;
    const location = { uri, range: { start, end } };
    return new ast.Operation(location, 'IF', [condition, body, other]);
  }

  function parseStatement(): ast.Statement {
    switch (tokens[i].type) {
      case '{':
        return parseBlock();
    }
    const start = tokens[i].range.start;
    const expression = parseExpression();
    const end = tokens[i - 1].range.end;
    expectStatementDelimiter();
    return new ast.ExpressionStatement({ uri, range: { start, end } }, expression);
  }

  function parsePrefix(): ast.Expression {
    const tloc: Location = { uri, range: tokens[i].range };
    const start = tloc.range.start;
    const tokenType = tokens[i].type;
    switch (tokenType) {
      case 'IDENTIFIER': {
        i++;
        const identifier = new ast.Identifier(tloc, tokens[i - 1].value as string);
        if (consume('=')) {
          const rhs = parseExpression();
          const end = rhs.location.range.end;
          return new ast.Assignment({ uri, range: { start, end } }, identifier, rhs);
        }
        return identifier;
      }
      case 'STRING':
        i++;
        return new ast.StringLiteral(tloc, tokens[i - 1].value as string);
      case 'INT':
        i++;
        return new ast.IntLiteral(tloc, tokens[i - 1].value as number);
      case 'LONG':
        i++;
        return new ast.LongLiteral(tloc, tokens[i - 1].value as number);
      case 'FLOAT':
        i++;
        return new ast.FloatLiteral(tloc, tokens[i - 1].value as number);
      case 'DOUBLE':
        i++;
        return new ast.DoubleLiteral(tloc, tokens[i - 1].value as number);
      case 'null':
        i++;
        return new ast.NullLiteral(tloc, null);
      case 'true':
        i++;
        return new ast.BooleanLiteral(tloc, true);
      case 'false':
        i++;
        return new ast.BooleanLiteral(tloc, false);
      case 'if': {
        i++;
        const condition = parseExpression();
        expect('then');
        const lhs = parseExpression();
        expect('else');
        const rhs = parseExpression();
        const end = rhs.location.range.end;
        return new ast.Operation(
          { uri, range: { start, end } }, 'IF', [condition, lhs, rhs]);
      }
      case '+':
      case '-': {
        i++;
        const arg = parsePrec(PREC_UNARY_MINUS);
        const end = arg.location.range.end;
        return new ast.Operation(tloc, tokenType, [arg]);
      }
      case '[': {
        i++;
        const elements = parseArgsBody(']');
        const end = expect(']').range.end;
        return new ast.Operation({ uri, range: { start, end } }, 'LIST-DISPLAY', elements);
      }
      case '{': {
        i++;
        const values: ast.Node[] = []; // should always be a multiple of 2
        while (!eof() && !at('}')) {
          values.push(parseExpression());
          expect(':');
          values.push(parseExpression());
          if (!consume(',')) {
            break;
          }
        }
        const end = expect('}').range.end;
        return new ast.Operation({ uri, range: { start, end } }, 'MAP-DISPLAY', values);
      }
      case '(': {
        i++;
        const j = i;
        while (consume('IDENTIFIER') || consume(','));
        const atLambda = consume(')') && at('=>');
        i = j;
        if (atLambda) {
          const parameters: ast.Identifier[] = [];
          while (!eof() && !at(')')) {
            parameters.push(parseIdentifier());
            if (!consume(',')) {
              break;
            }
          }
          expect(')');
          expect('=>');
          const body = at('{') ? parseBlock() : parseExpression();
          const end = body.location.range.end;
          return new ast.FunctionDisplay(
            { uri, range: { start, end } }, parameters, body);
        }
        const innerExpression = parseExpression();
        expect(')');
        return innerExpression;
      }
    }
    throw new StaticError(tloc, `Expected expression but got ${JSON.stringify(tokens[i].type)}`);
  }

  function parseArgsBody(closingToken: TokenType): ast.Node[] {
    const args: ast.Node[] = [];
    while (!eof() && !at(closingToken)) {
      args.push(parseExpression());
      if (!consume(',')) {
        break;
      }
    }
    return args;
  }

  function parseInfix(lhs: ast.Node, start: Position): ast.Node {
    const tokenType = tokens[i].type;
    const precedence = PrecMap.get(tokenType);
    if (!precedence) {
      throw new StaticError(
        { uri, range: tokens[i].range },
        `Expected infix expression token but found ${tokens[i].type}`);
    }
    switch (tokenType) {
      case '(': {
        i++;
        const args = parseArgsBody(')');
        const end = expect(')').range.end;
        return new ast.Operation(
          { uri, range: { start, end } },
          'FUNCTION-CALL',
          [lhs].concat(...args));
      }
      case '[': {
        i++;
        const index = parseExpression();
        const end = expect(']').range.end;
        return new ast.Operation(
          { uri, range: { start, end } },
          'SUBSCRIPT',
          [lhs, index]);
      }
    }
    const operator = BinopOperatorMap.get(tokenType);
    if (operator) {
      i++;
      const rightAssociative = operator === '**';
      const rhs = rightAssociative ?
        parsePrec(precedence) :
        parsePrec(precedence + 1);
      const end = rhs.location.range.end;
      return new ast.Operation({ uri, range: { start, end } }, operator, [lhs, rhs]);
    }
    throw new StaticError(
      { uri, range: tokens[i].range },
      `Expected infix expression token but found ${tokens[i].type}`);
  }

  function parsePrec(precedence: number): ast.Expression {
    const start = tokens[i].range.start;
    let expr = parsePrefix();
    while (precedence <= (PrecMap.get(tokens[i].type) || 0)) {
      expr = parseInfix(expr, start);
    }
    return expr;
  }

  function parseExpression(): ast.Expression {
    return parsePrec(1);
  }

  const fileStatements: ast.Node[] = [];
  while (!eof()) {
    try {
      fileStatements.push(parseStatement());
    } catch (e) {
      // If we encounter a syntax error, try to recover
      // by skipping the rest of the line
      if (e instanceof StaticError) {
        errors.push(e);
        while (!eof() && !at('NEWLINE')) {
          i++;
        }
        consume('NEWLINE');
      } else {
        throw e;
      }
    }
  }

  return new ast.File({
    uri,
    range: {
      start: tokens[0].range.start,
      end: tokens[tokens.length - 1].range.end,
    }
  }, fileStatements, errors);
}
