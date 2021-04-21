import {
  BigInt,
  BigDecimal,
  ByteArray,
  Address,
  crypto,
  ens,
} from '@graphprotocol/graph-ts';
import {
  UpdateCollateral as UpdateCollateralEvent,
  UpdateDebt as UpdateDebtEvent,
  Treasury
} from "../types/Treasury/Treasury";
import { Vault } from "../types/schema";
import { Comptroller } from "../types/Treasury/Comptroller";
import { VaultLibrary } from "../types/Treasury/VaultLibrary";
import {concat, bigIntToByteArray} from "../utils";

const getVaultId = (account: Address, fxToken: Address): string => (
  crypto.keccak256(concat(
    ByteArray.fromI32(account.toI32()),
    ByteArray.fromI32(fxToken.toI32())
  )).toHex()
);

const createVaultEntity = (
  id: string,
  account: Address,
  fxToken: Address
): Vault => {
  const vault = new Vault(id);
  vault.fxToken = fxToken.toHex();
  vault.account = fxToken.toHex();
  vault.debt = BigInt.fromI32(0);
  vault.collateralAsEther = BigInt.fromI32(0);
  vault.collateralRatio = BigInt.fromI32(0);
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
  vault.collateralRatio = vaultLibrary.getCurrentRatio(account, fxToken);
  vault.collateralAsEther = treasury.getTotalCollateralBalanceAsEth(account, fxToken);
  vault.save();
};

export const handleDebtUpdate = (event: UpdateDebtEvent): void => {
  const account = event.params.account;
  const fxToken = event.params.fxToken;
  const vaultId = getVaultId(account, fxToken);
  const vault = Vault.load(vaultId) || createVaultEntity(
    vaultId,
    account,
    fxToken
  );
  updateVault(vault as Vault, event.address, account, fxToken);
};

export const handleCollateralUpdate = (event: UpdateCollateralEvent): void => {
  const account = event.params.account;
  const fxToken = event.params.fxToken;
  const vaultId = getVaultId(account, fxToken);
  let vault = Vault.load(vaultId) || createVaultEntity(
    vaultId,
    account,
    fxToken
  );
  updateVault(vault as Vault, event.address, account, fxToken);
};
