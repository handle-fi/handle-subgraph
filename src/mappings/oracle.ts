import { AnswerUpdated } from "../types/AggregatorV3Interface/AggregatorV3Interface";
import { Vault, VaultOwners } from "../types/schema";
import { Address } from '@graphprotocol/graph-ts';
import { Handle } from "../types/Handle/Handle";
import { getVaultId, updateVault } from "./handle/vault";

const handleAddress = Address.fromString("0x4cc22AB2d7D0159ee2F98245B1BbA6AAa471DCef")
const handle = Handle.bind(handleAddress);

const tokens = {
  fxAUD: "0x0e3918BD80C74938D32Fa2EeDa170Cc23F51faa4",
  fxEUR: "0x133398C6d1ECB5eaE88AFDA6fA353b72Ad33D11D",
  fxKRW: "0xbdc2458f6B652047ae2B7EE07Da27aA605cC0D9d",
  WETH: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
  WBTC: "0xd3A691C852CDB01E281545A27064741F0B7f6825",
  DAI: "0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa",
};

const aggregatorToToken = {
  // ETH_USD, update ALL vaults due to indirect quoting.
  "0x10b3c106c4ed7d22b0e7abe5dc43bdfa970a153c": null,
  // AUD_USD -> fxAUD
  "0x8ef23ba9e66168d68b460139178513a3653fab70": tokens.fxAUD
  // TODO: finish this implementation for all pairs
};

/**
 * Listens to oracle price updates and updates the indexing of all Vault parameters.
 * This ensures all indexed Vault data is always up to date and able to be used for
 * liquidations and redemptions.
 */
export function handleAnswerUpdated (event: AnswerUpdated): void {
  const tokensToUpdate = aggregatorToToken[event.address.toHex()] != null
    ? [aggregatorToToken[event.address.toHex()]]
    : Object.keys(tokens).map(key => tokens[key]);

  const fxTokens = handle.getAllFxTokens();
  const collateralTokens = handle.getAllCollateralTypes();

  // Update all required vaults.
  for (let token of tokensToUpdate) {
    if (fxTokens.includes(token))
      updateVaultsByFxToken(token);
    if (collateralTokens.includes(token))
      updateVaultsByCollateralToken(token, fxTokens);
  }
}

const updateVaultsByFxToken = (fxToken: Address): void => {
  const vaultOwners = VaultOwners.load(fxToken.toHex());
  const owners = vaultOwners.owners;
  for (let owner of owners) {
    const account = Address.fromString(owner);
    const vault = Vault.load(getVaultId(account, fxToken));
    updateVault(vault, handleAddress, account, fxToken);
  }
};

const updateVaultsByCollateralToken = (collateralToken: Address, fxTokens: Address[]): void => {
  for (let fxToken of fxTokens) {
    const vaultOwners = VaultOwners.load(fxToken.toHex());
    const owners = vaultOwners.owners;
    for (let owner of owners) {
      const account = Address.fromString(owner);
      const vault = Vault.load(getVaultId(account, fxToken));
      if (!vault.collateralAddresses.includes(collateralToken.toHex()))
        continue;
      updateVault(vault, handleAddress, account, fxToken);
    }
  }
};
