import { Location } from './location';

export class StaticError {
  readonly location: Location;
  readonly message: string;
  constructor(location: Location, message: string) {
    this.location = location;
    this.message = message;
  }
}
