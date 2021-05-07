import {
  BigInt,
  ByteArray,
  Address,
  crypto,
} from '@graphprotocol/graph-ts';
import {
  UpdateCollateral as UpdateCollateralEvent,
  UpdateDebt as UpdateDebtEvent,
  Treasury
} from "../types/Treasury/Treasury";
import {Vault, VaultCollateral} from "../types/schema";
import { Comptroller } from "../types/Treasury/Comptroller";
import { VaultLibrary } from "../types/Treasury/VaultLibrary";
import {concat} from "../utils";

// TODO: Set and load this from Comptroller contract.
const liquidationPercentage = BigInt.fromString("80");

const getVaultId = (account: Address, fxToken: Address): string => (
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

const updateVault = (
  vault: Vault,
  treasuryAddress: Address,
  account: Address,
  fxToken: Address
): Vault => {
  const treasury = Treasury.bind(treasuryAddress);
  const vaultLibrary = VaultLibrary.bind(treasury.vaultLibrary());
  vault.debt = treasury.getDebt(account, fxToken);
  vault.collateralAsEther = vaultLibrary.getTotalCollateralBalanceAsEth(account, fxToken);
  vault.collateralRatio = vaultLibrary.getCurrentRatio(account, fxToken);
  vault.minimumRatio = vaultLibrary.getMinimumRatio(account, fxToken);
  vault.isRedeemable = (
    vault.collateralRatio.lt(vault.minimumRatio) &&
    vault.collateralAsEther.gt(BigInt.fromString("0")) &&
    vault.debt.gt(BigInt.fromString("0"))
  );
  vault.isLiquidatable = (
    vault.isRedeemable &&
    vault.collateralRatio.lt(
      vault.minimumRatio
        .times(liquidationPercentage)
        .div(BigInt.fromString("100"))
    )
  );
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

export function handleDebtUpdate (event: UpdateDebtEvent): void {
  const account = event.params.account;
  const fxToken = event.params.fxToken;
  const vaultId = getVaultId(account, fxToken);
  let vault = Vault.load(vaultId) || createVaultEntity(
    vaultId,
    account,
    fxToken
  );
  vault = updateVault(vault as Vault, event.address, account, fxToken);
  vault.save();
}

export function handleCollateralUpdate (event: UpdateCollateralEvent): void {
  const account = event.params.account;
  const fxToken = event.params.fxToken;
  const collateralToken = event.params.collateralToken;
  const vaultId = getVaultId(account, fxToken);
  let vault = Vault.load(vaultId) || createVaultEntity(
    vaultId,
    account,
    fxToken
  );
  vault = updateVault(vault as Vault, event.address, account, fxToken);
  // Add or remove collateral token address to array.
  const treasury = Treasury.bind(event.address);
  const collateralBalance = treasury.getCollateralBalance(account, collateralToken, fxToken);
  const addresses = vault.collateralAddresses;
  const hasCollateral = addresses.includes(collateralToken.toHex());
  if (collateralBalance.equals(BigInt.fromString("0")) && hasCollateral) {
    addresses.splice(addresses.indexOf(collateralToken.toHex()), 1);
    vault.collateralAddresses = addresses;
  } else if (collateralBalance.gt(BigInt.fromString("0")) && !hasCollateral) {
    addresses.push(collateralToken.toHex());
    vault.collateralAddresses = addresses;
  }
  vault.save();
  // Update vault collateral entity.
  const vaultCollateral = getCreateVaultCollateral(
    vault as Vault,
    collateralToken
  );
  vaultCollateral.amount = treasury.getCollateralBalance(
    account,
    collateralToken,
    fxToken
  );
  vaultCollateral.save();
}
