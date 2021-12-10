import { BigInt } from '@graphprotocol/graph-ts';
import {
  Deposit,
  Supply,
  Withdraw
} from "../types/GovernanceLock/GovernanceLock";
import {GovernanceLockedSupplyChange, GovernanceLocker} from "../types/schema";

const getGovernanceLocker = (address: string): GovernanceLocker => {
  let locker = GovernanceLocker.load(address);
  if (locker != null)
    return locker as GovernanceLocker;
  locker = new GovernanceLocker(address);
  locker.lockEndDate = BigInt.fromI32(0);
  locker.lockCreationDate = BigInt.fromI32(0);
  locker.lockLastUpdatedDate = BigInt.fromI32(0);
  locker.amount = BigInt.fromI32(0);
  locker.updateCount = BigInt.fromI32(0);
  locker.withdrawCount = BigInt.fromI32(0);
  return locker as GovernanceLocker;
};

const getSupplyChange = (
  difference: BigInt,
  date: BigInt
): GovernanceLockedSupplyChange => {
  // This will most likely always be null, but to prevent errors
  // this check is still present.
  const id = date.toHex() + "_" + difference.toHex();
  let change = GovernanceLockedSupplyChange.load(id);
  if (change != null)
    return change as GovernanceLockedSupplyChange;
  change = new GovernanceLockedSupplyChange(id);
  change.supplyDifference = BigInt.fromI32(0);
  change.date = BigInt.fromI32(0);
  change.triggeredBy = "";
  return change as GovernanceLockedSupplyChange;
};

export function handleDeposit(event: Deposit): void {
  const locker = getGovernanceLocker(event.params.depositor.toHex());
  if (locker.amount.equals(BigInt.fromI32(0)))
    locker.lockCreationDate = event.block.timestamp;
  locker.amount = locker.amount.plus(event.params.value);
  locker.lockEndDate = event.params.locktime;
  locker.lockLastUpdatedDate = event.block.timestamp;
  // Deposit may either increase lock time or amount, and may be called
  // multiple times during lock duration, justifying why this variable is
  // not called depositCount.
  locker.updateCount = locker.updateCount.plus(BigInt.fromI32(1));
  locker.save();
}

export function handleWithdraw(event: Withdraw): void {
  const locker = getGovernanceLocker(event.params.depositor.toHex());
  const zero = BigInt.fromI32(0);
  locker.amount = zero;
  locker.lockCreationDate = zero;
  locker.lockEndDate = zero;
  locker.lockLastUpdatedDate = event.block.timestamp;
  locker.updateCount = BigInt.fromI32(0);
  locker.withdrawCount = locker.withdrawCount.plus(BigInt.fromI32(1));
  locker.save();
}

export function handleSupply(event: Supply): void {
  const difference = event.params.supply.minus(event.params.previousSupply);
  const change = getSupplyChange(difference, event.block.timestamp);
  change.supplyDifference = difference;
  change.date = event.block.timestamp;
  change.triggeredBy = event.transaction.from.toHex();
  change.save();
}
