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
import {
  Vault,
  VaultCollateral,
  VaultRegistry,
  fxToken as fxTokenEntity,
  CollateralToken
} from "../../types/schema";
import {concat} from "../../utils";

const ONE_ETH = BigInt.fromI32(10).pow(18);
const ZERO = BigInt.fromString("0");
const MINIMMUM_LIQUIDATION_RATIO = ONE_ETH
  .times(BigInt.fromI32(11)).div(BigInt.fromI32(10));

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
  vault.debt = ZERO;
  vault.debtAsEther = ZERO;
  vault.collateralAsEther = ZERO;
  vault.collateralRatio = ZERO;
  vault.minimumRatio = ZERO;
  vault.redeemableTokens = ZERO;
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
  const nominator = crTarget.times(debtAsEther).minus(collateralAsEther.times(ONE_ETH));
  const denominator = crTarget.minus(collateralReturnRatio);
  return nominator.div(denominator);
};

export const updateVaultPriceDerivedProperties = (vault: Vault): void => {
  const fxTokenEthRate = fxTokenEntity.load(vault.fxToken).rate;
  if (fxTokenEthRate.isZero()) return;
  vault.debtAsEther = vault.debt.times(fxTokenEthRate).div(ONE_ETH);
  let collateralAsEther = ZERO;
  const collateralAmountsEther: Map<string, BigInt> = new Map<string, BigInt>();
  const collateralAddresses: string[] = vault.collateralAddresses;
  for (let i = 0; i < collateralAddresses.length; i++) {
    const collateralToken = CollateralToken.load(collateralAddresses[i]);
    const collateralEthRate = collateralToken.rate;
    const collateralUnit = BigInt.fromI32(10).pow(collateralToken.decimals);
    const vaultCollateral = VaultCollateral
      .load(getVaultCollateralId(vault.id, Address.fromString(collateralAddresses[i])));
    collateralAsEther = collateralAsEther
      .plus(vaultCollateral.amount.times(collateralEthRate).div(collateralUnit));
    collateralAmountsEther.set(vaultCollateral.address, collateralAsEther);
  }
  vault.collateralAsEther = collateralAsEther;
  vault.collateralRatio = !vault.debtAsEther.isZero()
    ? vault.collateralAsEther.times(ONE_ETH).div(vault.debtAsEther)
    : ZERO;
  let minimumRatio = ZERO;
  if (!vault.collateralAsEther.isZero())
    for (let i = 0; i < collateralAddresses.length; i++) {
      const vaultCollateral = VaultCollateral
        .load(getVaultCollateralId(vault.id, Address.fromString(collateralAddresses[i])));
      const collateral = CollateralToken.load(vaultCollateral.address);
      minimumRatio = minimumRatio.plus(
        collateral.mintCollateralRatio
          .times(ONE_ETH)
          .times(collateralAmountsEther.get(vaultCollateral.address))
          .div(vault.collateralAsEther)
          .div(BigInt.fromI32(100))
      );
    }
  vault.minimumRatio = minimumRatio;
  vault.isRedeemable = (
    vault.collateralRatio.lt(vault.minimumRatio) &&
    vault.collateralRatio.ge(ONE_ETH) &&
    vault.collateralAsEther.gt(ZERO) &&
    vault.debt.gt(ZERO)
  );
  let liquidationRatio = vault.minimumRatio
        .times(BigInt.fromI32(8))
        .div(BigInt.fromI32(10));
  if (liquidationRatio.lt(MINIMMUM_LIQUIDATION_RATIO))
    liquidationRatio = MINIMMUM_LIQUIDATION_RATIO;
  vault.isLiquidatable = (
    vault.isRedeemable &&
    vault.collateralRatio.lt(liquidationRatio)
  );
  if (vault.isRedeemable) {
    const redeemableAsEther = calculateTokensRequiredForCrIncrease(
      vault.minimumRatio,
      vault.debtAsEther,
      vault.collateralAsEther,
      ONE_ETH // no fees for redemption.
    );
    // Convert to fxToken currency.
    vault.redeemableTokens = vault.isRedeemable
      ? redeemableAsEther.times(ONE_ETH).div(fxTokenEthRate)
      : ZERO;
    // If redeemable amount is greater than debt, cap the value, although this is a critical issue.
    if (vault.redeemableTokens.gt(vault.debt))
      vault.redeemableTokens = vault.debt;
  } else if (vault.redeemableTokens.gt(ZERO)) {
    // Clear redeemable amount.
    vault.redeemableTokens = ZERO;
  }
  vault.save();
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
    vaultCollateral.amount = ZERO;
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
  if (collateralBalance.equals(ZERO) && hasCollateral) {
    addresses.splice(addresses.indexOf(collateralAddress.toHex()), 1);
    vault.collateralAddresses = addresses;
  } else if (collateralBalance.gt(ZERO) && !hasCollateral) {
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
