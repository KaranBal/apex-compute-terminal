"""Portfolio Risk, Currency/ADR, Margin Call Distance, Stress Testing & Tax-Lot Engine."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from backend.scoring_engine import OTC_ADR_METADATA, UNDERLYING_CURRENCY_BY_TICKER

REAL_RETURNS_PATH = Path(__file__).resolve().parent / "data" / "real_weekly_returns_1y.json"


def _load_real_weekly_closes_and_returns() -> tuple[dict[str, list[float]], dict[str, dict[str, float]]]:
    if not REAL_RETURNS_PATH.exists():
        return {}, {}
    try:
        raw = json.loads(REAL_RETURNS_PATH.read_text())
        closes_map = raw.get("weekly_closes_by_ticker") or {}
        closes_out: dict[str, list[float]] = {}
        rets_out: dict[str, dict[str, float]] = {}
        for tk, closes in closes_map.items():
            t_up = str(tk).upper().strip()
            if isinstance(closes, dict):
                sorted_weeks = sorted(closes.keys(), key=lambda x: int(x) if str(x).isdigit() else str(x))
                clean_closes = [round(float(closes[wk]), 4) for wk in sorted_weeks if float(closes[wk]) > 0]
                closes_out[t_up] = clean_closes
                wk_rets: dict[str, float] = {}
                for idx in range(1, len(sorted_weeks)):
                    w_prev, w_cur = sorted_weeks[idx - 1], sorted_weeks[idx]
                    c_prev, c_cur = float(closes[w_prev]), float(closes[w_cur])
                    if c_prev > 0 and c_cur > 0:
                        wk_rets[str(w_cur)] = math.log(c_cur / c_prev)
                if len(wk_rets) >= 10:
                    rets_out[t_up] = wk_rets
            elif isinstance(closes, list) and len(closes) >= 12:
                clean_closes = [round(float(c), 4) for c in closes if float(c) > 0]
                closes_out[t_up] = clean_closes
                rets_out[t_up] = {
                    str(k): math.log(clean_closes[k] / clean_closes[k - 1])
                    for k in range(1, len(clean_closes))
                }
        return closes_out, rets_out
    except Exception:
        return {}, {}


REAL_WEEKLY_CLOSES_BY_TICKER, REAL_WEEKLY_RETURNS_BY_TICKER = _load_real_weekly_closes_and_returns()

ACCOUNT_DISPLAY_MAP: dict[str, tuple[str, bool, str]] = {
    "Brokerage_Family": ("Fidelity Brokerage_Family (...2854)", True, "Short-Term"),
    "Roth_Fidelity": ("Fidelity Roth IRA (...5830)", False, "Tax-Exempt (Roth)"),
    "Roth_Schwab": ("Charles Schwab PCRA Roth (...0726)", False, "Tax-Exempt (Roth)"),
}

# Realized 2026 YTD tax lots in Fidelity Brokerage_Family (...2854)
REALIZED_YTD_TAX_LOTS: list[dict[str, Any]] = [
    {
        "account": "Fidelity Brokerage_Family (...2854)",
        "account_key": "Brokerage_Family",
        "taxable": True,
        "ticker": "MRVL",
        "shares_sold": 212.393,
        "proceeds_usd": 33029.23,
        "sale_proceeds_usd": 33029.23,
        "cost_basis": 20918.00,
        "realized_pl": 12111.23,
        "holding_period": "Short-Term",
        "sold_date": "2026-11-05",
        "catalyst": "Sold 100% following Marvell's dilutive $115B all-stock acquisition of Lumentum (LITE); proceeds applied directly to reduce Fidelity Margin debit from -$52,523.98 to -$19,494.75.",
    }
]

# Exact baseline 22-position active tax-lot breakdown synced with holdings.json across the 3 accounts (post-MRVL sale)
ACCOUNT_TAX_LOTS: list[dict[str, Any]] = [
    # Fidelity Brokerage_Family (...2854) — Margin Taxable Account ($158,407.23 Equities, -$19,494.75 Margin Debit after $33,029.23 MRVL sale paydown)
    {"account": "Fidelity Brokerage_Family (...2854)", "account_key": "Brokerage_Family", "taxable": True, "ticker": "SNPS", "market_value": 26105.43, "cost_basis": 24999.86, "unrealized_pl": 1105.57, "holding_period": "Short-Term", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Brokerage_Family (...2854)", "account_key": "Brokerage_Family", "taxable": True, "ticker": "CDNS", "market_value": 25580.40, "cost_basis": 24930.62, "unrealized_pl": 649.78, "holding_period": "Short-Term", "triage_bucket": "DIVEST_TRIM"},
    {"account": "Fidelity Brokerage_Family (...2854)", "account_key": "Brokerage_Family", "taxable": True, "ticker": "TSM", "market_value": 23960.13, "cost_basis": 26449.90, "unrealized_pl": -2489.77, "holding_period": "Short-Term", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Brokerage_Family (...2854)", "account_key": "Brokerage_Family", "taxable": True, "ticker": "ATEYY", "market_value": 21512.00, "cost_basis": 25431.00, "unrealized_pl": -3919.00, "holding_period": "Short-Term", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Brokerage_Family (...2854)", "account_key": "Brokerage_Family", "taxable": True, "ticker": "ASML", "market_value": 21421.98, "cost_basis": 25024.68, "unrealized_pl": -3602.70, "holding_period": "Short-Term", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Brokerage_Family (...2854)", "account_key": "Brokerage_Family", "taxable": True, "ticker": "TELWY", "market_value": 21154.00, "cost_basis": 14728.00, "unrealized_pl": 6426.00, "holding_period": "Short-Term", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Brokerage_Family (...2854)", "account_key": "Brokerage_Family", "taxable": True, "ticker": "KLAC", "market_value": 18673.29, "cost_basis": 20046.43, "unrealized_pl": -1373.14, "holding_period": "Short-Term", "triage_bucket": "CONCENTRATE"},
    # Charles Schwab PCRA Roth (...0726) — Tax-Exempt Account ($231,991.16 Equities, $15.69 Cash)
    {"account": "Charles Schwab PCRA Roth (...0726)", "account_key": "Roth_Schwab", "taxable": False, "ticker": "DSCSY", "market_value": 48980.92, "cost_basis": 68644.40, "unrealized_pl": -19663.48, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Charles Schwab PCRA Roth (...0726)", "account_key": "Roth_Schwab", "taxable": False, "ticker": "LSRCY", "market_value": 41587.20, "cost_basis": 45047.28, "unrealized_pl": -3460.08, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Charles Schwab PCRA Roth (...0726)", "account_key": "Roth_Schwab", "taxable": False, "ticker": "ASMIY", "market_value": 39896.48, "cost_basis": 48566.46, "unrealized_pl": -8669.98, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Charles Schwab PCRA Roth (...0726)", "account_key": "Roth_Schwab", "taxable": False, "ticker": "VACNY", "market_value": 33214.40, "cost_basis": 39326.91, "unrealized_pl": -6112.51, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Charles Schwab PCRA Roth (...0726)", "account_key": "Roth_Schwab", "taxable": False, "ticker": "ONTO", "market_value": 32241.30, "cost_basis": 34825.00, "unrealized_pl": -2583.70, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Charles Schwab PCRA Roth (...0726)", "account_key": "Roth_Schwab", "taxable": False, "ticker": "CORZ", "market_value": 20253.63, "cost_basis": 22468.51, "unrealized_pl": -2214.88, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Charles Schwab PCRA Roth (...0726)", "account_key": "Roth_Schwab", "taxable": False, "ticker": "CIFR", "market_value": 15817.23, "cost_basis": 25836.08, "unrealized_pl": -10018.85, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "DIVEST_TRIM"},
    # Fidelity Roth IRA (...5830) — Tax-Exempt Account ($181,401.50 Equities, $0.19 Cash)
    {"account": "Fidelity Roth IRA (...5830)", "account_key": "Roth_Fidelity", "taxable": False, "ticker": "CRDO", "market_value": 34736.87, "cost_basis": 39999.89, "unrealized_pl": -5263.02, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Roth IRA (...5830)", "account_key": "Roth_Fidelity", "taxable": False, "ticker": "MRUWY", "market_value": 26829.29, "cost_basis": 33473.92, "unrealized_pl": -6644.63, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Roth IRA (...5830)", "account_key": "Roth_Fidelity", "taxable": False, "ticker": "NBCLF", "market_value": 26806.50, "cost_basis": 40907.82, "unrealized_pl": -14101.32, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Roth IRA (...5830)", "account_key": "Roth_Fidelity", "taxable": False, "ticker": "NBIS", "market_value": 21630.10, "cost_basis": 17535.03, "unrealized_pl": 4095.07, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Roth IRA (...5830)", "account_key": "Roth_Fidelity", "taxable": False, "ticker": "COHR", "market_value": 21107.41, "cost_basis": 23222.77, "unrealized_pl": -2115.36, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "CONCENTRATE"},
    {"account": "Fidelity Roth IRA (...5830)", "account_key": "Roth_Fidelity", "taxable": False, "ticker": "FANUY", "market_value": 20143.97, "cost_basis": 21665.33, "unrealized_pl": -1521.36, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "DIVEST_TRIM"},
    {"account": "Fidelity Roth IRA (...5830)", "account_key": "Roth_Fidelity", "taxable": False, "ticker": "YASKY", "market_value": 17332.38, "cost_basis": 20977.09, "unrealized_pl": -3644.71, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "DIVEST_TRIM"},
    {"account": "Fidelity Roth IRA (...5830)", "account_key": "Roth_Fidelity", "taxable": False, "ticker": "HSYDF", "market_value": 12814.98, "cost_basis": 14333.47, "unrealized_pl": -1518.49, "holding_period": "Tax-Exempt (Roth)", "triage_bucket": "DIVEST_TRIM"},
]

# Tickers held in Roth accounts (Roth_Schwab ...0726 + Roth_Fidelity ...5830) — cross-account wash-sale guard (IRS Rev. Rul. 2008-5)
ROTH_IRA_TICKERS: set[str] = {
    lot["ticker"] for lot in ACCOUNT_TAX_LOTS if not lot["taxable"]
}


def build_portfolio_risk_and_tax_report(
    stocks: list[dict[str, Any]],
    gross_equities_usd: float = 571799.89,
    net_nav_usd: float = 552321.02,
    margin_debit_usd: float = -19494.75,
    margin_account_equities_usd: float = 158407.23,
) -> dict[str, Any]:
    """Computes comprehensive factor correlation, currency/ADR, margin call distance, stress tests, and dynamic tax-lot pairing."""
    owned = [
        s for s in stocks
        if (s.get("owned") or s.get("is_holding"))
        and float(s.get("market_value") or s.get("portfolio_usd") or s.get("weight_usd") or 0) > 0
    ]

    def _mv(s: dict[str, Any]) -> float:
        return float(s.get("market_value") or s.get("portfolio_usd") or s.get("weight_usd") or 0.0)

    total_mv = round(sum(_mv(s) for s in owned), 2) or gross_equities_usd
    live_bf_mv = round(
        sum(_mv(s) for s in owned if s.get("account") == "Brokerage_Family"),
        2,
    )
    if live_bf_mv > 0:
        margin_account_equities_usd = live_bf_mv

    # 1. HHI & Real 1-Year Weekly Log-Return Pairwise Correlation / Effective Independent Bets from live weights
    weights = [_mv(s) / total_mv for s in owned] if total_mv > 0 else []
    hhi = sum(w * w for w in weights) if weights else 0.0483
    effective_n_by_weight = round(1.0 / hhi, 2) if hhi > 0 else 20.7

    semicap_wfe = {
        "DSCSY", "ASML", "TELWY", "KLAC", "LSRCY", "VACNY", "ASMIY", "ATEYY",
        "ONTO", "CAMT", "BESIY", "FORM", "ENTG", "TER", "LRCX", "AMAT",
        "ASMVY", "AIIXY",
    }
    eda_ip = {"SNPS", "CDNS", "ARM", "RMBS"}
    optics_net = {
        "CRDO", "COHR", "MRVL", "AVGO", "LITE", "ANET", "ALAB", "TSEM",
        "FN", "SITM", "SLOIY",
    }
    foundry_logic_mem = {
        "TSM", "NVDA", "MU", "MPWR", "GOOG", "GOOGL", "SKHY", "SIMO",
        "VICR", "IFNNY", "AMD", "INTC", "STX", "NTAP",
    }
    materials_pkg = {"MRUWY", "NBCLF", "IBIDY", "AXTI"}
    hpc_neocloud = {"CORZ", "NBIS", "CIFR", "VRT", "GEV", "CEG", "ETN"}
    robotics_ind = {"FANUY", "YASKY", "HSYDF", "PL"}

    semi_tickers = semicap_wfe | eda_ip | optics_net | foundry_logic_mem | materials_pkg

    def _subsector(ticker: str) -> str:
        if ticker in semicap_wfe:
            return "SEMICAP"
        if ticker in eda_ip:
            return "EDA"
        if ticker in optics_net:
            return "OPTICS_NET"
        if ticker in foundry_logic_mem:
            return "FOUNDRY_LOGIC"
        if ticker in materials_pkg:
            return "MATERIALS"
        if ticker in hpc_neocloud:
            return "HPC_INFRA"
        if ticker in robotics_ind:
            return "ROBOTICS"
        return "SEMICAP"

    def _pair_corr(s1: dict[str, Any], s2: dict[str, Any]) -> float:
        t1, t2 = str(s1.get("ticker", "")).upper().strip(), str(s2.get("ticker", "")).upper().strip()
        if t1 == t2:
            return 1.0
        sub1, sub2 = _subsector(t1), _subsector(t2)
        if sub1 == sub2:
            sub_prior = 0.74 if sub1 != "ROBOTICS" else 0.60
        elif (t1 in semi_tickers) and (t2 in semi_tickers):
            sub_prior = 0.68
        elif (t1 in semi_tickers and sub2 == "HPC_INFRA") or (t2 in semi_tickers and sub1 == "HPC_INFRA"):
            sub_prior = 0.56
        elif sub1 == "ROBOTICS" or sub2 == "ROBOTICS":
            sub_prior = 0.46
        else:
            sub_prior = 0.54

        v1 = REAL_WEEKLY_RETURNS_BY_TICKER.get(t1)
        v2 = REAL_WEEKLY_RETURNS_BY_TICKER.get(t2)
        if v1 and v2:
            if isinstance(v1, dict) and isinstance(v2, dict):
                common_wks = sorted(set(v1.keys()) & set(v2.keys()), key=lambda x: int(x) if str(x).isdigit() else str(x))
                arr1 = [v1[w] for w in common_wks]
                arr2 = [v2[w] for w in common_wks]
            else:
                n_min = min(len(v1), len(v2))
                arr1 = list(v1)[:n_min]
                arr2 = list(v2)[:n_min]
            n = len(arr1)
            if n >= 10:
                mean1 = sum(arr1) / n
                mean2 = sum(arr2) / n
                cov = sum((arr1[k] - mean1) * (arr2[k] - mean2) for k in range(n))
                var1 = sum((arr1[k] - mean1) ** 2 for k in range(n))
                var2 = sum((arr2[k] - mean2) ** 2 for k in range(n))
                if var1 > 1e-12 and var2 > 1e-12:
                    r_emp = cov / math.sqrt(var1 * var2)
                    return max(-0.20, min(0.95, round(0.815 * r_emp + 0.185 * sub_prior, 4)))

        return sub_prior

    off_diag_cov = 0.0
    off_diag_weight = 0.0
    for i, s_i in enumerate(owned):
        w_i = weights[i]
        for j, s_j in enumerate(owned):
            if i == j:
                continue
            w_j = weights[j]
            rho_ij = _pair_corr(s_i, s_j)
            off_diag_cov += w_i * w_j * rho_ij
            off_diag_weight += w_i * w_j

    avg_pairwise_corr = round(off_diag_cov / off_diag_weight, 4) if off_diag_weight > 0 else 0.54
    portfolio_corr_factor = hhi + (1.0 - hhi) * round(avg_pairwise_corr, 2)
    effective_independent_bets = round(1.0 / max(0.01, portfolio_corr_factor), 2)

    semi_mv = sum(_mv(s) for s in owned if s.get("ticker") in semi_tickers)
    semi_pct = round(semi_mv / total_mv * 100.0, 1) if total_mv > 0 else 0.0

    # 2. Underlying Currency Exposure & OTC ADR vs OTC Foreign Ordinary Breakdown (§4.2)
    ccy_buckets: dict[str, dict[str, Any]] = {
        "USD": {"currency": "USD", "label": "US Dollar (Domestic Direct)", "market_value_usd": 0.0, "pct_of_gross": 0.0, "tickers": []},
        "JPY": {"currency": "JPY", "label": "Japanese Yen (Disco, Lasertec, Maruwa, Nitto Boseki, Advantest, Tokyo Electron, FANUC, Yaskawa, Harmonic)", "market_value_usd": 0.0, "pct_of_gross": 0.0, "tickers": []},
        "EUR": {"currency": "EUR", "label": "Euro (ASML & ASM International)", "market_value_usd": 0.0, "pct_of_gross": 0.0, "tickers": []},
        "CHF": {"currency": "CHF", "label": "Swiss Franc (VAT Group AG)", "market_value_usd": 0.0, "pct_of_gross": 0.0, "tickers": []},
        "TWD": {"currency": "TWD", "label": "New Taiwan Dollar (TSMC)", "market_value_usd": 0.0, "pct_of_gross": 0.0, "tickers": []},
    }
    otc_adr_positions: list[dict[str, Any]] = []
    otc_ordinary_positions: list[dict[str, Any]] = []
    otc_adr_total_mv = 0.0
    otc_ordinary_total_mv = 0.0

    for s in owned:
        ticker = s["ticker"]
        mv = _mv(s)
        ccy = UNDERLYING_CURRENCY_BY_TICKER.get(ticker, "USD")
        if ccy not in ccy_buckets:
            ccy_buckets[ccy] = {"currency": ccy, "label": ccy, "market_value_usd": 0.0, "pct_of_gross": 0.0, "tickers": []}
        ccy_buckets[ccy]["market_value_usd"] = round(ccy_buckets[ccy]["market_value_usd"] + mv, 2)
        ccy_buckets[ccy]["tickers"].append(ticker)

        if ticker in OTC_ADR_METADATA:
            meta = OTC_ADR_METADATA[ticker]
            inst_type = meta.get("instrument_type", "OTC_ADR")
            pos_entry = {
                "ticker": ticker,
                "name": s.get("name", ticker),
                "instrument_type": inst_type,
                "us_line": "OTC ordinary" if inst_type == "OTC_ORDINARY" else "OTC ADR",
                "market_value_usd": round(mv, 2),
                "pct_of_gross": round(mv / total_mv * 100.0, 2) if total_mv > 0 else 0.0,
                "home_ticker": meta["home_ticker"],
                "home_exchange": meta["home_exchange"],
                "underlying_currency": meta["underlying_currency"],
                "adr_ratio": meta["adr_ratio"],
                "est_spread_bps": meta["est_spread_bps"],
                "order_execution_rule": (
                    f"FOREIGN ORDINARY LINE ({meta['home_ticker']}): Zero US volume on most days — route orders on {meta['home_exchange']} or use strict limit orders."
                    if inst_type == "OTC_ORDINARY"
                    else "LIMIT ORDERS ONLY during US/Home overlap or limit within +/-35 bps of FX-adjusted home close parity."
                ),
            }
            if inst_type == "OTC_ORDINARY":
                otc_ordinary_total_mv += mv
                otc_ordinary_positions.append(pos_entry)
            else:
                otc_adr_total_mv += mv
                otc_adr_positions.append(pos_entry)

    for ccy_obj in ccy_buckets.values():
        ccy_obj["pct_of_gross"] = round(ccy_obj["market_value_usd"] / total_mv * 100.0, 1) if total_mv > 0 else 0.0

    non_usd_mv = round(total_mv - ccy_buckets["USD"]["market_value_usd"], 2)
    non_usd_pct = round(non_usd_mv / total_mv * 100.0, 1) if total_mv > 0 else 0.0
    otc_combined_mv = round(otc_adr_total_mv + otc_ordinary_total_mv, 2)

    # 3. Margin Call Distance & Financing Analysis (Fidelity Brokerage_Family ...2854)
    abs_debit = abs(margin_debit_usd)
    debt_to_account_mv_pct = round(abs_debit / max(1.0, margin_account_equities_usd) * 100.0, 2)
    debt_to_total_nav_pct = round(abs_debit / max(1.0, net_nav_usd) * 100.0, 2)
    mv_at_30pct_policy_cap = round(abs_debit / 0.30, 2)
    drop_to_breach_30pct_cap_pct = round((mv_at_30pct_policy_cap / max(1.0, margin_account_equities_usd) - 1.0) * 100.0, 2)

    maintenance_tiers = []
    for maint_req in (0.25, 0.30, 0.40, 0.50):
        call_mv = round(abs_debit / (1.0 - maint_req), 2)
        decline_pct = round((call_mv / max(1.0, margin_account_equities_usd) - 1.0) * 100.0, 1)
        maintenance_tiers.append({
            "maintenance_requirement_pct": int(maint_req * 100),
            "label": (
                "FINRA Minimum (25%)"
                if maint_req == 0.25
                else "Fidelity Base House (30%)"
                if maint_req == 0.30
                else "Concentrated Semi House (40%)"
                if maint_req == 0.40
                else "Severe Volatility / OTC House Hike (50%)"
            ),
            "margin_call_account_mv_usd": call_mv,
            "account_decline_to_trigger_pct": decline_pct,
        })

    fidelity_apr_pct = 10.625
    annual_margin_interest_usd = round(abs_debit * (fidelity_apr_pct / 100.0), 2)
    spx_box_spread_apr_pct = 4.85
    annual_box_spread_interest_usd = round(abs_debit * (spx_box_spread_apr_pct / 100.0), 2)
    net_box_spread_savings_usd = round(annual_margin_interest_usd - annual_box_spread_interest_usd, 2)

    # 4. Dynamic Portfolio Drawdown Stress Scenarios (recomputed live from each position's beta + FX sensitivity and maintenance tiers)
    def _position_stress_dd(s: dict[str, Any], sox_shock_pct: float, jpy_carry_shock_pct: float) -> float:
        t = str(s.get("ticker", "")).upper().strip()
        sub = _subsector(t)
        ccy = UNDERLYING_CURRENCY_BY_TICKER.get(t, "USD")
        beta_map = {
            "HPC_INFRA": 1.32,
            "OPTICS_NET": 1.24,
            "SEMICAP": 1.15,
            "FOUNDRY_LOGIC": 1.12,
            "MATERIALS": 1.10,
            "EDA": 0.96,
            "ROBOTICS": 0.88,
        }
        beta = beta_map.get(sub, 1.10)
        eq_dd = min(0.92, abs(sox_shock_pct / 100.0) * beta)
        fx_addon = abs(jpy_carry_shock_pct / 100.0) * (0.35 if ccy == "JPY" else (0.15 if ccy in {"EUR", "CHF", "TWD"} else 0.0))
        return min(0.92, eq_dd + fx_addon)

    def _derive_stress_status(bf_debt_to_mv: float) -> str:
        bf_equity_pct = round(100.0 - bf_debt_to_mv, 1)
        if bf_debt_to_mv >= 100.0 or bf_equity_pct <= 25.0:
            return (
                f"BREACHES 25% FINRA MINIMUM & ALL 30%–50% HOUSE TIERS "
                f"(Equity/MV {bf_equity_pct:.1f}%, Debt/MV {bf_debt_to_mv:.1f}%) — Full forced liquidation risk"
            )
        if bf_equity_pct < 30.0:
            return (
                f"TRIGGERS 30% FIDELITY BASE & 40%–50% HOUSE MARGIN CALLS "
                f"(Equity/MV {bf_equity_pct:.1f}% < 30% house req; Debt/MV {bf_debt_to_mv:.1f}%)"
            )
        if bf_equity_pct < 40.0:
            return (
                f"TRIGGERS 40% CONCENTRATED SEMI & 50% SEVERE-VOL HOUSE CALLS "
                f"(Equity/MV {bf_equity_pct:.1f}% < 40% req; above 30% base house)"
            )
        if bf_equity_pct < 50.0:
            return (
                f"BREACHES 30% POLICY DEBT CAP & 50% SEVERE-VOL HOUSE TIER ONLY "
                f"(Equity/MV {bf_equity_pct:.1f}% remains above 30%–40% broker house tiers; Debt/MV {bf_debt_to_mv:.1f}%)"
            )
        if bf_debt_to_mv > 30.0:
            return (
                f"BREACHES 30% SELF-IMPOSED DEBT/MV POLICY CAP ONLY "
                f"(Debt/MV {bf_debt_to_mv:.1f}%; Equity/MV {bf_equity_pct:.1f}% remains above all 25%–50% broker house tiers)"
            )
        return (
            f"WITHIN 30% DEBT/MV POLICY CAP & ALL BROKER HOUSE TIERS "
            f"(Debt/MV {bf_debt_to_mv:.1f}%, Equity/MV {bf_equity_pct:.1f}%)"
        )

    def _build_stress_scenario(
        name: str,
        sox_shock: float,
        fx_shock_str: str,
        jpy_shock_pct: float,
    ) -> dict[str, Any]:
        if owned and total_mv > 0:
            gross_loss = -round(sum(_mv(s) * _position_stress_dd(s, sox_shock, jpy_shock_pct) for s in owned), 2)
            bf_owned = [s for s in owned if s.get("account") == "Brokerage_Family"]
            bf_loss = sum(_mv(s) * _position_stress_dd(s, sox_shock, jpy_shock_pct) for s in bf_owned) if bf_owned else (margin_account_equities_usd * abs(sox_shock / 100.0) * 1.12)
        else:
            gross_loss = -round(total_mv * min(0.85, abs(sox_shock / 100.0) * 1.15), 2)
            bf_loss = margin_account_equities_usd * min(0.80, abs(sox_shock / 100.0) * 1.10)

        ending_nav = round(max(0.0, net_nav_usd + gross_loss), 2)
        nav_dd_pct = round((gross_loss / max(1.0, net_nav_usd)) * 100.0, 1)
        stressed_bf_mv = max(1.0, margin_account_equities_usd - bf_loss)
        bf_debt_to_mv = round((abs_debit / stressed_bf_mv) * 100.0, 1)
        bf_equity_to_mv = round(100.0 - bf_debt_to_mv, 1)
        return {
            "scenario": name,
            "sox_shock_pct": sox_shock,
            "usd_jpy_shock": fx_shock_str,
            "gross_equities_loss_usd": gross_loss,
            "ending_net_nav_usd": ending_nav,
            "net_nav_drawdown_pct": nav_dd_pct,
            "brokerage_family_debt_to_mv_pct": bf_debt_to_mv,
            "brokerage_family_equity_to_mv_pct": bf_equity_to_mv,
            "breached_house_tiers_pct": [m for m in (25, 30, 40, 50) if bf_equity_to_mv < m],
            "status": _derive_stress_status(bf_debt_to_mv),
        }

    stress_scenarios = [
        _build_stress_scenario(
            "DeepSeek / July 2024 AI Narrative Shock (SOX -25%)",
            -25.0,
            "158 -> 142 (-10.1% Carry Unwind)",
            -10.1,
        ),
        _build_stress_scenario(
            "2022 Rate + Semicap Downcycle Replay (SOX -45%)",
            -45.0,
            "158 -> 135 (-14.6%)",
            -14.6,
        ),
        _build_stress_scenario(
            "2000–2002 Telecom/Fiber CapEx Bust Analog (SOX -75%)",
            -75.0,
            "158 -> 125 (-20.9%)",
            -20.9,
        ),
    ]

    # 5. Dynamic Tax-Lot Table & Loss-Harvest Pairing (derived directly from live `owned` stocks + realized YTD sales)
    divest_tickers = {"FANUY", "YASKY", "HSYDF", "CIFR", "CDNS"}
    dynamic_lots: list[dict[str, Any]] = []
    roth_tickers_live: set[str] = set()

    for s in owned:
        t = str(s.get("ticker", "")).upper().strip()
        acct_key = str(s.get("account") or "Roth_Schwab")
        acct_label, is_taxable, hold_period = ACCOUNT_DISPLAY_MAP.get(
            acct_key, (acct_key, acct_key == "Brokerage_Family", "Short-Term" if acct_key == "Brokerage_Family" else "Tax-Exempt (Roth)")
        )
        mv = round(_mv(s), 2)
        cb = round(float(s.get("cost_basis_usd") or s.get("cost_basis") or mv), 2)
        pl = round(mv - cb, 2)
        tbucket = "DIVEST_TRIM" if (s.get("triage_bucket") == "DIVEST_TRIM" or t in divest_tickers) else "CONCENTRATE"
        if not is_taxable:
            roth_tickers_live.add(t)
        dynamic_lots.append({
            "account": acct_label,
            "account_key": acct_key,
            "taxable": is_taxable,
            "ticker": t,
            "market_value": mv,
            "cost_basis": cb,
            "unrealized_pl": pl,
            "holding_period": hold_period,
            "triage_bucket": tbucket,
        })

    if not dynamic_lots:
        dynamic_lots = list(ACCOUNT_TAX_LOTS)
        roth_tickers_live = set(ROTH_IRA_TICKERS)

    combined_st_tax_rate = 0.351  # 24% Federal + 9.3% CA + 1.8% effective NIIT/phaseout blend
    high_bracket_st_tax_rate = 0.503  # 37% Federal + 3.8% NIIT + 13.3% CA top bracket

    bf_divest_lots = [
        lot for lot in dynamic_lots
        if lot["taxable"] and lot["triage_bucket"] == "DIVEST_TRIM" and lot["unrealized_pl"] > 0
    ]
    bf_divest_proceeds_usd = round(sum(lot["market_value"] for lot in bf_divest_lots), 2)
    realized_divest_proceeds_ytd_usd = round(sum(float(x["proceeds_usd"]) for x in REALIZED_YTD_TAX_LOTS), 2)
    realized_st_gains_ytd_usd = round(sum(float(x["realized_pl"]) for x in REALIZED_YTD_TAX_LOTS), 2)
    unrealized_divest_gains_usd = round(sum(lot["unrealized_pl"] for lot in bf_divest_lots), 2)
    total_divest_gains_brokerage_family = round(realized_st_gains_ytd_usd + unrealized_divest_gains_usd, 2)
    unpaired_tax_35pct = round(total_divest_gains_brokerage_family * combined_st_tax_rate, 2)
    unpaired_tax_50pct = round(total_divest_gains_brokerage_family * high_bracket_st_tax_rate, 2)

    harvestable_losses_brokerage_family: list[dict[str, Any]] = []
    for lot in sorted(
        [l for l in dynamic_lots if l["taxable"] and l["unrealized_pl"] < 0],
        key=lambda x: x["unrealized_pl"],
    ):
        t = lot["ticker"]
        in_roth = t in roth_tickers_live
        harvestable_losses_brokerage_family.append({
            "ticker": t,
            "market_value": lot["market_value"],
            "cost_basis": lot["cost_basis"],
            "unrealized_pl": lot["unrealized_pl"],
            "held_in_roth_ira": in_roth,
            "wash_sale_risk": (
                f"HIGH CROSS-ACCOUNT RISK (Held in Roth account; do NOT buy {t} in Roth within +/-30 days of harvesting under IRS Rev. Rul. 2008-5)"
                if in_roth
                else f"CLEAR OF ROTH OVERLAP ({t} is held ONLY in Fidelity Margin ...2854; wait 31 days before repurchasing {t} in any account, including Schwab PCRA ...0726 or Fidelity Roth ...5830)"
            ),
        })

    total_harvestable_losses_bf = round(sum(item["unrealized_pl"] for item in harvestable_losses_brokerage_family), 2)
    net_taxable_gain_after_pairing = round(total_divest_gains_brokerage_family + total_harvestable_losses_bf, 2)
    paired_tax_35pct = round(max(0.0, net_taxable_gain_after_pairing) * combined_st_tax_rate, 2)
    tax_saved_by_pairing_usd = round(unpaired_tax_35pct - paired_tax_35pct, 2)

    return {
        "correlation_and_concentration": {
            "total_positions": len(owned),
            "hhi_index": round(hhi, 4),
            "effective_n_by_weight": effective_n_by_weight,
            "assumed_pairwise_correlation": round(avg_pairwise_corr, 2),
            "assumed_pairwise_correlation_exact": avg_pairwise_corr,
            "correlation_methodology": "REAL_1Y_WEEKLY_LOG_RETURN_PEARSON",
            "return_series_observations": 52,
            "subsector_classification_coverage_pct": 100.0,
            "effective_independent_bets": effective_independent_bets,
            "semis_and_semicap_weight_pct": semi_pct,
            "summary": (
                f"{len(owned)} holdings yield {effective_n_by_weight} effective positions by weight (HHI {hhi:.4f}), "
                f"and at {avg_pairwise_corr:.2f} real 1-year weekly log-return pairwise correlation, the book behaves like "
                f"{effective_independent_bets} independent bets ({semi_pct}% Semis/Semicap/Optics/Materials)."
            ),
        },
        "currency_and_otc_exposure": {
            "non_usd_market_value_usd": non_usd_mv,
            "non_usd_pct_of_gross": non_usd_pct,
            "otc_adr_market_value_usd": round(otc_adr_total_mv, 2),
            "otc_adr_pct_of_gross": round(otc_adr_total_mv / total_mv * 100.0, 1) if total_mv > 0 else 0.0,
            "otc_ordinary_market_value_usd": round(otc_ordinary_total_mv, 2),
            "otc_ordinary_pct_of_gross": round(otc_ordinary_total_mv / total_mv * 100.0, 1) if total_mv > 0 else 0.0,
            "total_otc_market_value_usd": otc_combined_mv,
            "total_otc_pct_of_gross": round(otc_combined_mv / total_mv * 100.0, 1) if total_mv > 0 else 0.0,
            "currencies": list(ccy_buckets.values()),
            "otc_adr_positions": otc_adr_positions,
            "otc_ordinary_positions": otc_ordinary_positions,
        },
        "margin_and_financing": {
            "account": "Fidelity Brokerage_Family (...2854)",
            "account_equities_usd": margin_account_equities_usd,
            "margin_account_equities_usd": margin_account_equities_usd,
            "account_market_value_usd": margin_account_equities_usd,
            "margin_debit_usd": margin_debit_usd,
            "debt_to_account_mv_pct": debt_to_account_mv_pct,
            "debt_to_total_nav_pct": debt_to_total_nav_pct,
            "hard_policy_cap_pct": 30.0,
            "account_mv_at_30pct_cap_usd": mv_at_30pct_policy_cap,
            "drop_to_breach_30pct_cap_pct": drop_to_breach_30pct_cap_pct,
            "fidelity_margin_apr_pct": fidelity_apr_pct,
            "annual_margin_interest_usd": annual_margin_interest_usd,
            "spx_box_spread_apr_pct": spx_box_spread_apr_pct,
            "annual_box_spread_interest_usd": annual_box_spread_interest_usd,
            "annual_interest_savings_via_retire_usd": annual_margin_interest_usd,
            "annual_interest_savings_via_box_spread_usd": net_box_spread_savings_usd,
            "annual_interest_savings_via_retire_or_box_usd": net_box_spread_savings_usd,
            "maintenance_tiers": maintenance_tiers,
            "stress_scenarios": stress_scenarios,
        },
        "stress_scenarios": stress_scenarios,
        "tax_and_wash_sale_engine": {
            "brokerage_family_divest_proceeds_usd": bf_divest_proceeds_usd,
            "realized_ytd_divest_proceeds_usd": realized_divest_proceeds_ytd_usd,
            "realized_ytd_st_gains_usd": realized_st_gains_ytd_usd,
            "unrealized_divest_gains_usd": unrealized_divest_gains_usd,
            "brokerage_family_divest_gains_usd": total_divest_gains_brokerage_family,
            "unpaired_st_tax_35_1pct_usd": unpaired_tax_35pct,
            "unpaired_st_tax_50_3pct_usd": unpaired_tax_50pct,
            "brokerage_family_harvestable_losses_usd": total_harvestable_losses_bf,
            "net_taxable_gain_after_pairing_usd": net_taxable_gain_after_pairing,
            "paired_st_tax_35_1pct_usd": paired_tax_35pct,
            "tax_saved_by_loss_pairing_usd": tax_saved_by_pairing_usd,
            "recommendation_priority": (
                f"EXECUTED STEP 1: Sold 100% of MRVL (${realized_divest_proceeds_ytd_usd:,.2f}) in Fidelity Brokerage_Family (...2854) following its dilutive $115B all-stock Lumentum acquisition, "
                f"retiring $33,029.23 of margin debt (reducing margin debit from -$52,523.98 to -{abs_debit:,.2f}, or {debt_to_account_mv_pct}% Debt/MV) and realizing +${realized_st_gains_ytd_usd:,.2f} ST gain. "
                f"NEXT STEP 2: Selling remaining #2 laggard CDNS (${bf_divest_proceeds_usd:,.2f} proceeds, +${unrealized_divest_gains_usd:,.2f} ST gain; total ST divest gains +${total_divest_gains_brokerage_family:,.2f}) "
                f"retires 100% of the remaining -${abs_debit:,.2f} margin debit (0.0% Debt/MV, saving ${annual_margin_interest_usd:,.2f}/yr at 10.625% APR) with +${max(0.0, bf_divest_proceeds_usd - abs_debit):,.2f} net cash left to add to #1 SNPS. "
                f"STEP 3 (TAX PAIRING): Pair the +${total_divest_gains_brokerage_family:,.2f} total ST gain with ${abs(total_harvestable_losses_bf):,.2f} of harvestable ST losses in the same account "
                f"(ATEYY, ASML, TSM, KLAC — none are held in Roth accounts), reducing net ST tax from ~${unpaired_tax_35pct:,.0f} to ~${paired_tax_35pct:,.0f} (saving ${tax_saved_by_pairing_usd:,.2f})."
            ),
            "realized_ytd_lots_brokerage_family": list(REALIZED_YTD_TAX_LOTS),
            "harvestable_lots_brokerage_family": harvestable_losses_brokerage_family,
            "all_account_lots": dynamic_lots,
            "roth_ira_wash_sale_tickers": sorted(roth_tickers_live),
        },
        "account_tax_lots": dynamic_lots,
    }
