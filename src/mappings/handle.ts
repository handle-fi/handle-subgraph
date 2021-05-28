import {
  UpdateCollateral as UpdateCollateralEvent,
  UpdateDebt as UpdateDebtEvent,
  ConfigureCollateralToken as ConfigureCollateralTokenEvent,
  ConfigureFxToken as ConfigureFxTokenEvent,
} from "../types/Handle/Handle";
import * as vault from "./handle/vault";
import * as tokens from "./handle/tokens";

export function handleDebtUpdate (event: UpdateDebtEvent): void {
  vault.handleDebtUpdate(event);
}

export function handleCollateralUpdate (event: UpdateCollateralEvent): void {
  vault.handleCollateralUpdate(event);
}

export function handleFxTokenConfiguration (event: ConfigureFxTokenEvent): void {
  tokens.handleFxTokenConfiguration(event);
}

export function handleCollateralTokenConfiguration (event: ConfigureCollateralTokenEvent): void {
  tokens.handleCollateralTokenConfiguration(event);
}
