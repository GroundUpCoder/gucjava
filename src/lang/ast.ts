import { Location } from "./location";
import { SimpleModifierType } from "./token";

export interface Node {
  readonly location: Location;
}
export type Expression =
  NullLiteral |
  BooleanLiteral |
  IntLiteral |
  LongLiteral |
  FloatLiteral |
  DoubleLiteral |
  StringLiteral |
  Identifier |
  Assignment;
export type Statement = Block | ExpressionStatement;
export type TypeDeclaration = ClassDeclaration;
export type ClassDeclaration = NormalClassDeclaration;
export type ClassBodyDeclaration = StaticBlock;
export type Modifier = SimpleModifier;
export type GeneralIdentifier = Identifier | QualifiedIdentifier;

export class Identifier implements Node {
  readonly location: Location;
  readonly name: string;
  constructor(location: Location, name: string) {
    this.location = location;
    this.name = name;
  }
}

export class QualifiedIdentifier implements Node {
  readonly location: Location;
  readonly parent: GeneralIdentifier;
  readonly child: Identifier;
  constructor(location: Location, parent: GeneralIdentifier, child: Identifier) {
    this.location = location;
    this.parent = parent;
    this.child = child;
  }
}

export class ImportDeclaration implements Node {
  readonly location: Location;
  readonly isStatic: boolean;
  readonly identifier: QualifiedIdentifier;
  readonly star: boolean;
  constructor(
    location: Location,
    isStatic: boolean,
    identifier: QualifiedIdentifier,
    star: boolean) {
    this.location = location;
    this.isStatic = isStatic;
    this.identifier = identifier;
    this.star = star;
  }
}

export class SimpleModifier implements Node {
  readonly location: Location;
  readonly type: SimpleModifierType;
  constructor(location: Location, type: SimpleModifierType) {
    this.location = location;
    this.type = type;
  }
}

export class CompilationUnit implements Node {
  readonly location: Location;
  readonly pkg: QualifiedIdentifier;
  readonly imports: ImportDeclaration[];
  readonly types: TypeDeclaration[];
  constructor(
    location: Location,
    pkg: QualifiedIdentifier,
    imports: ImportDeclaration[],
    types: TypeDeclaration[]) {
    this.location = location;
    this.pkg = pkg;
    this.imports = imports;
    this.types = types;
  }
}

export class NormalClassDeclaration implements Node {
  readonly location: Location;
  readonly modifiers: Modifier[];
  readonly identifier: Identifier;
  readonly declarations: ClassBodyDeclaration[];
  constructor(location: Location, modifiers: Modifier[], identifier: Identifier,
    declarations: ClassBodyDeclaration[]) {
    this.location = location;
    this.modifiers = modifiers;
    this.identifier = identifier;
    this.declarations = declarations;
  }
}

class BlockImplementation implements Node {
  readonly location: Location;
  readonly statements: Statement[];
  constructor(location: Location, statements: Statement[]) {
    this.location = location;
    this.statements = statements;
  }
}
export class StaticBlock extends BlockImplementation { }
export class Block extends BlockImplementation { }

export class ExpressionStatement implements Node {
  readonly location: Location;
  readonly expression: Expression;
  constructor(location: Location, expression: Expression) {
    this.location = location;
    this.expression = expression;
  }
}

class LiteralImplementation<T> implements Node {
  readonly location: Location;
  readonly value: T;
  constructor(location: Location, value: T) {
    this.location = location;
    this.value = value;
  }
}
export class NullLiteral extends LiteralImplementation<null> { }
export class BooleanLiteral extends LiteralImplementation<boolean> { }
export class IntLiteral extends LiteralImplementation<number> { }
export class LongLiteral extends LiteralImplementation<number> { }
export class FloatLiteral extends LiteralImplementation<number> { }
export class DoubleLiteral extends LiteralImplementation<number> { }
export class StringLiteral extends LiteralImplementation<string> { }

export class Assignment implements Node {
  readonly location: Location;
  readonly target: Expression;
  readonly value: Expression;
  constructor(location: Location, target: Identifier, value: Expression) {
    this.location = location;
    this.target = target;
    this.value = value;
  }
}
