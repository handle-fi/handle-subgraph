import {Address} from "@graphprotocol/graph-ts/index";

export const handleAddress = Address.fromString("{{handle}}");

// Address strings are constructed here as Address.fromString(x).toHex() because that makes them lowercase.
// This is important to keep in case the API ever changes so nothing breaks, and case sensitivity is accounted for.
export function getTokens(): string[] {
  return [
    // 0 fxAUD
    Address.fromString("{{fxAUD}}").toHex(),
    // 1 fxEUR
    Address.fromString("{{fxEUR}}").toHex(),
    // 2 fxKRW
    Address.fromString("{{fxKRW}}").toHex(),
    // 3 WETH
    Address.fromString("{{WETH}}").toHex(),
    // 4 fxCNY
    Address.fromString("{{fxCNY}}").toHex(),
    // 5 fxPHP
    Address.fromString("{{fxPHP}}").toHex(),
    // 6 fxUSD
    Address.fromString("{{fxUSD}}").toHex(),
    // 7 fxCHF
    Address.fromString("{{fxCHF}}").toHex(),
    // 8 FOREX
    Address.fromString("{{forex}}").toHex(),
  ];
}

export const fxUsdAddress: string = getTokens()[6];
export const wethAddress: string = getTokens()[3];

/**
 * The WASM compiler doesn't seem to like dictionaries or switches, so it's needed to wrap it in
 * a function using if statements.
 */
export function aggregatorToToken(aggregator: string): string | null {
  const tokens = getTokens();
  // ETH_USD, update ALL vaults due to indirect quoting.
  if (aggregator == "{{ETH_USD}}")
    return null;
  // AUD_USD -> fxAUD
  if (aggregator == "{{AUD_USD}}")
    return tokens[0];
  // EUR_USD -> fxEUR
  if (aggregator == "{{EUR_USD}}")
    return tokens[1];
  // KRW_USD -> fxKRW
  if (aggregator == "{{KRW_USD}}")
    return tokens[2];
  // CNY_USD -> fxCNY
  if (aggregator == "{{CNY_USD}}")
    return tokens[4];
  // PHP_USD -> fxPHP
  if (aggregator == "{{PHP_USD}}")
    return tokens[5];
  // CHF_USD -> fxCHF
  if (aggregator == "{{CHF_USD}}")
    return tokens[7];
  // FOREX_USD -> forex
  if (aggregator == "{{FOREX_USD}}")
    return tokens[8];
  return null;
}
