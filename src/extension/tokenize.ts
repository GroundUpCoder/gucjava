import * as vscode from 'vscode';
import { lex } from '../lang/lexer';
import { getSelectionOrAllText, writeToNewEditor } from './utils';

export async function tokenizeCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const text = getSelectionOrAllText(editor);
  const tokens = lex(text);

  await writeToNewEditor(emit => {
    for (const token of tokens) {
      emit(
        `${token.range.start.line + 1}:` +
        `${token.range.start.column + 1} - ` +
        `${token.range.end.line + 1}:` +
        `${token.range.end.column + 1} - ` +
        `${token.type} ` +
        `${token.value === null ? '' : JSON.stringify(token.value)}\n`);
    }
  });
}
