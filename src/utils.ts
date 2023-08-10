import {BigInt, ByteArray, log} from '@graphprotocol/graph-ts';

export const oneEth = BigInt.fromString("1000000000000000000");

/**
 * Concatenates two byte arrays.
 */
export const concat = (a: ByteArray, b: ByteArray): ByteArray => {
  let out = new Uint8Array(a.length + b.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i];
  }
  for (let j = 0; j < b.length; j++) {
    out[a.length + j] = b[j];
  }
  return out as ByteArray;
};

export function nonNull<T>(value: T | null): T {
  if (value == null || !value) {
    log.error("nonNull found a null value", []);
    throw new Error("nonNull found a null value");
  }
  return value as T;
}
