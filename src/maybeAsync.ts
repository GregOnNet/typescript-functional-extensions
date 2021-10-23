import { isDefined } from '.';
import { Maybe } from './maybe';
import { ResultAsync } from './resultAsync';
import {
  ActionOfT,
  FunctionOfT,
  FunctionOfTtoK,
  isFunction,
  isPromise,
  MaybeMatcher,
  MaybeMatcherNoReturn,
} from './utilities';

/**
 * Represents an asynchronous value that might or might not exist
 */
export class MaybeAsync<TValue> {
  /**
   * Creates a new MaybeAsync from the given value
   * @param value Can be a Promise or Maybe
   * @returns MaybeAsync
   */
  static from<TValue>(maybe: Maybe<TValue>): MaybeAsync<TValue>;
  static from<TValue>(promise: Promise<TValue>): MaybeAsync<TValue>;
  static from<TValue>(maybePromise: Promise<Maybe<TValue>>): MaybeAsync<TValue>;
  static from<TValue>(
    valueOrPromiseOrMaybePromise:
      | Promise<TValue | Maybe<TValue>>
      | Maybe<TValue>
  ): MaybeAsync<TValue> {
    if (isPromise(valueOrPromiseOrMaybePromise)) {
      return new MaybeAsync(
        valueOrPromiseOrMaybePromise.then((v) =>
          v instanceof Maybe ? v : Maybe.from(v)
        )
      );
    } else if (valueOrPromiseOrMaybePromise instanceof Maybe) {
      return new MaybeAsync(Promise.resolve(valueOrPromiseOrMaybePromise));
    }

    throw new Error('Value must be a Promise or Maybe');
  }

  /**
   * Creates a new MaybeAsync from the given value
   * @param value
   * @returns
   */
  static some<TValue>(value: TValue): MaybeAsync<TValue> {
    return new MaybeAsync(Promise.resolve(Maybe.some(value)));
  }

  /**
   * Creates a new MaybeAsync with no value
   * @returns
   */
  static none<TValue>(): MaybeAsync<TValue> {
    return new MaybeAsync(Promise.resolve(Maybe.none()));
  }

  get hasValue(): Promise<boolean> {
    return this.value.then((m) => m.hasValue);
  }

  get hasNoValue(): Promise<boolean> {
    return this.value.then((m) => m.hasNoValue);
  }

  private value: Promise<Maybe<TValue>>;

  protected constructor(value: Promise<Maybe<TValue>>) {
    this.value = value;
  }

  map<TNewValue>(
    selector: FunctionOfTtoK<TValue, TNewValue>
  ): MaybeAsync<TNewValue> {
    return new MaybeAsync(this.value.then((m) => m.map(selector)));
  }

  mapAsync<TNewValue>(
    selector: FunctionOfTtoK<TValue, Promise<TNewValue>>
  ): MaybeAsync<TNewValue> {
    return new MaybeAsync(
      this.value.then((m) => m.mapAsync(selector).toPromise())
    );
  }

  tap(action: ActionOfT<TValue>): MaybeAsync<TValue> {
    return new MaybeAsync(this.value.then((m) => m.tap(action)));
  }

  tapAsync(action: FunctionOfTtoK<TValue, Promise<void>>): MaybeAsync<TValue> {
    return new MaybeAsync(
      this.value.then(async (m) => {
        if (m.hasNoValue) {
          return m;
        }

        await action(m.getValueOrThrow());

        return m;
      })
    );
  }

  bind<TNewValue>(
    selector: FunctionOfTtoK<TValue, Maybe<TNewValue>>
  ): MaybeAsync<TNewValue> {
    return new MaybeAsync(this.value.then((m) => m.bind(selector)));
  }

  bindAsync<TNewValue>(
    selector: FunctionOfTtoK<TValue, MaybeAsync<TNewValue>>
  ): MaybeAsync<TNewValue> {
    return new MaybeAsync(
      this.value.then((m) => m.bindAsync(selector).toPromise())
    );
  }

  match<TNewValue>(
    matcher: MaybeMatcher<TValue, TNewValue> | MaybeMatcherNoReturn<TValue>
  ): Promise<TNewValue | void> {
    return this.value.then((m) => m.match(matcher));
  }

  execute(func: ActionOfT<TValue>): Promise<void> {
    return this.value.then((m) => m.execute(func));
  }

  or(
    fallback:
      | TValue
      | FunctionOfT<TValue>
      | Maybe<TValue>
      | FunctionOfT<Maybe<TValue>>
      | MaybeAsync<TValue>
      | FunctionOfT<MaybeAsync<TValue>>
  ): MaybeAsync<TValue> {
    return new MaybeAsync(
      this.value.then((m) => {
        if (fallback instanceof MaybeAsync) {
          return m.orAsync(fallback).toPromise();
        } else {
          if (m.hasValue) {
            return m;
          }

          if (!isFunction(fallback)) {
            if (fallback instanceof Maybe) {
              return m.or(fallback);
            }

            return m.or(fallback);
          }

          const result = fallback();

          if (result instanceof MaybeAsync) {
            return m.orAsync(result).toPromise();
          }

          if (result instanceof Maybe) {
            return m.or(result);
          }

          return m.or(result);
        }
      })
    );
  }

  toResult(error: string): ResultAsync {
    return ResultAsync.from(this.value.then((m) => m.toResult(error)));
  }

  /**
   * Returns the inner Promise, wrapping Maybe.none if handleError is true
   * for a rejected Promise, otherwise rejected Promise handling is left up to the caller.
   * @param handleError
   * @returns
   */
  toPromise(handleError: boolean = false): Promise<Maybe<TValue>> {
    return isDefined(handleError) && handleError
      ? this.value.catch((_) => Maybe.none())
      : this.value;
  }
}
