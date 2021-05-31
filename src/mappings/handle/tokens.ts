import { Address } from '@graphprotocol/graph-ts';
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
  entity.name = !nameCall.reverted ? nameCall.value : "";
  entity.totalBalance = handle.totalBalances(address);
  return entity;
};

const createFxTokenEntity = (address: Address): fxToken => {
  const entity = new fxToken(address.toHex());
  const token = ERC20.bind(address);
  let symbolCall = token.try_symbol();
  entity.symbol = !symbolCall.reverted ? symbolCall.value : "";
  let nameCall = token.try_name();
  entity.name = !nameCall.reverted ? nameCall.value : "";
  entity.totalSupply = token.totalSupply();
  return entity;
};

export function handleFxTokenConfiguration (event: ConfigureFxTokenEvent): void {
  const address = event.params.fxToken;
  // Load token entity.
  const entity = fxToken.load(address.toHex()) || createFxTokenEntity(address);
  // Set contract ata.
  const handle = Handle.bind(event.address);
  entity.rewardRatio = handle.getTokenDetails(address).rewardRatio;
  entity.isValid = handle.isFxTokenValid(address);
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
  entity.save();
}