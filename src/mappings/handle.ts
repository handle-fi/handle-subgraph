import {
  UpdateCollateral as UpdateCollateralEvent,
  UpdateDebt as UpdateDebtEvent,
} from "../types/Handle/Handle";
import * as vault from "./handle/vault";

export function handleDebtUpdate (event: UpdateDebtEvent): void {
  vault.handleDebtUpdate(event);
}

export function handleCollateralUpdate (event: UpdateCollateralEvent): void {
  vault.handleCollateralUpdate(event);
}
