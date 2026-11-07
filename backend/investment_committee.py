"""Investment Committee (multi-persona agent swarm) consensus layer for Apex Compute Terminal.

The committee verdict is deliberately kept SEPARATE from the algorithmic bottleneck score:
- `bottleneck_score` / `rating` / `triage_bucket` = what the rubric computes (unchanged).
- `committee_verdict` = what the multi-persona committee decided after debate (the policy layer).

Source of truth: backend/data/investment_committee.json (written after each committee session).
Live holdings and prices from the normalized terminal payload are used to price every
recommended trade and to compute the post-trade book, so the panel never shows stale dollars.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

COMMITTEE_PATH = Path(__file__).parent / "data" / "investment_committee.json"

ALLOWED_ACTIONS = {"KEEP", "ADD", "TRIM", "SELL", "BUY", "WATCH", "AVOID", "HOLD"}
SELL_ACTIONS = {"SELL", "TRIM"}
BUY_ACTIONS = {"BUY", "ADD"}


def load_committee_state(path: Path = COMMITTEE_PATH) -> Dict[str, Any]:
    """Loads the latest committee session; returns {} when no session has been recorded."""
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def _holding_index(norm_stocks: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {str(s.get("ticker")).upper(): s for s in norm_stocks if s.get("is_holding")}


def _synthesize_dynamic_verdict(s: Dict[str, Any], session_id: str | None = None, as_of: str | None = None) -> Dict[str, Any]:
    """Synthesizes a policy-layer committee verdict for any user-added or edited ticker from its rubric score and swarm debate."""
    t = str(s.get("ticker", "")).upper()
    score = s.get("bottleneck_score")
    is_hold = bool(s.get("is_holding"))
    tb = str(s.get("triage_bucket", ""))
    debate = s.get("swarm_debate") or {}
    votes = debate.get("votes") or {"BUY": 3, "HOLD": 2, "SELL": 1}
    v_for = int(votes.get("BUY", 0)) + (int(votes.get("HOLD", 0)) if is_hold else 0)
    v_against = int(votes.get("SELL", 0))
    v_split = max(0, 6 - v_for - v_against)

    if score is not None and float(score) >= 82:
        action = "ADD" if is_hold else "BUY"
        conviction = "HIGH"
        bucket = "CORE_MONOPOLY" if is_hold else "NEW_ALLOCATION"
    elif score is not None and float(score) >= 62:
        action = "KEEP" if is_hold else "WATCH"
        conviction = "HIGH" if float(score) >= 75 else "MEDIUM"
        bucket = "CORE_MONOPOLY"
    elif (score is not None and float(score) < 55) or tb == "DIVEST_TRIM":
        action = "SELL" if is_hold else "AVOID"
        conviction = "HIGH"
        bucket = "EXIT"
    else:
        action = "KEEP" if is_hold else "WATCH"
        conviction = "MEDIUM"
        bucket = "TACTICAL_SWING"

    headline = (
        f"{action} — {s.get('name', t)} ({s.get('layer', 'L3')} · Score {score if score is not None else 'UNSCORED'}/100)"
    )
    rationale = str(
        debate.get("consensus_rationale")
        or s.get("thesis")
        or s.get("moat_36m")
        or f"Dynamic 12-Expert Agent Swarm consensus verdict for {t}."
    )
    key_risk = str(
        s.get("primary_risk_factor")
        or "Monitor valuation multiple vs. 3-year EPS CAGR and physical bottleneck share."
    )
    return {
        "action": action,
        "conviction": conviction,
        "bucket": bucket,
        "headline": headline,
        "rationale": rationale,
        "key_risk": key_risk,
        "votes": {"for": max(1, v_for), "against": v_against, "split": v_split},
        "committee_id": session_id or "ic-dynamic-swarm",
        "as_of": as_of or "Dynamic Swarm Session",
        "is_dynamic_verdict": True,
    }


def price_trades(trades: List[Dict[str, Any]], holdings: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Resolves each trade's dollar amount against live holdings (full exits use live market value; skips removed holdings)."""
    priced: List[Dict[str, Any]] = []
    for tr in trades:
        t = str(tr.get("ticker", "")).upper()
        action = str(tr.get("action", "")).upper()
        h = holdings.get(t) or {}
        live_mv = float(h.get("portfolio_usd") or h.get("weight_usd") or 0.0)
        if action in SELL_ACTIONS and (t not in holdings or live_mv <= 0.0):
            continue
        amount = tr.get("amount_usd")
        if action == "SELL" and (amount is None or tr.get("full_exit", True)):
            amount = live_mv
        elif action == "TRIM" and amount is not None:
            amount = min(float(amount), live_mv)
        amount = round(float(amount or 0.0), 2)
        if amount <= 0.0:
            continue
        priced.append({
            **tr,
            "ticker": t,
            "action": action,
            "amount_usd": amount,
            "live_position_usd": round(live_mv, 2),
            "account": tr.get("account") or h.get("account") or "",
        })
    return priced


