import {Address} from "@graphprotocol/graph-ts/index";

export const handleAddress = Address.fromString("{{handle}}");

export function getTokens(): string[] {
  return [
    // 0 fxAUD
    "{{fxAUD}}",
    // 1 fxEUR
    "{{fxEUR}}",
    // 2 fxKRW
    "{{fxKRW}}",
    // 3 WETH
    "{{WETH}}",
    // 4 WBTC
    "{{WBTC}}",
    // 5 DAI
    "{{DAI}}",
    // 7 fxCNY
    "{{fxCNY}}",
    // 8 fxPHP
    "{{fxPHP}}"
  ];
}

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
  // BTC_ETH -> WBTC
  if (aggregator == "{{BTC_ETH}}")
    return tokens[4];
  // DAI_ETH -> DAI
  if (aggregator == "{{DAI_ETH}}")
    return tokens[5];
  // CNY_USD -> fxCNY
  if (aggregator == "{{CNY_USD}}")
    return tokens[7];
  // PHP_USD -> fxPHP
  if (aggregator == "{{PHP_USD}}")
    return tokens[8];
  return null;
}
