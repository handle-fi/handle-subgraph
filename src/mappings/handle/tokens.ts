import {Address, BigInt} from '@graphprotocol/graph-ts';
import {
  Handle,
  ConfigureFxToken as ConfigureFxTokenEvent,
  ConfigureCollateralToken as ConfigureCollateralTokenEvent
} from "../../types/Handle/Handle";
import {
  Handle as ETH_USD_Handle
} from "../../types/ETH_USD/Handle";
import {CollateralToken, fxToken, TokenRegistry} from "../../types/schema";
import { ERC20 } from "../../types/Handle/ERC20";
import { updateTokenPrices } from "../oracle";
import { getTokens } from "../oracleAddresses";
import {oneEth} from "../../utils";

const getCreateTokenRegistry = (handle: Address): TokenRegistry => {
  let registry = TokenRegistry.load((handle.toHex()))
  if (registry == null) {
    registry = new TokenRegistry(handle.toHex());
    registry.fxTokens = [];
    registry.collateralTokens = [];
  }
  return registry as TokenRegistry;
};

const createCollateralTokenEntity = (address: Address, handle: Handle): CollateralToken => {
  const entity = new CollateralToken(address.toHex());
  const token = ERC20.bind(address);
  let symbolCall = token.try_symbol();
  entity.symbol = !symbolCall.reverted ? symbolCall.value : "";
  let nameCall = token.try_name();
  entity.name = !nameCall.reverted ? nameCall.value : ""
  entity.decimals = token.decimals();
  // Set initial rate to 1 ether if tx reverts to prevent division by zero errors.
  const tryTokenRate = handle.try_getTokenPrice(address);
  entity.rate = !tryTokenRate.reverted
    ? tryTokenRate.value
    : oneEth;
  return entity;
};

const createFxTokenEntity = (address: Address, handle: Handle): fxToken => {
  const entity = new fxToken(address.toHex());
  const token = ERC20.bind(address);
  let symbolCall = token.try_symbol();
  entity.symbol = !symbolCall.reverted ? symbolCall.value : "";
  entity.decimals = token.decimals();
  let nameCall = token.try_name();
  entity.name = !nameCall.reverted ? nameCall.value : "";
  // Set initial rate to 1 ether if tx reverts to prevent division by zero errors.
  const tryTokenRate = handle.try_getTokenPrice(address);
  entity.rate = !tryTokenRate.reverted
    ? tryTokenRate.value
    : oneEth;
  return entity;
};

export function handleFxTokenConfiguration (event: ConfigureFxTokenEvent): void {
  const address = event.params.fxToken;
  const handle = Handle.bind(event.address);
  // Load token entity.
  const entity = fxToken.load(address.toHex()) || createFxTokenEntity(address, handle);
  // Set contract ata.
  entity.isValid = handle.isFxTokenValid(address);
  entity.totalSupply = ERC20.bind(address).totalSupply();
  entity.save();
  // Update token registry for fxToken.
  const tokenRegistry = getCreateTokenRegistry(event.address);
  const fxArray = tokenRegistry.fxTokens;
  if (!fxArray.includes(address.toHex())) {
    fxArray.push(address.toHex());
    tokenRegistry.fxTokens = fxArray;
    tokenRegistry.save();
  }
  // Also update token price.
  updateTokenPrices(
    [address.toHex()],
    ETH_USD_Handle.bind(event.address)
  );
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
  // Update token registry for collateral token.
  const tokenRegistry = getCreateTokenRegistry(event.address);
  const collateralArray = tokenRegistry.collateralTokens;
  if (!collateralArray.includes(address.toHex())) {
    collateralArray.push(address.toHex());
    tokenRegistry.collateralTokens = collateralArray;
    tokenRegistry.save();
  }
  // Also update all token prices.
  // This is done to ensure everything is correctly set up.
  updateTokenPrices(
    getTokens(),
    ETH_USD_Handle.bind(event.address)
  );
}