def account_cash_flows(priced: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    """Per-account sources (sells/trims) vs. uses (buys/adds) so the plan is self-funding per account."""
    flows: Dict[str, Dict[str, float]] = {}
    for tr in priced:
        acct = str(tr.get("account") or "UNASSIGNED")
        f = flows.setdefault(acct, {"sources_usd": 0.0, "uses_usd": 0.0})
        if tr["action"] in SELL_ACTIONS:
            f["sources_usd"] = round(f["sources_usd"] + tr["amount_usd"], 2)
        elif tr["action"] in BUY_ACTIONS:
            f["uses_usd"] = round(f["uses_usd"] + tr["amount_usd"], 2)
    for f in flows.values():
        f["net_cash_usd"] = round(f["sources_usd"] - f["uses_usd"], 2)
    return flows


def post_trade_book(priced: List[Dict[str, Any]], holdings: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Applies the recommended trades to live holdings and returns position weights after the plan."""
    book: Dict[str, float] = {t: float(h.get("portfolio_usd") or h.get("weight_usd") or 0.0) for t, h in holdings.items()}
    cash = 0.0
    for tr in priced:
        t, amt = tr["ticker"], tr["amount_usd"]
        if tr["action"] in SELL_ACTIONS:
            book[t] = max(0.0, book.get(t, 0.0) - amt)
            cash += amt
        elif tr["action"] in BUY_ACTIONS:
            book[t] = book.get(t, 0.0) + amt
            cash -= amt
    book = {t: v for t, v in book.items() if v > 1.0}
    total = sum(book.values()) + max(0.0, cash)
    rows = [
        {"ticker": t, "usd": round(v, 2), "weight_pct": round(100.0 * v / max(1.0, total), 2)}
        for t, v in sorted(book.items(), key=lambda kv: -kv[1])
    ]
    return {
        "positions": rows,
        "names_count": len(rows),
        "residual_cash_usd": round(cash, 2),
        "total_usd": round(total, 2),
        "max_weight_pct": rows[0]["weight_pct"] if rows else 0.0,
    }


def apply_committee_verdicts(norm_stocks: List[Dict[str, Any]], committee: Dict[str, Any]) -> None:
    """Attaches the committee's per-ticker verdict to each stock (or synthesizes a dynamic verdict for user-added/edited holdings) without touching rubric scores."""
    per_ticker = committee.get("per_ticker") or {}
    session = committee.get("committee_id")
    as_of = committee.get("as_of")
    for s in norm_stocks:
        t = str(s.get("ticker", "")).upper()
        v = per_ticker.get(t)
        if v and not s.get("user_edited"):
            s["committee_verdict"] = {**v, "committee_id": session, "as_of": as_of}
        elif s.get("is_holding") or s.get("is_custom_stock") or s.get("user_edited"):
            s["committee_verdict"] = _synthesize_dynamic_verdict(s, session_id=session, as_of=as_of)


def build_investment_committee_payload(norm_stocks: List[Dict[str, Any]], committee: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Returns the committee session enriched with live trade pricing, per-account funding and the post-trade book."""
    committee = committee if committee is not None else load_committee_state()
    if not committee:
        return {}
    holdings = _holding_index(norm_stocks)
    per_ticker = dict(committee.get("per_ticker") or {})
    for t, h in holdings.items():
        if t not in per_ticker or h.get("user_edited"):
            per_ticker[t] = h.get("committee_verdict") or _synthesize_dynamic_verdict(
                h, session_id=committee.get("committee_id"), as_of=committee.get("as_of")
            )
    priced = price_trades(committee.get("trades") or [], holdings)
    return {
        **committee,
        "per_ticker": per_ticker,
        "trades": priced,
        "account_cash_flows": account_cash_flows(priced),
        "post_trade_book": post_trade_book(priced, holdings),
        "holdings_without_verdict": sorted(t for t in holdings if t not in per_ticker),
    }

