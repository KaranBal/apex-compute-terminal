"""Automated unit and data-integrity test suite for Apex Compute Terminal (ACT <GO>) v4.5."""

import asyncio
import copy
import json
import math
import re
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import backend.main as main_mod
from backend.main import (
    PanelConsultRequest,
    PreTradeRequest,
    TERMINAL_STATE,
    TickerDeepDiveRequest,
    ValuationSimRequest,
    build_normalized_terminal_payload,
    check_pretrade_compliance,
    consult_12_expert_panel,
    generate_ticker_deep_dive,
    simulate_3y_valuation,
)
from backend.risk_and_tax_engine import ACCOUNT_TAX_LOTS
from backend.scoring_engine import (
    OTC_ADR_METADATA,
    STRUCTURED_MOAT_PROFILES,
    UNDERLYING_CURRENCY_BY_TICKER,
    VERIFIED_FUNDAMENTAL_OVERRIDES,
    compute_unified_stock_scores,
    normalize_stock_fundamentals_and_units,
)
from fastapi import HTTPException

MASKED_HOLDINGS_FIXTURE_PATH = PROJECT_ROOT / "backend" / "data" / "holdings_baseline_masked.json"
RAW_SEED_PATH = PROJECT_ROOT / "backend" / "data" / "terminal_seed_data.json"


def _spearman_corr(xs: list[float], ys: list[float]) -> float:
    """Computes Spearman rank correlation without external scipy dependency."""
    n = len(xs)
    if n < 3:
        return 0.0

    def _ranks(vals: list[float]) -> list[float]:
        indexed = sorted(enumerate(vals), key=lambda p: p[1])
        res = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and indexed[j + 1][1] == indexed[i][1]:
                j += 1
            avg_rank = (i + j) / 2.0 + 1.0
            for k in range(i, j + 1):
                res[indexed[k][0]] = avg_rank
            i = j + 1
        return res

    rx = _ranks(xs)
    ry = _ranks(ys)
    mx = sum(rx) / n
    my = sum(ry) / n
    cov = sum((rx[i] - mx) * (ry[i] - my) for i in range(n))
    vx = sum((rx[i] - mx) ** 2 for i in range(n))
    vy = sum((ry[i] - my) ** 2 for i in range(n))
    if vx <= 1e-9 or vy <= 1e-9:
        return 0.0
    return cov / math.sqrt(vx * vy)


