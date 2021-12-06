import { BigInt, Address } from '@graphprotocol/graph-ts';
import { oneEth } from "../utils";
import {
  ForexDistribution,
  ForexDistributionRateChange,
  RewardPool, RewardPoolDepositor,
  RewardPoolRegistry
} from "../types/schema";
import {
  RewardPool as RewardPoolContract,
  Claim,
  CreatePool,
  ForexDistributed,
  PoolAliasChanged,
  SetForexDistributionRate,
  Stake,
  Unstake,
  WhitelistChanged,
  SetPoolWeights
} from "../types/RewardPool/RewardPool";
import { log } from '@graphprotocol/graph-ts'

const getRewardPoolRegistry = (contractAddress: string): RewardPoolRegistry => {
  let registry = RewardPoolRegistry.load(contractAddress);
  if (registry != null)
    return registry as RewardPoolRegistry;
  registry = new RewardPoolRegistry(contractAddress);
  registry.poolCount = BigInt.fromI32(0);
  registry.totalWeight = BigInt.fromI32(0);
  registry.totalForexDistributed = BigInt.fromI32(0);
  registry.currentDistributionRatePerSecond = BigInt.fromI32(0);
  registry.save();
  return registry as RewardPoolRegistry;
};

const getForexDistributionChange = (
  contractAddress: string,
  amount: BigInt,
  date: BigInt
): ForexDistributionRateChange => {
  const id = contractAddress + "_" + date.toHex() + "_" + amount.toHex();
  let entity = ForexDistributionRateChange.load(id);
  if (entity != null)
    return entity as ForexDistributionRateChange;
  entity = new ForexDistributionRateChange(id);
  entity.poolRegistry = contractAddress;
  entity.date = BigInt.fromI32(0);
  entity.ratePerSecond = BigInt.fromI32(0);
  return entity as ForexDistributionRateChange;
};

const getDepositor = (
  contractAddress: string,
  account: string,
  poolId: BigInt
): RewardPoolDepositor => {
  const id = account + "_" + poolId.toHex();
  let entity = RewardPoolDepositor.load(id);
  if (entity != null)
    return entity as RewardPoolDepositor;
  entity = new RewardPoolDepositor(id);
  entity.amount = BigInt.fromI32(0);
  entity.account = account;
  entity.rewardPool = contractAddress;
  entity.totalClaimed = BigInt.fromI32(0);
  return entity as RewardPoolDepositor;
};

const getForexDistribution = (
  contractAddress: string,
  poolId: BigInt,
  amount: BigInt,
  date: BigInt
): ForexDistribution => {
  const prefix = contractAddress + "_" + poolId.toHex();
  const id = prefix + "_" + date.toHex() + "_" + amount.toHex();
  let entity = ForexDistribution.load(id);
  if (entity != null)
    return entity as ForexDistribution;
  entity = new ForexDistribution(id);
  entity.rewardPool = contractAddress;
  entity.distributionRatePerSecond = BigInt.fromI32(0);
  entity.amount = BigInt.fromI32(0);
  entity.date = BigInt.fromI32(0);
  return entity as ForexDistribution;
};

const getRewardPool = (id: BigInt): RewardPool => {
  let pool = RewardPool.load(id.toHex());
  if (pool != null)
    return pool as RewardPool;
  pool = new RewardPool(id.toHex());
  pool.totalDeposits = BigInt.fromI32(0);
  pool.weight = BigInt.fromI32(0);
  pool.ratio = BigInt.fromI32(0);
  pool.assetAddress = "";
  pool.assetType = BigInt.fromI32(0);
  pool.whitelistedStakers = [];
  pool.aliases = [];
  return pool as RewardPool;
};

const updatePoolRatios = (contractAddress: string): void => {
  const registry = getRewardPoolRegistry(contractAddress);
  const contract = RewardPoolContract.bind(
    Address.fromString(contractAddress)
  );
  for (let i = 0; i < registry.poolCount.toI32(); i++) {
    const poolId = BigInt.fromI32(i);
    const pool = getRewardPool(poolId);
    pool.weight = contract.getPool(poolId).value0;
    pool.ratio = pool.weight.times(oneEth).div(registry.totalWeight);
    pool.save();
  }
};

export function handleCreatePool(event: CreatePool): void {
  log.info("RewardPool: handleCreatePool", []);
  const rewardPool = getRewardPool(event.params.id);
  rewardPool.assetType = BigInt.fromI32(event.params.assetType);
  rewardPool.assetAddress = event.params.asset.toHex();
  rewardPool.weight = event.params.weight;
  // Update totalWeight in reward registry.
  const registry = getRewardPoolRegistry(event.address.toHex());
  registry.totalWeight = registry.totalWeight.plus(event.params.weight);
  registry.save();
  // Calculate reward pool ratios since total weight has changed.
  updatePoolRatios(event.address.toHex());
}

