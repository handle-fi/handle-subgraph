import {
  ByteArray,
  Address,
  crypto, BigInt,
} from '@graphprotocol/graph-ts';
import { concat } from "../utils";
import {
  Deposit,
  Supply,
  Withdraw
} from "../types/GovernanceLock/GovernanceLock";
import {GovernanceLockedSupplyChange, GovernanceLocker} from "../types/schema";

const getSupplyChangeId = (difference: BigInt, date: BigInt): string => (
  crypto.keccak256(concat(
    ByteArray.fromHexString(date.toHex()),
    ByteArray.fromHexString(difference.toHex())
  )).toHex()
);

const getGovernanceLocker = (address: string): GovernanceLocker => {
  let locker = GovernanceLocker.load(address);
  if (locker != null)
    return locker as GovernanceLocker;
  locker = new GovernanceLocker(address);
  locker.lockEndDate = BigInt.fromI32(0);
  locker.lockCreationDate = BigInt.fromI32(0);
  locker.lockLastUpdatedDate = BigInt.fromI32(0);
  locker.amount = BigInt.fromI32(0);
  return locker as GovernanceLocker;
};

const getSupplyChange = (
  difference: BigInt,
  date: BigInt
): GovernanceLockedSupplyChange => {
  // This will most likely always be null, but to prevent errors
  // this check is still present.
  const id = getSupplyChangeId(difference, date);
  let change = GovernanceLockedSupplyChange.load(id);
  if (change != null)
    return change as GovernanceLockedSupplyChange;
  change = new GovernanceLockedSupplyChange(id);
  change.supplyDifference = BigInt.fromI32(0);
  change.date = BigInt.fromI32(0);
  return change as GovernanceLockedSupplyChange;
};


export function handleDeposit(event: Deposit): void {
  const locker = getGovernanceLocker(event.address.toHex());
  if (locker.amount.equals(BigInt.fromI32(0)))
    locker.lockCreationDate = event.block.timestamp;
  locker.amount = locker.amount.plus(event.params.value);
  locker.lockLastUpdatedDate = event.block.timestamp;
  locker.save();
}

export function handleWithdraw(event: Withdraw): void {
  const locker = getGovernanceLocker(event.address.toHex());
  const zero = BigInt.fromI32(0);
  locker.amount = zero;
  locker.lockCreationDate = zero;
  locker.lockEndDate = zero;
  locker.lockLastUpdatedDate = event.block.timestamp;
  locker.save();
}

export function handleSupply(event: Supply): void {
  const difference = event.params.supply.minus(event.params.previousSupply);
  const change = getSupplyChange(difference, event.block.timestamp);
  change.supplyDifference = difference;
  change.date = event.block.timestamp;
  change.save();
}
