import {
  BigInt,
  ByteArray,
  Address,
  crypto,
} from '@graphprotocol/graph-ts';
import {
  fxKeeperPool as fxKeeperPoolSchema,
} from "../types/schema";
import {
  Stake as StakeEvent,
  Unstake as UnstakeEvent,
  Withdraw as WithdrawEvent,
  Liquidate as LiquidateEvent,
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
  pool.liquidationsExecuted = BigInt.fromString("0");
  pool.totalDeposits = BigInt.fromString("0");
  return pool;
};

export function handleWithdraw(event: WithdrawEvent): void {
  const fxToken = event.params.token;
  const poolId = getPoolId(event.address, fxToken);
  let pool = (fxKeeperPoolSchema.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    fxToken
  )) as fxKeeperPoolSchema;
  pool.save();
}

export function handleLiquidate(event: LiquidateEvent): void {
  const fxToken = event.params.token;
  const poolId = getPoolId(event.address, fxToken);
  let pool = (fxKeeperPoolSchema.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    fxToken
  )) as fxKeeperPoolSchema;
  pool.liquidationsExecuted = pool.liquidationsExecuted.plus(BigInt.fromString("1"));
  pool.save();
}

export function handleStake(event: StakeEvent): void {
  const fxToken = event.params.token;
  const poolId = getPoolId(event.address, fxToken);
  let pool = (fxKeeperPoolSchema.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    fxToken
  )) as fxKeeperPoolSchema;
  pool.totalDeposits = pool.totalDeposits.plus(event.params.amount);
  pool.save();
}

export function handleUnstake(event: UnstakeEvent): void {
  const fxToken = event.params.token;
  const poolId = getPoolId(event.address, fxToken);
  let pool = (fxKeeperPoolSchema.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    fxToken
  )) as fxKeeperPoolSchema;
  pool.totalDeposits = pool.totalDeposits.minus(event.params.amount);
  pool.save();
}
