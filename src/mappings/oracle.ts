import { AnswerUpdated } from "../types/ETH_USD/AggregatorV3Interface";
import {
  CollateralToken,
  fxToken,
  TokenRegistry,
  Vault,
  VaultRegistry
} from "../types/schema";
import { Handle } from "../types/ETH_USD/Handle";
import { Address } from '@graphprotocol/graph-ts';
import { getVaultId, updateVault } from "./handle/vault";
import { aggregatorToToken, getTokens, handleAddress } from "./oracleAddresses";

/**
 * Listens to oracle price updates and updates the indexing of all Vault parameters.
 * This ensures all indexed Vault data is always up to date and able to be used for
 * liquidations and redemptions.
 */
export function handleAnswerUpdated(event: AnswerUpdated): void {
  const handle = Handle.bind(handleAddress);
  const tokensToUpdate: string[] = aggregatorToToken(event.address.toHex()) != null
    ? [aggregatorToToken(event.address.toHex())]
    : getTokens();
  updateTokenPrices(tokensToUpdate, handle);
}

export function updateTokenPrices(tokens: string[], handle: Handle): void {
  const tokenRegistry = TokenRegistry.load(handleAddress.toHex());
  // Abort if the token registry was not created yet (before Handle deployment).
  if (tokenRegistry == null)
    return;

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
    const tokenAddress = Address.fromString(tokens[i]);
    if (fxTokens.includes(tokenAddress)) {
      updateFxTokenRate(tokenAddress, handle);
      updateVaultsByFxToken(tokenAddress);
    }
    if (collateralTokens.includes(tokenAddress)) {
      updateCollateralTokenRate(tokenAddress, handle);
      updateVaultsByCollateralToken(tokenAddress, fxTokens);
    }
  }
}

function updateVaultsByFxToken(fxToken: Address): void {
  const vaultOwners = VaultRegistry.load(fxToken.toHex());
  if (vaultOwners == null) return;
  const owners = vaultOwners.owners;
  for (let i = 0; i < owners.length; i++) {
    const account = Address.fromString(owners[i]);
    let vault = Vault.load(getVaultId(account, fxToken));
    if (vault == null)
      continue;
    vault = updateVault(vault as Vault, handleAddress, account, fxToken);
    vault.save();
  }
}

function updateVaultsByCollateralToken(collateralToken: Address, fxTokens: Address[]): void {
  for (let i = 0; i < fxTokens.length; i++) {
    const vaultOwners = VaultRegistry.load(fxTokens[i].toHex());
    if (vaultOwners == null) continue;
    const owners = vaultOwners.owners;
    for (let j = 0; j < owners.length; j++) {
      const account = Address.fromString(owners[j]);
      let vault = Vault.load(getVaultId(account, fxTokens[i]));
      if (vault == null)
        continue;
      if (!vault.collateralAddresses.includes(collateralToken.toHex()))
        continue;
      vault = updateVault(vault as Vault, handleAddress, account, fxTokens[i]);
      vault.save();
    }
  }
}

function updateFxTokenRate(address: Address, handle: Handle): void {
  const entity = fxToken.load(address.toHex());
  if (entity == null) return;
  const result = handle.try_getTokenPrice(address);
  if (result.reverted) return;
  entity.rate = result.value;
  entity.save();
}

function updateCollateralTokenRate(address: Address, handle: Handle): void {
  const entity = CollateralToken.load(address.toHex());
  if (entity == null) return;
  const result = handle.try_getTokenPrice(address);
  if (result.reverted) return;
  entity.rate = result.value;
  entity.save();
}
