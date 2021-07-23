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
import {updateTokenPrices} from "../oracle";
import {getTokens} from "../oracleAddresses";

const oneEth = BigInt.fromString("1000000000000000000");

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
  // Set initial rate to 1 ether to prevent division by zero errors.
  entity.rate = oneEth;
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
  // Set initial rate to 1 ether to prevent division by zero errors.
  entity.rate = oneEth;
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
    ETH_USD_Handle.bind(address)
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
  // Also update token price.
  updateTokenPrices(
    [address.toHex()],
    ETH_USD_Handle.bind(address)
  );
}