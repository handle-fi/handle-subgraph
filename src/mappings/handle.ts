import {
  UpdateCollateral as UpdateCollateralEvent,
  UpdateDebt as UpdateDebtEvent,
  ConfigureCollateralToken as ConfigureCollateralTokenEvent,
  ConfigureFxToken as ConfigureFxTokenEvent,
} from "../types/Handle/Handle";
import * as vault from "./handle/vault";
import * as tokens from "./handle/tokens";
import { log } from '@graphprotocol/graph-ts'

export function handleDebtUpdate (event: UpdateDebtEvent): void {
  log.info("handleDebtUpdate", []);
  vault.handleDebtUpdate(event);
}

export function handleCollateralUpdate (event: UpdateCollateralEvent): void {
  log.info("handleCollateralUpdate", []);
  vault.handleCollateralUpdate(event);
}

export function handleFxTokenConfiguration (event: ConfigureFxTokenEvent): void {
  log.info("handleFxTokenConfiguration", []);
  tokens.handleFxTokenConfiguration(event);
}

export function handleCollateralTokenConfiguration (event: ConfigureCollateralTokenEvent): void {
  log.info("handleCollateralTokenConfiguration", []);
  tokens.handleCollateralTokenConfiguration(event);
}
