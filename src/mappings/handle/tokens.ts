import {Address, BigInt} from '@graphprotocol/graph-ts';
import {
  Handle,
  ConfigureFxToken as ConfigureFxTokenEvent,
  ConfigureCollateralToken as ConfigureCollateralTokenEvent
} from "../../types/Handle/Handle";
import { CollateralToken, fxToken } from "../../types/schema";
import { ERC20 } from "../../types/Handle/ERC20";

const createCollateralTokenEntity = (address: Address, handle: Handle): CollateralToken => {
  const entity = new CollateralToken(address.toHex());
  const token = ERC20.bind(address);
  let symbolCall = token.try_symbol();
  entity.symbol = !symbolCall.reverted ? symbolCall.value : "";
  let nameCall = token.try_name();
  entity.name = !nameCall.reverted ? nameCall.value : ""
  entity.decimals = token.decimals();
  // Set initial rate to 1 wei to prevent division by zero errors.
  entity.rate = BigInt.fromString("1");
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
  // Set initial rate to 1 wei to prevent division by zero errors.
  entity.rate = BigInt.fromString("1");
  return entity;
};

export function handleFxTokenConfiguration (event: ConfigureFxTokenEvent): void {
  const address = event.params.fxToken;
  // Load token entity.
  const entity = fxToken.load(address.toHex()) || createFxTokenEntity(address);
  // Set contract ata.
  const handle = Handle.bind(event.address);
  entity.isValid = handle.isFxTokenValid(address);
  entity.totalSupply = ERC20.bind(address).totalSupply();
  entity.save();
}

export function handleCollateralTokenConfiguration (event: ConfigureCollateralTokenEvent): void {
  const address = event.params.collateralToken;
  const handle = Handle.bind(event.address);
  // Load token entity.
  const entity = CollateralToken.load(address.toHex()) || createCollateralTokenEntity(address, handle);
  // Set contract data.
  const collateralDetails = handle.getCollateralDetails(address);
  entity.liquidationFee = collateralDetails.liquidationFee;
  entity.mintCollateralRatio = collateralDetails.mintCR;
  entity.isValid = handle.isCollateralValid(address);
  entity.interestRate = handle.getCollateralDetails(address).interestRate;
  entity.totalBalance = handle.totalBalances(address);
  entity.save();
}