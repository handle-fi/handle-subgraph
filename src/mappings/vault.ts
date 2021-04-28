﻿import {
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
import { Vault } from "../types/schema";
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
  return vault;
};

const updateVault = (
  vault: Vault,
  treasuryAddress: Address,
  account: Address,
  fxToken: Address
): void => {
  const treasury = Treasury.bind(treasuryAddress);
  const vaultLibrary = VaultLibrary.bind(treasury.vaultLibrary());
  vault.debt = treasury.getDebt(account, fxToken);
  vault.collateralAsEther = treasury.getTotalCollateralBalanceAsEth(account, fxToken);
  vault.collateralRatio = vaultLibrary.getCurrentRatio(account, fxToken);
  vault.minimumRatio = vaultLibrary.getVaultMinimumRatio(account, fxToken);
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
  vault.save();
};

export function handleDebtUpdate (event: UpdateDebtEvent): void {
  const account = event.params.account;
  const fxToken = event.params.fxToken;
  const vaultId = getVaultId(account, fxToken);
  const vault = Vault.load(vaultId) || createVaultEntity(
    vaultId,
    account,
    fxToken
  );
  updateVault(vault as Vault, event.address, account, fxToken);
}

export function handleCollateralUpdate (event: UpdateCollateralEvent): void {
  const account = event.params.account;
  const fxToken = event.params.fxToken;
  const vaultId = getVaultId(account, fxToken);
  let vault = Vault.load(vaultId) || createVaultEntity(
    vaultId,
    account,
    fxToken
  );
  updateVault(vault as Vault, event.address, account, fxToken);
}
