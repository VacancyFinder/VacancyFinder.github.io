import type { AdapterFn } from "../types.js";
import { flatrock, fortude, oracleHcm, peopleshr, rooster, simplifiedhr } from "./platforms.js";
import { rootcode } from "./rootcode.js";
import { zillione } from "./zillione.js";

/** Site- and platform-specific adapters, selected by adapterConfig.kind. */
export const CUSTOM: Record<string, AdapterFn> = {
  rootcode,
  zillione,
  peopleshr,
  simplifiedhr,
  "oracle-hcm": oracleHcm,
  rooster,
  flatrock,
  fortude,
};
