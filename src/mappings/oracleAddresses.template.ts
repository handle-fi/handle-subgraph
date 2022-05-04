import {Address} from "@graphprotocol/graph-ts/index";

export const handleAddress = Address.fromString("{{handle}}");

// Address strings are constructed here as Address.fromString(x).toHex() because that makes them lowercase.
// This is important to keep in case the API ever changes so nothing breaks, and case sensitivity is accounted for.
export function getTokens(): Address[] {
  return [
    // 0 fxAUD
    Address.fromString("{{fxAUD}}"),
    // 1 fxEUR
    Address.fromString("{{fxEUR}}"),
    // 2 fxKRW
    Address.fromString("{{fxKRW}}"),
    // 3 WETH
    Address.fromString("{{WETH}}"),
    // 4 fxCNY
    Address.fromString("{{fxCNY}}"),
    // 5 fxPHP
    Address.fromString("{{fxPHP}}"),
    // 6 fxUSD
    Address.fromString("{{fxUSD}}"),
    // 7 fxCHF
    Address.fromString("{{fxCHF}}"),
    // 8 FOREX
    Address.fromString("{{forex}}"),
  ];
}

export const wethAddress: Address = getTokens()[3];
export const fxAudAddress: Address = getTokens()[0];
export const fxEurAddress: Address = getTokens()[1];
export const fxKrwAddress: Address = getTokens()[2];
export const fxCnyAddress: Address = getTokens()[4];
export const fxPhpAddress: Address = getTokens()[5];
export const fxUsdAddress: Address = getTokens()[6];
export const fxChfAddress: Address = getTokens()[7];
export const forexAddress: Address = getTokens()[8];

/**
 * The WASM compiler doesn't seem to like dictionaries or switches, so it's needed to wrap it in
 * a function using if statements.
 */
export function aggregatorToToken(aggregator: Address): Address | null {
  // ETH_USD, update ALL vaults due to indirect quoting.
  if (aggregator.equals(Address.fromString("{{ETH_USD}}")))
    return null;
  // AUD_USD -> fxAUD
  if (aggregator.equals(Address.fromString("{{AUD_USD}}")))
    return fxAudAddress;
  // EUR_USD -> fxEUR
  if (aggregator.equals(Address.fromString("{{EUR_USD}}")))
    return fxEurAddress;
  // KRW_USD -> fxKRW
  if (aggregator.equals(Address.fromString("{{KRW_USD}}")))
    return fxKrwAddress;
  // CNY_USD -> fxCNY
  if (aggregator.equals(Address.fromString("{{CNY_USD}}")))
    return fxCnyAddress;
  // PHP_USD -> fxPHP
  if (aggregator.equals(Address.fromString("{{PHP_USD}}")))
    return fxPhpAddress;
  // CHF_USD -> fxCHF
  if (aggregator.equals(Address.fromString("{{CHF_USD}}")))
    return fxChfAddress;
  // FOREX_USD -> forex
  if (aggregator.equals(Address.fromString("{{FOREX_USD}}")))
    return forexAddress;
  return null;
}
