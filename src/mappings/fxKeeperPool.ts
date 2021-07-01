import {
  BigInt,
  ByteArray,
  Address,
  crypto,
} from '@graphprotocol/graph-ts';
import {
  fxKeeperPool as fxKeeperPoolSchema,
  fxKeeperPoolCollateral
} from "../types/schema";
import { Handle } from "../types/fxKeeperPool/Handle";
import {
  Stake as StakeEvent,
  Unstake as UnstakeEvent,
  Withdraw as WithdrawEvent,
  Liquidate as LiquidateEvent,
  fxKeeperPool,
} from "../types/fxKeeperPool/fxKeeperPool";
import { concat } from "../utils";

const getPoolId = (address: Address, fxToken: Address): string => (
  crypto.keccak256(concat(
    ByteArray.fromHexString(address.toHex()),
    ByteArray.fromHexString(fxToken.toHex())
  )).toHex()
);

const getPoolCollateralId = (
  poolId: string,
  collateralToken: Address
): string => {
  return crypto.keccak256(concat(
    ByteArray.fromHexString(poolId),
    ByteArray.fromHexString(collateralToken.toHex())
  )).toHex()
};

const createPoolEntity = (
  id: string,
  address: Address,
  fxToken: Address
): fxKeeperPoolSchema => {
  const pool = new fxKeeperPoolSchema(id);
  pool.fxToken = fxToken.toHex();
  pool.collateralAddresses = [];
  pool.depositorCount = BigInt.fromString("0");
  pool.liquidationsExecuted = BigInt.fromString("0");
  pool.totalDeposits = BigInt.fromString("0");
  return pool;
};

const getCreatePoolCollateral = (
  pool: fxKeeperPoolSchema,
  collateralToken: Address
): fxKeeperPoolCollateral => {
  const poolId = getPoolCollateralId(pool.id, collateralToken);
  let poolCollateral = fxKeeperPoolCollateral.load(poolId);
  if (poolCollateral == null) {
    poolCollateral = new fxKeeperPoolCollateral(poolId);
    poolCollateral.pool = pool.id;
    poolCollateral.address = collateralToken.toHex();
    poolCollateral.amount = BigInt.fromString("0");
  }
  return poolCollateral as fxKeeperPoolCollateral;
};

const updateAllCollateralTokens = (
  pool: fxKeeperPoolSchema,
  contract: fxKeeperPool
): fxKeeperPoolSchema => {
  const handle = Handle.bind(contract.handleAddress());
  const collateralTypes = handle.getAllCollateralTypes();
  const fxToken = Address.fromString(pool.fxToken);
  for (let i = 0; i < collateralTypes.length; i++) {
    const collateralType = collateralTypes[i];
    const balance = contract.getPoolCollateralBalance(fxToken, collateralType);
    const collateralToken = getCreatePoolCollateral(pool, collateralType);
    collateralToken.amount = balance;
    collateralToken.save();
    // Update pool entity collateral addresses array.
    const hasExistingAddress = pool.collateralAddresses.includes(collateralType.toHex());
    const collateralAddresses = pool.collateralAddresses;
    if (hasExistingAddress && collateralToken.amount.equals(BigInt.fromString("0"))) {
      collateralAddresses.splice(pool.collateralAddresses.indexOf(collateralType.toHex()), 1);
    } else if (!hasExistingAddress && collateralToken.amount.gt(BigInt.fromString("0"))) {
      collateralAddresses.push(collateralType.toHex());
    }
    pool.collateralAddresses = collateralAddresses;
  }
  return pool;
};

export function handleWithdraw(event: WithdrawEvent): void {
  const fxToken = event.params.token;
  const poolId = getPoolId(event.address, fxToken);
  let pool = fxKeeperPoolSchema.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    fxToken
  );
  const contract = fxKeeperPool.bind(event.address);
  updateAllCollateralTokens(pool as fxKeeperPoolSchema, contract);
  pool.save();
}

export function handleLiquidate(event: LiquidateEvent): void {
  const fxToken = event.params.token;
  const poolId = getPoolId(event.address, fxToken);
  let pool = fxKeeperPoolSchema.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    fxToken
  );
  const contract = fxKeeperPool.bind(event.address);
  pool.totalDeposits = contract.getPoolTotalDeposit(fxToken);
  pool.liquidationsExecuted = pool.liquidationsExecuted.plus(BigInt.fromString("1"));
  updateAllCollateralTokens(pool as fxKeeperPoolSchema, contract);
  pool.save();
}

export function handleStake(event: StakeEvent): void {
  const fxToken = event.params.token;
  const poolId = getPoolId(event.address, fxToken);
  let pool = fxKeeperPoolSchema.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    fxToken
  );
  const contract = fxKeeperPool.bind(event.address);
  pool.totalDeposits = contract.getPoolTotalDeposit(fxToken);
  // Add new depositor if balance of stake is the event amount.
  if (contract.balanceOfStake(event.params.account, fxToken).equals(event.params.amount))
    pool.depositorCount = pool.depositorCount.plus(BigInt.fromString("1"));
  pool.save();
}

export function handleUnstake(event: UnstakeEvent): void {
  const fxToken = event.params.token;
  const poolId = getPoolId(event.address, fxToken);
  let pool = fxKeeperPoolSchema.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    fxToken
  );
  const contract = fxKeeperPool.bind(event.address);
  pool.totalDeposits = contract.getPoolTotalDeposit(fxToken);
  // Subtract depositor if balance of stake is zero.
  if (contract.balanceOfStake(event.params.account, fxToken).equals(BigInt.fromString("0")))
    pool.depositorCount = pool.depositorCount.minus(BigInt.fromString("1"));
  pool.save();
}
