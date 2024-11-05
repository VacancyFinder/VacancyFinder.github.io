import type { AdapterFn } from "../types.js";
import { rootcode } from "./rootcode.js";
import { zillione } from "./zillione.js";

/** Site-specific adapters, selected by adapterConfig.kind. One file per site. */
export const CUSTOM: Record<string, AdapterFn> = { rootcode, zillione };
