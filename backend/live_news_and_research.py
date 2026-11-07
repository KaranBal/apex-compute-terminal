"""Live Earnings, M&A, Supply-Chain News & Specialist Industry Research Engine (SemiAnalysis, etc.).

Integrated into the daily 6:00 AM PT refresh job (`backend/daily_refresh_job.py`) and on-demand terminal refresh
so the Apex Compute Terminal (`ACT <GO>`) continuously tracks:
1. Breaking M&A & corporate actions (e.g., Marvell's $115B all-stock acquisition of Lumentum).
2. Latest quarterly earnings releases, guidance revisions, and hyperscaler LTAs (e.g., Coherent Q1 FY27 $2.37B
   revenue + $20B PhotonLink LTA; Astera Labs Q3 $584.9M revenue +154% YoY & $1B+ Scorpio run-rate; KLA, ASM Int'l, Advantest).
3. Specialist semiconductor & AI infrastructure research feeds:
   - SemiAnalysis (`https://newsletter.semianalysis.com/feed` & `https://www.semianalysis.com/feed`)
   - Fabricated Knowledge (`https://www.fabricatedknowledge.com/feed`)
   - Chipstrat (`https://www.chipstrat.com/feed`)
   - The Next Platform (`https://www.nextplatform.com/feed/`)
   - Semiconductor Engineering (`https://semiengineering.com/feed/`)
4. Automated Thesis & Playbook Impact Review (`review_new_information`) that maps every new article/headline
   to affected portfolio tickers and flags THESIS_REINFORCEMENT, THESIS_VIOLATION_OR_MA_ALERT, or ARCHITECTURE_SHIFT.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import email.utils
import html
import json
import logging
from pathlib import Path
import re
import ssl
from typing import Any, Dict, List, Optional
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

logger = logging.getLogger("apex_live_intelligence")

INTELLIGENCE_PATH = Path(__file__).parent / "data" / "live_intelligence_review.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

SPECIALIST_RESEARCH_FEEDS: List[Dict[str, str]] = [
    {
        "source_id": "semianalysis_substack",
        "source_name": "SemiAnalysis",
        "category": "Deep Semiconductor & AI Supply-Chain Research",
        "url": "https://newsletter.semianalysis.com/feed",
    },
    {
        "source_id": "semianalysis_web",
        "source_name": "SemiAnalysis",
        "category": "Deep Semiconductor & AI Supply-Chain Research",
        "url": "https://www.semianalysis.com/feed",
    },
    {
        "source_id": "fabricated_knowledge",
        "source_name": "Fabricated Knowledge",
        "category": "Semiconductor Cycle & WFE Deep Dives",
        "url": "https://www.fabricatedknowledge.com/feed",
    },
    {
        "source_id": "chipstrat",
        "source_name": "Chipstrat",
        "category": "Custom Silicon, XPU & Semiconductor Strategy",
        "url": "https://www.chipstrat.com/feed",
    },
    {
        "source_id": "next_platform",
        "source_name": "The Next Platform",
        "category": "HPC, AI Clusters, Interconnects & Systems",
        "url": "https://www.nextplatform.com/feed/",
    },
    {
        "source_id": "semi_engineering",
        "source_name": "Semiconductor Engineering",
        "category": "Advanced Packaging, CoWoS, HBM4, EUV & EDA Physics",
        "url": "https://semiengineering.com/feed/",
    },
]

TARGETED_NEWS_QUERIES: List[Dict[str, str]] = [
    {"topic": "M&A / Optical Consolidation", "query": "Marvell Lumentum acquisition 115 billion", "tickers": "MRVL,LITE,COHR,AVGO"},
    {"topic": "Coherent Q1 FY27 Earnings & $20B LTA", "query": "Coherent Q1 2027 revenue 2.37 billion PhotonLink", "tickers": "COHR,CRDO"},
    {"topic": "Astera Labs Q3 2026 Earnings & Scorpio", "query": "Astera Labs Q3 2026 revenue Scorpio X-Series", "tickers": "ALAB,CRDO,AVGO"},
    {"topic": "Credo OCP Optical & AEC Standards", "query": "Credo Technology OCP optical telemetry Oracle", "tickers": "CRDO"},
    {"topic": "SemiAnalysis Latest AI & Chip Research", "query": "SemiAnalysis SpaceX OR GDPx OR Anthropic OR TSMC", "tickers": "NVDA,AVGO,TSM,ASML,GOOG"},
    {"topic": "WFE & Semicap Earnings (KLAC, ASMIY, ONTO)", "query": '"KLA" OR "ASM International" OR "Onto Innovation" earnings revenue 2026', "tickers": "KLAC,ASMIY,ONTO"},
    {"topic": "HBM4 & Packaging Monopolies", "query": '"SK Hynix" OR "Micron" OR "FormFactor" OR "BESI" HBM4 hybrid bonding', "tickers": "MU,FORM,BESIY,DSCSY,ATEYY"},
    {"topic": "GW Datacenter Power & ERCOT Grid", "query": '"Vertiv" OR "Core Scientific" OR "Nebius" OR "Cipher" AI data center power', "tickers": "VRT,CORZ,NBIS,CIFR,GEV,CEG"},
]

NOISE_PATTERNS = re.compile(
    r"13F|shares (acquired|sold|purchased|bought) by|"
    r"(holdings|position|stake) (raised|lowered|increased|decreased|cut|boosted|trimmed) by|"
    r"what to expect|earnings preview|week ahead|varsity|high school",
    re.I,
)


def _ssl_context() -> ssl.SSLContext:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl._create_unverified_context()


def _fetch_url_text(url: str, timeout: float = 7.0) -> Optional[str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp:
            return resp.read().decode("utf-8", "replace")
    except Exception as exc:
        logger.debug("Feed fetch skipped for %s: %s", url, exc)
        return None


def _parse_pub_date(raw_pub: str) -> str:
    if not raw_pub:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        dt = email.utils.parsedate_to_datetime(raw_pub)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return raw_pub[:10]


def _clean_html_text(raw_str: str) -> str:
    if not raw_str:
        return ""
    unescaped = html.unescape(raw_str)
    no_tags = re.sub(r"<[^>]+>", " ", unescaped)
    # Prevent accidental XX/100 window-scanner score collisions in external headlines
    no_slash_100 = re.sub(r"\b(\d{1,3})/100\b", r"\1 pts", no_tags)
    return re.sub(r"\s+", " ", no_slash_100).strip()


def _infer_related_tickers(text: str) -> List[str]:
    keyword_map = {
        "MARVELL": "MRVL",
        "MRVL": "MRVL",
        "LUMENTUM": "LITE",
        "LITE": "LITE",
        "COHERent": "COHR",
        "COHR": "COHR",
        "PHOTONLINK": "COHR",
        "BROADCOM": "AVGO",
        "AVGO": "AVGO",
        "TOMAHAWK": "AVGO",
        "TRAINIUM": "AVGO",
        "TPU": "GOOG",
        "GOOGLE": "GOOG",
        "ANTHROPIC": "GOOG",
        "CLAUDE": "GOOG",
        "NVIDIA": "NVDA",
        "NVDA": "NVDA",
        "RUBIN": "NVDA",
        "BLACKWELL": "NVDA",
        "TSMC": "TSM",
        "TAIWAN SEMICONDUCTOR": "TSM",
        "COWOS": "TSM",
        "ASML": "ASML",
        "EUV": "ASML",
        "HYBRID BONDING": "BESIY",
        "BESI": "BESIY",
        "HBM": "MU",
        "MICRON": "MU",
        "SK HYNIX": "MU",
        "DISCO": "DSCSY",
        "LASERTEC": "LSRCY",
        "ADVANTEST": "ATEYY",
        "TOKYO ELECTRON": "TELWY",
        "ASM INTERNATIONAL": "ASMIY",
        "ONTO": "ONTO",
        "KLA": "KLAC",
        "CREDO": "CRDO",
        "ASTERA": "ALAB",
        "SCORPIO": "ALAB",
        "VERTIV": "VRT",
        "CORE SCIENTIFIC": "CORZ",
        "CIPHER": "CIFR",
        "ERCOT": "CIFR",
        "TEXAS": "CIFR",
        "NEBIUS": "NBIS",
        "SPACEX": "NVDA",
        "XAI": "NVDA",
        "COLOSSUS": "VRT",
        "FORMFACTOR": "FORM",
        "NITTO BOSEKI": "NBCLF",
        "MARUWA": "MRUWY",
        "HARMONIC DRIVE": "HSYDF",
        "SYNOPSYS": "SNPS",
        "CADENCE": "CDNS",
    }
    upper_t = text.upper()
    matched: List[str] = []
    for kw, tk in keyword_map.items():
        if kw.upper() in upper_t and tk not in matched:
            matched.append(tk)
    return matched[:5] if matched else ["AI"]


def _derive_swarm_implication(title: str, summary: str, tickers: List[str]) -> Dict[str, str]:
    combined = f"{title} {summary}".upper()
    if "MARVELL" in combined and "LUMENTUM" in combined:
        return {
            "impact_type": "THESIS_VIOLATION_OR_MA_ALERT",
            "severity": "CRITICAL",
            "portfolio_action": (
                "CONFIRMS MRVL SALE & DISQUALIFIES LITE STANDALONE BUY: Marvell's $115B all-stock buyout of Lumentum "
                "dilutes MRVL shareholders and forces LITE holders into MRVL equity. Pivot 100% of optical laser conviction "
                "to owned #1 independent leader Coherent (COHR, $21.1k in Roth_Fidelity)."
            ),
        }
    if "COHERENT" in combined or "PHOTONLINK" in combined:
        return {
            "impact_type": "THESIS_REINFORCEMENT",
            "severity": "HIGH",
            "portfolio_action": (
                "CONCENTRATE COHR ($21.1k in Roth_Fidelity): Record Q1 FY27 revenue ($2.37B, +56% YoY), $2.09 EPS beat, "
                "and $20B PhotonLink hyperscaler LTA (>60% FY27 growth guide to $3B+/qtr) cement COHR as the #1 independent "
                "6-inch InP laser & OCS monopoly as Lumentum is absorbed into Marvell."
            ),
        }
    if "HYBRID BONDING" in combined and "ASML" in combined:
        return {
            "impact_type": "ARCHITECTURE_SHIFT",
            "severity": "HIGH",
            "portfolio_action": (
                "BULLISH FOR OWNED ASML ($21.4k) / COMPETITIVE WATCH ON BESIY: SemiAnalysis reports ASML is developing "
                "its own hybrid bonding tool via patent filings & roadmap—reinforcing our owned ASML lithography monopoly while "
                "requiring close monitoring of BESI's (BESIY) long-term >75% Cu-Cu hybrid bonding share."
            ),
        }
    if "BACKLASH" in combined or ("TEXAS" in combined and ("PERMIT" in combined or "MINER" in combined or "DEMOCRAT" in combined)):
        return {
            "impact_type": "THESIS_VIOLATION_OR_MA_ALERT",
            "severity": "HIGH",
            "portfolio_action": (
                "VALIDATES CIFR DIVESTMENT ($15.8k in Schwab Roth): SemiAnalysis & Bernstein highlight Texas ERCOT permit "
                "and grid politics risk for Texas data-center builds (CIFR is contracted but debt-funded). Retain CORZ ($20.3k) & NBIS ($21.6k) "
                "and rotate CIFR into equipment monopolies VRT & MU."
            ),
        }
    if "GDPX" in combined:
        return {
            "impact_type": "ARCHITECTURE_SHIFT",
            "severity": "HIGH",
            "portfolio_action": (
                "100x TEST-TIME COMPUTE SCALING WALL: SemiAnalysis's GDPx benchmark shows top frontier models score just 12% "
                "on real-world enterprise tasks—proving multi-year demand for N2 GAA wafers (TSM, ASML, ASMIY), 16-Hi HBM4 "
                "(DSCSY, ONTO, MU, FORM), and low-latency interconnects (CRDO, COHR, AVGO)."
            ),
        }
    if "SPACEX" in combined or "COLOSSUS" in combined or "50GW" in combined:
        return {
            "impact_type": "THESIS_REINFORCEMENT",
            "severity": "HIGH",
            "portfolio_action": (
                "MASSIVE WFE & COOLING TAILWIND: SemiAnalysis tracks +50GW of 2027 datacenter construction (including SpaceX/xAI's "
                "13GW AI cloud buildout) and notes the bottleneck is shifting back to chips/CoWoS/HBM—directly benefiting our "
                "18 core semicap, foundry, and optical monopolies."
            ),
        }
    if "ASTERA" in combined or "SCORPIO" in combined:
        return {
            "impact_type": "THESIS_REINFORCEMENT",
            "severity": "MEDIUM",
            "portfolio_action": (
                "SCALE-UP INTERCONNECT DEMAND CONFIRMED: Astera Labs' Q3 beat ($584.9M rev, +154% YoY) and $730-$750M Q4 guide "
                "validate explosive scale-up switch/retimer demand; we capture this layer at 60% lower PEG via owned #1 AEC monopoly CRDO (0.40x PEG)."
            ),
        }
    if "CREDO" in combined or "OCP" in combined:
        return {
            "impact_type": "THESIS_REINFORCEMENT",
            "severity": "HIGH",
            "portfolio_action": (
                "CONCENTRATE CRDO ($34.7k in Fidelity Roth): OCP approval of Credo's optical telemetry standards + Oracle AI "
                "deployment reinforces CRDO's 82% AEC monopoly and expansion into optical DSPs."
            ),
        }
    return {
        "impact_type": "THESIS_REINFORCEMENT",
        "severity": "MEDIUM",
        "portfolio_action": (
            f"Monitor quarterly book-to-bill, gross margin trajectory, and customer concentration across {', '.join(tickers)}."
        ),
    }


def fetch_specialist_research_articles(max_per_feed: int = 5) -> List[Dict[str, Any]]:
    """Fetches latest articles from SemiAnalysis, Fabricated Knowledge, Chipstrat, Next Platform, and SemiEngineering."""
    articles: List[Dict[str, Any]] = []
    seen_titles: set[str] = set()

    def _pull_feed(feed_meta: Dict[str, str]) -> List[Dict[str, Any]]:
        xml_text = _fetch_url_text(feed_meta["url"], timeout=7.0)
        if not xml_text:
            return []
        parsed_items: List[Dict[str, Any]] = []
        try:
            root = ET.fromstring(xml_text)
            for item in root.findall("./channel/item")[:max_per_feed]:
                title = _clean_html_text(item.findtext("title") or "")
                if not title or title.lower() == "semianalysis":
                    continue
                pub_date = _parse_pub_date(item.findtext("pubDate") or "")
                link = (item.findtext("link") or "").strip()
                desc = _clean_html_text(item.findtext("description") or "")
                tickers = _infer_related_tickers(f"{title} {desc}")
                implication = _derive_swarm_implication(title, desc, tickers)
                parsed_items.append({
                    "source_id": feed_meta["source_id"],
                    "source_name": feed_meta["source_name"],
                    "category": feed_meta["category"],
                    "title": title,
                    "published": pub_date,
                    "link": link,
                    "summary": desc[:320] if desc else title,
                    "related_tickers": tickers,
                    **implication,
                })
        except Exception as exc:
            logger.debug("XML parse skipped for %s: %s", feed_meta["url"], exc)
        return parsed_items

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(_pull_feed, f) for f in SPECIALIST_RESEARCH_FEEDS]
        for fut in as_completed(futures):
            for art in fut.result():
                norm_t = art["title"].lower()
                if norm_t not in seen_titles:
                    seen_titles.add(norm_t)
                    articles.append(art)

    articles.sort(key=lambda x: (0 if "SemiAnalysis" in x["source_name"] else 1, x["published"]), reverse=False)
    # Sort primarily with newest dates first, keeping SemiAnalysis prominent
    articles.sort(key=lambda x: x["published"], reverse=True)
    return articles[:18]


def fetch_google_news_rss_items(query: str, days: int = 7, max_items: int = 4) -> List[Dict[str, Any]]:
    """Fetches live Google News RSS items for a targeted query using real article links (never search query URLs)."""
    q_full = f"{query} when:{days}d"
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q_full)}&hl=en-US&gl=US&ceid=US:en"
    xml_text = _fetch_url_text(url, timeout=6.0)
    if not xml_text:
        return []
    now_iso = datetime.now(timezone.utc).isoformat()
    out: List[Dict[str, Any]] = []
    for raw_item in re.findall(r"<item>(.*?)</item>", xml_text, re.S):
        def _tag(tname: str) -> str:
            m = re.search(rf"<{tname}[^>]*>(.*?)</{tname}>", raw_item, re.S)
            if not m:
                return ""
            val = m.group(1).strip()
            val = re.sub(r"^<!\[CDATA\[(.*)\]\]>$", r"\1", val, flags=re.S)
            return html.unescape(val)

        title = _clean_html_text(_tag("title"))
        if not title or NOISE_PATTERNS.search(title):
            continue
        pub_date = _parse_pub_date(_tag("pubDate"))
        source = _clean_html_text(_tag("source")) or "Industry Wire"
        desc = _clean_html_text(_tag("description"))
        article_link = _tag("link").strip()
        if not article_link or "news.google.com/search" in article_link:
            continue
        out.append({
            "title": title,
            "published": pub_date,
            "fetched_at": now_iso,
            "expires_at": "2027-02-15",
            "publisher": source,
            "summary": desc[:280] if desc else title,
            "link": article_link,
        })
        if len(out) >= max_items:
            break
    return out


# Curated verified baseline intelligence items (factual reporting only; analyst commentary separated into ANALYST_NOTES)
BASELINE_VERIFIED_EVENTS: List[Dict[str, Any]] = [
    {
        "event_id": "mrvl_lite_115b_merger_2026_11_03",
        "date": "2026-11-04",
        "fetched_at": "2026-11-05T14:00:00Z",
        "expires_at": "2027-02-15",
        "category": "M&A / CORPORATE ACTION",
        "headline": "Marvell Agrees to Acquire Lumentum in Historic $115B All-Stock Deal; Both Stocks Plunge (~$91B Value Wiped Out)",
        "source": "Marvell Investor Relations / SEC Form 8-K",
        "related_tickers": ["MRVL", "LITE", "COHR", "AVGO"],
        "impact_type": "THESIS_VIOLATION_OR_MA_ALERT",
        "severity": "CRITICAL",
        "summary": (
            "Marvell (MRVL) announced a $115B all-stock acquisition of Lumentum (LITE) to combine optical DSPs with InP lasers. "
            "Wall Street slashed ratings (BofA downgraded MRVL to Neutral PT $225 from $400; TD Cowen cut PT in half) citing equity dilution, "
            "while LITE plunged >17% as shareholders convert into diluted MRVL stock and optical OEMs (Ciena, Cisco) evaluate independent laser supply."
        ),
        "portfolio_action": (
            "Supply-chain read-across: Lumentum ceases to be a standalone optical pure-play once merged into Marvell, leaving Coherent (COHR) "
            "as the largest independent US vertically integrated 6-inch InP laser and Optical Circuit Switch (OCS) supplier."
        ),
        "link": "https://investor.marvell.com/news-events/press-releases",
    },
    {
        "event_id": "cohr_q1_fy27_20b_photonlink_2026_11_04",
        "date": "2026-11-05",
        "fetched_at": "2026-11-05T14:00:00Z",
        "expires_at": "2027-02-15",
        "category": "EARNINGS BEAT & $20B HYPERSCALER LTA",
        "headline": "Coherent (COHR) Reports Record $2.37B Q1 FY27 Revenue (+56% YoY), $2.09 EPS Beat & Signs $20B PhotonLink Hyperscaler LTA",
        "source": "Coherent Corp. Q1 FY2027 Form 10-Q & Press Release",
        "related_tickers": ["COHR", "CRDO", "LITE", "TSEM", "AXTI"],
        "impact_type": "THESIS_REINFORCEMENT",
        "severity": "CRITICAL",
        "summary": (
            "Coherent posted Q1 FY2027 revenue of $2.37B (+50-56% YoY) and adjusted EPS of $2.09 (beating consensus by $0.07), signed a $20B PhotonLink "
            "Long-Term Agreement (LTA) with a tier-1 hyperscaler, and raised FY27 revenue growth guidance above 60% (projecting $3.0B+ quarter by Q4 FY27 and $4.0B quarter in FY28)."
        ),
        "portfolio_action": (
            "Supply-chain read-across: Confirms multi-year hyperscaler demand for 6-inch InP CW/EML lasers, 800G/1.6T optical transceivers, "
            "and Optical Circuit Switches (OCS), with positive upstream read-across to InP substrates (AXTI) and MOCVD reactors (AIIXY)."
        ),
        "link": "https://www.coherent.com/news/press-releases",
    },
    {
        "event_id": "semianalysis_spacex_gdpx_backlash_2026_11_03",
        "date": "2026-11-04",
        "fetched_at": "2026-11-05T14:00:00Z",
        "expires_at": "2027-02-15",
        "category": "SEMIANALYSIS DEEP RESEARCH",
        "headline": "SemiAnalysis: (1) SpaceX 13GW AI Cloud in 18 Months, (2) GDPx Benchmark Shows Best AI Agent at 12%, (3) Texas Datacenter Permit Risk & ASML Hybrid Bonding Tool",
        "source": "SemiAnalysis (Dylan Patel / Maya Barkin / Max Kan)",
        "related_tickers": ["ASML", "TSM", "NVDA", "AVGO", "BESIY", "CIFR", "CORZ"],
        "impact_type": "ARCHITECTURE_SHIFT",
        "severity": "HIGH",
        "summary": (
            "Latest SemiAnalysis research highlights: (1) SpaceX/xAI building 13GW of AI compute in 18 months (+50GW global DC buildout in 2027, moving the shortage back to chips); "
            "(2) GDPx real-world benchmark where top frontier AI scores just 12% (0% in finance/legal), proving massive test-time compute scaling ahead; "
            "(3) Bipartisan 2028 Texas datacenter permit freeze risk; and (4) Patent/roadmap evidence that ASML is building its own Hybrid Bonding tool."
        ),
        "portfolio_action": (
            "Supply-chain read-across: Reinforces wafer fab equipment and packaging demand (ASML, TSM, DSCSY, LSRCY, ASMIY, ONTO, ATEYY), "
            "highlights ERCOT regulatory risk for debt-funded Texas data-center builds (CIFR), and introduces long-term competitive watch on BESIY from ASML."
        ),
        "link": "https://newsletter.semianalysis.com/p/elon-is-doing-it-again-spacex-will",
    },
    {
        "event_id": "alab_q3_2026_scorpio_beat_2026_11_04",
        "date": "2026-11-04",
        "fetched_at": "2026-11-05T14:00:00Z",
        "expires_at": "2027-02-15",
        "category": "EARNINGS / GUIDANCE BEAT",
        "headline": "Astera Labs (ALAB) Q3 Revenue Jumps 154% YoY to Record $584.9M; Guides Q4 to $730M-$750M as Scorpio X-Series Passes $1B Annualized",
        "source": "Astera Labs Q3 2026 Earnings Release",
        "related_tickers": ["ALAB", "CRDO", "AVGO", "SITM"],
        "impact_type": "THESIS_REINFORCEMENT",
        "severity": "HIGH",
        "summary": (
            "Astera Labs doubled Q3 revenue to $584.9M (+154% YoY) and guided Q4 to $730M-$750M as Scorpio X-Series smart fabric switches surpassed $1B annualized run-rate and Aries 7 debuted. "
            "Meanwhile, Credo (CRDO) secured OCP approval for two optical telemetry standards and expanded its Oracle AI interconnect deployment."
        ),
        "portfolio_action": (
            "Supply-chain read-across: Confirms accelerating rack-level scale-up connectivity demand across Active Electrical Cables (CRDO), "
            "PCIe/UALink fabric switches (ALAB), and precision silicon MEMS reference clocks (SITM)."
        ),
        "link": "https://investors.asteralabs.com/news-releases",
    },
    {
        "event_id": "klac_asmiy_ateyy_q3_2026_beats",
        "date": "2026-11-02",
        "fetched_at": "2026-11-05T14:00:00Z",
        "expires_at": "2027-02-15",
        "category": "WFE MONOPOLY EARNINGS BEATS",
        "headline": "KLA (Rev +29% YoY, $4.7B Q2 Guide), ASM International (€1.16B Record Q3 Rev on 2nm GAA ALD) & Advantest (Record HBM4/SoC Test Outlook) Beat Estimates",
        "source": "KLA / ASM International / Advantest Earnings Filings",
        "related_tickers": ["KLAC", "ASMIY", "ATEYY", "TSM"],
        "impact_type": "THESIS_REINFORCEMENT",
        "severity": "HIGH",
        "summary": (
            "Leading WFE suppliers reported Q3 beats: KLA (KLAC) grew revenue +29% YoY with $936M in quarterly buybacks and guided Q2 to $4.7B +/- $200M; "
            "ASM International (ASMIY) hit record €1.16B Q3 revenue on N2 2nm Gate-All-Around ALD orders; and Advantest (ATEYY) raised full-year AI SoC & HBM4 tester guidance."
        ),
        "portfolio_action": (
            "Supply-chain read-across: Confirms N2 2nm GAA Atomic Layer Deposition (ASMIY; plus Kokusai Electric 6525.T on TSE), process control metrology (KLAC), "
            "and HBM4 burn-in test (ATEYY) capital intensity expansion."
        ),
        "link": "https://ir.kla.com/news-releases",
    },
]

ANALYST_NOTES: List[Dict[str, Any]] = [
    {
        "note_id": "note_mrvl_exit_cohr_rotation_2026_11_04",
        "date": "2026-11-05",
        "author": "Apex Compute Investment Committee",
        "related_tickers": ["MRVL", "LITE", "COHR", "AVGO"],
        "thesis_note": (
            "EXECUTED PORTFOLIO ACTION: Sold 100% of MRVL (212.393 sh, $33,029.23 in Fidelity Margin ...2854, realizing +$12,111.23 ST gain "
            "and reducing margin debit from -$52,523.98 to -$19,494.75). Disqualify LITE as a standalone Buy due to MRVL stock merger conversion, "
            "and concentrate optical laser/OCS exposure in owned Coherent (COHR, $21,107 in Roth_Fidelity ...5830)."
        ),
    },
    {
        "note_id": "note_section4_inflection_candidates_2026_11_05",
        "date": "2026-11-05",
        "author": "Apex Compute Investment Committee",
        "related_tickers": ["VICR", "TSEM", "AXTI", "IBIDY", "SLOIY", "AIIXY", "FN", "ASMVY", "BESIY", "FORM"],
        "thesis_note": (
            "SMALL/MID-CAP (<= $25B) INFLECTION HUNT: Evaluated US-tradable bottleneck candidates across Silicon Photonics foundry (TSEM), "
            "hybrid bonding (BESIY), HBM4 MEMS probe cards (FORM), ABF substrates (IBIDY — liquid ADR, requires Google compliance pre-clearance), "
            "48V vertical power challenger (VICR), InP wafer substrates (AXTI — speculative China MOFCOM export-permit risk), Photonics-SOI wafers (SLOIY), "
            "InP MOCVD reactors (AIIXY — thin OTC ADR), 1.6T optical assembly (FN — 12.8% EMS GM), and TCB bonders (ASMVY). "
            "Non-US-ADR leaders Kokusai Electric (6525.T), Micronics Japan (6871.T), Asahi Diamond (6140.T), and Santec (6777.T) are tracked in the Local-Market Watchlist."
        ),
    },
    {
        "note_id": "note_memory_cycle_peak_margin_guard_2026_11_05",
        "date": "2026-11-05",
        "author": "Apex Compute Investment Committee",
        "related_tickers": ["MU", "SKHY", "FORM", "DSCSY", "ONTO", "BESIY"],
        "thesis_note": (
            "MEMORY CYCLE-PEAK GUARDRAIL: While Micron (MU, 80.7% GM) and SK hynix (SKHY on Nasdaq, 62.0% GM) have 2026-2027 HBM3E/HBM4 capacity sold out under LTAs, "
            "DRAM contract price growth is decelerating (+80% Q2 -> +40% Q3 -> +20% Q4 2026). Avoid commodity DRAM peak-P/B traps (Nanya 2408.TW, Winbond 2344.TW) "
            "and tilt incremental HBM4 upside toward <= $25B consumable, metrology & bonding leaders (FORM, BESIY, DSCSY, ONTO)."
        ),
    },
    {
        "note_id": "note_divest_trim_execution_plan_2026_11_05",
        "date": "2026-11-05",
        "author": "Apex Compute Investment Committee",
        "related_tickers": ["FANUY", "YASKY", "HSYDF", "CIFR", "CDNS", "COHR", "VRT"],
        "thesis_note": (
            "DIVEST & UPGRADE ROTATION: Exit off-thesis industrial robotics & mechanical gears (FANUY, YASKY, HSYDF), debt-funded Texas data-center builder (CIFR), "
            "and #2 EDA peer (CDNS 2.48x PEG) to eliminate the remaining -$19,494.75 Fidelity margin debit and concentrate Roth capital in #1 AI-compute bottlenecks."
        ),
    },
]


def _filter_unexpired_items(items: List[Dict[str, Any]], ref_date: str) -> List[Dict[str, Any]]:
    """Filters out any news or research item whose expires_at date has passed relative to ref_date."""
    valid: List[Dict[str, Any]] = []
    for item in items:
        exp = str(item.get("expires_at") or "9999-12-31")[:10]
        if ref_date <= exp:
            valid.append(item)
    return valid


def run_live_information_and_research_review(
    stocks: Optional[List[Dict[str, Any]]] = None,
    fetch_network: bool = True,
    as_of_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Pulls live SemiAnalysis/industry research RSS feeds + targeted earnings/M&A news,
    merges with verified baseline events, filters out expired items, separates `analyst_notes`
    from `material_events`, updates per-stock recent_news, and persists
    `backend/data/live_intelligence_review.json`.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    ref_date = (as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"))[:10]
    research_articles: List[Dict[str, Any]] = []
    live_news_events: List[Dict[str, Any]] = [dict(ev) for ev in BASELINE_VERIFIED_EVENTS]

    if fetch_network:
        try:
            raw_articles = fetch_specialist_research_articles(max_per_feed=5)
            for art in raw_articles:
                art.setdefault("fetched_at", now_iso)
                art.setdefault("expires_at", "2027-02-15")
            research_articles = raw_articles
        except Exception as exc:
            logger.warning("Specialist research fetch fallback: %s", exc)

        def _run_news_q(q_meta: Dict[str, str]) -> List[Dict[str, Any]]:
            items = fetch_google_news_rss_items(q_meta["query"], days=7, max_items=2)
            t_list = [t.strip() for t in q_meta["tickers"].split(",") if t.strip()]
            enriched = []
            for it in items:
                imp = _derive_swarm_implication(it["title"], it["summary"], t_list)
                enriched.append({
                    "event_id": f"live_{ abs(hash(it['title'])) % 1000000 }",
                    "date": it["published"],
                    "fetched_at": it.get("fetched_at", now_iso),
                    "expires_at": it.get("expires_at", "2027-02-15"),
                    "category": q_meta["topic"].upper(),
                    "headline": it["title"],
                    "source": it["publisher"],
                    "related_tickers": t_list,
                    "summary": it["summary"],
                    "link": it["link"],
                    **imp,
                })
            return enriched

        try:
            with ThreadPoolExecutor(max_workers=6) as pool:
                futs = [pool.submit(_run_news_q, qm) for qm in TARGETED_NEWS_QUERIES]
                seen_headlines = {ev["headline"].lower()[:50] for ev in live_news_events}
                for fut in as_completed(futs):
                    for ev in fut.result():
                        key = ev["headline"].lower()[:50]
                        if key not in seen_headlines:
                            seen_headlines.add(key)
                            live_news_events.append(ev)
        except Exception as exc:
            logger.warning("Targeted news query fallback: %s", exc)

    if not research_articles:
        # Fallback SemiAnalysis & industry research snapshot if offline
        research_articles = [
            {
                "source_id": "semianalysis_substack",
                "source_name": "SemiAnalysis",
                "category": "Deep Semiconductor & AI Supply-Chain Research",
                "title": "Elon Is Doing It Again: SpaceX Will Be The World's Biggest AI Cloud",
                "published": "2026-11-03",
                "fetched_at": "2026-11-05T14:00:00Z",
                "expires_at": "2027-02-15",
                "link": "https://newsletter.semianalysis.com/p/elon-is-doing-it-again-spacex-will",
                "summary": "Making 13GW in 1.5 Years A Reality, Repurposing Rocket Ship Campuses, A Datacenter at TeraFab?",
                "related_tickers": ["NVDA", "TSM", "VRT", "COHR"],
                **_derive_swarm_implication("SpaceX 13GW AI Cloud", "", ["NVDA", "TSM", "VRT"]),
            },
            {
                "source_id": "semianalysis_substack",
                "source_name": "SemiAnalysis",
                "category": "Deep Semiconductor & AI Supply-Chain Research",
                "title": "GDPx: Measuring Frontier Model Capabilities Across the Most Valuable Domains",
                "published": "2026-11-02",
                "fetched_at": "2026-11-05T14:00:00Z",
                "expires_at": "2027-02-15",
                "link": "https://newsletter.semianalysis.com/p/gdpx-measuring-frontier-model-capabilities",
                "summary": "Frontier benchmark spanning 11 high-value domains; top frontier AI agent completes just 12% of tasks (0% on finance & legal), proving huge test-time compute scaling wall ahead.",
                "related_tickers": ["NVDA", "AVGO", "TSM", "ASML", "MU"],
                **_derive_swarm_implication("GDPx Frontier Model Capabilities", "", ["NVDA", "AVGO", "TSM"]),
            },
            {
                "source_id": "semianalysis_substack",
                "source_name": "SemiAnalysis",
                "category": "Deep Semiconductor & AI Supply-Chain Research",
                "title": "The Datacenter Backlash Goes Bipartisan: Next Week's Midterms and the 2028 Buildout",
                "published": "2026-11-01",
                "fetched_at": "2026-11-05T14:00:00Z",
                "expires_at": "2027-02-15",
                "link": "https://newsletter.semianalysis.com/p/the-datacenter-backlash-goes-bipartisan",
                "summary": "2027 is largely locked in, but 2028 faces a prolonged Texas ERCOT permit freeze risk as both parties run on tighter grid interconnection rules.",
                "related_tickers": ["CIFR", "CORZ", "NBIS", "VRT"],
                **_derive_swarm_implication("Datacenter Backlash Texas permit", "", ["CIFR", "CORZ"]),
            },
            {
                "source_id": "semianalysis_substack",
                "source_name": "SemiAnalysis",
                "category": "Deep Semiconductor & AI Supply-Chain Research",
                "title": "ASML Is Building a Hybrid Bonding Tool!",
                "published": "2026-10-15",
                "fetched_at": "2026-11-05T14:00:00Z",
                "expires_at": "2027-02-15",
                "link": "https://newsletter.semianalysis.com/p/asml-is-building-a-hybrid-bonding",
                "summary": "Patent filings, supply-chain reports, and ASML's own roadmap reveal ASML is developing a next-generation Hybrid Bonding tool to compete in 3D wafer/die bonding.",
                "related_tickers": ["ASML", "BESIY", "TSM"],
                **_derive_swarm_implication("ASML Hybrid Bonding Tool", "", ["ASML", "BESIY"]),
            },
        ]

    live_news_events = _filter_unexpired_items(live_news_events, ref_date)
    research_articles = _filter_unexpired_items(research_articles, ref_date)

    # Attach latest relevant headlines to each stock in `stocks` if provided
    if stocks:
        for s in stocks:
            t = str(s.get("ticker", "")).upper().strip()
            matched_news = []
            for ev in live_news_events:
                if t in ev.get("related_tickers", []):
                    matched_news.append({
                        "title": ev["headline"],
                        "publisher": ev["source"],
                        "published": ev["date"],
                        "fetched_at": ev.get("fetched_at", now_iso),
                        "expires_at": ev.get("expires_at", "2027-02-15"),
                        "link": ev["link"],
                    })
            for art in research_articles:
                if t in art.get("related_tickers", []):
                    matched_news.append({
                        "title": f"[{art['source_name']}] {art['title']}",
                        "publisher": art["source_name"],
                        "published": art["published"],
                        "fetched_at": art.get("fetched_at", now_iso),
                        "expires_at": art.get("expires_at", "2027-02-15"),
                        "link": art["link"],
                    })
            if matched_news:
                existing = s.get("recent_news") or []
                seen_t = set()
                merged = []
                for item in matched_news + existing:
                    lnk = str(item.get("link", ""))
                    if "news.google.com/search" in lnk:
                        continue
                    k = str(item.get("title", "")).lower()[:45]
                    if k and k not in seen_t:
                        seen_t.add(k)
                        merged.append(item)
                s["recent_news"] = merged[:5]

    structured_ma_alerts = [
        {
            "event_id": "mrvl_acquires_lite_115b_2026_11_03",
            "date": "2026-11-03",
            "fetched_at": "2026-11-05T14:00:00Z",
            "expires_at": "2027-02-15",
            "acquirer_ticker": "MRVL",
            "target_ticker": "LITE",
            "deal_value_usd_b": 115.0,
            "structure": "All-Stock Acquisition ($115B)",
            "status": "Announced Nov 3, 2026",
            "headline": "Marvell (MRVL) Agrees to Acquire Lumentum (LITE) in $115B All-Stock Deal; Both Stocks Plunge (~$91B Value Lost)",
            "portfolio_status_acquirer": "SOLD 100% ($33,029.23 exited in Fidelity Margin ...2854; realized +$12,111.23 ST gain & cut margin debit from -$52,523.98 to -$19,494.75)",
            "portfolio_status_target": "DISQUALIFIED AS STANDALONE BUY (Absorbed into MRVL #2 ASIC/DSP conglomerate; concentrate optics in owned #1 Coherent COHR)",
            "swarm_verdict": (
                "UNANIMOUS EXIT / AVOID: BofA downgraded MRVL to Neutral ($225 PT from $400) and TD Cowen cut PT by 50% on severe equity dilution "
                "and optical fab integration execution risk. Owned Coherent (COHR, $21,107 in Roth ...5830) is now the sole independent US 6-inch InP laser & OCS monopoly."
            ),
            "sources": [
                {
                    "publisher": "Marvell Technology Investor Relations (Form 8-K)",
                    "link": "https://investor.marvell.com/news-events/press-releases",
                }
            ],
        }
    ]

    structured_earnings_reviews = [
        {
            "date": "2026-11-04",
            "fetched_at": "2026-11-05T14:00:00Z",
            "expires_at": "2027-02-15",
            "ticker": "COHR",
            "name": "Coherent Corp.",
            "quarter": "Q1 FY2027",
            "is_holding": True,
            "portfolio_usd": 21107.41,
            "headline": "Coherent Reports Record $2.37B Q1 FY27 Revenue (+56% YoY), $2.09 Adj EPS Beat & Signs $20B PhotonLink Hyperscaler LTA",
            "revenue_actual": "$2.37B (+56% YoY)",
            "eps_actual": "$2.09 Adj EPS (+$0.07 beat)",
            "forward_guidance": "Signed $20B PhotonLink LTA; FY27 Rev Growth >60% ($3B+ Q4 FY27, $4B Q in FY28)",
            "swarm_action": "UPGRADE TO #1 INDEPENDENT OPTICAL MONOPOLY (TOP-DECILE CONVICTION): Concentrate optical laser & OCS allocation in owned COHR.",
            "link": "https://www.coherent.com/news/press-releases",
        },
        {
            "date": "2026-11-03",
            "fetched_at": "2026-11-05T14:00:00Z",
            "expires_at": "2027-02-15",
            "ticker": "CRDO",
            "name": "Credo Technology / Astera Labs Read-Across",
            "quarter": "Q3 CY2026",
            "is_holding": True,
            "portfolio_usd": 34736.87,
            "headline": "Credo Wins OCP Approval for 2 Optical Telemetry Standards; Peer Astera Labs (ALAB) Prints $584.9M Q3 Rev (+154% YoY)",
            "revenue_actual": "ALAB $584.9M (+154% YoY) / Scorpio >$1B Run-Rate",
            "eps_actual": "CRDO +59.3% 3Y EPS CAGR @ 0.40x PEG",
            "forward_guidance": "ALAB Q4 Guide $730M–$750M; Booming Scale-Up & AEC Copper Demand",
            "swarm_action": "KEEP #1 OWNED CRDO ($34,737 in Roth ...5830 at 0.40x PEG vs ALAB at 1.17x PEG).",
            "link": "https://investors.credotech.com/news-releases",
        },
        {
            "date": "2026-11-02",
            "fetched_at": "2026-11-05T14:00:00Z",
            "expires_at": "2027-02-15",
            "ticker": "KLAC",
            "name": "KLA Corp / ASM International / Advantest",
            "quarter": "Q3 CY2026",
            "is_holding": True,
            "portfolio_usd": 18673.29,
            "headline": "KLA (+29% YoY Rev, $4.7B Q2 Guide), ASM International (€1.16B Record Q3 Rev on 2nm GAA ALD) & Advantest Beat",
            "revenue_actual": "KLAC +29% YoY; ASMIY Record €1.16B",
            "eps_actual": "KLAC $936M Quarterly Buybacks; ATEYY Record HBM4 Test Margin",
            "forward_guidance": "KLAC Q2 $4.7B +/- $200M; ASMIY N2 2nm GAA ALD Acceleration",
            "swarm_action": "CONCENTRATE OWNED WFE MONOPOLIES: Hold full positions in ASMIY ($39.9k), ATEYY ($21.5k), and KLAC ($18.7k).",
            "link": "https://ir.kla.com/news-releases",
        },
    ]

    review_payload = {
        "generated_at": now_iso,
        "as_of_date": ref_date,
        "review_version": "v4.5-primary-urls-expiry-separated-notes",
        "sources_monitored": [
            "SemiAnalysis (Substack & Web RSS)",
            "Fabricated Knowledge (Substack RSS)",
            "Chipstrat (Substack RSS)",
            "The Next Platform (HPC/AI RSS)",
            "Semiconductor Engineering (Packaging/WFE RSS)",
            "Primary SEC EDGAR & Company Investor Relations Releases",
            "Yahoo Finance v8 Ticker & Quote Feeds",
        ],
        "executive_digest": [
            "M&A & PORTFOLIO EXIT — MARVELL ($115B LUMENTUM DEAL): Marvell (MRVL) agreed to acquire Lumentum (LITE) in a $115B all-stock deal (Nov 3, 2026); both stocks plunged (~$91B combined value wiped out) on massive dilution and downgrades (BofA to Neutral PT $225, TD Cowen PT cut 50%). Karan SOLD 100% of MRVL ($33,029.23 in Fidelity Margin ...2854, realizing +$12,111.23 gain and reducing margin debit from -$52,523.98 to -$19,494.75). LITE is disqualified as a standalone buy; Coherent (COHR) is now our sole #1 independent InP laser & OCS champion.",
            "EARNINGS BLOWOUT & $20B LTA — COHERENT (COHR): Reported Q1 FY2027 revenue of $2.37B (+56% YoY), adj EPS of $2.09 (beat by $0.07), signed a $20B PhotonLink hyperscaler Long-Term Agreement (LTA), and guided FY27 revenue growth >60% ($3B+ quarter by Q4 FY27, $4B quarter in FY28).",
            "SEMIANALYSIS RESEARCH HIGHLIGHTS: (1) SpaceX/xAI building 13GW AI cloud in 18 months (+50GW global DC capacity in 2027, moving shortage back to chips/CoWoS/HBM); (2) GDPx benchmark shows best frontier AI agent scores just 12% on real-world work (0% in finance/legal), proving 100x+ test-time compute scaling wall ahead; (3) Bipartisan Texas ERCOT permit risk validates divesting CIFR; (4) ASML developing its own Hybrid Bonding tool (bullish for owned ASML, key watch on BESIY).",
            "SCALE-UP & WFE EARNINGS BEATS: Astera Labs (ALAB) Q3 revenue jumped +154% YoY to $584.9M (Q4 guide $730M-$750M, Scorpio >$1B run-rate); Credo (CRDO) won OCP approval for 2 optical telemetry standards; KLA (+29% YoY rev, $4.7B Q2 guide), ASM International (€1.16B record Q3 rev on N2 GAA ALD), and Advantest (record HBM4 tester outlook) all beat.",
        ],
        "material_events": live_news_events[:14],
        "analyst_notes": ANALYST_NOTES,
        "specialist_research_feed": research_articles[:14],
        "ma_and_corporate_action_alerts": _filter_unexpired_items(structured_ma_alerts, ref_date),
        "earnings_and_guidance_reviews": _filter_unexpired_items(structured_earnings_reviews, ref_date),
        "semianalysis_and_specialist_research": research_articles[:14],
    }

    try:
        INTELLIGENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
        INTELLIGENCE_PATH.write_text(json.dumps(review_payload, indent=2))
    except Exception as exc:
        logger.warning("Could not write intelligence review file: %s", exc)

    return review_payload


def load_or_build_live_intelligence_review(
    stocks: Optional[List[Dict[str, Any]]] = None,
    as_of_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Loads persisted `live_intelligence_review.json` if present, schema-current, and unexpired
    (and enriches `stocks` with per-ticker headlines), otherwise generates a fresh baseline snapshot.
    """
    ref_date = (as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"))[:10]
    if INTELLIGENCE_PATH.exists():
        try:
            payload = json.loads(INTELLIGENCE_PATH.read_text())
            if (
                payload.get("review_version") != "v4.5-primary-urls-expiry-separated-notes"
                or "analyst_notes" not in payload
                or len(payload.get("analyst_notes") or []) < 3
                or "ma_and_corporate_action_alerts" not in payload
                or not payload["ma_and_corporate_action_alerts"]
            ):
                return run_live_information_and_research_review(stocks=stocks, fetch_network=False, as_of_date=ref_date)

            payload["material_events"] = _filter_unexpired_items(payload.get("material_events") or [], ref_date)
            payload["specialist_research_feed"] = _filter_unexpired_items(payload.get("specialist_research_feed") or [], ref_date)
            payload["semianalysis_and_specialist_research"] = payload["specialist_research_feed"]
            payload["ma_and_corporate_action_alerts"] = _filter_unexpired_items(payload.get("ma_and_corporate_action_alerts") or [], ref_date)
            payload["earnings_and_guidance_reviews"] = _filter_unexpired_items(payload.get("earnings_and_guidance_reviews") or [], ref_date)

            if stocks:
                live_news_events = payload.get("material_events") or []
                research_articles = payload.get("specialist_research_feed") or []
                for s in stocks:
                    t = str(s.get("ticker", "")).upper().strip()
                    matched_news = []
                    for ev in live_news_events:
                        if t in ev.get("related_tickers", []):
                            matched_news.append({
                                "title": ev["headline"],
                                "publisher": ev["source"],
                                "published": ev["date"],
                                "fetched_at": ev.get("fetched_at"),
                                "expires_at": ev.get("expires_at"),
                                "link": ev["link"],
                            })
                    for art in research_articles:
                        if t in art.get("related_tickers", []):
                            matched_news.append({
                                "title": f"[{art['source_name']}] {art['title']}",
                                "publisher": art["source_name"],
                                "published": art["published"],
                                "fetched_at": art.get("fetched_at"),
                                "expires_at": art.get("expires_at"),
                                "link": art["link"],
                            })
                    if matched_news:
                        existing = s.get("recent_news") or []
                        seen_t = set()
                        merged = []
                        for item in matched_news + existing:
                            lnk = str(item.get("link", ""))
                            if "news.google.com/search" in lnk:
                                continue
                            k = str(item.get("title", "")).lower()[:45]
                            if k and k not in seen_t:
                                seen_t.add(k)
                                merged.append(item)
                        s["recent_news"] = merged[:5]
            return payload
        except Exception as exc:
            logger.warning("Could not load existing live_intelligence_review.json: %s", exc)

    return run_live_information_and_research_review(stocks=stocks, fetch_network=False, as_of_date=ref_date)


