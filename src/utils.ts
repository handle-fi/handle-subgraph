import {BigInt, log} from '@graphprotocol/graph-ts';

export const oneEth = BigInt.fromString("1000000000000000000");

export function nonNull<T>(value: T | null): T {
  if (value == null || !value) {
    log.error("nonNull found a null value", []);
    throw new Error("nonNull found a null value");
  }
  return value as T;
}
