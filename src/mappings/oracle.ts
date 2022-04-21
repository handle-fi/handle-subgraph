import { AnswerUpdated } from "../types/ETH_USD/AggregatorV3Interface";
import {
  ChainlinkRate,
  CollateralToken,
  fxToken,
  TokenRegistry, Vault, VaultRegistry,
} from "../types/schema";
import {Address, BigInt} from '@graphprotocol/graph-ts';
import {
  aggregatorToToken, fxUsdAddress,
  getTokens,
  handleAddress
} from "./oracleAddresses";
import { log } from '@graphprotocol/graph-ts'
import {getVaultId, updateVaultPriceDerivedProperties} from "./handle/vault";

const ONE_ETH = BigInt.fromI32(10).pow(18);

/**
 * Listens to oracle price updates.
 */
export function handleAnswerUpdated(event: AnswerUpdated): void {
  log.info("handleAnswerUpdated", []);
  const tokensToUpdate: string[] = aggregatorToToken(event.address.toHex()) != null
    ? [aggregatorToToken(event.address.toHex())]
    : getTokens();
  if (tokensToUpdate.length > 1) {
    // ETH/USD update
    const chainlinkRate = ChainlinkRate.load(fxUsdAddress)
      || new ChainlinkRate(fxUsdAddress);
    chainlinkRate.value = event.params.current;
    chainlinkRate.save();
  } else {
    // Specific token/US update.
    const tokenAddress = tokensToUpdate[0];
    const chainlinkRate = ChainlinkRate.load(tokenAddress)
      || new ChainlinkRate(tokenAddress);
    chainlinkRate.value = event.params.current;
    chainlinkRate.save();
  }
  updateTokenPrices(tokensToUpdate);
}

/**
 * Updates prices for selected tokens.
 * If tokens.length === 1, then a price other than ETH/USD has changed.
 * If tokens.length > 1, ETH/USD has changed.
 */
export function updateTokenPrices(tokens: string[]): void {
  log.info("updateTokenPrices", []);
  const tokenRegistry = TokenRegistry.load(handleAddress.toHex());
  // Abort if the token registry was not created yet (before Handle deployment).
  if (tokenRegistry == null)
    return;

  const chainlinkEthUsdRateEntity = ChainlinkRate.load(fxUsdAddress);
  if (chainlinkEthUsdRateEntity == null) {
    log.warning("Chainlink ETH/USD rate is not defined yet", []);
    return;
  }
  const chainlinkEthUsdRate = chainlinkEthUsdRateEntity.value;

  const fxTokenStrings: string[] = tokenRegistry.fxTokens;
  const fxTokens: Address[] = [];
  for (let i = 0; i < fxTokenStrings.length; i++) {
    fxTokens.push(Address.fromString(fxTokenStrings[i]));
  }
  
  const collateralTokenStrings: string[] = tokenRegistry.collateralTokens;
  const collateralTokens: Address[] = [];
  for (let i = 0; i < collateralTokenStrings.length; i++) {
    collateralTokens.push(Address.fromString(collateralTokenStrings[i]));
  }

  // Update all required vaults.
  for (let i = 0; i < tokens.length; i ++) {
    if (tokens[i].length === 0) continue;
    const tokenAddress = Address.fromString(tokens[i]);
    if (fxTokens.includes(tokenAddress) && tokenAddress.length > 0) {
      const chainlinkTokenUsdEntity = ChainlinkRate.load(tokenAddress.toHex());
      if (chainlinkTokenUsdEntity == null) continue;
      updateFxTokenRate(tokenAddress, chainlinkTokenUsdEntity.value, chainlinkEthUsdRate);
    }
    if (collateralTokens.includes(tokenAddress) && collateralTokens.length > 0) {
      const chainlinkTokenUsdEntity = ChainlinkRate.load(tokenAddress.toHex());
      if (chainlinkTokenUsdEntity == null) continue;
      updateCollateralTokenRate(tokenAddress, chainlinkTokenUsdEntity.value, chainlinkEthUsdRate);
    }
    let owners = VaultRegistry.load(tokenAddress.toHex()).owners;
    for (let j = 0; j < owners.length; j++) {
      const vault = Vault
        .load(getVaultId(Address.fromString(owners[j]), tokenAddress));
      if (vault != null)
        updateVaultPriceDerivedProperties(vault as Vault);
    }
  }
}

function updateFxTokenRate(
  address: Address,
  chainlinkTokenUsdRate: BigInt,
  chainlinkEthUsdRate: BigInt
): void {
  const entity = fxToken.load(address.toHex());
  if (entity == null) return;
  entity.rate = chainlinkTokenUsdRate
    .times(ONE_ETH)
    .div(chainlinkEthUsdRate);
  entity.save();
}

function updateCollateralTokenRate(
  address: Address,
  chainlinkTokenUsdRate: BigInt,
  chainlinkEthUsdRate: BigInt
): void {
  const entity = CollateralToken.load(address.toHex());
  if (entity == null) return;
  entity.rate = chainlinkTokenUsdRate
    .times(ONE_ETH)
    .div(chainlinkEthUsdRate);
  entity.save();
}
