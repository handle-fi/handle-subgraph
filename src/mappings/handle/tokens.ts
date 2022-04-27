import {Address, BigInt} from '@graphprotocol/graph-ts';
import {
  ConfigureFxToken as ConfigureFxTokenEvent,
  ConfigureCollateralToken as ConfigureCollateralTokenEvent, Handle
} from "../../types/Handle/Handle";
import {CollateralToken, fxToken, TokenRegistry} from "../../types/schema";
import { ERC20 } from "../../types/Handle/ERC20";

const getCreateTokenRegistry = (handle: Address): TokenRegistry => {
  let registry = TokenRegistry.load((handle.toHex()))
  if (registry == null) {
    registry = new TokenRegistry(handle.toHex());
    registry.fxTokens = [];
    registry.collateralTokens = [];
  }
  return registry as TokenRegistry;
};

const createCollateralTokenEntity = (address: Address): CollateralToken => {
  const entity = new CollateralToken(address.toHex());
  const token = ERC20.bind(address);
  let symbolCall = token.try_symbol();
  entity.symbol = !symbolCall.reverted ? symbolCall.value : "";
  let nameCall = token.try_name();
  entity.name = !nameCall.reverted ? nameCall.value : ""
  entity.decimals = token.decimals();
  entity.rate = BigInt.fromI32(0);
  return entity;
};

const createFxTokenEntity = (address: Address): fxToken => {
  const entity = new fxToken(address.toHex());
  const token = ERC20.bind(address);
  let symbolCall = token.try_symbol();
  entity.symbol = !symbolCall.reverted ? symbolCall.value : "";
  entity.decimals = token.decimals();
  let nameCall = token.try_name();
  entity.name = !nameCall.reverted ? nameCall.value : "";
  entity.rate = BigInt.fromI32(0);
  return entity;
};

export function handleFxTokenConfiguration (event: ConfigureFxTokenEvent): void {
  const address = event.params.fxToken;
  // Load token entity.
  const entity = fxToken.load(address.toHex()) || createFxTokenEntity(address);
  // Set contract data.
  entity.isValid = !event.params.removed;
  entity.save();
  // Update token registry for fxToken.
  const tokenRegistry = getCreateTokenRegistry(event.address);
  const fxArray = tokenRegistry.fxTokens;
  if (!fxArray.includes(address.toHex())) {
    fxArray.push(address.toHex());
    tokenRegistry.fxTokens = fxArray;
    tokenRegistry.save();
  }
}

export function handleCollateralTokenConfiguration (event: ConfigureCollateralTokenEvent): void {
  const address = event.params.collateralToken;
  const handle = Handle.bind(event.address);
  // Load token entity.
  const entity = CollateralToken.load(address.toHex()) || createCollateralTokenEntity(address);
  // Set contract data.
  const collateralDetails = handle.getCollateralDetails(address);
  entity.liquidationFee = collateralDetails.liquidationFee;
  entity.mintCollateralRatio = collateralDetails.mintCR;
  entity.interestRate = collateralDetails.interestRate;
  entity.save();
  // Update token registry for collateral token.
  const tokenRegistry = getCreateTokenRegistry(event.address);
  const collateralArray = tokenRegistry.collateralTokens;
  if (!collateralArray.includes(address.toHex())) {
    collateralArray.push(address.toHex());
    tokenRegistry.collateralTokens = collateralArray;
    tokenRegistry.save();
  }
}