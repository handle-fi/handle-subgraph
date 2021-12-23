import {Transform as TransformEvent} from "../types/Transformer/fxTransformer";
import { Transform } from "../types/schema"

const getTransform = (txHash: string): Transform => {
  let transform = Transform.load(txHash);
  if (transform != null)
    return transform as Transform;
  transform = new Transform(txHash);
  return transform as Transform;
};

export function handleTransform(event: TransformEvent): void {
  const transform = getTransform(event.transaction.hash.toHex());
  transform.account = event.params.account.toHex();
  transform.tokenIn = event.params.tokenIn.toHex();
  transform.tokenOut = event.params.tokenOut.toHex();
  transform.amountIn = event.params.amountIn;
  transform.amountOut = event.params.amountOut;
  transform.date = event.block.timestamp;
  transform.save();
}