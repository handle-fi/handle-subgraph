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
import {Vault, VaultCollateral, CollateralToken, fxToken, VaultRegistry} from "../../types/schema";
import { VaultLibrary } from "../../types/Handle/VaultLibrary";
import {concat} from "../../utils";
import { ERC20 } from "../../types/Handle/ERC20";

const oneEth = BigInt.fromString("1000000000000000000");
const zero = BigInt.fromString("0");
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
  vault.debt = zero;
  vault.collateralAsEther = zero;
  vault.collateralRatio = zero;
  vault.minimumRatio = zero;
  vault.redeemableTokens = zero;
  vault.isRedeemable = false;
  vault.isLiquidatable = false;
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

export const updateVault = (
  vault: Vault,
  handleAddress: Address,
  account: Address,
  fxToken: Address
): Vault => {
  const handle = Handle.bind(handleAddress);
  const vaultLibrary = VaultLibrary.bind(handle.vaultLibrary());
  const tokenPrice = handle.getTokenPrice(fxToken);
  // Attempt to fetch debt and debt as ETH.
  const tryDebt = handle.try_getDebt(account, fxToken);
  const tryDebtAsEth = vaultLibrary.try_getDebtAsEth(account, fxToken);
  // Assign valid values whether transaction reverted or not.
  vault.debt = !tryDebt.reverted ? tryDebt.value : vault.debt;
  const debtAsEth = !tryDebtAsEth.reverted
    ? tryDebtAsEth.value
    : vault.debt.times(tokenPrice).div(oneEth);
  vault.collateralAsEther = vaultLibrary.getTotalCollateralBalanceAsEth(account, fxToken);
  vault.collateralRatio = debtAsEth.gt(zero)
    ? vault.collateralAsEther.times(oneEth).div(debtAsEth)
    : zero;
  vault.minimumRatio = vaultLibrary.getMinimumRatio(account, fxToken);
  vault.isRedeemable = (
    vault.collateralRatio.lt(vault.minimumRatio) &&
    vault.collateralRatio.ge(oneEth) &&
    vault.collateralAsEther.gt(zero) &&
    vault.debt.gt(zero)
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
  if (vault.isRedeemable) {
    const redeemableAsEther = calculateTokensRequiredForCrIncrease(
      vault.minimumRatio,
      debtAsEth,
      vault.collateralAsEther,
      oneEth // no fees for redemption.
    );
    // Convert to fxToken currency.
    vault.redeemableTokens = vault.isRedeemable
      ? redeemableAsEther.times(oneEth).div(tokenPrice)
      : zero;
    // If redeemable amount is greater than debt, cap the value, although this is a critical issue.
    if (vault.redeemableTokens.gt(vault.debt))
      vault.redeemableTokens = vault.debt;
  } else if (vault.redeemableTokens.gt(zero)) {
    // Clear redeemable amount.
    vault.redeemableTokens = zero;
  }
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
  vault = updateVault(vault as Vault, event.address, event.params.account, event.params.fxToken);
  vault.save();
  // Update fxToken total supply.
  const token = fxToken.load(event.params.fxToken.toHex());
  if (token != null) {
    token.totalSupply = ERC20.bind(event.params.fxToken).totalSupply();
    token.save();
  }
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
  vault = updateVault(vault as Vault, event.address, account, fxToken);
  // Add or remove collateral token address to array.
  const handle = Handle.bind(event.address);
  const collateralBalance = handle.getCollateralBalance(account, collateralAddress, fxToken);
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
