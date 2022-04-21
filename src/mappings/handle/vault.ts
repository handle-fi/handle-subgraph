import {
  BigInt,
  ByteArray,
  Address,
  crypto,
} from '@graphprotocol/graph-ts';
import {
  Handle,
  UpdateCollateral as UpdateCollateralEvent,
  UpdateDebt as UpdateDebtEvent,
} from "../../types/Handle/Handle";
import {Vault, VaultCollateral, VaultRegistry} from "../../types/schema";
import {concat} from "../../utils";

const oneEth = BigInt.fromString("1000000000000000000");
const zero = BigInt.fromString("0");

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
  vault.collateralAddresses = [];
  return vault;
};

/**
 * Calculates tokens required for redemption or liquidation.
 * @param crTarget The final CR target after redemption/liquidation.
 * @param debtAsEther Vault debt as ether.
 * @param collateralAsEther Vault collateral as ether.
 * @param [collateralReturnRatio] Return ratio, 1 eth for no fees, 1.05 for 5% of fees on liquidation.
 */
const calculateTokensRequiredForCrIncrease = (
  crTarget: BigInt,
  debtAsEther: BigInt,
  collateralAsEther: BigInt,
  collateralReturnRatio: BigInt
): BigInt => {
  const nominator = crTarget.times(debtAsEther).minus(collateralAsEther.times(oneEth));
  const denominator = crTarget.minus(collateralReturnRatio);
  return nominator.div(denominator);
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
    vaultCollateral.amount = zero;
  }
  return vaultCollateral as VaultCollateral;
};

const getCreateVaultRegistry = (fxToken: Address): VaultRegistry => {
  let registry = VaultRegistry.load((fxToken.toHex()))
  if (registry == null) {
    registry = new VaultRegistry(fxToken.toHex());
    registry.owners = [];
  }
  return registry as VaultRegistry;
};

export function handleDebtUpdate (event: UpdateDebtEvent): void {
  const vaultId = getVaultId(event.params.account, event.params.fxToken);
  let vault = Vault.load(vaultId) || createVaultEntity(
    vaultId,
    event.params.account,
    event.params.fxToken
  );
  const handleContract = Handle.bind(event.address);
  const tryDebt = handleContract
    .try_getDebt(event.params.account, event.params.fxToken);
  if (!tryDebt.reverted)
    vault.debt = tryDebt.value;
  vault.save();
  // Add account to vaultOwners array if needed.
  const vaultRegistry = getCreateVaultRegistry(event.params.fxToken);
  const ownersArray = vaultRegistry.owners;
  if (!ownersArray.includes(event.params.account.toHex())) {
    ownersArray.push(event.params.account.toHex());
    vaultRegistry.owners = ownersArray;
    vaultRegistry.save();
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
  const handleContract = Handle.bind(event.address);
  const collateralBalance = handleContract
    .getCollateralBalance(account, collateralAddress, fxToken);
  const addresses = vault.collateralAddresses;
  const hasCollateral = addresses.includes(collateralAddress.toHex());
  if (collateralBalance.equals(zero) && hasCollateral) {
    addresses.splice(addresses.indexOf(collateralAddress.toHex()), 1);
    vault.collateralAddresses = addresses;
  } else if (collateralBalance.gt(zero) && !hasCollateral) {
    addresses.push(collateralAddress.toHex());
    vault.collateralAddresses = addresses;
  }
  vault.save();
  // Update vault collateral entity.
  const vaultCollateral = getCreateVaultCollateral(
    vault as Vault,
    collateralAddress
  );
  vaultCollateral.amount = collateralBalance;
  vaultCollateral.save();
}
