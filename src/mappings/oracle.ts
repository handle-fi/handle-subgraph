import { AnswerUpdated } from "../types/ETH_USD/AggregatorV3Interface";
import { Vault, VaultRegistry } from "../types/schema";
import { Handle } from "../types/ETH_USD/Handle";
import { Address } from '@graphprotocol/graph-ts';
import { getVaultId, updateVault } from "./handle/vault";

const handleAddress = Address.fromString("0x4cc22AB2d7D0159ee2F98245B1BbA6AAa471DCef");

// TODO: use a pre-processor to remove the hardcoded values per-network.

function getTokens(): string[] {
  return [
    // 0 fxAUD
    "0x0e3918BD80C74938D32Fa2EeDa170Cc23F51faa4",
    // 1 fxEUR
    "0x133398C6d1ECB5eaE88AFDA6fA353b72Ad33D11D",
    // 2 fxKRW
    "0xbdc2458f6B652047ae2B7EE07Da27aA605cC0D9d",
    // 3 WETH
    "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
    // 4 WBTC
    "0xd3A691C852CDB01E281545A27064741F0B7f6825",
    // 5 DAI
    "0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa",
  ];
}

/**
 * The WASM compiler doesn't seem to like dictionaries or switches, so it's needed to wrap it in
 * a function using if statements.
 */
function aggregatorToToken(aggregator: string): string | null {
  const tokens = getTokens();
  // ETH_USD, update ALL vaults due to indirect quoting.
  if (aggregator == "0x10b3c106c4ed7d22b0e7abe5dc43bdfa970a153c")
    return null;
  // AUD_USD -> fxAUD
  if (aggregator == "0x8ef23ba9e66168d68b460139178513a3653fab70")
    return tokens[0];
  // TODO: finish this implementation for all pairs
  return null;
}

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

  const fxTokens = handle.getAllFxTokens();
  const collateralTokens = handle.getAllCollateralTypes();

  // Update all required vaults.
  for (let i = 0; i < tokensToUpdate.length; i ++) {
    const tokenAddress = Address.fromString(tokensToUpdate[i]);
    if (fxTokens.includes(tokenAddress))
      updateVaultsByFxToken(tokenAddress);
    if (collateralTokens.includes(tokenAddress))
      updateVaultsByCollateralToken(tokenAddress, fxTokens);
  }
}

function updateVaultsByFxToken(fxToken: Address): void {
  const vaultOwners = VaultRegistry.load(fxToken.toHex());
  if (vaultOwners == null) return;
  const owners = vaultOwners.owners;
  for (let i = 0; i < owners.length; i++) {
    const account = Address.fromString(owners[i]);
    const vault = Vault.load(getVaultId(account, fxToken));
    if (vault == null)
      continue;
    updateVault(vault as Vault, handleAddress, account, fxToken);
  }
}

function updateVaultsByCollateralToken(collateralToken: Address, fxTokens: Address[]): void {
  for (let i = 0; i < fxTokens.length; i++) {
    const vaultOwners = VaultRegistry.load(fxTokens[i].toHex());
    if (vaultOwners == null) continue;
    const owners = vaultOwners.owners;
    for (let j = 0; j < owners.length; j++) {
      const account = Address.fromString(owners[j]);
      const vault = Vault.load(getVaultId(account, fxTokens[i]));
      if (vault == null)
        continue;
      if (!vault.collateralAddresses.includes(collateralToken.toHex()))
        continue;
      updateVault(vault as Vault, handleAddress, account, fxTokens[i]);
    }
  }
}
