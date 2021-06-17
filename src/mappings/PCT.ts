import {
  BigInt,
  ByteArray,
  Address,
  crypto,
} from '@graphprotocol/graph-ts';
import { pctPool } from "../types/schema";
import {
  Stake,
  Unstake,
  ClaimInterest,
  SetProtocolInterface,
  UnsetProtocolInterface,
  ProtocolClaimInterest,
  ProtocolReturnFunds,
  ProtocolDepositFunds,
  PCT,
} from "../types/PCT/PCT";
import { concat } from "../utils";

const getPoolId = (address: Address, collateralToken: Address): string => (
  crypto.keccak256(concat(
    ByteArray.fromHexString(address.toHex()),
    ByteArray.fromHexString(collateralToken.toHex())
  )).toHex()
);

const createPoolEntity = (
  id: string,
  address: Address,
  collateralToken: Address
): pctPool => {
  const pool = new pctPool(id);
  const pct = PCT.bind(address);
  pool.collateralToken = collateralToken.toHex();
  pool.totalDeposits = BigInt.fromString("0");
  pool.totalInvestments = BigInt.fromString("0");
  pool.totalClaimable = BigInt.fromString("0");
  pool.depositorCount = BigInt.fromString("0");
  pool.interfaces = [];
  pool.protocolFee = pct.protocolFee();
  return pool;
};

export function handleStake(event: Stake): void {
  // Event parameters.
  const account = event.params.account;
  const fxToken = event.params.fxToken;
  const collateralToken = event.params.collateralToken;
  const amount = event.params.amount;
  // Get PCT contract.
  const poolId = getPoolId(event.address, collateralToken);
  let pool = pctPool.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    collateralToken
  );
  const pct = PCT.bind(event.address);
  // Update values.
  pool.totalDeposits = pct.getTotalDeposits(collateralToken);
  // Add new depositor if balance of stake is the event amount.
  if (pct.balanceOfStake(account, fxToken, collateralToken).equals(amount))
    pool.depositorCount = pool.depositorCount.plus(BigInt.fromString("1"));
  pool.save();
}

export function handleUnstake(event: Unstake): void {
  // Event parameters.
  const account = event.params.account;
  const fxToken = event.params.fxToken;
  const collateralToken = event.params.collateralToken;
  const amount = event.params.amount;
  // Get PCT contract.
  const poolId = getPoolId(event.address, collateralToken);
  let pool = pctPool.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    collateralToken
  );
  const pct = PCT.bind(event.address);
  // Update values.
  pool.totalDeposits = pct.getTotalDeposits(collateralToken);
  // Add new depositor if balance of stake is zero.
  if (pct.balanceOfStake(account, fxToken, collateralToken).equals(BigInt.fromString("0")))
    pool.depositorCount = pool.depositorCount.minus(BigInt.fromString("1"));
  pool.save();
}

export function handleUserClaimInterest(event: ClaimInterest): void {
  // Event parameters.
  const account = event.params.acount;
  const collateralToken = event.params.collateralToken;
  const amount = event.params.amount;
  // Get PCT contract.
  const poolId = getPoolId(event.address, collateralToken);
  let pool = pctPool.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    collateralToken
  );
  const pct = PCT.bind(event.address);
  // Update values.
  pool.totalClaimable = pct.getTotalAccruedInterest(collateralToken);
  pool.save();
}

export function handleSetProtocolInterface(event: SetProtocolInterface): void {
  // Event parameters.
  const interfaceAddress = event.params.protocolInterfaceAddress;
  const collateralToken = event.params.collateralToken;
  // Get PCT contract.
  const poolId = getPoolId(event.address, collateralToken);
  let pool = pctPool.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    collateralToken
  );
  // Update values.
  const hasExistingAddress = pool.interfaces.includes(interfaceAddress.toHex());
  const interfaces = pool.interfaces;
  if (!hasExistingAddress) {
    interfaces.push(interfaceAddress.toHex());
    pool.interfaces = interfaces;
  }
  pool.save();
}

export function handleUnsetProtocolInterface(event: UnsetProtocolInterface): void {
  // Event parameters.
  const interfaceAddress = event.params.protocolInterfaceAddress;
  const collateralToken = event.params.collateralToken;
  // Get PCT contract.
  const poolId = getPoolId(event.address, collateralToken);
  let pool = pctPool.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    collateralToken
  );
  // Update values.
  const hasExistingAddress = pool.interfaces.includes(interfaceAddress.toHex());
  const interfaces = pool.interfaces;
  if (hasExistingAddress) {
    interfaces.splice(interfaces.indexOf(interfaceAddress.toHex(), 1));
    pool.interfaces = interfaces;
  }
  pool.save();
}

export function handleProtocolClaimInterest(event: ProtocolClaimInterest): void {
  // Event parameters.
  const interfaceAddress = event.params.protocolInterfaceAddress;
  const collateralToken = event.params.collateralToken;
  const amount = event.params.amount;
  // Get PCT contract.
  const poolId = getPoolId(event.address, collateralToken);
  let pool = pctPool.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    collateralToken
  );
  const pct = PCT.bind(event.address);
  // Update values.
  pool.protocolFee = pct.protocolFee();
  pool.totalClaimable = pct.getTotalAccruedInterest(collateralToken);
  pool.save();
}

export function handleProtocolReturnFunds(event: ProtocolReturnFunds): void {
  // Event parameters.
  const interfaceAddress = event.params.protocolInterfaceAddress;
  const collateralToken = event.params.collateralToken;
  const amount = event.params.amount;
  // Get PCT contract.
  const poolId = getPoolId(event.address, collateralToken);
  let pool = pctPool.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    collateralToken
  );
  const pct = PCT.bind(event.address);
  // Update values.
  pool.protocolFee = pct.protocolFee();
  pool.totalInvestments = pct.getTotalInvestments(collateralToken);
  pool.totalDeposits = pct.getTotalDeposits(collateralToken);
  pool.save();
}

export function handleProtocolDepositFunds(event: ProtocolDepositFunds): void {
  // Event parameters.
  const interfaceAddress = event.params.protocolInterfaceAddress;
  const collateralToken = event.params.collateralToken;
  const amount = event.params.amount;
  // Get PCT contract.
  const poolId = getPoolId(event.address, collateralToken);
  let pool = pctPool.load(poolId) || createPoolEntity(
    poolId,
    event.address,
    collateralToken
  );
  const pct = PCT.bind(event.address);
  // Update values.
  pool.protocolFee = pct.protocolFee();
  pool.totalInvestments = pct.getTotalInvestments(collateralToken);
  pool.totalDeposits = pct.getTotalDeposits(collateralToken);
  pool.save();
}