export function handleForexDistributed(event: ForexDistributed): void {
  log.info("RewardPool: handleForexDistributed", []);
  // Update total forex distributed value.
  const registry = getRewardPoolRegistry(event.address.toHex());
  registry.totalForexDistributed = registry.totalForexDistributed
    .plus(event.params.totalAmount);
  registry.save();
  const amounts = event.params.amounts;
  const poolIds = event.params.poolIds;
  // Create & save distribution entities.
  for (let i = 0; i < amounts.length; i++) {
    if (amounts[i] == BigInt.fromI32(0)) continue;
    const entity = getForexDistribution(
      event.address.toHex(),
      poolIds[i],
      amounts[i],
      event.block.timestamp
    );
    entity.distributionRatePerSecond = registry
      .currentDistributionRatePerSecond;
    entity.amount = amounts[i];
    entity.date = event.block.timestamp;
    entity.save();
  }
}

export function handleSetForexDistributionRate(
  event: SetForexDistributionRate
): void {
  log.info("RewardPool: handleSetForexDistributionRate", []);
  // Create change entity.
  const change = getForexDistributionChange(
    event.address.toHex(),
    event.params.ratePerSecond,
    event.block.timestamp
  );
  change.ratePerSecond = event.params.ratePerSecond;
  change.date = event.block.timestamp;
  change.save();
  // Update current distribution rate in registry entity.
  const registry = getRewardPoolRegistry(event.address.toHex());
  registry.currentDistributionRatePerSecond = event.params.ratePerSecond;
  registry.save();
}

export function handlePoolAliasChanged(event: PoolAliasChanged): void {
  log.info("RewardPool: handlePoolAliasChanged", []);
  const pool = getRewardPool(event.params.poolId);
  const aliases = pool.aliases;
  const hash = event.params.aliasHash.toHex();
  const index = aliases.indexOf(hash); 
  if (index > -1) {
    aliases[index] = hash;
  } else {
    aliases.push(hash);
  }
  pool.aliases = aliases;
  pool.save();
}

export function handleWhitelistChanged(event: WhitelistChanged): void {
  log.info("RewardPool: handleWhitelistChanged", []);
  const pool = getRewardPool(event.params.poolId);
  const whitelist = pool.whitelistedStakers;
  const enabling = event.params.whitelisted;
  const staker = event.params.staker.toHex();
  const isCurrentlyWhitelisted = whitelist.includes(staker); 
  if (isCurrentlyWhitelisted && !enabling) {
    // Remove from whitelist.
    whitelist.splice(whitelist.indexOf(staker), 1);
  } else if (!isCurrentlyWhitelisted && enabling) {
    // Add to whitelist.
    whitelist.push(staker);
  }
  pool.whitelistedStakers = whitelist;
  pool.save();
}

export function handleSetPoolWeights(event: SetPoolWeights): void {
  log.info("RewardPool: handleSetPoolWeights", []);
  updatePoolRatios(event.address.toHex());
}

export function handleStake(event: Stake): void {
  log.info("RewardPool: handleStake", []);
  // Update depositor params.
  const depositor = getDepositor(
    event.address.toHex(),
    event.params.account.toHex(),
    event.params.poolId
  );
  depositor.amount = depositor.amount.plus(event.params.amount);
  depositor.save();
  // Update pool params.
  const pool = getRewardPool(event.params.poolId);
  pool.totalDeposits = pool.totalDeposits.plus(event.params.amount);
  pool.save();
}

export function handleUnstake(event: Unstake): void {
  log.info("RewardPool: handleUnstake", []);
  // Update depositor params.
  const depositor = getDepositor(
    event.address.toHex(),
    event.params.account.toHex(),
    event.params.poolId
  );
  depositor.amount = depositor.amount.minus(event.params.amount);
  depositor.save();
  // Update pool params.
  const pool = getRewardPool(event.params.poolId);
  pool.totalDeposits = pool.totalDeposits.minus(event.params.amount);
  pool.save();
}

export function handleClaim(event: Claim): void {
  log.info("RewardPool: handleClaim", []);
  // Update depositor params.
  const amounts = event.params.amounts;
  const poolIds = event.params.poolIds;
  for (let i = 0; i < amounts.length; i++) {
    const depositor = getDepositor(
      event.address.toHex(),
      event.params.acount.toHex(),
      poolIds[i]
    );
    depositor.totalClaimed = depositor.totalClaimed
      .plus(amounts[i]);
    depositor.save();
  }
}
