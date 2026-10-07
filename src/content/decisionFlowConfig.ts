/**
 * DEC-TRACE §2 (docs/design/dec-trace.md, A4·A6; decision DTR-11): the money a decision sets going later. A decision's
 * target names the ledger categories its later postings fall in; the first posting in them after the decision (within
 * the thread's three years) is its consequence (`payment_flow`). An answer paid at once (a levy bought off, a nave
 * paid for) sets nothing going: what it paid shows on its card and in the ledger the day it was given.
 */
import type { PetitionResponse } from "./chapterConfig";
import type { LedgerCategory } from "../ledger/ledger.types";
import { BOROUGH_AUTONOMY_PETITION_ID } from "./legacyConfig";
import { LAND_REDISTRIBUTION_PETITION_ID, WAGES_PETITION_ID } from "./plagueConfig";
import { BOROUGH_CHARTER_PETITION_ID, CLOTH_OR_GRAIN_PETITION_ID, TAX_COLLECTION_PETITION_ID } from "./reorganisationConfig";
import { WALL_OR_MARKET_PETITION_ID, WAR_FUNDING_PETITION_ID, WOOL_PAYMENT_PETITION_ID } from "./warConfig";

/** The lord's own settings: the market dues are the stalls' fees; the war tax (the lay subsidy's seasons) its own line. */
export const TARGET_FLOWS: Readonly<Record<string, readonly LedgerCategory[]>> = {
  dues: ["stall_fee"],
  war_tax: ["war_tax"],
};

/** A chapter petition's answer → the ledger lines it sets going in the seasons after (`flow:<category>` targets). */
export const PETITION_FLOWS: Readonly<Record<string, Partial<Record<PetitionResponse, readonly LedgerCategory[]>>>> = {
  // WR-2: the wool in kind, season by season; WR-4: the merchants' loan repaid over eight seasons.
  [WOOL_PAYMENT_PETITION_ID]: { accept: ["wool_levy"] },
  [WAR_FUNDING_PETITION_ID]: { accept: ["war_loan"] },
  // WR-8: murage at the toll points; the market widened instead of the wall (its stalls' fees).
  [WALL_OR_MARKET_PETITION_ID]: { accept_with_price: ["murage"], refuse: ["stall_fee"] },
  // PL-5: the raised wages every ledger period (and the Statute's fine); PL-7: the settlers' entry fines as they come.
  [WAGES_PETITION_ID]: { accept: ["wages", "statute_fine"] },
  [LAND_REDISTRIBUTION_PETITION_ID]: { accept_with_price: ["entry_fine"] },
  // RG-6: the poll tax, gathered by the town or by the lord's men; RG-3: the cloth trade's tolls at the specialised price.
  [TAX_COLLECTION_PETITION_ID]: { accept: ["poll_tax"], refuse: ["poll_tax"] },
  [CLOTH_OR_GRAIN_PETITION_ID]: { accept: ["ulnage", "cloth_toll", "fulling_toll"] },
  // RG-9, LG-2: the town's fee farm each spring.
  [BOROUGH_CHARTER_PETITION_ID]: { accept: ["fee_farm"] },
  [BOROUGH_AUTONOMY_PETITION_ID]: { accept: ["fee_farm"] },
};

/** FC-2: the famine's answer → the season's relief bought and released, or the granaries' grain sold, while it lasts. */
export const FAMINE_FLOWS: Readonly<Record<string, readonly LedgerCategory[]>> = {
  relief: ["famine_relief"],
  speculation: ["famine_sale"],
};
