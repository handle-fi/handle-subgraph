import { AnswerUpdated } from "../types/ETH_USD/AggregatorV3Interface";
import {
  ChainlinkRate,
  CollateralToken,
  fxToken,
  TokenRegistry, Vault, VaultRegistry,
} from "../types/schema";
import {Address, BigInt} from '@graphprotocol/graph-ts';
import {
  aggregatorToToken, forexAddress, fxUsdAddress,
  getTokens,
  handleAddress, wethAddress
} from "./oracleAddresses";
import { log } from '@graphprotocol/graph-ts'
import {getVaultId, updateVaultPriceDerivedProperties} from "./handle/vault";

export const ONE_ETH = BigInt.fromI32(10).pow(18);
const CHAINLINK_PRICE_UNIT = BigInt.fromI32(10).pow(8);

/**
 * Listens to oracle price updates.
 */
export function handleAnswerUpdated(event: AnswerUpdated): void {
  log.info("handleAnswerUpdated", []);
  const tokensToUpdate: Address[] = aggregatorToToken(event.address) != null
    ? [aggregatorToToken(event.address)!]
    : getTokens();
  if (tokensToUpdate.length > 1) {
    // ETH/USD update
    const chainlinkRate = ChainlinkRate.load(fxUsdAddress.toHex())
      || new ChainlinkRate(fxUsdAddress.toHex());
    chainlinkRate.value = event.params.current;
    chainlinkRate.save();
  } else {
    // Specific token/US update.
    const tokenAddress = tokensToUpdate[0];
    const chainlinkRate = ChainlinkRate.load(tokenAddress.toHex())
      || new ChainlinkRate(tokenAddress.toHex());
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
export function updateTokenPrices(tokens: Address[]): void {
  log.info("updateTokenPrices", []);
  const tokenRegistry = TokenRegistry.load(handleAddress.toHex());
  // Abort if the token registry was not created yet (before Handle deployment).
  if (tokenRegistry == null)
    return;

  const chainlinkEthUsdRateEntity = ChainlinkRate.load(fxUsdAddress.toHex());
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
    const tokenAddress = Address.fromString(tokens[i].toHex());
    const chainlinkTokenUsdEntity: ChainlinkRate | null =
      ChainlinkRate.load(tokenAddress.toHex());
    const chainlinkTokenUsdEntityRate: BigInt = chainlinkTokenUsdEntity != null
      ? chainlinkTokenUsdEntity.value
      : BigInt.fromI32(0);
    if (fxTokens.includes(tokenAddress) && tokenAddress.length > 0)
      updateFxTokenRate(
        tokenAddress,
        chainlinkTokenUsdEntityRate,
        chainlinkEthUsdRate
      );
    if (collateralTokens.includes(tokenAddress) && collateralTokens.length > 0)
      updateCollateralTokenRate(tokenAddress,
        chainlinkTokenUsdEntityRate,
        chainlinkEthUsdRate
      );
    let registry = VaultRegistry.load(tokenAddress.toHex());
    if (registry == null) continue;
    const owners: string[] = registry.owners;
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
  if (address.equals(fxUsdAddress)) {
    entity.rate = ONE_ETH
      .times(CHAINLINK_PRICE_UNIT).div(chainlinkTokenUsdRate);
  } else {
    entity.rate = chainlinkTokenUsdRate
      .times(ONE_ETH)
      .div(chainlinkEthUsdRate);
  }
  entity.save();
}

function updateCollateralTokenRate(
  address: Address,
  chainlinkTokenUsdRate: BigInt,
  chainlinkEthUsdRate: BigInt
): void {
  const entity = CollateralToken.load(address.toHex());
  if (entity == null) return;
  if (address.equals(wethAddress)) {
    entity.rate = ONE_ETH;
  } else if (address.equals(forexAddress)) {
    // FOREX rate oracle is currently fixed to 10c USD
    entity.rate = entity.rate = ONE_ETH
      .times(CHAINLINK_PRICE_UNIT)
      .div(chainlinkEthUsdRate)
      .div(BigInt.fromI32(10))
  } else {
    // TODO collateral oracle may be c/ETH, not c/USD.
    entity.rate = chainlinkTokenUsdRate
      .times(ONE_ETH)
      .div(chainlinkEthUsdRate);
  }
  entity.save();
}
