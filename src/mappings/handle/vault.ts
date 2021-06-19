import {
  BigInt,
  ByteArray,
  Address,
  crypto,
} from '@graphprotocol/graph-ts';
import {
  UpdateCollateral as UpdateCollateralEvent,
  UpdateDebt as UpdateDebtEvent,
  Handle
} from "../../types/Handle/Handle";
import {Vault, VaultCollateral, CollateralToken, fxToken, VaultOwners} from "../../types/schema";
import { VaultLibrary } from "../../types/Handle/VaultLibrary";
import {concat} from "../../utils";
import { ERC20 } from "../../types/Handle/ERC20";

const oneEth = BigInt.fromString("1000000000000000000");
const liquidationPercentage = BigInt.fromString("80");
const minimumLiquidationRatio = oneEth
  .times(BigInt.fromString("110"))
  .div(BigInt.fromString("100")); // 110%

export const getVaultId = (account: Address, fxToken: Address): string => (
  crypto.keccak256(concat(
    ByteArray.fromHexString(account.toHex()),
    ByteArray.fromHexString(fxToken.toHex())
  )).toHex()
);

const getVaultCollateralId = (
  vaultId: string,
  collateralToken: Address
): string => {
  return crypto.keccak256(concat(
    ByteArray.fromHexString(vaultId),
    ByteArray.fromHexString(collateralToken.toHex())
  )).toHex()
};

const createVaultEntity = (
  id: string,
  account: Address,
  fxToken: Address
): Vault => {
  const vault = new Vault(id);
  vault.fxToken = fxToken.toHex();
  vault.account = account.toHex();
  vault.debt = BigInt.fromString("0");
  vault.collateralAsEther = BigInt.fromString("0");
  vault.collateralRatio = BigInt.fromString("0");
  vault.minimumRatio = BigInt.fromString("0");
  vault.isRedeemable = false;
  vault.isLiquidatable = false;
  vault.collateralAddresses = [];
  return vault;
};

export const updateVault = (
  vault: Vault,
  handleAddress: Address,
  account: Address,
  fxToken: Address
): Vault => {
  const handle = Handle.bind(handleAddress);
  const vaultLibrary = VaultLibrary.bind(handle.vaultLibrary());
  vault.debt = handle.getDebt(account, fxToken);
  vault.collateralAsEther = vaultLibrary.getTotalCollateralBalanceAsEth(account, fxToken);
  vault.collateralRatio = vaultLibrary.getCurrentRatio(account, fxToken);
  vault.minimumRatio = vaultLibrary.getMinimumRatio(account, fxToken);
  vault.isRedeemable = (
    vault.collateralRatio.lt(vault.minimumRatio) &&
    vault.collateralAsEther.gt(BigInt.fromString("0")) &&
    vault.debt.gt(BigInt.fromString("0"))
  );
  let liquidationRatio = vault.minimumRatio
        .times(liquidationPercentage)
        .div(BigInt.fromString("100"));
  if (liquidationRatio.lt(minimumLiquidationRatio))
    liquidationRatio = minimumLiquidationRatio;
  vault.isLiquidatable = (
    vault.isRedeemable &&
    vault.collateralRatio.lt(liquidationRatio)
  );
  vault.interestLastUpdateDate = handle.getInterestLastUpdateDate(account, fxToken);
  return vault;
};

const getCreateVaultCollateral = (
  vault: Vault,
  collateralToken: Address
): VaultCollateral => {
  const vaultCollateralId = getVaultCollateralId(vault.id, collateralToken);
  let vaultCollateral = VaultCollateral.load(vaultCollateralId);
  if (vaultCollateral == null) {
    vaultCollateral = new VaultCollateral(vaultCollateralId);
    vaultCollateral.vault = vault.id;
    vaultCollateral.address = collateralToken.toHex();
    vaultCollateral.amount = BigInt.fromString("0");
  }
  return vaultCollateral as VaultCollateral;
};

const getCreateVaultOwners = (fxToken: Address): VaultOwners => {
  let vaultOwners = VaultOwners.load((fxToken.toHex()))
  if (vaultOwners == null) {
    vaultOwners = new VaultOwners(fxToken.toHex());
    vaultOwners.owners = [];
  }
  return vaultOwners as VaultOwners;
};

export function handleDebtUpdate (event: UpdateDebtEvent): void {
  const vaultId = getVaultId(event.params.account, event.params.fxToken);
  let vault = Vault.load(vaultId) || createVaultEntity(
    vaultId,
    event.params.account,
    event.params.fxToken
  );
  vault = updateVault(vault as Vault, event.address, event.params.account, event.params.fxToken);
  vault.save();
  // Update fxToken total supply.
  const token = fxToken.load(event.params.fxToken.toHex());
  if (token != null) {
    token.totalSupply = ERC20.bind(event.params.fxToken).totalSupply();
    token.save();
  }
  // Add account to vaultOwners array if needed.
  const vaultOwners = getCreateVaultOwners(event.params.fxToken);
  if (!vaultOwners.owners.includes(event.params.account.toHex())) {
    vaultOwners.owners = [...vaultOwners.owners, event.params.account.toHex()];
    vaultOwners.save();
  }
}

export function handleCollateralUpdate (event: UpdateCollateralEvent): void {
  const account = event.params.account;
  const fxToken = event.params.fxToken;
  const collateralAddress = event.params.collateralToken;
  const vaultId = getVaultId(account, fxToken);
  let vault = Vault.load(vaultId) || createVaultEntity(
    vaultId,
    account,
    fxToken
  );
  vault = updateVault(vault as Vault, event.address, account, fxToken);
  // Add or remove collateral token address to array.
  const handle = Handle.bind(event.address);
  const collateralBalance = handle.getCollateralBalance(account, collateralAddress, fxToken);
  const addresses = vault.collateralAddresses;
  const hasCollateral = addresses.includes(collateralAddress.toHex());
  if (collateralBalance.equals(BigInt.fromString("0")) && hasCollateral) {
    addresses.splice(addresses.indexOf(collateralAddress.toHex()), 1);
    vault.collateralAddresses = addresses;
  } else if (collateralBalance.gt(BigInt.fromString("0")) && !hasCollateral) {
    addresses.push(collateralAddress.toHex());
    vault.collateralAddresses = addresses;
  }
  vault.save();
  // Update vault collateral entity.
  const vaultCollateral = getCreateVaultCollateral(
    vault as Vault,
    collateralAddress
  );
  vaultCollateral.amount = handle.getCollateralBalance(
    account,
    collateralAddress,
    fxToken
  );
  vaultCollateral.save();
  // Update collateral balance.
  // Update fxToken total supply.
  const token = CollateralToken.load(collateralAddress.toHex());
  if (token != null) {
    token.totalBalance = handle.totalBalances(collateralAddress);
    token.save();
  }
}