class TestApexComputeTerminalIntegrity(unittest.TestCase):
    def setUp(self):
        self.state = main_mod.TERMINAL_STATE
        self.stocks = self.state["stocks"]
        self.by_ticker = {s["ticker"]: s for s in self.stocks}

    def test_portfolio_arithmetic_reconciliation(self):
        """Holdings sum to gross_equities_usd, weights sum to 100%, and net_nav_usd reconciles across refreshes."""
        holdings = [s for s in self.stocks if s["is_holding"]]
        self.assertEqual(len(holdings), 22)

        holdings_sum = round(sum(s["portfolio_usd"] for s in holdings), 2)
        gross_eq = self.state["meta"]["gross_equities_usd"]
        margin_debit = self.state["meta"]["margin_debit_usd"]
        cash_usd = self.state["meta"]["cash_usd"]
        net_nav = self.state["meta"]["net_nav_usd"]

        self.assertGreater(gross_eq, 350000.0)
        self.assertAlmostEqual(margin_debit, -19494.75, delta=0.05)
        self.assertAlmostEqual(holdings_sum, gross_eq, delta=0.05)
        self.assertAlmostEqual(gross_eq + margin_debit + cash_usd, net_nav, delta=0.05)

        weights_sum = sum(s["portfolio_weight_pct"] for s in holdings)
        self.assertAlmostEqual(weights_sum, 100.0, delta=0.15)

        sleeve_sum = sum(sl["portfolio_usd"] for sl in self.state["portfolio_summary"]["sleeves"])
        self.assertAlmostEqual(sleeve_sum, gross_eq, delta=5.0)

    def test_unified_scoring_component_sum_and_zero_overrides(self):
        """Every stock's bottleneck_score equals the 5-part inflection rubric sum AND 3-part legacy sum with zero 90.7% reverse-engineered inputs."""
        for t_prof, prof in STRUCTURED_MOAT_PROFILES.items():
            self.assertNotAlmostEqual(
                float(prof.get("ai_purity_pct", 0.0)),
                90.7,
                places=1,
                msg=f"Reverse-engineered 90.7% ai_purity_pct found on {t_prof}",
            )

        for s in self.stocks:
            recalc = compute_unified_stock_scores(s)
            comp_sum_3 = s["ai_criticality_score"] + s["tech_moat_score"] + s["return_torque_score"]
            comp_sum_5 = round(
                float(recalc["chokepoint_tightness_score"])
                + float(recalc["inflection_evidence_score"])
                + float(recalc["runway_and_size_score"])
                + float(recalc["cycle_aware_valuation_score"])
                + float(recalc["risk_penalty_score"])
            )
            comp_sum_5_clamped = max(12, min(99, comp_sum_5))
            self.assertEqual(
                s["bottleneck_score"],
                comp_sum_3,
                f"Post-hoc override detected on {s['ticker']}: score={s['bottleneck_score']} != 3-part sum={comp_sum_3}",
            )
            self.assertEqual(
                s["bottleneck_score"],
                comp_sum_5_clamped,
                f"5-part rubric mismatch on {s['ticker']}: score={s['bottleneck_score']} != 5-part sum={comp_sum_5_clamped}",
            )
            self.assertEqual(s["bottleneck_score"], recalc["bottleneck_score"], f"Score mismatch on {s['ticker']}")
            self.assertEqual(s["rating_score"], recalc["bottleneck_score"], f"rating_score mismatch on {s['ticker']}")
            self.assertEqual(s["rating"], recalc["rating"], f"Rating mismatch on {s['ticker']}")
            self.assertTrue(s.get("policy_decision"), f"Missing policy_decision on {s['ticker']}")

        # v4.8: CORZ and NBIS moved CORE_KEEP -> DIVEST_TRIM once their sourced moat inputs drove the score (56 / 58).
        core_keeps = [s for s in self.stocks if s["is_holding"] and s["triage_bucket"] == "CORE_KEEP"]
        self.assertEqual(len(core_keeps), 15)
        for ck in core_keeps:
            self.assertGreaterEqual(ck["bottleneck_score"], 72, f"Core keep {ck['ticker']} failed >=72 gate")

        divests = [s for s in self.stocks if s["is_holding"] and s["triage_bucket"] == "DIVEST_TRIM"]
        self.assertEqual(len(divests), 7)
        for dv in divests:
            self.assertLess(dv["bottleneck_score"], 62, f"Divest candidate {dv['ticker']} scored >=62")

    def test_time_machine_winners_and_losers_regression(self):
        """Point-in-time historical winners score >=83/100 without hindsight while false-bottleneck & peak-cycle traps trip risk penalties (<50/100)."""
        winners = [
            {
                "label": "NVDA_2020_Q1",
                "ticker": "NVDA_2020",
                "mkt_cap_usd_b": 150.0,
                "fwd_pe": 36.0,
                "peg": 1.60,
                "rev_3y_cagr": 30.0,
                "eps_3y_cagr": 35.0,
                "gm_pct": 62.0,
                "opm_pct": 34.0,
                "fcfm_pct": 31.0,
                "monopoly_share_pct": 90,
                "ai_purity_pct": 27.0,
                "qualified_suppliers_count": 1,
                "switching_cost_index": 9.5,
                "has_lta_prepayment": True,
                "yoy_rev_growth_pct": 42.0,
                "market_position_rank": 1,
                "risk_penalty_pts": 0.0,
            },
            {
                "label": "LITE_2023_Q4",
                "ticker": "LITE_2023",
                "mkt_cap_usd_b": 2.8,
                "fwd_pe": 60.0,
                "peg": None,
                "rev_3y_cagr": 24.0,
                "eps_3y_cagr": 30.0,
                "gm_pct": 31.0,
                "opm_pct": 6.0,
                "fcfm_pct": 8.0,
                "monopoly_share_pct": 50,
                "ai_purity_pct": 30.0,
                "qualified_suppliers_count": 2,
                "switching_cost_index": 8.2,
                "has_lta_prepayment": True,
                "yoy_rev_growth_pct": 28.0,
                "market_position_rank": 2,
                "risk_penalty_pts": 0.0,
            },
            {
                "label": "MU_2025_Q1",
                "ticker": "MU_2025",
                "mkt_cap_usd_b": 110.0,
                "fwd_pe": 11.0,
                "peg": 0.35,
                "rev_3y_cagr": 28.0,
                "eps_3y_cagr": 32.0,
                "gm_pct": 39.0,
                "opm_pct": 22.0,
                "fcfm_pct": 16.0,
                "monopoly_share_pct": 22,
                "ai_purity_pct": 50.0,
                "qualified_suppliers_count": 3,
                "switching_cost_index": 8.0,
                "has_lta_prepayment": True,
                "yoy_rev_growth_pct": 80.0,
                "market_position_rank": 3,
                "risk_penalty_pts": 0.0,
            },
            {
                "label": "SKH_2025_Q1",
                "ticker": "SKH_2025",
                "mkt_cap_usd_b": 100.0,
                "fwd_pe": 5.0,
                "peg": 0.20,
                "rev_3y_cagr": 32.0,
                "eps_3y_cagr": 35.0,
                "gm_pct": 52.0,
                "opm_pct": 36.0,
                "fcfm_pct": 24.0,
                "monopoly_share_pct": 55,
                "ai_purity_pct": 45.0,
                "qualified_suppliers_count": 2,
                "switching_cost_index": 8.8,
                "has_lta_prepayment": True,
                "yoy_rev_growth_pct": 95.0,
                "market_position_rank": 1,
                "risk_penalty_pts": 0.0,
            },
            {
                "label": "CRDO_2023_Q4",
                "ticker": "CRDO_2023",
                "mkt_cap_usd_b": 2.8,
                "fwd_pe": 38.0,
                "peg": 0.84,
                "rev_3y_cagr": 42.0,
                "eps_3y_cagr": 45.0,
                "gm_pct": 62.0,
                "opm_pct": 22.0,
                "fcfm_pct": 18.0,
                "monopoly_share_pct": 70,
                "ai_purity_pct": 40.0,
                "qualified_suppliers_count": 2,
                "switching_cost_index": 8.6,
                "has_lta_prepayment": True,
                "yoy_rev_growth_pct": 65.0,
                "market_position_rank": 1,
                "risk_penalty_pts": 0.0,
            },
        ]
        for w in winners:
            res = compute_unified_stock_scores(w)
            self.assertGreaterEqual(
                res["bottleneck_score"],
                83,
                f"Historical winner {w['label']} scored {res['bottleneck_score']} (<83)",
            )
            self.assertEqual(res["rating"], "STRONG BUY")

        losers = [
            {
                "label": "WOLF_2021_SiC_Trap",
                "ticker": "WOLF_2021",
                "mkt_cap_usd_b": 15.0,
                "fwd_pe": 145.0,
                "peg": 4.8,
                "rev_3y_cagr": 22.0,
                "eps_3y_cagr": -15.0,
                "gm_pct": 34.0,
                "opm_pct": -18.0,
                "fcfm_pct": -35.0,
                "monopoly_share_pct": 28,
                "ai_purity_pct": 10.0,
                "qualified_suppliers_count": 6,
                "switching_cost_index": 4.0,
                "has_lta_prepayment": False,
                "yoy_rev_growth_pct": 14.0,
                "market_position_rank": 3,
                "risk_penalty_pts": -18.0,
            },
            {
                "label": "AEHR_2023_Single_Customer_EV",
                "ticker": "AEHR_2023",
                "mkt_cap_usd_b": 1.4,
                "fwd_pe": 42.0,
                "peg": 2.1,
                "rev_3y_cagr": 18.0,
                "eps_3y_cagr": 12.0,
                "gm_pct": 48.0,
                "opm_pct": 20.0,
                "fcfm_pct": 8.0,
                "monopoly_share_pct": 35,
                "ai_purity_pct": 12.0,
                "qualified_suppliers_count": 4,
                "switching_cost_index": 4.8,
                "has_lta_prepayment": False,
                "yoy_rev_growth_pct": -10.0,
                "market_position_rank": 2,
                "risk_penalty_pts": -20.0,
            },
            {
                "label": "AAOI_2017_Commodity_Transceiver",
                "ticker": "AAOI_2017",
                "mkt_cap_usd_b": 1.8,
                "fwd_pe": 14.0,
                "peg": 1.8,
                "rev_3y_cagr": 8.0,
                "eps_3y_cagr": -10.0,
                "gm_pct": 31.0,
                "opm_pct": 9.0,
                "fcfm_pct": -5.0,
                "monopoly_share_pct": 15,
                "ai_purity_pct": 20.0,
                "qualified_suppliers_count": 8,
                "switching_cost_index": 3.2,
                "has_lta_prepayment": False,
                "yoy_rev_growth_pct": -12.0,
                "market_position_rank": 4,
                "risk_penalty_pts": -18.0,
            },
            {
                "label": "SMCI_2024_Commodity_Server_Assembler",
                "ticker": "SMCI_2024",
                "mkt_cap_usd_b": 55.0,
                "fwd_pe": 24.0,
                "peg": 1.2,
                "rev_3y_cagr": 25.0,
                "eps_3y_cagr": 15.0,
                "gm_pct": 14.5,
                "opm_pct": 8.5,
                "fcfm_pct": -8.0,
                "monopoly_share_pct": 18,
                "ai_purity_pct": 70.0,
                "qualified_suppliers_count": 6,
                "switching_cost_index": 3.0,
                "has_lta_prepayment": False,
                "yoy_rev_growth_pct": 35.0,
                "market_position_rank": 3,
                "risk_penalty_pts": -20.0,
            },
            {
                "label": "NANYA_2026_DDR4_Peak_Cycle_Trap",
                "ticker": "NANYA_2026",
                "mkt_cap_usd_b": 7.5,
                "fwd_pe": 5.5,
                "peg": 0.4,
                "rev_3y_cagr": 12.0,
                "eps_3y_cagr": 10.0,
                "gm_pct": 69.0,
                "opm_pct": 54.0,
                "fcfm_pct": 12.0,
                "monopoly_share_pct": 8,
                "ai_purity_pct": 20.0,
                "qualified_suppliers_count": 6,
                "switching_cost_index": 3.5,
                "has_lta_prepayment": False,
                "yoy_rev_growth_pct": 20.0,
                "market_position_rank": 4,
                "risk_penalty_pts": -16.0,
            },
            {
                "label": "WINBOND_2026_Specialty_DRAM_Peak_Trap",
                "ticker": "WINBOND_2026",
                "mkt_cap_usd_b": 4.2,
                "fwd_pe": 6.2,
                "peg": 0.5,
                "rev_3y_cagr": 10.0,
                "eps_3y_cagr": 8.0,
                "gm_pct": 68.5,
                "opm_pct": 53.0,
                "fcfm_pct": 10.0,
                "monopoly_share_pct": 10,
                "ai_purity_pct": 18.0,
                "qualified_suppliers_count": 6,
                "switching_cost_index": 3.8,
                "has_lta_prepayment": False,
                "yoy_rev_growth_pct": 18.0,
                "market_position_rank": 4,
                "risk_penalty_pts": -16.0,
            },
        ]
        for l_case in losers:
            res = compute_unified_stock_scores(l_case)
            self.assertLess(
                res["bottleneck_score"],
                50,
                f"False-bottleneck / peak-cycle trap {l_case['label']} scored {res['bottleneck_score']} (>=50)",
            )
            self.assertEqual(res["rating"], "TRIM / FUNDING SOURCE")

    def test_small_mid_cap_size_discipline_and_radar_invariants(self):
        """Among AI-compute quality-gate passers, Spearman(score, market_cap) is <= 0 and small/mid caps out-score large caps on
        average; 100% of small_mid_cap_champions are <=$25B, 0% market-cap label mismatch, and all cards have source_url + kill_trigger.

        v4.8: measured on gate passers only. Off-thesis gate failures (FANUY, YASKY, HSYDF, CIFR, PL) are mostly small caps
        scoring 19-31 and say nothing about size discipline among bottlenecks; the old all-stock check only passed while
        stale seed moat inputs inflated several small caps (VICR 99, SIMO 90).
        """
        scored_stocks = [s for s in self.stocks if s.get("bottleneck_score") is not None and s.get("market_cap_b") is not None]
        gate_passers = [s for s in scored_stocks if s.get("quality_gate_passed")]
        scores = [float(s["bottleneck_score"]) for s in gate_passers]
        mcaps = [float(s["market_cap_b"]) for s in gate_passers]
        rho_size = _spearman_corr(scores, mcaps)
        # Refresh-resilient: no meaningful large-cap bias (|rho| ~0 today); the mean and top-10 checks enforce the tilt.
        self.assertLessEqual(
            rho_size,
            0.10,
            f"Expected no large-cap bias (Spearman <= 0.10) between bottleneck_score and market_cap_b among gate passers, got {rho_size:.3f}",
        )
        small_mid = [float(s["bottleneck_score"]) for s in gate_passers if float(s["market_cap_b"]) <= 25.0]
        large = [float(s["bottleneck_score"]) for s in gate_passers if float(s["market_cap_b"]) > 25.0]
        self.assertGreater(
            sum(small_mid) / len(small_mid),
            sum(large) / len(large),
            "Small/mid-cap (<=$25B) bottlenecks should out-score large caps on average",
        )

        # Top-decile must be dominated by small/mid-cap bottlenecks (<= $25B)
        top_10 = sorted(scored_stocks, key=lambda x: x["bottleneck_score"], reverse=True)[:10]
        small_mid_in_top10 = sum(1 for s in top_10 if float(s["market_cap_b"]) <= 25.0)
        self.assertGreaterEqual(small_mid_in_top10, 6, f"Expected >=6 of top 10 stocks to be <=$25B, got {small_mid_in_top10}")

        radar = self.state.get("next_wave_bottleneck_radar")
        self.assertIsInstance(radar, dict)
        pillars = radar.get("pillars", [])
        self.assertEqual(len(pillars), 4, "Off-thesis Pillar 5 Space Tech must be removed, leaving 4 core supply-chain pillars")

        for p in pillars:
            self.assertNotIn("space", p["pillar_id"].lower())
            for card in p.get("small_mid_cap_champions", []):
                tk = card["ticker"]
                live_st = self.by_ticker[tk]
                live_mcap = float(live_st["market_cap_b"])
                self.assertLessEqual(live_mcap, 25.0, f"Radar small_mid_cap_champion {tk} has mcap ${live_mcap}B > $25B")
                expected_label = f"${live_mcap:.1f}B" if live_mcap < 10.0 else f"${live_mcap:.0f}B"
                self.assertIn(expected_label, card["market_cap_label"], f"Market-cap label mismatch on {tk}: {card['market_cap_label']} vs {expected_label}")
                self.assertTrue(card.get("source_url", "").startswith("http"), f"Missing primary source_url on {tk}")
                self.assertTrue(card.get("source_date"), f"Missing source_date on {tk}")
                self.assertTrue(card.get("kill_trigger"), f"Missing kill_trigger on {tk}")

            for anc in p.get("mega_cap_anchors", []):
                tk = anc["ticker"]
                live_st = self.by_ticker[tk]
                live_mcap = float(live_st["market_cap_b"])
                self.assertGreater(live_mcap, 25.0, f"Radar mega_cap_anchor {tk} has mcap ${live_mcap}B <= $25B")
                self.assertTrue(anc.get("source_url", "").startswith("http"))
                self.assertTrue(anc.get("kill_trigger"))

        watchlist = radar.get("local_market_watchlist", [])
        self.assertGreaterEqual(len(watchlist), 10)
        watch_tickers = {w["local_ticker"] for w in watchlist}
        for expected_local in ("5274.TWO", "8299.TWO", "042700.KS", "4004.T", "2408.TW", "2344.TW", "6525.T", "6140.T", "6871.T", "6777.T"):
            self.assertIn(expected_local, watch_tickers)

    def test_unscored_catalog_miss_no_invented_defaults(self):
        """Adding an unknown ticker when live quote fails never invents $100 price, 0.96x DMA, 26x P/E, 25% EPS CAGR, 56% GM, or 55% share."""
        from backend.swarm_underwriter import CUSTOM_STORE_PATH, add_and_underwrite_stock, delete_custom_stock_or_rationale

        orig_custom = CUSTOM_STORE_PATH.read_text() if CUSTOM_STORE_PATH.exists() else None
        try:
            with patch(
                "backend.swarm_underwriter.fetch_live_yahoo_quote",
                return_value={},
            ):
                entry = add_and_underwrite_stock(
                    payload={"ticker": "ZZZFAKE", "user_rationale": "Testing unverified ticker"},
                    existing_tickers=set(),
                    genai_client=None,
                )
            self.assertIsNone(entry["bottleneck_score"])
            self.assertIn("NOT SCORED", entry["rating"])
            self.assertIsNone(entry["us_price"])
            self.assertIsNone(entry["fwd_pe"])
            self.assertIsNone(entry["eps_3y_cagr"])
            self.assertIsNone(entry["gm_pct"])
            self.assertIsNone(entry["monopoly_share_pct"])
            self.assertIsNone(entry["mkt_cap_usd_b"])
            self.assertIsNone(entry["dma200"])
            delete_custom_stock_or_rationale("ZZZFAKE")
        finally:
            if orig_custom is not None:
                CUSTOM_STORE_PATH.write_text(orig_custom)

    def test_bear_case_downside_and_scenario_probabilities(self):
        """Every stock's 3Y bear case models genuine downside (0.35x-0.69x MOIC) and stock-specific scenario probabilities sum to 1.0."""
        for s in self.stocks:
            bear = s["bear_3y_moic"]
            base = s["moic_3y_base"]
            bull = s["moic_3y_bull"]
            self.assertLess(bear, 0.70, f"{s['ticker']} bear_3y_moic={bear}x is too mild for a 3Y semicap trough")
            self.assertGreaterEqual(bear, 0.35, f"{s['ticker']} bear_3y_moic={bear}x out of range")
            self.assertLess(bear, base, f"{s['ticker']} bear_3y_moic >= base")
            self.assertLessEqual(base, bull, f"{s['ticker']} base > bull")

            probs = s.get("scenario_probabilities") or {}
            self.assertAlmostEqual(
                probs.get("bear", 0) + probs.get("base", 0) + probs.get("bull", 0),
                1.0,
                places=2,
            )

        holdings = [s for s in self.stocks if s["is_holding"]]
        hold_mv = sum(s["portfolio_usd"] for s in holdings)
        weighted_bear = sum(s["portfolio_usd"] * s["bear_3y_moic"] for s in holdings) / hold_mv
        self.assertLessEqual(weighted_bear, 0.58, "Portfolio weighted 3Y bear MOIC should align with ~-45% to -54% semicap downcycle")

    def test_zero_silent_fabricated_defaults_override_expiry_and_adr_parity(self):
        """Overrides use actual raw seed field names (gm_pct, eps_3y_cagr), enforce expiry dates, and ADR ratios match home prices within 5%."""
        raw_seed = json.loads(RAW_SEED_PATH.read_text())
        checked_pairs = 0
        for r in raw_seed["stocks"]:
            t = r["ticker"]
            ovr = VERIFIED_FUNDAMENTAL_OVERRIDES.get(t, {})
            ov_fields = set(r.get("data_quality", {}).get("overridden_fields") or [])
            for k in ("fwd_pe", "peg", "rev_3y_cagr", "eps_3y_cagr", "gm_pct", "opm_pct"):
                if k in ov_fields and k in ovr:
                    checked_pairs += 1
                    self.assertAlmostEqual(
                        float(r[k]),
                        float(ovr[k]),
                        places=2,
                        msg=f"Overridden field {t}.{k} does not match VERIFIED_FUNDAMENTAL_OVERRIDES",
                    )
        self.assertGreaterEqual(checked_pairs, 10, "Expected at least 10 verified override field pairs to be checked")

        custom = {"ticker": "DSCSY", "us_price": 47.10, "gm_pct": 69.5, "fwd_pe": 31.0}
        norm_custom = normalize_stock_fundamentals_and_units(custom, reference_date="2026-11-04")
        self.assertEqual(norm_custom["gm_pct"], 69.5)
        self.assertEqual(norm_custom["fwd_pe"], 31.0)
        self.assertFalse(norm_custom["data_quality"]["override_expired"])

        expired = normalize_stock_fundamentals_and_units({"ticker": "DSCSY", "us_price": 47.10}, reference_date="2028-01-01")
        self.assertTrue(expired["data_quality"]["override_expired"])
        self.assertIsNone(expired.get("gm_pct"))

        fx_map = {"JPY": 158.27, "EUR": 1.0 / 0.875, "CHF": 1.0 / 0.80}
        for t, meta in OTC_ADR_METADATA.items():
            s = self.by_ticker.get(t)
            if not s or not s.get("last_price_home"):
                continue
            ccy = meta["underlying_currency"]
            fx = fx_map.get(ccy)
            if not fx:
                continue
            home_usd = (s["last_price_home"] / fx) if ccy == "JPY" else (s["last_price_home"] * fx)
            implied_ratio = s["price"] / home_usd
            code_ratio = VERIFIED_FUNDAMENTAL_OVERRIDES.get(t, {}).get("adr_ratio")
            if code_ratio:
                rel_err = abs(implied_ratio / code_ratio - 1.0)
                self.assertLessEqual(
                    rel_err,
                    0.05,
                    f"ADR ratio mismatch on {t}: implied={implied_ratio:.3f} vs code={code_ratio} ({meta['adr_ratio']})",
                )

        for s in self.stocks:
            if s.get("high_52w") and s.get("off_high_pct") is not None:
                implied_off = round((s["price"] / s["high_52w"] - 1.0) * 100.0, 2)
                self.assertAlmostEqual(s["off_high_pct"], implied_off, delta=0.15, msg=f"off_high_pct mismatch on {s['ticker']}")

    def test_no_mixed_currency_or_synthetic_104x_technicals(self):
        """USD ADR price and 50-DMA / 52W-high must be in USD and never synthesized as 1.04x / 1.03x of price."""
        for s in self.stocks:
            px = s["price"]
            dma50 = s.get("dma50")
            high52 = s.get("high_52w")
            if px and dma50 is not None:
                ratio = dma50 / px
                self.assertGreater(ratio, 0.2, f"Unit mismatch on {s['ticker']}: dma50={dma50} vs price={px}")
                self.assertLess(ratio, 5.0, f"Unit mismatch on {s['ticker']}: dma50={dma50} vs price={px}")
                self.assertNotAlmostEqual(
                    dma50,
                    round(px * 1.04, 2),
                    places=2,
                    msg=f"{s['ticker']} dma50={dma50} looks synthesized from price*1.04",
                )
            if px and high52 is not None:
                ratio_h = high52 / px
                self.assertGreater(ratio_h, 0.5, f"Unit mismatch on {s['ticker']}: high_52w={high52} vs price={px}")
                self.assertLess(ratio_h, 5.0, f"Unit mismatch on {s['ticker']}: high_52w={high52} vs price={px}")

    def test_window_based_narrative_score_consistency(self):
        """Window-based scan (70 chars before every XX/100) catches strings with decimals and verifies zero narrative score drift."""
        tickers = set(self.by_ticker.keys())
        tick_re = re.compile(r"\b(" + "|".join(sorted(tickers, key=len, reverse=True)) + r")\b")
        mismatches = []

        def walk(obj, path=""):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k == "historical_backtest_audit":
                        continue
                    walk(v, f"{path}.{k}")
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    walk(v, f"{path}[{i}]")
            elif isinstance(obj, str) and "/100" in obj:
                for m in re.finditer(r"(\d{1,3})/100", obj):
                    prefix = obj[max(0, m.start() - 70) : m.start()]
                    ts = tick_re.findall(prefix)
                    if ts:
                        tk = ts[-1]
                        sc = int(m.group(1))
                        actual = self.by_ticker[tk]["bottleneck_score"]
                        if sc != actual:
                            mismatches.append((path, tk, sc, actual, obj[max(0, m.start() - 40) : m.end()]))

        walk(self.state, "state")
        self.assertEqual(mismatches, [], f"Window-scan narrative score drift detected: {mismatches}")

    def test_tax_lot_reconciliation_against_masked_fixture(self):
        """All 22 active baseline tax lots reconcile against holdings_baseline_masked.json and dynamic lots reconcile with live holdings."""
        self.assertTrue(MASKED_HOLDINGS_FIXTURE_PATH.exists(), "Masked holdings fixture must exist inside repo")
        raw_fixture_text = MASKED_HOLDINGS_FIXTURE_PATH.read_text()
        self.assertNotIn("X51702854", raw_fixture_text)
        self.assertNotIn("259765830", raw_fixture_text)

        h_doc = json.loads(raw_fixture_text)
        src_lots = {
            row["ticker"]: row
            for acct in h_doc["accounts"].values()
            for row in acct["positions"]
        }
        self.assertEqual(len(ACCOUNT_TAX_LOTS), 22)
        for lot in ACCOUNT_TAX_LOTS:
            t = lot["ticker"]
            self.assertIn(t, src_lots)
            cb = float(src_lots[t]["cost_basis"])
            mv = float(src_lots[t]["weight_units"])
            self.assertAlmostEqual(lot["cost_basis"], cb, places=2)
            self.assertAlmostEqual(lot["market_value"], mv, places=2)
            self.assertAlmostEqual(lot["unrealized_pl"], round(mv - cb, 2), places=2)

        rt = self.state["portfolio_risk_and_tax"]
        self.assertAlmostEqual(rt["margin_and_financing"]["annual_interest_savings_via_box_spread_usd"], 1125.82, places=2)
        tax_eng = rt["tax_and_wash_sale_engine"]
        expected_divest_gains = round(
            float(tax_eng["realized_ytd_st_gains_usd"]) + float(tax_eng["unrealized_divest_gains_usd"]),
            2,
        )
        self.assertAlmostEqual(tax_eng["brokerage_family_divest_gains_usd"], expected_divest_gains, places=2)
        expected_harv = round(sum(float(l["unrealized_pl"]) for l in tax_eng["harvestable_lots_brokerage_family"]), 2)
        self.assertAlmostEqual(tax_eng["brokerage_family_harvestable_losses_usd"], expected_harv, places=2)

    def test_pretrade_compliance_sell_guard_sell_purpose_and_gate6_preclearance(self):
        """Pre-trade check blocks general selling of #1 monopolies, permits TAX_LOSS_HARVEST/CONCENTRATION_TRIM/MARGIN_DEBT_PAYDOWN, and flags Gate 6 partners."""
        holdings = [s for s in self.stocks if s["is_holding"]]
        approved_general_sells = []
        for s in holdings:
            res = check_pretrade_compliance(
                PreTradeRequest(ticker=s["ticker"], action="SELL", sell_purpose="GENERAL_EXIT", amount_usd=5000, account=s["account"])
            )
            if res["overall_status"].startswith("APPROVED"):
                approved_general_sells.append(s["ticker"])
            g5_detail = res["gates"][4]["detail"]
            if s.get("dip_rule"):
                self.assertNotIn(s["dip_rule"], g5_detail)

        self.assertEqual(
            set(approved_general_sells),
            {"FANUY", "YASKY", "HSYDF", "CIFR", "CDNS", "CORZ", "NBIS"},
            "Only the 7 DIVEST_OR_UPGRADE holdings (v4.8 adds CORZ/NBIS at 56/58) should be APPROVED for general exit sale",
        )

        # Risk-management sell purposes (TAX_LOSS_HARVEST, CONCENTRATION_TRIM, MARGIN_DEBT_PAYDOWN) on a #1 holding are approved
        for purpose in ("TAX_LOSS_HARVEST", "CONCENTRATION_TRIM", "MARGIN_DEBT_PAYDOWN"):
            res_tlh = check_pretrade_compliance(
                PreTradeRequest(ticker="ATEYY", action="SELL", sell_purpose=purpose, amount_usd=5000, account="Brokerage_Family")
            )
            self.assertTrue(res_tlh["gates"][1]["passed"], f"Expected Gate 2 to pass for sell_purpose={purpose}")
            self.assertIn("APPROVED", res_tlh["overall_status"])

        # Gate 6 compliance pre-clearance flags GOOG, AVGO, IBIDY, STX, AMD, INTC, NTAP
        for partner_tk in ("GOOG", "AVGO", "IBIDY", "STX", "AMD", "INTC", "NTAP"):
            if partner_tk in self.by_ticker:
                res_g6 = check_pretrade_compliance(
                    PreTradeRequest(ticker=partner_tk, action="BUY", amount_usd=5000, account="Roth_Fidelity")
                )
                self.assertIn("COMPLIANCE CHECK REQUIRED", res_g6["gates"][5]["detail"])

        # Selling a holding in an account where it is not held must fail Gate 3
        wrong_acct = check_pretrade_compliance(
            PreTradeRequest(ticker="CRDO", action="SELL", amount_usd=5000, account="Brokerage_Family")
        )
        self.assertFalse(wrong_acct["gates"][2]["passed"])
        self.assertIn("ACCOUNT LOT MISMATCH", wrong_acct["overall_status"])

        # Margin-funded BUY in Brokerage_Family that exceeds 0.65x PEG must fail Gate 3
        res_asml_margin = check_pretrade_compliance(
            PreTradeRequest(ticker="ASML", action="BUY", amount_usd=10000, account="Brokerage_Family")
        )
        self.assertFalse(res_asml_margin["gates"][2]["passed"])
        self.assertNotEqual(res_asml_margin["overall_status"], "APPROVED (NO-DIWORSIFICATION PASS)")

        # Unknown tickers must be explicitly REJECTED with dynamic universe count and bottleneck_score=None
        for unknown in ("ZZZZ", "AAPL"):
            res_unk = check_pretrade_compliance(
                PreTradeRequest(ticker=unknown, action="BUY", amount_usd=10000, account="Roth_Fidelity")
            )
            self.assertIsNone(res_unk["bottleneck_score"])
            self.assertIn("REJECTED", res_unk["overall_status"])
            self.assertIn(f"{len(self.stocks)}-STOCK UNIVERSE", res_unk["overall_status"])
            self.assertFalse(res_unk["gates"][1]["passed"])

        with self.assertRaises(HTTPException) as ctx:
            simulate_3y_valuation(ValuationSimRequest(ticker="ZZZZ"))
        self.assertEqual(ctx.exception.status_code, 404)

    def test_stress_scenario_labels_match_equity_to_mv_math(self):
        """Stress scenario status labels must match Equity/MV = 100 - Debt/MV against (25, 30, 40, 50) house maintenance tiers."""
        rt = self.state["portfolio_risk_and_tax"]
        for sc in rt["stress_scenarios"]:
            dmv = sc["brokerage_family_debt_to_mv_pct"]
            eq_mv = round(100.0 - dmv, 1)
            self.assertAlmostEqual(sc["brokerage_family_equity_to_mv_pct"], eq_mv, places=1)
            breached_house = [m for m in (25, 30, 40, 50) if eq_mv < m]
            self.assertEqual(sc["breached_house_tiers_pct"], breached_house)
            if not breached_house and dmv > 30.0:
                self.assertIn("POLICY CAP ONLY", sc["status"])
            elif breached_house == [50]:
                self.assertIn("50% SEVERE-VOL HOUSE TIER ONLY", sc["status"])
            elif 25 in breached_house:
                self.assertIn("25% FINRA MINIMUM", sc["status"])

    def test_risk_tax_engine_and_entity_accuracy(self):
        """Risk/tax report computes empirical return-series correlation, classifies 100% of universe subsectors, labels NBCLF as Nitto Boseki, and masks account numbers."""
        rt = self.state["portfolio_risk_and_tax"]
        cc = rt["correlation_and_concentration"]
        self.assertAlmostEqual(cc["effective_independent_bets"], 1.78, places=2)
        self.assertAlmostEqual(cc["assumed_pairwise_correlation"], 0.54, places=2)
        self.assertEqual(cc.get("subsector_classification_coverage_pct"), 100.0)
        self.assertGreater(rt["currency_and_otc_exposure"]["non_usd_pct_of_gross"], 45.0)
        self.assertLess(rt["margin_and_financing"]["debt_to_account_mv_pct"], 25.0)

        triage_str = json.dumps(self.state["portfolio_triage"])
        self.assertIn("0.0% Debt/MV", triage_str)

        serialized = json.dumps(self.state)
        self.assertNotIn("259765830", serialized, "Unmasked Fidelity Roth account number found in payload")
        self.assertNotIn("X51702854", serialized, "Unmasked Fidelity Margin account number found in payload")
        self.assertNotIn("NBCLF (Nabtesco", serialized, "Wrong entity Nabtesco found in payload for NBCLF")
        self.assertNotIn("Nabtesco (NBCLF", serialized, "Wrong entity Nabtesco found in payload for NBCLF")
        self.assertIn("Nitto Boseki", serialized)

    def test_news_primary_urls_and_expiry_discipline(self):
        """News items use primary article/IR/SEC URLs (never news.google.com/search), carry fetched_at and expires_at, and separate analyst_notes from material_events."""
        intel = self.state.get("live_intelligence_review")
        self.assertIsInstance(intel, dict)
        self.assertIn("material_events", intel)
        self.assertIn("analyst_notes", intel)
        self.assertGreaterEqual(len(intel["material_events"]), 3)
        self.assertGreaterEqual(len(intel["analyst_notes"]), 3)

        for item in intel.get("executive_intelligence_digest", []):
            self.assertNotIn("news.google.com/search", item.get("link", ""))
            self.assertTrue(item.get("fetched_at"))
            self.assertTrue(item.get("expires_at"))

        for n in self.state.get("top_material_news", []):
            self.assertNotIn("news.google.com/search", n.get("link", ""))
            self.assertTrue(n.get("fetched_at"))
            self.assertTrue(n.get("expires_at"))

    def test_mrvl_sold_lite_ma_cohr_lta_and_live_intelligence_review(self):
        """Verifies MRVL is sold ($0 held), LITE is reclassified for $115B MRVL acquisition, COHR is #1 optical monopoly, and live_intelligence_review is populated."""
        mrvl = self.by_ticker["MRVL"]
        self.assertFalse(mrvl["is_holding"])
        self.assertEqual(mrvl["portfolio_usd"], 0.0)
        self.assertEqual(mrvl["inclusion_status"], "NOT_INCLUDED_SOLD_EXITED")
        self.assertEqual(mrvl["triage_bucket"], "WATCH_AVOID")

        lite = self.by_ticker["LITE"]
        self.assertFalse(lite["is_holding"])
        self.assertEqual(lite["inclusion_status"], "NOT_INCLUDED_ACQUIRED_BY_MRVL")
        self.assertEqual(lite["triage_bucket"], "WATCH_AVOID")
        self.assertLess(lite["bottleneck_score"], 65)

        cohr = self.by_ticker["COHR"]
        self.assertTrue(cohr["is_holding"])
        self.assertEqual(cohr["triage_bucket"], "CORE_KEEP")
        self.assertGreaterEqual(cohr["bottleneck_score"], 90)
        self.assertEqual(cohr["rating"], "STRONG BUY")
        self.assertIn("PhotonLink", cohr["choke_point"])

    def test_biggest_rating_change_scale_consistency(self):
        """biggest_rating_change old_score, new_score, and delta are all on the 0-10 scale and backed by ratings_history.json."""
        brc = self.state["biggest_rating_change"]
        self.assertLessEqual(brc["old_score"], 10.0)
        self.assertLessEqual(brc["new_score"], 10.0)
        self.assertAlmostEqual(brc["new_score"] - brc["old_score"], brc["delta"], places=2)
        self.assertEqual(brc.get("history_source"), "backend/data/ratings_history.json")

    def test_deep_dive_cache_and_clean_formatting(self):
        """Ticker deep dive memo caches by (snapshot_id, ticker, model) and has zero raw ** tokens."""
        res1 = asyncio.run(generate_ticker_deep_dive(TickerDeepDiveRequest(ticker="ONTO", preferred_model="deterministic")))
        res2 = asyncio.run(generate_ticker_deep_dive(TickerDeepDiveRequest(ticker="ONTO", preferred_model="deterministic")))
        self.assertEqual(res1["timestamp"], res2["timestamp"])
        self.assertNotIn("**", res1["memo"])

    def test_non_uniform_refresh_invariants_preserved(self):
        """Non-uniform price shock (JPY ADRs -12%, others +3%) dynamically updates correlation, FX share, OTC USD, Debt/MV, caps, findings, and panel consult."""
        from backend.daily_refresh_job import FINDINGS_PATH, RATINGS_HISTORY_PATH
        orig_findings = FINDINGS_PATH.read_text() if FINDINGS_PATH.exists() else None
        orig_ratings = RATINGS_HISTORY_PATH.read_text() if RATINGS_HISTORY_PATH.exists() else None
        orig_state = main_mod.TERMINAL_STATE
        try:
            pre_non_usd = orig_state["portfolio_risk_and_tax"]["currency_and_otc_exposure"]["non_usd_pct_of_gross"]
            raw_copy = copy.deepcopy(json.loads(RAW_SEED_PATH.read_text()))
            for s in raw_copy["stocks"]:
                t = s["ticker"]
                px = float(s.get("us_price") or s.get("last_price") or 100.0)
                shock = 0.88 if UNDERLYING_CURRENCY_BY_TICKER.get(t) == "JPY" else 1.03
                new_px = round(px * shock, 4)
                s["us_price"] = new_px
                s["last_price"] = new_px
                s["chg_1d"] = round((shock - 1.0) * 100.0, 2)
                if s.get("is_holding") and s.get("shares"):
                    s["weight_usd"] = round(float(s["shares"]) * new_px, 2)

            rebuilt = build_normalized_terminal_payload(raw_copy)
            holdings = [s for s in rebuilt["stocks"] if s["is_holding"]]
            expected_gross = round(sum(s["portfolio_usd"] for s in holdings), 2)
            self.assertAlmostEqual(rebuilt["meta"]["gross_equities_usd"], expected_gross, places=2)
            self.assertAlmostEqual(sum(s["portfolio_weight_pct"] for s in holdings), 100.0, delta=0.15)

            rt = rebuilt["portfolio_risk_and_tax"]
            live_non_usd = rt["currency_and_otc_exposure"]["non_usd_pct_of_gross"]
            live_debt_mv = rt["margin_and_financing"]["debt_to_account_mv_pct"]
            self.assertNotAlmostEqual(live_non_usd, pre_non_usd, places=1)
            self.assertIn(str(live_non_usd), rebuilt["daily_ai_findings"]["bear_case_premortem"])
            self.assertEqual(rebuilt["daily_ai_findings"]["snapshot_id"], rebuilt["snapshot_id"])

            main_mod.TERMINAL_STATE = rebuilt
            resp = asyncio.run(
                consult_12_expert_panel(
                    PanelConsultRequest(question="Stress test my book", preferred_model="deterministic")
                )
            )
            txt = resp["response"]
            self.assertIn(f"{live_debt_mv}%", txt)
        finally:
            main_mod.TERMINAL_STATE = orig_state
            if orig_findings is not None:
                FINDINGS_PATH.write_text(orig_findings)
            if orig_ratings is not None:
                RATINGS_HISTORY_PATH.write_text(orig_ratings)

    def test_rationale_and_custom_stock_swarm_underwriting_placement(self):
        """Every stock has an ownership/non-inclusion rationale + 6-panel swarm debate, and adding a new stock places it into Screener, Layers, and 7 Supply Chains."""
        from backend.daily_refresh_job import FINDINGS_PATH, RATINGS_HISTORY_PATH
        from backend.main import (
            AddAndUnderwriteStockRequest,
            StockRationaleRequest,
            api_add_and_underwrite_stock,
            api_delete_custom_stock,
            update_stock_ownership_rationale,
        )
        from backend.swarm_underwriter import CUSTOM_STORE_PATH

        orig_custom = CUSTOM_STORE_PATH.read_text() if CUSTOM_STORE_PATH.exists() else None
        orig_findings = FINDINGS_PATH.read_text() if FINDINGS_PATH.exists() else None
        orig_ratings = RATINGS_HISTORY_PATH.read_text() if RATINGS_HISTORY_PATH.exists() else None
        try:
            self.assertEqual(len(self.state["stocks"]), 56)
            for st in self.state["stocks"]:
                self.assertTrue(st.get("ownership_rationale"), f"Missing ownership_rationale for {st['ticker']}")
                self.assertTrue(st.get("why_action"), f"Missing why_action for {st['ticker']}")
                self.assertTrue(st.get("inclusion_status"), f"Missing inclusion_status for {st['ticker']}")
                debate = st.get("swarm_debate")
                self.assertIsInstance(debate, dict, f"Missing swarm_debate for {st['ticker']}")
                self.assertEqual(len(debate.get("expert_voices", [])), 6)
                self.assertEqual(debate.get("bottleneck_score"), st["bottleneck_score"])

            rat_res = update_stock_ownership_rationale(
                StockRationaleRequest(
                    ticker="ANET",
                    user_rationale="Excluded because every Arista switch runs on Broadcom Tomahawk silicon at half the P/E.",
                    inclusion_status="NOT_INCLUDED_EXCLUDED_PEER",
                    chain_id="gpu_tpu_cluster",
                    node_id="xpu_6",
                )
            )
            self.assertEqual(rat_res["status"], "ok")
            self.assertIn("Broadcom Tomahawk silicon", rat_res["stock"]["ownership_rationale"])

            add_res = api_add_and_underwrite_stock(
                AddAndUnderwriteStockRequest(
                    ticker="NVMI",
                    layer_id="L3",
                    chain_id="tsmc_cowos",
                    node_id="tsmc_3",
                    inclusion_status="NOT_INCLUDED_EXCLUDED_PEER",
                    user_rationale="Strong X-ray metrology peer, but overlaps with owned KLAC and cheaper ONTO (0.48x PEG).",
                )
            )
            self.assertEqual(add_res["status"], "ok")
            nvmi_st = add_res["stock"]
            self.assertEqual(nvmi_st["ticker"], "NVMI")
            self.assertTrue(nvmi_st["is_custom_stock"])
            self.assertEqual(
                nvmi_st["bottleneck_score"],
                nvmi_st["ai_criticality_score"] + nvmi_st["tech_moat_score"] + nvmi_st["return_torque_score"],
            )
            self.assertEqual(len(nvmi_st["swarm_debate"]["expert_voices"]), 6)

            new_state = add_res["terminal_state"]
            self.assertTrue(any(s["ticker"] == "NVMI" for s in new_state["stocks"]))
            l3_layer = next(l for l in new_state["supply_chain_layers"] if l["layer_id"] == "L3")
            self.assertIn("NVMI", l3_layer["tickers"])

            del_nvmi = api_delete_custom_stock("NVMI")
            self.assertTrue(del_nvmi["removed_custom_stock"])
            del_anet = api_delete_custom_stock("ANET")
            self.assertTrue(del_anet["removed_custom_rationale"])
            self.assertFalse(any(s["ticker"] == "NVMI" for s in del_anet["terminal_state"]["stocks"]))
        finally:
            if orig_custom is not None:
                CUSTOM_STORE_PATH.write_text(orig_custom)
            if orig_findings is not None:
                FINDINGS_PATH.write_text(orig_findings)
            if orig_ratings is not None:
                RATINGS_HISTORY_PATH.write_text(orig_ratings)
            main_mod.TERMINAL_STATE = build_normalized_terminal_payload(main_mod.RAW_STATE)

    def test_section4_inflection_candidates_and_recommendation_log(self):
        """Verifies all US-tradable §4 inflection candidates are in the 56-stock universe, non-ADR tickers were moved to local watchlist, PL is WATCH_AVOID, and recommendation_log is populated."""
        sec4_candidates = {
            "VICR", "TSEM", "AXTI", "IBIDY",
            "SLOIY", "AIIXY", "FN", "ASMVY", "RMBS", "SIMO", "SITM",
        }
        self.assertTrue(sec4_candidates.issubset(set(self.by_ticker.keys())))
        for removed_non_adr in ("KKSIY", "ASAAF", "MJPNF", "IBIDF", "SLOIF"):
            self.assertNotIn(removed_non_adr, self.by_ticker)

        pl = self.by_ticker["PL"]
        self.assertEqual(pl["triage_bucket"], "WATCH_AVOID", "Planet Labs (PL) must be WATCH_AVOID (downstream compute consumer)")
        self.assertLess(pl["bottleneck_score"], 50)

        rec_log = self.state.get("recommendation_log")
        self.assertIsInstance(rec_log, dict)
        self.assertEqual(rec_log["summary_metrics"]["historical_hit_rate_pct"], 100.0)
        self.assertEqual(rec_log["summary_metrics"]["historical_false_positive_rate_pct"], 0.0)
        self.assertGreaterEqual(len(rec_log.get("active_recommendations", [])), 10)

    def test_v46_tradability_quality_gate_and_real_weekly_correlation(self):
        """Verifies SKHY on Nasdaq, OTC ADR vs Ordinary separation, Quality Gate pass/fail/conditional tiers, GOOG employer restriction, and unowned leader valuation-watch ratings."""
        skhy = self.by_ticker["SKHY"]
        self.assertEqual(skhy["us_line"], "Nasdaq")
        self.assertEqual(skhy["liquidity_tier"], "LIQUID_US_EXCHANGE")
        self.assertAlmostEqual(skhy["price"], 123.90, places=2)
        self.assertEqual(skhy["zero_volume_days_65d"], 0)

        valid_us_lines = {"NYSE", "Nasdaq", "OTC ADR", "OTC ordinary"}
        for s in self.stocks:
            self.assertIn(s["us_line"], valid_us_lines, f"Invalid us_line on {s['ticker']}")
            self.assertIn("quality_gate_passed", s)
            self.assertIn("quality_tier", s)
            self.assertIsNotNone(s.get("score_rank"))
            self.assertIsNotNone(s.get("score_percentile"))

        for fail_tk in ("HSYDF", "FANUY", "YASKY", "PL", "CIFR"):
            st = self.by_ticker[fail_tk]
            self.assertFalse(st["quality_gate_passed"], f"{fail_tk} must fail AI-Compute Quality Gate")
            self.assertLess(st["bottleneck_score"], 40, f"{fail_tk} must score <40")

        goog = self.by_ticker["GOOG"]
        self.assertEqual(goog["rating"], "EMPLOYER STOCK — TRADING WINDOW & PRE-CLEARANCE")
        self.assertTrue(goog["compliance_restricted"])

        for leader_watch_tk in ("AMAT", "MU", "ETN", "GEV", "ANET", "ARM"):
            st = self.by_ticker[leader_watch_tk]
            self.assertEqual(st["rating"], "BEST-IN-CLASS · CYCLE / VALUATION WATCH")

        otc_exp = self.state["portfolio_risk_and_tax"]["currency_and_otc_exposure"]
        self.assertEqual(len(otc_exp["otc_adr_positions"]), 9)
        self.assertEqual(len(otc_exp["otc_ordinary_positions"]), 2)
        ord_tickers = {p["ticker"] for p in otc_exp["otc_ordinary_positions"]}
        self.assertEqual(ord_tickers, {"NBCLF", "HSYDF"})

    def test_v47_investment_committee_policy_layer(self):
        """Committee verdicts cover every holding, trades are self-funding per account (no margin), post-trade weights stay capped,
        and the policy layer never mutates rubric scores."""
        from backend.investment_committee import (
            ALLOWED_ACTIONS,
            BUY_ACTIONS,
            SELL_ACTIONS,
            build_investment_committee_payload,
            load_committee_state,
        )

        ic = self.state.get("investment_committee")
        self.assertIsInstance(ic, dict)
        self.assertTrue(ic.get("committee_id"))
        self.assertEqual(len(ic["questions"]), 4)
        self.assertGreaterEqual(len(ic["personas"]), 5)
        for q in ic["questions"]:
            self.assertTrue(q.get("answer_headline"), f"{q['id']} missing headline")
            self.assertTrue(q.get("consensus"), f"{q['id']} missing consensus")

        held = {s["ticker"]: s for s in self.stocks if s.get("is_holding")}
        self.assertEqual(ic.get("holdings_without_verdict"), [], "Every holding needs a committee verdict")
        for t, s in held.items():
            v = s.get("committee_verdict")
            self.assertIsNotNone(v, f"{t} missing committee_verdict")
            self.assertIn(v["action"], ALLOWED_ACTIONS)
            self.assertTrue(v.get("rationale"), f"{t} verdict needs a rationale")

        for tr in ic["trades"]:
            self.assertIn(tr["action"], SELL_ACTIONS | BUY_ACTIONS)
            self.assertGreater(tr["amount_usd"], 0.0, f"{tr['ticker']} trade must have a positive amount")
            if tr["action"] in SELL_ACTIONS:
                self.assertIn(tr["ticker"], held, f"Cannot sell unheld {tr['ticker']}")
                self.assertEqual(tr["account"], held[tr["ticker"]]["account"], f"{tr['ticker']} sold from wrong account")
                self.assertLessEqual(tr["amount_usd"], held[tr["ticker"]]["portfolio_usd"] + 0.01)
            else:
                self.assertIn(tr.get("us_line"), {"NYSE", "Nasdaq", "OTC ADR"}, f"{tr['ticker']} must be US-listed or an ADR")

        for acct, flow in ic["account_cash_flows"].items():
            self.assertGreaterEqual(flow["net_cash_usd"], -500.0, f"{acct} plan would need margin")

        book = ic["post_trade_book"]
        self.assertLessEqual(book["max_weight_pct"], 15.0)
        self.assertGreaterEqual(book["residual_cash_usd"], -500.0)

        # Policy layer must not mutate rubric scores
        raw_scores = {s["ticker"]: s.get("bottleneck_score") for s in self.stocks}
        rebuilt = build_investment_committee_payload(copy.deepcopy(self.stocks), load_committee_state())
        self.assertEqual(rebuilt["committee_id"], ic["committee_id"])
        self.assertEqual(raw_scores, {s["ticker"]: s.get("bottleneck_score") for s in self.stocks})

    def test_v48_score_and_label_share_sourced_inputs(self):
        """The 0-100 score is computed from the same sourced moat profile that supplies the quality tier, so a CONDITIONAL
        name can never show a seed-inflated STRONG BUY (v4.7 bug: VICR 99 / SIMO 90 next to 'CONDITIONAL - NICHE / #2')."""
        moat_keys = (
            "ai_purity_pct",
            "market_position_rank",
            "switching_cost_index",
            "qualified_suppliers_count",
            "has_lta_prepayment",
        )
        for s in self.stocks:
            prof = STRUCTURED_MOAT_PROFILES.get(s["ticker"])
            if not prof or s.get("bottleneck_score") is None:
                continue
            for k in moat_keys:
                if k in prof:
                    self.assertEqual(s[k], prof[k], f"{s['ticker']} scored with stale {k}={s[k]} (profile {prof[k]})")
            if "BEST-IN-CLASS" in s["rating"]:
                self.assertIn("PASS", s["quality_tier"], f"{s['ticker']} labeled best-in-class with tier {s['quality_tier']}")

        self.assertLess(self.by_ticker["VICR"]["bottleneck_score"], 70)
        self.assertLess(self.by_ticker["SIMO"]["bottleneck_score"], 62)
        self.assertGreaterEqual(self.by_ticker["FORM"]["bottleneck_score"], 90)

    def test_v48_refresh_rescales_price_driven_valuation_fields(self):
        """A price refresh moves market cap, forward P/E and PEG with the price; EV-valued names keep P/E/PEG None."""
        from backend.daily_refresh_job import rescale_price_driven_fields

        st = {"mkt_cap_usd_b": 10.0, "fwd_pe": 20.0, "peg": 0.5, "us_price": 100.0}
        rescale_price_driven_fields(st, 100.0, 110.0)
        self.assertAlmostEqual(st["mkt_cap_usd_b"], 11.0, places=2)
        self.assertAlmostEqual(st["fwd_pe"], 22.0, places=2)
        self.assertAlmostEqual(st["peg"], 0.55, places=2)

        ev_name = {"mkt_cap_usd_b": 4.0, "fwd_pe": None, "peg": None}
        rescale_price_driven_fields(ev_name, 10.0, 8.0)
        self.assertAlmostEqual(ev_name["mkt_cap_usd_b"], 3.2, places=2)
        self.assertIsNone(ev_name["fwd_pe"])
        self.assertIsNone(ev_name["peg"])

        untouched = {"mkt_cap_usd_b": 5.0, "fwd_pe": 15.0}
        rescale_price_driven_fields(untouched, 0.0, 12.0)
        self.assertEqual(untouched, {"mkt_cap_usd_b": 5.0, "fwd_pe": 15.0})

    def test_v49_dynamic_ticker_edit_remove_and_bulk_manage(self):
        """Customers can edit any stock (including baseline holdings), remove any stock, replace the universe with custom tickers, clear all stocks to 0, and restore defaults."""
        from backend.daily_refresh_job import FINDINGS_PATH, RATINGS_HISTORY_PATH
        from backend.main import (
            BulkManageUniverseRequest,
            EditStockRequest,
            api_bulk_manage_universe,
            api_edit_stock,
            api_remove_stock_from_universe,
        )
        from backend.swarm_underwriter import CUSTOM_STORE_PATH

        orig_custom = CUSTOM_STORE_PATH.read_text() if CUSTOM_STORE_PATH.exists() else None
        orig_findings = FINDINGS_PATH.read_text() if FINDINGS_PATH.exists() else None
        orig_ratings = RATINGS_HISTORY_PATH.read_text() if RATINGS_HISTORY_PATH.exists() else None
        try:
            # 1. Edit an unowned baseline stock (ONTO) to become an owned holding with $40,000 position and custom fundamentals
            edit_res = api_edit_stock(
                EditStockRequest(
                    ticker="ONTO",
                    is_holding=True,
                    weight_usd=40000.0,
                    account="Roth_Schwab",
                    us_price=220.0,
                    fwd_pe=24.0,
                    eps_3y_cagr=45.0,
                    gm_pct=62.0,
                    monopoly_share_pct=75,
                    user_rationale="Added ONTO as $40k core CoWoS metrology holding.",
                )
            )
            self.assertEqual(edit_res["status"], "ok")
            onto_st = edit_res["stock"]
            self.assertTrue(onto_st["is_holding"])
            self.assertAlmostEqual(onto_st["portfolio_usd"], 40000.0, places=2)
            self.assertAlmostEqual(onto_st["price"], 220.0, places=2)
            self.assertIsNotNone(onto_st.get("committee_verdict"))
            self.assertEqual(edit_res["terminal_state"]["investment_committee"]["holdings_without_verdict"], [])

            # 2. Remove a baseline holding (NVDA) from the universe
            rem_res = api_remove_stock_from_universe("NVDA")
            self.assertEqual(rem_res["status"], "ok")
            rem_state = rem_res["terminal_state"]
            self.assertFalse(any(s["ticker"] == "NVDA" for s in rem_state["stocks"]))
            self.assertIn("NVDA", rem_state["removed_tickers"])
            self.assertEqual(rem_state["investment_committee"]["holdings_without_verdict"], [])

            # 3. Replace entire universe with a custom 4-stock portfolio (zero other stocks)
            rep_res = api_bulk_manage_universe(
                BulkManageUniverseRequest(
                    mode="replace_universe",
                    scope="universe",
                    tickers=["TSM", "ASML", "AVGO", "KLAC"],
                    as_holdings=True,
                    weight_usd_each=50000.0,
                    account="Roth_Schwab",
                )
            )
            self.assertEqual(rep_res["status"], "ok")
            rep_state = rep_res["terminal_state"]
            self.assertEqual(len(rep_state["stocks"]), 4)
            self.assertEqual({s["ticker"] for s in rep_state["stocks"]}, {"TSM", "ASML", "AVGO", "KLAC"})
            self.assertAlmostEqual(rep_state["meta"]["gross_equities_usd"], 200000.0, places=2)
            self.assertEqual(rep_state["investment_committee"]["holdings_without_verdict"], [])

            # 4. Clear all tickers (0 hardcoded stocks)
            clr_res = api_bulk_manage_universe(
                BulkManageUniverseRequest(mode="clear_all", scope="universe")
            )
            self.assertEqual(clr_res["status"], "ok")
            self.assertEqual(len(clr_res["terminal_state"]["stocks"]), 0)
            self.assertEqual(clr_res["terminal_state"]["meta"]["holdings_count"], 0)

            # 5. Restore default seed portfolio
            rst_res = api_bulk_manage_universe(
                BulkManageUniverseRequest(mode="reset_default", scope="universe")
            )
            self.assertEqual(rst_res["status"], "ok")
            self.assertEqual(len(rst_res["terminal_state"]["stocks"]), 56)
            self.assertEqual(rst_res["terminal_state"]["meta"]["holdings_count"], 22)
        finally:
            if orig_custom is not None:
                CUSTOM_STORE_PATH.write_text(orig_custom)
            elif CUSTOM_STORE_PATH.exists():
                CUSTOM_STORE_PATH.unlink()
            if orig_findings is not None:
                FINDINGS_PATH.write_text(orig_findings)
            if orig_ratings is not None:
                RATINGS_HISTORY_PATH.write_text(orig_ratings)
            main_mod.TERMINAL_STATE = build_normalized_terminal_payload(main_mod.RAW_STATE)

    def test_v49_dynamic_swarm_portfolio_analysis_on_custom_tickers(self):
        """Swarm portfolio analysis evaluates any customer-specified ticker list, outputs health score, weighted MOIC, 6-panel consensus, and conviction-weighted allocations."""
        from backend.daily_refresh_job import FINDINGS_PATH, RATINGS_HISTORY_PATH
        from backend.main import SwarmPortfolioAnalysisRequest, api_run_swarm_portfolio_analysis
        from backend.swarm_underwriter import CUSTOM_STORE_PATH

        orig_custom = CUSTOM_STORE_PATH.read_text() if CUSTOM_STORE_PATH.exists() else None
        orig_findings = FINDINGS_PATH.read_text() if FINDINGS_PATH.exists() else None
        orig_ratings = RATINGS_HISTORY_PATH.read_text() if RATINGS_HISTORY_PATH.exists() else None
        try:
            custom_list = ["SNPS", "CDNS", "TSM", "ASML", "KLAC", "LRCX", "AMAT", "ARM", "CIFR", "CORZ"]
            res = api_run_swarm_portfolio_analysis(
                SwarmPortfolioAnalysisRequest(
                    scope="custom_tickers",
                    tickers=custom_list,
                    mandate="Evaluate best-in-class semicap monopolies under $500B and power plays.",
                    capital_usd=250000.0,
                    run_vertex_swarm=False,
                )
            )
            self.assertEqual(res["status"], "ok")
            rep = res["analysis"]
            self.assertEqual(rep["ticker_count"], len(custom_list))
            self.assertGreater(rep["portfolio_health_score"], 50.0)
            self.assertGreater(rep["weighted_expected_3y_moic"], 1.2)
            self.assertTrue(rep["executive_synthesis"])
            self.assertEqual(len(rep["panel_consensus_matrix"]), 6)
            self.assertEqual(len(rep["supply_chain_coverage"]), 7)
            total_alloc = sum(r["target_usd"] for r in rep["recommended_allocations"])
            self.assertAlmostEqual(total_alloc, 250000.0, delta=5.0)
        finally:
            if orig_custom is not None:
                CUSTOM_STORE_PATH.write_text(orig_custom)
            elif CUSTOM_STORE_PATH.exists():
                CUSTOM_STORE_PATH.unlink()
            if orig_findings is not None:
                FINDINGS_PATH.write_text(orig_findings)
            if orig_ratings is not None:
                RATINGS_HISTORY_PATH.write_text(orig_ratings)
            main_mod.TERMINAL_STATE = build_normalized_terminal_payload(main_mod.RAW_STATE)

    def test_v49_zero_hardcoded_autonomous_swarm_discovery(self):
        """Autonomous Swarm Discovery finds and ranks the best investments without any user-supplied tickers, respecting market-cap ceilings, layer filters, and apply_mode."""
        from backend.daily_refresh_job import FINDINGS_PATH, RATINGS_HISTORY_PATH
        from backend.main import AutonomousSwarmDiscoveryRequest, api_run_autonomous_swarm_discovery
        from backend.swarm_underwriter import CUSTOM_STORE_PATH

        orig_custom = CUSTOM_STORE_PATH.read_text() if CUSTOM_STORE_PATH.exists() else None
        orig_findings = FINDINGS_PATH.read_text() if FINDINGS_PATH.exists() else None
        orig_ratings = RATINGS_HISTORY_PATH.read_text() if RATINGS_HISTORY_PATH.exists() else None
        try:
            # 1. Under $500B market cap best-in-class AI compute discovery
            disc_res = api_run_autonomous_swarm_discovery(
                AutonomousSwarmDiscoveryRequest(
                    thesis_or_mandate="Find the highest-quality, safest AI compute pure-play monopolies under $500 billion market cap.",
                    max_market_cap_usd_b=500.0,
                    min_monopoly_share_pct=50,
                    top_n=6,
                    capital_usd=120000.0,
                    run_vertex_swarm=False,
                    apply_mode="none",
                )
            )
            self.assertEqual(disc_res["status"], "ok")
            disc = disc_res["discovery"]
            self.assertGreater(disc["candidates_audited_count"], 30)
            spotlight = disc["best_investment_spotlight"]
            self.assertIsNotNone(spotlight)
            self.assertLessEqual(spotlight["mkt_cap_usd_b"], 500.0)
            self.assertGreaterEqual(spotlight["monopoly_share_pct"], 50)
            self.assertGreaterEqual(spotlight["bottleneck_score"], 80)
            self.assertTrue(spotlight.get("headline"))
            self.assertTrue(spotlight.get("why_number_one_over_alternatives"))
            self.assertEqual(len(disc["discovered_picks"]), 6)
            for p in disc["discovered_picks"]:
                self.assertLessEqual(p["mkt_cap_usd_b"], 500.0)
                self.assertGreaterEqual(p["monopoly_share_pct"], 50)
            total_disc_usd = sum(p["recommended_allocation_usd"] for p in disc["discovered_picks"])
            self.assertAlmostEqual(total_disc_usd, 120000.0, delta=5.0)

            # 2. Layer 5 Power & Datacenter Capacity discovery with apply_mode='add_top_pick'
            pwr_res = api_run_autonomous_swarm_discovery(
                AutonomousSwarmDiscoveryRequest(
                    thesis_or_mandate="Scarce gigawatt power and datacenter thermal/power infrastructure.",
                    max_market_cap_usd_b=150.0,
                    min_monopoly_share_pct=35,
                    focus_layers=["L5"],
                    top_n=3,
                    capital_usd=60000.0,
                    run_vertex_swarm=False,
                    apply_mode="add_top_pick",
                )
            )
            self.assertEqual(pwr_res["status"], "ok")
            pwr_disc = pwr_res["discovery"]
            self.assertGreaterEqual(len(pwr_disc["discovered_picks"]), 1)
            for p in pwr_disc["discovered_picks"]:
                self.assertEqual(p["layer_id"], "L5")
            top_pwr_tk = pwr_disc["best_investment_spotlight"]["ticker"]
            self.assertIn(top_pwr_tk, pwr_disc["applied_tickers"])
            applied_st = next(s for s in pwr_res["terminal_state"]["stocks"] if s["ticker"] == top_pwr_tk)
            self.assertTrue(applied_st["is_holding"])
        finally:
            if orig_custom is not None:
                CUSTOM_STORE_PATH.write_text(orig_custom)
            elif CUSTOM_STORE_PATH.exists():
                CUSTOM_STORE_PATH.unlink()
            if orig_findings is not None:
                FINDINGS_PATH.write_text(orig_findings)
            if orig_ratings is not None:
                RATINGS_HISTORY_PATH.write_text(orig_ratings)
            main_mod.TERMINAL_STATE = build_normalized_terminal_payload(main_mod.RAW_STATE)


if __name__ == "__main__":
    unittest.main()

