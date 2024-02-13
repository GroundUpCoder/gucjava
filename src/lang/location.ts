import { Uri } from "vscode";
import { Range } from "./token";

export interface Location {
  uri: Uri;
  range: Range;
}
