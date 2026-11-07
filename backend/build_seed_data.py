#!/usr/bin/env python3
"""Builds the comprehensive seed dataset for Apex Compute Terminal (ACT <GO>)
combining live Nov 4, 2026 Google Finance portfolio sync (karan.ds.bal@gmail.com),
Yahoo Finance market data, StockAnalysis fundamentals, Playbook triggers,
and the 12-Expert Panel + 4-Platform App Swarm frameworks.
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.scoring_engine import compute_unified_stock_scores
from backend.supply_chains_and_triage import get_stock_triage_info

SCRATCH_ROOT = Path("/Users/karansbal/.gemini/jetski/scratch/ai_compute_portfolio")
OUT_PATH = Path("/Users/karansbal/Desktop/projects/apex-compute-terminal/backend/data/terminal_seed_data.json")


def parse_fundamentals_md(md_path: Path) -> dict:
    """Parse markdown table from fundamentals_2026-10-18.md and fundamentals.md."""
    out = {}
    if not md_path.exists():
        return out
    lines = md_path.read_text().splitlines()
    headers = []
    for line in lines:
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if not headers:
            headers = cells
            continue
        if all(set(c) <= {"-"} for c in cells):
            continue
        row = dict(zip(headers, cells))
        raw_t = row.get("ticker", "")
        t = raw_t.split("(")[0].strip()
        if t:
            out[t] = row
    return out


def parse_num(val: str):
    if not val or val in ("n/a", ""):
        return None
    val = val.replace(",", "").replace("%", "").replace("$", "").strip()
    mult = 1.0
    if "trillion" in val.lower():
        mult = 1000.0
        val = val.lower().replace("trillion", "").strip()
    elif "billion" in val.lower():
        mult = 1.0
        val = val.lower().replace("billion", "").strip()
    elif "million" in val.lower():
        mult = 0.001
        val = val.lower().replace("million", "").strip()
    m = re.search(r"[-+]?\d*\.?\d+", val)
    return round(float(m.group(0)) * mult, 3) if m else None


# Curated 12-Expert Panel enrichment per symbol (USD MktCap B, Supply-Chain Layer, Monopoly Share %, Choke Score, Sleeve, 3Y Base MOIC, 3Y Bull MOIC, Panel Conviction)
EXPERT_ENRICHMENT = {
    "GOOG": {
        "name": "Alphabet Inc.",
        "mkt_cap_usd_b": 4150.0,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 6: Hyperscaler & Custom XPU / Cloud",
        "monopoly_share_pct": 90,
        "choke_score": 88,
        "panel_conviction": 76,
        "panel_verdict": "TRIM GLIDE (>28% BF)",
        "base_3y_moic": 1.47,
        "bull_3y_moic": 1.75,
        "target_3y_mkt_cap_b": 6100.0,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["TSM", "AVGO", "COHR", "LITE"],
        "customers": ["Enterprise Cloud", "Waymo", "Consumer AI"],
        "rivals": ["MSFT", "AMZN", "META"],
        "bottleneck_note": "Full-stack TPU v6e/v7p + Optical Circuit Switching (OCS) + Gemini; capped at 26-28% BF due to employer concentration & $4.15T market-cap gravity.",
    },
    "MRVL": {
        "name": "Marvell Technology",
        "mkt_cap_usd_b": 199.8,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 6: Hyperscaler & Custom XPU / Cloud",
        "monopoly_share_pct": 25,
        "choke_score": 74,
        "panel_conviction": 64,
        "panel_verdict": "TRIM ON LTCG -> NVDA/AVGO",
        "base_3y_moic": 1.77,
        "bull_3y_moic": 2.54,
        "target_3y_mkt_cap_b": 354.5,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["TSM", "SNPS", "CDNS"],
        "customers": ["AMZN (Trainium)", "MSFT (Maia)", "GOOG"],
        "rivals": ["AVGO", "ALAB"],
        "bottleneck_note": "#2 custom ASIC & #1/2 1.6T optical DSP; trades at 40.3x Fwd P/E (2.2x more expensive than AVGO/NVDA with 52% GM vs 75% GM). Hold for Day-366 LTCG then rotate half into NVDA/AVGO.",
    },
    "TSM": {
        "name": "Taiwan Semiconductor (TSMC)",
        "mkt_cap_usd_b": 1930.0,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 2: Leading-Edge Foundry & GAA Wafer Fab",
        "monopoly_share_pct": 95,
        "choke_score": 99,
        "panel_conviction": 96,
        "panel_verdict": "DOUBLE-DOWN (#1 Fortress)",
        "base_3y_moic": 2.30,
        "bull_3y_moic": 2.74,
        "target_3y_mkt_cap_b": 4440.0,
        "fx_rate_to_usd": 0.0315,
        "adr_ratio": 5.0,
        "suppliers": ["ASML", "ASMIY", "TELWY", "KLAC", "DSCSY", "ONTO", "NBCLF"],
        "customers": ["NVDA", "AVGO", "GOOG", "AMZN", "AMD", "AAPL"],
        "rivals": ["INTC (18A)", "Samsung Foundry"],
        "bottleneck_note": "95%+ leading-edge AI logic (N2 GAA, A16 backside power) + CoWoS-L & SoIC packaging gatekeeper at 18.8x Fwd P/E (0.45 PEG).",
    },
    "CDNS": {
        "name": "Cadence Design Systems",
        "mkt_cap_usd_b": 88.0,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 1: EUV Lithography, Masks & EDA Toll",
        "monopoly_share_pct": 48,
        "choke_score": 85,
        "panel_conviction": 68,
        "panel_verdict": "HOLD / SOURCE OF FUNDS",
        "base_3y_moic": 1.37,
        "bull_3y_moic": 1.62,
        "target_3y_mkt_cap_b": 120.5,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["TSM IP Ecosystem"],
        "customers": ["NVDA", "AVGO", "GOOG", "AAPL", "AMD"],
        "rivals": ["SNPS", "Siemens EDA"],
        "bottleneck_note": "Essential EDA & Palladium hardware verification duopoly (85.9% GM), but 37.2x Fwd P/E on 16.1% EPS growth (2.48 PEG) yields ~1.37x in 3Y.",
    },
    "SNPS": {
        "name": "Synopsys Inc.",
        "mkt_cap_usd_b": 87.1,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 1: EUV Lithography, Masks & EDA Toll",
        "monopoly_share_pct": 52,
        "choke_score": 88,
        "panel_conviction": 80,
        "panel_verdict": "HOLD CORE (Cheaper EDA)",
        "base_3y_moic": 1.81,
        "bull_3y_moic": 2.05,
        "target_3y_mkt_cap_b": 158.0,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["Ansys Multiphysics"],
        "customers": ["NVDA", "AVGO", "TSM", "AMD", "MRVL"],
        "rivals": ["CDNS", "Siemens EDA"],
        "bottleneck_note": "#1 EDA + HBM4/UCIe IP + Ansys 3D thermal/multiphysics simulation at 25.7x Fwd P/E (1.03 PEG — 31% cheaper than CDNS).",
    },
    "ASML": {
        "name": "ASML Holding",
        "mkt_cap_usd_b": 638.2,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 1: EUV Lithography, Masks & EDA Toll",
        "monopoly_share_pct": 100,
        "choke_score": 100,
        "panel_conviction": 93,
        "panel_verdict": "DOUBLE-DOWN (#2 Fortress)",
        "base_3y_moic": 2.12,
        "bull_3y_moic": 2.71,
        "target_3y_mkt_cap_b": 1350.0,
        "fx_rate_to_usd": 1.09,
        "adr_ratio": 1.0,
        "suppliers": ["Carl Zeiss", "VACNY", "MRUWY"],
        "customers": ["TSM", "SKHY", "MU", "INTC", "Samsung"],
        "rivals": ["None (100% EUV Monopoly)"],
        "bottleneck_note": "100% Low-NA (NXE:3800E) & High-NA (EXE:5000/5200) EUV monopoly; 53.6% FCF margin, 45.2% 3Y EPS CAGR (0.57 implied PEG).",
    },
    "TELWY": {
        "name": "Tokyo Electron",
        "mkt_cap_usd_b": 154.0,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 2: Leading-Edge Foundry & GAA Wafer Fab",
        "monopoly_share_pct": 90,
        "choke_score": 89,
        "panel_conviction": 78,
        "panel_verdict": "HOLD (Tax-Locked)",
        "base_3y_moic": 1.76,
        "bull_3y_moic": 2.12,
        "target_3y_mkt_cap_b": 272.0,
        "fx_rate_to_usd": 0.00645,
        "adr_ratio": 0.5,
        "suppliers": ["VACNY", "MRUWY"],
        "customers": ["TSM", "SKHY", "MU", "Samsung", "Rapidus"],
        "rivals": ["AMAT", "LRCX"],
        "bottleneck_note": "100% EUV coater/developer monopoly (attached 1:1 to every ASML EUV scanner) + cryogenic HAR etch & wafer bonders (0.99 PEG).",
    },
    "ATEYY": {
        "name": "Advantest Corp",
        "mkt_cap_usd_b": 160.0,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test",
        "monopoly_share_pct": 58,
        "choke_score": 90,
        "panel_conviction": 82,
        "panel_verdict": "HOLD CORE / ADD DIP",
        "base_3y_moic": 1.73,
        "bull_3y_moic": 2.16,
        "target_3y_mkt_cap_b": 276.0,
        "fx_rate_to_usd": 0.00645,
        "adr_ratio": 1.0,
        "suppliers": ["FORM", "TPRO.MI", "6871.T"],
        "customers": ["NVDA", "TSM", "SKHY", "AMD", "AVGO"],
        "rivals": ["TER"],
        "bottleneck_note": "V93000 SoC + HBM4 ATE test duopoly leader (65.7% GM, 45.7% OPM); test insertion time per AI chip package is structurally compounding.",
    },
    "KLAC": {
        "name": "KLA Corporation",
        "mkt_cap_usd_b": 216.3,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 2: Leading-Edge Foundry & GAA Wafer Fab",
        "monopoly_share_pct": 56,
        "choke_score": 91,
        "panel_conviction": 84,
        "panel_verdict": "HOLD / BUY DIP <=$150",
        "base_3y_moic": 1.78,
        "bull_3y_moic": 2.03,
        "target_3y_mkt_cap_b": 385.4,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["Carl Zeiss", "High-Precision Optics"],
        "customers": ["TSM", "SKHY", "MU", "INTC"],
        "rivals": ["ONTO (Packaging)", "LSRCY (Actinic Mask)", "AMAT"],
        "bottleneck_note": ">55% front-end wafer inspection & metrology monopoly (61.3% GM, 41.7% OPM); N2 GAA and A16 backside power drive higher inspection intensity.",
    },
    "DSCSY": {
        "name": "Disco Corporation",
        "mkt_cap_usd_b": 35.8,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test",
        "monopoly_share_pct": 80,
        "choke_score": 96,
        "panel_conviction": 86,
        "panel_verdict": "HOLD CORE MONOPOLY (21% RS)",
        "base_3y_moic": 2.85,
        "bull_3y_moic": 3.60,
        "target_3y_mkt_cap_b": 102.0,
        "fx_rate_to_usd": 0.00645,
        "adr_ratio": 0.1,
        "suppliers": ["Synthetic Diamond & CBN Abrasives"],
        "customers": ["SKHY", "TSM", "MU", "Samsung", "ASE"],
        "rivals": ["Tokyo Seimitsu (Accretech)"],
        "bottleneck_note": "80% precision wafer thinning (<30µm for 16-Hi HBM4), dicing & KABRA laser slicing monopoly with 70.8% GM, 43.1% OPM, and recurring consumable blades.",
    },
    "LSRCY": {
        "name": "Lasertec Corp",
        "mkt_cap_usd_b": 23.2,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 1: EUV Lithography, Masks & EDA Toll",
        "monopoly_share_pct": 100,
        "choke_score": 97,
        "panel_conviction": 83,
        "panel_verdict": "HOLD CORE (17% RS)",
        "base_3y_moic": 2.55,
        "bull_3y_moic": 3.20,
        "target_3y_mkt_cap_b": 59.0,
        "fx_rate_to_usd": 0.00645,
        "adr_ratio": 0.2,
        "suppliers": ["EUV Light Sources"],
        "customers": ["TSM", "INTC", "Samsung", "Toppan/DNP Mask Shops"],
        "rivals": ["KLAC / Zeiss (Future Actinic R&D)"],
        "bottleneck_note": "100% actinic (13.5nm EUV wavelength) patterned photomask inspection monopoly (ACTIS A150 / High-NA A300) with 59.2% GM & 45.7% OPM.",
    },
    "ASMIY": {
        "name": "ASM International",
        "mkt_cap_usd_b": 38.8,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 2: Leading-Edge Foundry & GAA Wafer Fab",
        "monopoly_share_pct": 58,
        "choke_score": 93,
        "panel_conviction": 90,
        "panel_verdict": "HOLD / REBALANCE DIP (0.65 PEG)",
        "base_3y_moic": 3.05,
        "bull_3y_moic": 3.85,
        "target_3y_mkt_cap_b": 118.0,
        "fx_rate_to_usd": 1.09,
        "adr_ratio": 1.0,
        "suppliers": ["VACNY", "Specialty Precursors"],
        "customers": ["TSM", "SKHY", "MU", "INTC", "Samsung"],
        "rivals": ["TELWY", "LRCX", "Kokusai Electric"],
        "bottleneck_note": ">55% global monopoly in single-wafer Atomic Layer Deposition (ALD) & selective epitaxy; N2 GAA nanosheets & 4F2 DRAM boost ALD steps >35% (0.65 PEG).",
    },
    "ONTO": {
        "name": "Onto Innovation",
        "mkt_cap_usd_b": 9.75,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test",
        "monopoly_share_pct": 78,
        "choke_score": 95,
        "panel_conviction": 95,
        "panel_verdict": "DOUBLE-DOWN (#1 IC 92/100)",
        "base_3y_moic": 3.35,
        "bull_3y_moic": 4.20,
        "target_3y_mkt_cap_b": 32.7,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["Precision Optical Assemblies"],
        "customers": ["TSM (CoWoS-L)", "SKHY (HBM4)", "MU"],
        "rivals": ["CAMT", "KLAC"],
        "bottleneck_note": "#1 2.5D/3D CoWoS-L & HBM4 Dragonfly bump/void inspection monopoly (~75-80% AI share) at $9.75B cap, net cash, 19.3x Fwd P/E, and 0.48 PEG.",
    },
    "VACNY": {
        "name": "VAT Group AG",
        "mkt_cap_usd_b": 21.1,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 2: Leading-Edge Foundry & GAA Wafer Fab",
        "monopoly_share_pct": 73,
        "choke_score": 92,
        "panel_conviction": 80,
        "panel_verdict": "HOLD CORE (14% RS)",
        "base_3y_moic": 2.35,
        "bull_3y_moic": 2.90,
        "target_3y_mkt_cap_b": 49.6,
        "fx_rate_to_usd": 1.15,
        "adr_ratio": 0.1,
        "suppliers": ["Swiss Precision Alloys & Elastomers"],
        "customers": ["AMAT", "LRCX", "TELWY", "ASML", "ASMIY"],
        "rivals": ["MKS Instruments", "CKD"],
        "bottleneck_note": "70-75% global monopoly in ultra-high-purity semiconductor vacuum valves inside every EUV, ALD, and cryo-etch tool (61.4% GM, 44.3% 3Y EPS CAGR).",
    },
    "CORZ": {
        "name": "Core Scientific",
        "mkt_cap_usd_b": 4.33,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 5: Gigawatt Power, Thermal & Neocloud Shells",
        "monopoly_share_pct": 35,
        "choke_score": 81,
        "panel_conviction": 79,
        "panel_verdict": "HOLD / ADD DIP <=$11.50",
        "base_3y_moic": 2.95,
        "bull_3y_moic": 4.10,
        "target_3y_mkt_cap_b": 12.8,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["VRT", "GEV", "ERCOT/TVA Grid"],
        "customers": ["AMD (2.5GW $14B+ Pact)", "CRWV (590MW §365b)"],
        "rivals": ["CIFR", "IREN", "APLD", "DLR"],
        "bottleneck_note": "2.5 GW ($14B+, 15-yr) AMD investment-grade lease pact + 590 MW CoreWeave liquid-cooled shells trading 53% below rejected $9B buyout.",
    },
    "CIFR": {
        "name": "Cipher Digital",
        "mkt_cap_usd_b": 3.73,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 5: Gigawatt Power, Thermal & Neocloud Shells",
        "monopoly_share_pct": 35,
        "choke_score": 83,
        "panel_conviction": 81,
        "panel_verdict": "HOLD / ADD DIP <=$7.25",
        "base_3y_moic": 3.10,
        "bull_3y_moic": 4.40,
        "target_3y_mkt_cap_b": 11.6,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["VRT", "ERCOT High-Voltage Substations"],
        "customers": ["AMZN (AWS)", "GOOG-Backed Fluidstack"],
        "rivals": ["CORZ", "IREN", "WULF"],
        "bottleneck_note": "$11.4B+ contracted AWS and Google-backed Fluidstack powered shells with 0% CoreWeave exposure and $3.19B escrowed construction cash.",
    },
    "CRDO": {
        "name": "Credo Technology",
        "mkt_cap_usd_b": 27.68,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 4: Rack Scale-Up & Scale-Out Interconnects",
        "monopoly_share_pct": 82,
        "choke_score": 95,
        "panel_conviction": 94,
        "panel_verdict": "DOUBLE-DOWN (#2 IC 89/100)",
        "base_3y_moic": 3.45,
        "bull_3y_moic": 4.50,
        "target_3y_mkt_cap_b": 95.5,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["TSM (N12/N7 DSP)", "Cable Assemblies"],
        "customers": ["AMZN (AWS)", "MSFT", "xAI", "META"],
        "rivals": ["APH", "ALAB", "MRVL"],
        "bottleneck_note": "75-88% Active Electrical Cable (AEC) monopoly for 800G/1.6T multi-rack scale-up + ZeroFlap optics; 67.1% GM, 38.2% ROIC, net cash, 0.40 PEG.",
    },
    "NBCLF": {
        "name": "Nitto Boseki (Nittobo)",
        "mkt_cap_usd_b": 3.55,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test",
        "monopoly_share_pct": 88,
        "choke_score": 94,
        "panel_conviction": 81,
        "panel_verdict": "HOLD CORE (15.5% RF)",
        "base_3y_moic": 2.75,
        "bull_3y_moic": 3.70,
        "target_3y_mkt_cap_b": 9.8,
        "fx_rate_to_usd": 0.00645,
        "adr_ratio": 1.0,
        "suppliers": ["Specialty Glass Furnaces"],
        "customers": ["Ibiden (4062.T)", "Unimicron", "Shinko", "EMC (2383.TW)"],
        "rivals": ["Taiwan Glass", "AGY"],
        "bottleneck_note": "85-90% global monopoly in ultra-low-CTE 'T-glass' yarn preventing CoWoS-L ABF substrate warpage; $3.55B cap, sold out through 2027.",
    },
    "MRUWY": {
        "name": "Maruwa Co., Ltd.",
        "mkt_cap_usd_b": 3.58,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 4: Rack Scale-Up & Scale-Out Interconnects",
        "monopoly_share_pct": 68,
        "choke_score": 91,
        "panel_conviction": 85,
        "panel_verdict": "HOLD CORE (0.72 PEG, $3.6B Cap)",
        "base_3y_moic": 3.15,
        "bull_3y_moic": 4.25,
        "target_3y_mkt_cap_b": 11.3,
        "fx_rate_to_usd": 0.00645,
        "adr_ratio": 0.25,
        "suppliers": ["High-Purity Aluminum Nitride Powder"],
        "customers": ["COHR", "LITE", "InnoLight", "ASML"],
        "rivals": ["Kyocera", "Ferrotec"],
        "bottleneck_note": "60-70% global choke point in high-thermal-conductivity AlN ceramic substrates for 800G/1.6T optical transceivers + EUV quartz (53% GM, 33% OPM, $3.6B cap).",
    },
    "NBIS": {
        "name": "Nebius Group",
        "mkt_cap_usd_b": 45.36,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 5: Gigawatt Power, Thermal & Neocloud Shells",
        "monopoly_share_pct": 40,
        "choke_score": 84,
        "panel_conviction": 85,
        "panel_verdict": "HOLD / ADD DIP <=$140",
        "base_3y_moic": 2.90,
        "bull_3y_moic": 3.90,
        "target_3y_mkt_cap_b": 131.5,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["NVDA (Equity Partner)", "Quanta/Foxconn ODM"],
        "customers": ["MSFT", "META", "Frontier AI Labs"],
        "rivals": ["CRWV", "Lambda", "Crusoe"],
        "bottleneck_note": "Customer-funded full-stack AI neocloud with $37.5B+ Meta/MSFT/NVDA backlog, 74.3% GM, 251% 3Y Rev CAGR, and cleanest balance sheet vs debt-heavy CRWV.",
    },
    "COHR": {
        "name": "Coherent Corp",
        "mkt_cap_usd_b": 41.22,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 4: Rack Scale-Up & Scale-Out Interconnects",
        "monopoly_share_pct": 55,
        "choke_score": 90,
        "panel_conviction": 88,
        "panel_verdict": "HOLD / ADD DIP (#3 IC 83/100)",
        "base_3y_moic": 3.20,
        "bull_3y_moic": 4.10,
        "target_3y_mkt_cap_b": 131.9,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["MRUWY (AlN Substrates)", "6-inch InP Wafer Fabs"],
        "customers": ["GOOG", "NVDA", "META", "MSFT", "AMZN"],
        "rivals": ["LITE", "InnoLight", "Fabrinet"],
        "bottleneck_note": "World's first 6-inch Indium Phosphide (InP) laser fabs + 800G/1.6T transceivers + Optical Circuit Switches (OCS) at 22.3x Fwd P/E and 0.42 PEG.",
    },
    "FANUY": {
        "name": "FANUC Corporation",
        "mkt_cap_usd_b": 31.2,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 7: Physical AI & Humanoid Robotics",
        "monopoly_share_pct": 45,
        "choke_score": 72,
        "panel_conviction": 71,
        "panel_verdict": "HOLD (Locked Robotics Sleeve)",
        "base_3y_moic": 1.65,
        "bull_3y_moic": 2.35,
        "target_3y_mkt_cap_b": 51.5,
        "fx_rate_to_usd": 0.00645,
        "adr_ratio": 0.5,
        "suppliers": ["HSYDF", "Nabtesco (6268.T)", "NVDA Isaac"],
        "customers": ["Global Auto, Electronics & AI Factory Capex"],
        "rivals": ["ABB", "YASKY", "KUKA"],
        "bottleneck_note": "Global industrial robotics & CNC leader integrating Nvidia Isaac & Google AI physical-AI brains; 26.8% FCFM, held in locked 12% Roth Robotics sleeve.",
    },
    "YASKY": {
        "name": "Yaskawa Electric",
        "mkt_cap_usd_b": 7.7,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 7: Physical AI & Humanoid Robotics",
        "monopoly_share_pct": 38,
        "choke_score": 70,
        "panel_conviction": 73,
        "panel_verdict": "HOLD (Locked Robotics Sleeve)",
        "base_3y_moic": 1.85,
        "bull_3y_moic": 2.60,
        "target_3y_mkt_cap_b": 14.2,
        "fx_rate_to_usd": 0.00645,
        "adr_ratio": 2.0,
        "suppliers": ["HSYDF", "Nabtesco", "NVDA Isaac"],
        "customers": ["Semiconductor Wafer Handling & Factory Automation"],
        "rivals": ["FANUY", "Inovance", "Estun"],
        "bottleneck_note": "AC servo drives + MOTOMAN physical-AI robotics benefiting from semiconductor cleanroom & factory capex (21.8x Fwd P/E, 1.13 PEG).",
    },
    "HSYDF": {
        "name": "Harmonic Drive Systems",
        "mkt_cap_usd_b": 3.23,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 7: Physical AI & Humanoid Robotics",
        "monopoly_share_pct": 72,
        "choke_score": 86,
        "panel_conviction": 75,
        "panel_verdict": "HOLD (Humanoid Rotary Choke Point)",
        "base_3y_moic": 2.60,
        "bull_3y_moic": 4.20,
        "target_3y_mkt_cap_b": 8.4,
        "fx_rate_to_usd": 0.00645,
        "adr_ratio": 1.0,
        "suppliers": ["Specialty Japanese Fatigue-Resistant Steel"],
        "customers": ["Tesla Optimus", "Figure AI", "Boston Dynamics", "FANUY", "YASKY"],
        "rivals": ["Leaderdrive (China)", "Nidec Shimpo"],
        "bottleneck_note": "70%+ US/Allied NDAA-shielded monopoly in zero-backlash strain-wave gears (14-28 rotary joints per humanoid robot) at $3.2B cap (0.75 PEG on recovery).",
    },
    # Top Watchlist & Candidate Benchmarks across Sleeve 1, 2, 3
    "NVDA": {
        "name": "NVIDIA Corporation",
        "mkt_cap_usd_b": 5170.0,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 6: Hyperscaler & Custom XPU / Cloud",
        "monopoly_share_pct": 85,
        "choke_score": 98,
        "panel_conviction": 95,
        "panel_verdict": "STRONG BUY (Rotate MRVL -> 12% BF)",
        "base_3y_moic": 2.17,
        "bull_3y_moic": 2.86,
        "target_3y_mkt_cap_b": 11210.0,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["TSM", "SKHY", "MU", "ONTO", "CRDO", "COHR", "VRT"],
        "customers": ["MSFT", "META", "GOOG", "AMZN", "ORCL", "NBIS", "xAI"],
        "rivals": ["AVGO (Custom XPUs)", "AMD"],
        "bottleneck_note": "Merchant GPU + NVLink 72/144 + CUDA + Isaac Physical AI monopoly trading at just 17.7x Fwd P/E and 0.35 PEG with 74.7% GM and 65.2% OPM.",
    },
    "AVGO": {
        "name": "Broadcom Inc.",
        "mkt_cap_usd_b": 1570.0,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 4: Rack Scale-Up & Scale-Out Interconnects",
        "monopoly_share_pct": 75,
        "choke_score": 96,
        "panel_conviction": 93,
        "panel_verdict": "STRONG BUY (#1 XPU + Tomahawk 6)",
        "base_3y_moic": 2.41,
        "bull_3y_moic": 3.57,
        "target_3y_mkt_cap_b": 3790.0,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["TSM", "SNPS", "CDNS", "ATEYY"],
        "customers": ["GOOG (TPU)", "META (MTIA)", "ByteDance", "OpenAI/AAPL"],
        "rivals": ["MRVL", "NVDA (Spectrum-X)"],
        "bottleneck_note": "#1 custom AI XPU (>70% share) + #1 merchant AI Ethernet switching (Tomahawk 5/6) + 200G SerDes at 19.0x Fwd P/E (0.35 PEG) & 44.2% FCFM.",
    },
    "LITE": {
        "name": "Lumentum Holdings",
        "mkt_cap_usd_b": 68.5,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 4: Rack Scale-Up & Scale-Out Interconnects",
        "monopoly_share_pct": 55,
        "choke_score": 91,
        "panel_conviction": 89,
        "panel_verdict": "TOP SLEEVE 3 WATCH (0.30 PEG)",
        "base_3y_moic": 3.10,
        "bull_3y_moic": 4.20,
        "target_3y_mkt_cap_b": 212.0,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["InP Wafer Fabs", "MRUWY"],
        "customers": ["GOOG", "NVDA", "MSFT", "META"],
        "rivals": ["COHR"],
        "bottleneck_note": "200G/lane EML & CW InP laser choke point sold out through 2027 for 1.6T transceivers & CPO external laser sources (66.5% Rev3Y, 77.2% EPS3Y, 0.30 PEG).",
    },
    "BESIY": {
        "name": "BE Semiconductor (BESI)",
        "mkt_cap_usd_b": 13.5,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test",
        "monopoly_share_pct": 75,
        "choke_score": 93,
        "panel_conviction": 88,
        "panel_verdict": "TOP PACKAGING WATCH (0.58 PEG)",
        "base_3y_moic": 3.30,
        "bull_3y_moic": 4.50,
        "target_3y_mkt_cap_b": 44.5,
        "fx_rate_to_usd": 1.09,
        "adr_ratio": 1.0,
        "suppliers": ["AMAT (Co-Development Partner)"],
        "customers": ["TSM (SoIC)", "AMD", "SKHY / MU (HBM4E/5)", "INTC"],
        "rivals": ["Hanmi (TCB)", "ASMPT", "Shinkawa"],
        "bottleneck_note": "75%+ global monopoly in <100nm direct Cu-to-Cu Hybrid Bonding for TSMC SoIC & HBM4E/HBM5; 64.1% GM, 72.4% EPS3Y, -52.6% off high at 0.58 PEG.",
    },
    "FORM": {
        "name": "FormFactor Inc.",
        "mkt_cap_usd_b": 7.70,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test",
        "monopoly_share_pct": 45,
        "choke_score": 85,
        "panel_conviction": 82,
        "panel_verdict": "WATCH ON PULLBACK <=$82",
        "base_3y_moic": 2.90,
        "bull_3y_moic": 3.80,
        "target_3y_mkt_cap_b": 22.3,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["MEMS Micro-Springs"],
        "customers": ["SKHY", "MU", "TSM", "INTC"],
        "rivals": ["TPRO.MI (Technoprobe)", "6871.T (Micronics Japan)"],
        "bottleneck_note": "3D MEMS wafer probe-card leader ($7.7B cap, 0.41 PEG, 59.2% EPS3Y); HBM4 2048-bit interface doubles test contact points per wafer.",
    },
    "SKHY": {
        "name": "SK Hynix (000660.KS)",
        "mkt_cap_usd_b": 645.0,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test",
        "monopoly_share_pct": 55,
        "choke_score": 95,
        "panel_conviction": 86,
        "panel_verdict": "BENCHMARK / BUY DEEP DIP <=$125",
        "base_3y_moic": 2.40,
        "bull_3y_moic": 3.20,
        "target_3y_mkt_cap_b": 1548.0,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["ASML", "DSCSY", "ONTO", "FORM", "6871.T", "TSM (HBM4 Base Die)"],
        "customers": ["NVDA", "GOOG", "AMD", "AWS"],
        "rivals": ["MU", "Samsung"],
        "bottleneck_note": "The original HBM3E/HBM4 blueprint: 3.10x Fwd P/E, 0.04 PEG, 76.3% GM, 68.0% OPM, 83.5% Rev3Y CAGR with 2027 HBM capacity sold out.",
    },
    "MU": {
        "name": "Micron Technology",
        "mkt_cap_usd_b": 994.3,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test",
        "monopoly_share_pct": 28,
        "choke_score": 89,
        "panel_conviction": 84,
        "panel_verdict": "BUY DEEP DIP (<=5% Memory Cap)",
        "base_3y_moic": 2.25,
        "bull_3y_moic": 3.00,
        "target_3y_mkt_cap_b": 2237.0,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["ASML", "AMAT", "LRCX", "TELWY", "ONTO", "DSCSY"],
        "customers": ["NVDA", "AMD", "Hyperscalers"],
        "rivals": ["SKHY", "Samsung"],
        "bottleneck_note": "US HBM3E/HBM4 + LPDDR5X power-efficiency leader printing 80.7% GM, 74.6% OPM at 4.98x Fwd P/E and 0.07 PEG.",
    },
    "VRT": {
        "name": "Vertiv Holdings",
        "mkt_cap_usd_b": 79.5,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 5: Gigawatt Power, Thermal & Neocloud Shells",
        "monopoly_share_pct": 42,
        "choke_score": 86,
        "panel_conviction": 84,
        "panel_verdict": "CANDIDATE BUY ON 18% DIP",
        "base_3y_moic": 2.45,
        "bull_3y_moic": 3.15,
        "target_3y_mkt_cap_b": 194.8,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["Pumps, Heat Exchangers, Power Semiconductors"],
        "customers": ["NVDA", "MSFT", "GOOG", "META", "CORZ", "CIFR", "NBIS"],
        "rivals": ["Eaton (ETN)", "Schneider Electric", "Delta (2308.TW)", "AVC (3017.TW)"],
        "bottleneck_note": "Liquid cooling CDU + 800V high-density rack power distribution leader for 130kW-600kW Blackwell/Rubin racks (26.0x Fwd P/E, 0.65 PEG, -38% off high).",
    },
    "ALAB": {
        "name": "Astera Labs",
        "mkt_cap_usd_b": 49.6,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 4: Rack Scale-Up & Scale-Out Interconnects",
        "monopoly_share_pct": 65,
        "choke_score": 84,
        "panel_conviction": 74,
        "panel_verdict": "WAIT FOR <=32x P/E (CRDO 2.5x Cheaper)",
        "base_3y_moic": 2.10,
        "bull_3y_moic": 2.95,
        "target_3y_mkt_cap_b": 104.0,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["TSM"],
        "customers": ["AMZN", "NVDA", "MSFT", "GOOG"],
        "rivals": ["CRDO", "MRVL", "AVGO"],
        "bottleneck_note": "PCIe Gen6 Aries retimers + Scorpio fabric switches (75.1% GM, 65.1% Rev3Y), but at 50.9x Fwd P/E (0.95 PEG), CRDO (20.2x P/E, 0.40 PEG) is far cheaper.",
    },
    "ANET": {
        "name": "Arista Networks",
        "mkt_cap_usd_b": 223.2,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 4: Rack Scale-Up & Scale-Out Interconnects",
        "monopoly_share_pct": 45,
        "choke_score": 83,
        "panel_conviction": 72,
        "panel_verdict": "PREFER AVGO (0.35 vs 1.52 PEG)",
        "base_3y_moic": 1.75,
        "bull_3y_moic": 2.25,
        "target_3y_mkt_cap_b": 390.6,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["AVGO (Tomahawk 5/6 Silicon)", "COHR", "LITE"],
        "customers": ["META", "MSFT", "ORCL"],
        "rivals": ["NVDA (Spectrum-X)", "Celestica (White-Box)"],
        "bottleneck_note": "800G/1.6T AI Ethernet switching software leader (48.9% FCFM), but trades at 38.1x Fwd P/E (1.52 PEG) vs underlying chip supplier AVGO at 19.0x (0.35 PEG).",
    },
    "CEG": {
        "name": "Constellation Energy",
        "mkt_cap_usd_b": 96.2,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 5: Gigawatt Power, Thermal & Neocloud Shells",
        "monopoly_share_pct": 50,
        "choke_score": 87,
        "panel_conviction": 78,
        "panel_verdict": "CANDIDATE BUY ON 20% DIP",
        "base_3y_moic": 1.95,
        "bull_3y_moic": 2.50,
        "target_3y_mkt_cap_b": 187.5,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["CCJ (Uranium)", "GEV (Nuclear Turbines)"],
        "customers": ["MSFT", "META", "US Grid"],
        "rivals": ["TLN", "VST"],
        "bottleneck_note": "Largest US carbon-free 24/7 nuclear baseload fleet with multi-decade hyperscaler PPAs (22.0x Fwd P/E, 1.30 PEG).",
    },
    "GEV": {
        "name": "GE Vernova",
        "mkt_cap_usd_b": 245.4,
        "sleeve": "Sleeve 1: 2x/3Y Fortress Compounder",
        "layer": "Layer 5: Gigawatt Power, Thermal & Neocloud Shells",
        "monopoly_share_pct": 50,
        "choke_score": 88,
        "panel_conviction": 77,
        "panel_verdict": "CANDIDATE BUY ON 18% DIP",
        "base_3y_moic": 1.90,
        "bull_3y_moic": 2.40,
        "target_3y_mkt_cap_b": 466.0,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["Specialty Superalloys & Forgings"],
        "customers": ["Hyperscalers", "Utilities", "IPP Generators"],
        "rivals": ["Siemens Energy (ENR.DE)", "Mitsubishi Heavy"],
        "bottleneck_note": "Heavy-duty H-class gas turbines & HVDC grid transformers booked out to 2029 on AI datacenter load (43.8x Fwd P/E, 1.14 PEG).",
    },
    "TER": {
        "name": "Teradyne Inc.",
        "mkt_cap_usd_b": 50.8,
        "sleeve": "Sleeve 3: Next Growth Engine & Physical AI",
        "layer": "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test",
        "monopoly_share_pct": 42,
        "choke_score": 82,
        "panel_conviction": 76,
        "panel_verdict": "PREFER ATEYY IN SEMI TEST",
        "base_3y_moic": 2.15,
        "bull_3y_moic": 2.80,
        "target_3y_mkt_cap_b": 109.2,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["FORM", "TPRO.MI"],
        "customers": ["AAPL", "AVGO", "MRVL", "MU"],
        "rivals": ["ATEYY"],
        "bottleneck_note": "~88% Semiconductor Test (custom ASIC + HBM ATE duopoly with ATEYY) and ~12% Universal Robots cobots / MiR AMRs (33.3x Fwd P/E, 0.93 PEG).",
    },
    "ENTG": {
        "name": "Entegris Inc.",
        "mkt_cap_usd_b": 17.8,
        "sleeve": "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly",
        "layer": "Layer 2: Leading-Edge Foundry & GAA Wafer Fab",
        "monopoly_share_pct": 70,
        "choke_score": 93,
        "panel_conviction": 90,
        "panel_verdict": "STRONG BUY (#1 Consumable Choke Point)",
        "base_3y_moic": 2.65,
        "bull_3y_moic": 3.40,
        "target_3y_mkt_cap_b": 47.2,
        "fx_rate_to_usd": 1.0,
        "adr_ratio": 1.0,
        "suppliers": ["Specialty Fluoropolymers & Ultra-Pure Chemicals"],
        "customers": ["TSM", "ASML", "INTC", "MU", "Samsung"],
        "rivals": ["DuPont Electronics", "Shin-Etsu Polymer"],
        "bottleneck_note": "#1 global monopoly in Extreme-Clean liquid filtration, FOUP wafer carriers, and CMP slurries required at every 2nm GAA & High-NA EUV pass (~80% recurring revenue).",
    },
}


def compute_no_diworsification_bottleneck_metrics(t: str, is_holding: bool, choke_score: int, mono_share: int, base_moic: float, peg: float, eps_3y: float, gm: float):
    """
    No-Diworsification Best-in-Class Bottleneck Algorithm (0-100):
    1. AI Criticality (0-40 pts): Can frontier AI chips/clusters ship without this technology?
    2. Technological Monopoly & Moat (0-35 pts): Is it #1 Best-in-Class (60-100% share) or a #2 follower?
    3. 3Y AI Return Torque (0-25 pts): Multi-bagger return velocity (3Y MOIC, EPS CAGR, low PEG).
    Concentration in #1 monopolies is explicitly rewarded (ZERO single-name concentration caps).
    """
    # 1. AI Criticality (0-40)
    if t in {"ASML", "TSM", "LSRCY", "DSCSY", "ASMIY", "TELWY", "ATEYY", "ONTO", "CRDO", "NBCLF", "MRUWY", "KLAC", "VACNY", "SNPS", "CDNS", "NVDA", "AVGO", "MU", "ENTG", "BESIY", "LITE"}:
        ai_crit = min(40, max(35, int(round(choke_score * 0.4))))
    elif t in {"CORZ", "NBIS", "COHR", "MRVL", "VRT", "GEV", "CEG", "FORM", "ALAB", "ANET", "TER", "GOOG"}:
        ai_crit = min(35, max(27, int(round(choke_score * 0.36))))
    elif t in {"HSYDF"}:
        ai_crit = 28
    else:  # FANUY, YASKY, CIFR
        ai_crit = 19 if t in {"FANUY", "YASKY"} else 22

    # 2. Technological Monopoly & #1 Rank (0-35)
    challengers_num2 = {"MRVL", "COHR", "CIFR", "ANET", "ALAB"}
    non_critical_legacy = {"FANUY", "YASKY"}
    if t in non_critical_legacy:
        tech_moat = 16
        rank_label = "LEGACY INDUSTRIAL (<12% AI)"
    elif t in challengers_num2:
        tech_moat = 22
        rank_label = "#2 CHALLENGER (UPGRADE TO #1)"
    else:
        tech_moat = min(35, max(29, int(round(mono_share * 0.18 + (gm or 55.0) * 0.25))))
        rank_label = "#1 BEST-IN-CLASS MONOPOLY"

    # 3. 3Y Return Torque (0-25)
    peg_val = peg if (peg and peg > 0) else 0.85
    peg_bonus = 6 if peg_val <= 0.55 else (4 if peg_val <= 0.90 else (2 if peg_val <= 1.30 else 0))
    moic_pts = min(19, max(6, int(round((base_moic - 1.0) * 8.5))))
    torque = min(25, moic_pts + peg_bonus)

    total_score = min(99, ai_crit + tech_moat + torque)

    if is_holding:
        if t in {"FANUY", "YASKY", "CIFR"}:
            verdict = "DIVEST (NON-CRITICAL / LAGGARD)"
        elif t in {"MRVL", "COHR"}:
            verdict = "UPGRADE TO #1 (AVGO / LITE)"
        elif total_score >= 90:
            verdict = "CONCENTRATE (#1 MONOPOLY)"
        else:
            verdict = "CORE HOLD (#1 BOTTLENECK)"
    else:
        if total_score >= 90:
            verdict = "TOP #1 BOTTLENECK BUY"
        else:
            verdict = "WATCH FOR PULLBACK"

    return {
        "ai_criticality_score": ai_crit,
        "tech_moat_score": tech_moat,
        "return_torque_score": torque,
        "bottleneck_score": total_score,
        "bottleneck_rank_label": rank_label,
        "no_diworsification_verdict": verdict,
    }


def build():
    holdings_raw = json.loads((SCRATCH_ROOT / "holdings.json").read_text())
    playbook_raw = json.loads((SCRATCH_ROOT / "digest" / "playbook.json").read_text())
    watchlist_live = json.loads((SCRATCH_ROOT / "digest" / "state" / "watchlist_live.json").read_text())
    digest_today = json.loads((SCRATCH_ROOT / "digest" / "out" / "2026-11-04" / "data.json").read_text())

    f_oct18 = parse_fundamentals_md(SCRATCH_ROOT / "data" / "fundamentals_2026-10-18.md")
    f_latest = parse_fundamentals_md(SCRATCH_ROOT / "fundamentals.md")
    fundamentals_map = {**f_oct18, **{k: v for k, v in f_latest.items() if v.get("FwdPE")}}
    if "BESI" in fundamentals_map and "BESIY" not in fundamentals_map:
        fundamentals_map["BESIY"] = fundamentals_map["BESI"]

    digest_by_ticker = {h["ticker"]: h for h in digest_today.get("holdings", [])}
    ratings_by_ticker = digest_today.get("ratings", {})

    # Build live holdings lookup directly from holdings.json (synced from Charles Schwab & Fidelity)
    live_holdings_by_ticker = {}
    account_totals = {}
    account_net_totals = {}
    grand_total = 0.0
    for acct, acct_obj in holdings_raw["accounts"].items():
        s = round(sum(float(p["weight_units"]) for p in acct_obj["positions"]), 2)
        account_totals[acct] = s
        account_net_totals[acct] = float(acct_obj.get("net_account_value_usd", s))
        grand_total += s
        for p in acct_obj["positions"]:
            live_holdings_by_ticker[p["ticker"]] = {**p, "account": acct}

    grand_total = round(grand_total, 2)
    net_nav_usd = float(holdings_raw.get("summary", {}).get("net_nav_usd", 552321.02))
    margin_debit_usd = float(holdings_raw.get("summary", {}).get("margin_debit_usd", -52523.98))

    # Build unified stocks list (23 live holdings + 13 US/ADR candidates)
    stocks = []
    seen = set()

    ordered_tickers = [
        p["ticker"]
        for acct_obj in holdings_raw["accounts"].values()
        for p in acct_obj["positions"]
    ] + ["NVDA", "AVGO", "MU", "LITE", "BESIY", "ENTG", "VRT", "GEV", "CEG", "FORM", "ALAB", "ANET", "TER", "GOOG"]

    for t in ordered_tickers:
        if t in seen:
            continue
        seen.add(t)
        live_pos = live_holdings_by_ticker.get(t)
        d_row = digest_by_ticker.get(t, {})
        r_row = ratings_by_ticker.get(t, {})
        f_row = fundamentals_map.get(t, {})
        enrich = EXPERT_ENRICHMENT.get(t, {})
        pb = playbook_raw.get("holdings", {}).get(t) or playbook_raw.get("watch", {}).get(t) or d_row.get("playbook", {})

        is_holding = live_pos is not None
        acct = live_pos["account"] if is_holding else "Candidate / Watchlist"
        weight_usd = round(float(live_pos["weight_units"]), 2) if is_holding else 0.0
        shares_held = float(live_pos.get("shares", 0.0)) if is_holding else 0.0
        cost_basis_usd = float(live_pos.get("cost_basis", 0.0)) if is_holding else 0.0
        gain_loss_pct = float(live_pos.get("gain_loss_pct", 0.0)) if is_holding else 0.0

        acct_total = account_totals.get(acct, 0.0)
        actual_pct_account = round((weight_usd / acct_total) * 100, 2) if (is_holding and acct_total > 0) else 0.0
        actual_pct_book = round((weight_usd / grand_total) * 100, 2) if (is_holding and grand_total > 0) else 0.0
        target_pct_account = pb.get("target_pct_account") or actual_pct_account

        hl = d_row.get("home_line") or {}
        ul = d_row.get("us_line") or {}

        # Date-stamped market quotes and USD technicals for candidates not present in digest_today["holdings"]
        candidate_market_quotes = {
            "BESIY": {
                "price": 171.25,
                "chg_1d": -1.24,
                "dma50": 202.61,
                "dma200": 246.76,
                "high_52w": 368.69,
                "low_52w": 142.79,
                "as_of": "2026-11-04",
                "source": "OTC/Euronext BESI.AS Verified Close",
            },
            "ENTG": {
                "price": 118.40,
                "chg_1d": 0.65,
                "dma50": 121.70,
                "dma200": 114.95,
                "high_52w": 147.57,
                "low_52w": 89.02,
                "as_of": "2026-11-04",
                "source": "NASDAQ ENTG Verified Close",
            },
        }
        cmq = candidate_market_quotes.get(t, {})

        if is_holding and live_pos.get("price"):
            us_px = float(live_pos["price"])
        elif ul.get("last"):
            us_px = float(ul["last"])
        elif cmq.get("price"):
            us_px = float(cmq["price"])
        elif hl.get("last"):
            raw_hl = float(hl["last"])
            us_px = raw_hl if (hl.get("currency") or "USD") == "USD" else round(raw_hl * enrich.get("fx_rate_to_usd", 1.0) * enrich.get("adr_ratio", 1.0), 2)
        else:
            us_px = 0.0

        last_px = us_px
        currency = "USD"
        chg_1d = (
            float(live_pos["day_change_pct"])
            if (is_holding and live_pos.get("day_change_pct") is not None)
            else (
                d_row.get("overnight_move")
                if d_row.get("overnight_move") is not None
                else (cmq.get("chg_1d") if "chg_1d" in cmq else hl.get("chg_session", 0.0))
            )
        )

        # Prefer USD line (`ul`) technicals directly (no synthetic ul_scale adjustment)
        us_dma50 = round(float(ul["dma50"]), 2) if ul.get("dma50") is not None else (cmq.get("dma50") if "dma50" in cmq else (hl.get("dma50") if (hl.get("currency") or "USD") == "USD" else None))
        us_dma200 = round(float(ul["dma200"]), 2) if ul.get("dma200") is not None else (cmq.get("dma200") if "dma200" in cmq else (hl.get("dma200") if (hl.get("currency") or "USD") == "USD" else None))
        us_hi52 = ul.get("high_52w") if ul.get("high_52w") is not None else (cmq.get("high_52w") if "high_52w" in cmq else (hl.get("high_52w") if (hl.get("currency") or "USD") == "USD" else None))
        us_lo52 = ul.get("low_52w") if ul.get("low_52w") is not None else (cmq.get("low_52w") if "low_52w" in cmq else (hl.get("low_52w") if (hl.get("currency") or "USD") == "USD" else None))

        fwd_pe = parse_num(f_row.get("FwdPE", "")) or (24.5 if t == "ENTG" else None)
        pe = parse_num(f_row.get("PE", ""))
        ps = parse_num(f_row.get("PS", ""))
        fwd_ps = parse_num(f_row.get("FwdPS", ""))
        rev_3y = parse_num(f_row.get("Rev3Y", "")) or (22.0 if t == "ENTG" else None)
        eps_3y = parse_num(f_row.get("EPS3Y", "")) or (31.5 if t == "ENTG" else None)
        peg = parse_num(f_row.get("PEG", ""))
        if peg is None and fwd_pe and eps_3y and eps_3y > 0:
            peg = round(fwd_pe / eps_3y, 2)
        elif peg is None and fwd_pe and rev_3y and rev_3y > 0:
            peg = round(fwd_pe / rev_3y, 2)

        gm = parse_num(f_row.get("GM", "")) or (46.5 if t == "ENTG" else None)
        opm = parse_num(f_row.get("OPM", "")) or (26.0 if t == "ENTG" else None)
        fcfm = parse_num(f_row.get("FCFM", ""))
        short_pct = parse_num(f_row.get("Short", ""))

        mkt_cap_b = enrich.get("mkt_cap_usd_b") or parse_num(f_row.get("MktCap", "")) or 25.0
        base_moic = enrich.get("base_3y_moic", 2.2)
        bull_moic = enrich.get("bull_3y_moic", 3.0)
        implied_cagr_3y = round(((base_moic ** (1 / 3)) - 1) * 100, 1)

        # Tax-aware hurdle spread vs 10.625% margin loan
        tax_drag = 0.238 if acct == "Brokerage_Family" else 0.0
        after_tax_cagr = round(implied_cagr_3y * (1.0 - tax_drag), 2)
        hurdle_spread = round(after_tax_cagr - 10.625, 2) if acct == "Brokerage_Family" else round(after_tax_cagr, 2)

        # Implied 2029E P/E to hit 2.0x and 3.0x in 3Y
        g_rate = (eps_3y or rev_3y or 25.0) / 100.0
        earnings_3y_mult = (1.0 + min(g_rate, 0.65)) ** 3
        cur_pe_ref = fwd_pe or 25.0
        implied_exit_pe_2x = round((cur_pe_ref * 2.0) / earnings_3y_mult, 1)
        implied_exit_pe_3x = round((cur_pe_ref * 3.0) / earnings_3y_mult, 1)

        dip_obj = pb.get("dip_below") or {}
        brk_obj = pb.get("breakout_above") or {}

        mono_share = enrich.get("monopoly_share_pct", 60)
        choke_sc = enrich.get("choke_score", 85)
        triage_info = get_stock_triage_info(t, is_holding)

        sanitized_news = []
        for n_item in (d_row.get("news") or [])[:3]:
            ni = dict(n_item)
            if isinstance(ni.get("title"), str):
                ni["title"] = re.sub(r"(\d{1,3})/100", r"\1 pts", ni["title"])
            sanitized_news.append(ni)

        hi52_val = round(float(us_hi52), 2) if us_hi52 is not None else None
        computed_off_high = (
            round((us_px / hi52_val - 1.0) * 100.0, 2)
            if (hi52_val is not None and hi52_val > 0 and us_px > 0)
            else (ul.get("off_high") if ul.get("off_high") is not None else hl.get("off_high"))
        )

        raw_stock = {
            "ticker": t,
            "name": enrich.get("name") or (live_pos["name"] if is_holding else None) or d_row.get("name") or t,
            "home_symbol": (live_pos.get("home") if is_holding else None) or d_row.get("home") or t,
            "last_price_home": hl.get("last"),
            "is_holding": is_holding,
            "owned": is_holding,
            "account": acct,
            "shares": shares_held,
            "cost_basis_usd": cost_basis_usd,
            "gain_loss_pct": gain_loss_pct,
            "sleeve": enrich.get("sleeve", "Sleeve 2: 3x-5x+ Picks & Shovels Monopoly"),
            "layer": enrich.get("layer", "Layer 3: CoWoS-L, SoIC & HBM4 3D Packaging / Test"),
            "weight_usd": weight_usd,
            "actual_pct_account": actual_pct_account,
            "target_pct_account": target_pct_account,
            "actual_pct_book": actual_pct_book,
            "last_price": us_px,
            "currency": currency,
            "us_price": us_px,
            "exchange": ul.get("exchange") or hl.get("exchange") or "NASDAQ/NYSE/OTC",
            "chg_1d": chg_1d,
            "chg_5d": ul.get("chg_5d", hl.get("chg_5d", 0.0)),
            "chg_1m": ul.get("chg_1m", hl.get("chg_1m", 0.0)),
            "off_high_pct": computed_off_high,
            "high_52w": hi52_val,
            "low_52w": round(float(us_lo52), 2) if us_lo52 is not None else None,
            "dma50": round(float(us_dma50), 2) if us_dma50 is not None else None,
            "dma200": round(float(us_dma200), 2) if us_dma200 is not None else None,
            "above_50dma": bool(us_px >= float(us_dma50)) if (us_dma50 is not None and us_px > 0) else None,
            "above_200dma": bool(us_px >= float(us_dma200)) if (us_dma200 is not None and us_px > 0) else None,
            "mkt_cap_usd_b": mkt_cap_b,
            "pe_trailing": pe,
            "fwd_pe": fwd_pe,
            "ps_trailing": ps,
            "fwd_ps": fwd_ps,
            "peg": peg,
            "rev_3y_cagr": rev_3y,
            "eps_3y_cagr": eps_3y,
            "gm_pct": gm,
            "opm_pct": opm,
            "fcfm_pct": fcfm,
            "short_pct": short_pct,
            "monopoly_share_pct": mono_share,
            "choke_score": choke_sc,
            "base_3y_moic": base_moic,
            "bull_3y_moic": bull_moic,
            "target_3y_mkt_cap_b": enrich.get("target_3y_mkt_cap_b", round(mkt_cap_b * base_moic, 1)),
            "implied_3y_cagr_pct": implied_cagr_3y,
            "after_tax_cagr_pct": after_tax_cagr,
            "margin_hurdle_spread_pct": hurdle_spread,
            "implied_exit_pe_for_2x": implied_exit_pe_2x,
            "implied_exit_pe_for_3x": implied_exit_pe_3x,
            "thesis": enrich.get("bottleneck_note") or pb.get("thesis") or "",
            "bottleneck_note": enrich.get("bottleneck_note", ""),
            "dip_rule": pb.get("dip", ""),
            "breakout_rule": pb.get("breakout", ""),
            "kill_rule": pb.get("kill", ""),
            "dip_line": dip_obj.get("line", t),
            "dip_price": dip_obj.get("price"),
            "breakout_line": brk_obj.get("line", t),
            "breakout_price": brk_obj.get("price"),
            "alert_candidates": d_row.get("alert_candidates", []),
            "suppliers": enrich.get("suppliers", []),
            "customers": enrich.get("customers", []),
            "rivals": enrich.get("rivals", []),
            "recent_news": sanitized_news,
            **triage_info,
        }
        scored_stock = compute_unified_stock_scores(raw_stock)
        if scored_stock.get("high_52w") and float(scored_stock["high_52w"]) > 0 and us_px > 0:
            scored_stock["off_high_pct"] = round((us_px / float(scored_stock["high_52w"]) - 1.0) * 100.0, 2)
        triage_synced = get_stock_triage_info(t, is_holding, bottleneck_score=scored_stock["bottleneck_score"])
        scored_stock.update(triage_synced)
        stocks.append(scored_stock)

    # Compute No-Diworsification Bottleneck Telemetry (Zero artificial single-stock caps!)
    stocks_by_t_caps = {s["ticker"]: s for s in stocks}
    mrvl_sc = stocks_by_t_caps.get("MRVL", {}).get("bottleneck_score", 51)
    cdns_sc = stocks_by_t_caps.get("CDNS", {}).get("bottleneck_score", 51)
    monopoly_num1_tickers = {"DSCSY", "LSRCY", "ASMIY", "VACNY", "ONTO", "CRDO", "MRUWY", "NBCLF", "SNPS", "TSM", "ATEYY", "ASML", "TELWY", "KLAC", "HSYDF", "NBIS", "CORZ", "COHR"}
    challenger_num2_tickers = {"MRVL", "CDNS"}
    divest_laggard_tickers = {"FANUY", "YASKY", "CIFR"}
    total_roth_usd = round(account_totals["Roth_Schwab"] + account_totals["Roth_Fidelity"], 2)

    monopoly_usd = round(sum(s["weight_usd"] for s in stocks if s["is_holding"] and s["ticker"] in monopoly_num1_tickers), 2)
    challenger_usd = round(sum(s["weight_usd"] for s in stocks if s["is_holding"] and s["ticker"] in challenger_num2_tickers), 2)
    divest_usd = round(sum(s["weight_usd"] for s in stocks if s["is_holding"] and s["ticker"] in divest_laggard_tickers), 2)
    top5_holdings = sorted([s for s in stocks if s["is_holding"]], key=lambda x: x["weight_usd"], reverse=True)[:5]
    top5_usd = round(sum(s["weight_usd"] for s in top5_holdings), 2)
    monopoly_pct_1d = round(monopoly_usd / grand_total * 100, 1) if grand_total > 0 else 81.5
    bf_net_nav = round(account_totals["Brokerage_Family"] + margin_debit_usd, 0)
    bf_drop_buf = round((abs(margin_debit_usd) / 0.30 / max(1.0, account_totals["Brokerage_Family"]) - 1.0) * 100.0, 1)

    portfolio_caps = [
        {
            "id": "num1_monopoly_share_book",
            "label": "#1 Best-in-Class Bottleneck Monopolies (18 Core Holdings)",
            "actual_pct": round(monopoly_usd / grand_total * 100, 2),
            "cap_pct": 100.0,
            "end_2027_cap_pct": 100.0,
            "actual_usd": monopoly_usd,
            "status": f"{monopoly_pct_1d:.1f}% (#1 TARGET: 100%)",
            "note": "No Diworsification: Target 100% of portfolio in #1 irreplaceable AI bottlenecks",
        },
        {
            "id": "top5_conviction_concentration",
            "label": "Top 5 Conviction Bottlenecks (DSCSY, LSRCY, ASMIY, CRDO, VACNY)",
            "actual_pct": round(top5_usd / grand_total * 100, 2),
            "cap_pct": 60.0,
            "end_2027_cap_pct": 60.0,
            "actual_usd": top5_usd,
            "status": "HIGH CONVICTION (GOOD)",
            "note": "Concentrated sizing in 75-100% monopolies is rewarded; zero artificial trim caps",
        },
        {
            "id": "num2_challengers_to_upgrade",
            "label": "#2 Challengers to Upgrade into #1 Leaders (MRVL -> AVGO/NVDA, CDNS -> SNPS/AVGO)",
            "actual_pct": round(challenger_usd / grand_total * 100, 2),
            "cap_pct": 0.0,
            "end_2027_cap_pct": 0.0,
            "actual_usd": challenger_usd,
            "status": f"UPGRADE (${challenger_usd:,.0f})",
            "note": f"MRVL (${stocks_by_t_caps.get('MRVL', {}).get('weight_usd', 33029)/1000:.1f}k, {mrvl_sc}/100) is #2 behind AVGO; CDNS (${stocks_by_t_caps.get('CDNS', {}).get('weight_usd', 25580)/1000:.1f}k, {cdns_sc}/100) duplicates cheaper #1 SNPS",
        },
        {
            "id": "non_critical_divest_pool",
            "label": "Non-Critical / Low-AI-Torque Divest Pool (FANUY, YASKY, CIFR)",
            "actual_pct": round(divest_usd / grand_total * 100, 2),
            "cap_pct": 0.0,
            "end_2027_cap_pct": 0.0,
            "actual_usd": divest_usd,
            "status": f"DIVEST (${divest_usd:,.0f})",
            "note": f"Free ${divest_usd/1000:.1f}k from legacy industrial robotics (<12% AI) & redundant miner CIFR ({stocks_by_t_caps.get('CIFR', {}).get('chg_1d', -20.8):+.1f}% 1D)",
        },
        {
            "id": "fidelity_margin_debit",
            "label": "Fidelity Investment Margin (...2854) Debit Balance",
            "actual_pct": round(abs(margin_debit_usd) / account_totals["Brokerage_Family"] * 100, 2),
            "cap_pct": 30.0,
            "end_2027_cap_pct": 20.0,
            "actual_usd": margin_debit_usd,
            "status": f"NET NAV ${bf_net_nav:,.0f}",
            "note": f"${account_totals['Brokerage_Family']:,.0f} Gross Equities minus ${abs(margin_debit_usd):,.0f} Margin Debit = ${bf_net_nav:,.0f} Net Equity ({bf_drop_buf:+.1f}% buffer to 30% Debt/MV cap)",
        },
    ]


    # 7 Supply-Chain Layers with bottlenecks & leading indicators
    supply_chain_layers = [
        {
            "id": "L1",
            "name": "Layer 1: EUV / High-NA Lithography, Photomasks & EDA Toll",
            "bottleneck_physics": "Reticle-limit AI XPUs (3.3x-5.5x CoWoS-L) transitioning to N2 GAA & A16 backside power boost EUV mask layers and require 13.5nm actinic phase-defect inspection plus multiphysics EDA verification.",
            "monopoly_tickers": ["ASML", "LSRCY", "SNPS", "CDNS", "MRUWY"],
            "leading_kpi": "ASML Quarterly Net Bookings (>€5B) & Book-to-Bill (>1.0x); Lasertec ACTIS A300 High-NA Mask Orders",
            "bull_signal": "ASML Book-to-Bill >1.0x & 2027-28 capacity sold out; LSRCY FY6/27 NP >=¥90B",
            "kill_signal": "ASML B2B <1.0 two quarters or KLA/Zeiss ships commercial actinic patterned-mask inspector",
            "portfolio_weight_pct": round(sum(s["actual_pct_book"] for s in stocks if s["ticker"] in {"ASML", "LSRCY", "SNPS", "CDNS"}), 2),
        },
        {
            "id": "L2",
            "name": "Layer 2: Leading-Edge Foundry & GAA Wafer Fab (N2 / A16)",
            "bottleneck_physics": "Horizontal nanosheet Gate-All-Around (N2) and backside power delivery (A16) replace line-of-sight PVD with single-wafer Atomic Layer Deposition (ALD +35% steps) and double process control & vacuum valve intensity.",
            "monopoly_tickers": ["TSM", "ASMIY", "KLAC", "TELWY", "VACNY"],
            "leading_kpi": "TSMC Monthly NT$ Revenue (+30% YoY) & Gross Margin (>62%); ASM International GAA ALD Order Intake; VAT Group Quarterly Orders (>=CHF 600M)",
            "bull_signal": "TSM 2027 USD revenue guide >25% & GM >62%; ASMIY & VACNY orders accelerating QoQ",
            "kill_signal": "TSM Jan-2027 guide <20% USD growth or GM <58%; VACNY orders <CHF 550M; ASMIY orders -20% YoY 2Q",
            "portfolio_weight_pct": round(sum(s["actual_pct_book"] for s in stocks if s["ticker"] in {"TSM", "ASMIY", "KLAC", "TELWY", "VACNY"}), 2),
        },
        {
            "id": "L3",
            "name": "Layer 3: CoWoS-L, SoIC, HBM4 3D Packaging, T-Glass & ATE Test",
            "bottleneck_physics": "16-Hi HBM4 (2048-bit interface + logic base die) & multi-reticle CoWoS-L create extreme warpage and bump-pitch walls: requiring T-glass low-CTE yarn (NBCLF), <30µm wafer grinding (DSCSY), 3D bump metrology (ONTO), Cu-Cu hybrid bonding (BESIY), and long burn-in test (ATEYY, FORM).",
            "monopoly_tickers": ["ONTO", "DSCSY", "NBCLF", "ATEYY", "BESIY", "FORM", "SKHY", "MU"],
            "leading_kpi": "TSMC CoWoS-L Capacity (>140k wpm); Onto Dragonfly QoQ Packaging Rev; Disco Quarterly Shipments; Nittobo T-Glass Pricing",
            "bull_signal": "ONTO sequential AI packaging growth; DSCSY record shipments & ~70% GM; NBCLF T-glass sold out through 2027",
            "kill_signal": "ONTO AI packaging rev down 2Q or KLA takes Dragonfly share; DSCSY shipments >15% below record; NBCLF T-glass price cut",
            "portfolio_weight_pct": round(sum(s["actual_pct_book"] for s in stocks if s["ticker"] in {"ONTO", "DSCSY", "NBCLF", "ATEYY"}), 2),
        },
        {
            "id": "L4",
            "name": "Layer 4: 200G/448G Scale-Up AEC Copper & Scale-Out 1.6T Optics / OCS",
            "bottleneck_physics": "At 200G/lane PAM4, passive copper dies past 1.5m while optics inside the rack burn 25-30W and suffer laser link-flaps. Credo AECs own the 1.5m-7m rack scale-up bridge; Coherent 6-inch InP lasers & Optical Circuit Switches (OCS) + Maruwa AlN ceramics own scale-out.",
            "monopoly_tickers": ["CRDO", "COHR", "MRUWY", "AVGO", "LITE", "ALAB", "ANET"],
            "leading_kpi": "Credo Hyperscaler 800G/1.6T AEC Ramp & GM (>65%); Coherent Datacom Book-to-Bill (>1.0x) & 6-Inch InP Yield; Maruwa OPM (>=33%)",
            "bull_signal": "CRDO QoQ beat-and-raise across 3-4 hyperscalers; COHR GM expanding toward 42%+ on internal 6-inch InP & OCS orders",
            "kill_signal": "CRDO guide < prior Q or GM <60%; COHR Datacom B2B <1.0 or TTM GM <35%; MRUWY OPM <28%",
            "portfolio_weight_pct": round(sum(s["actual_pct_book"] for s in stocks if s["ticker"] in {"CRDO", "COHR", "MRUWY"}), 2),
        },
        {
            "id": "L5",
            "name": "Layer 5: Gigawatt Energized Powered Shells, Neoclouds & Liquid Cooling",
            "bottleneck_physics": "US grid interconnection queues stretch 4-7 years and Rubin racks jump to 250-600kW. Energized high-voltage substations with IG hyperscaler leases (CIFR, CORZ), customer-funded neocloud pods (NBIS), nuclear PPAs (TLN, CEG), and liquid cooling (VRT) control 2026-2028 deployment speed.",
            "monopoly_tickers": ["NBIS", "CORZ", "CIFR", "VRT", "CEG", "GEV"],
            "leading_kpi": "MW Energization Cadence vs Schedule; All-In Project Debt Cost (<12%); ^TNX 10Y Yield (<5.30%); CRWV / HYG Credit Spreads",
            "bull_signal": "On-time MW energization for AWS/Fluidstack (CIFR) & AMD (CORZ); NBIS customer-funded backlog >$37.5B with 0% dilutive converts",
            "kill_signal": "Any dilutive convert/equity offering (CIFR/NBIS), energization slip >6m, or debt >12%",
            "portfolio_weight_pct": round(sum(s["actual_pct_book"] for s in stocks if s["ticker"] in {"NBIS", "CORZ", "CIFR"}), 2),
        },
        {
            "id": "L6",
            "name": "Layer 6: Hyperscaler Cloud, Merchant GPUs, Custom XPUs & Frontier Labs",
            "bottleneck_physics": "Merchant GPUs (NVDA Rubin NVL72/144) and custom hyperscaler XPUs (Google TPU v6e/v7p, AWS Trainium2/3, Broadcom XPUs) drive the entire upstream capex waterfall while monetizing autonomous coding & enterprise inference.",
            "monopoly_tickers": ["GOOG", "NVDA", "AVGO", "MRVL"],
            "leading_kpi": "Top-4 Hyperscaler CapEx YoY Growth (+25-45%); Google Cloud YoY Growth (>=50%); Nvidia Data Center QoQ Guide (>=+8%)",
            "bull_signal": "All 4 hyperscalers raise 2027 capex; NVDA GM >74% on Rubin ramp; Google Cloud >50% YoY",
            "kill_signal": "2+ of MSFT/GOOGL/AMZN/META guide 2027 capex flat/down YoY (Master Switch -> Semicap cap to 30%)",
            "portfolio_weight_pct": round(sum(s["actual_pct_book"] for s in stocks if s["ticker"] in {"GOOG", "MRVL"}), 2),
        },
        {
            "id": "L7",
            "name": "Layer 7: Physical AI, Factory Automation & Humanoid Actuation",
            "bottleneck_physics": "Foundation world models (Nvidia Isaac/Cosmos, Gemini Robotics) are unlocking physical manipulation. Rotary strain-wave gears (HSYDF, 14-28 per humanoid) and industrial arms/servos (FANUY, YASKY) provide 2028-2030 S-curve optionality.",
            "monopoly_tickers": ["HSYDF", "FANUY", "YASKY"],
            "leading_kpi": "Harmonic Drive (6324.T) Quarterly Order Growth (>=+10% YoY); Western Humanoid Production Volume (Optimus, Figure, Boston Dynamics)",
            "bull_signal": "HSYDF Nov 11 orders >+15% YoY on humanoid & semi tool recovery; FANUY/YASKY robot bookings turn positive YoY",
            "kill_signal": "HSYDF orders <+10% YoY AND FY OP guide cut; FANUY robot orders down >15% YoY 2Q",
            "portfolio_weight_pct": round(sum(s["actual_pct_book"] for s in stocks if s["ticker"] in {"HSYDF", "FANUY", "YASKY"}), 2),
        },
    ]

    # 12-Expert Panel cards
    expert_panel = [
        {
            "id": "growth_investor",
            "role": "Institutional Tech Growth Investor",
            "affiliation_lens": "Crossover / Tiger / Coatue Framework",
            "core_metric": "Forward PEG (<0.75x) & 3Y Reverse-DCF vs. 10.625% Hurdle",
            "headline_view": "NVDA (17.7x P/E, 0.35 PEG) & AVGO (19.0x P/E, 0.35 PEG) are 2.2x cheaper on earnings than MRVL (40.3x P/E) and 7x cheaper on PEG than CDNS (2.48 PEG).",
            "key_points": [
                "Market-Cap Ceiling Law: NVDA ($5.17T) cannot 4x to $21T, so terminal P/E is compressed to 17.7x. Yet even with a 20% P/E haircut to 14x and 40% EPS growth, NVDA delivers 2.17x in 3Y—beating MRVL (1.77x) and CDNS (1.37x).",
                "In Sleeve 1, TSM (18.8x P/E, 0.45 PEG -> 2.30x 3Y MOIC) and ASML (26.0x P/E, 0.57 PEG -> 2.12x 3Y MOIC) are the highest-probability 2x compounders requiring zero multiple expansion.",
                "In Sleeve 2 Roth, concentrate aggressively where <0.55 PEG meets -45% to -52% drawdowns: ONTO (0.48 PEG), CRDO (0.40 PEG), COHR (0.42 PEG), and BESIY (0.58 PEG).",
            ],
            "top_picks": ["TSM", "NVDA", "AVGO", "ONTO", "CRDO", "COHR"],
            "avoid_or_trim": ["CDNS (2.48 PEG)", "MRVL (40.3x P/E on LTCG)", "ALAB (50.9x P/E)"],
        },
        {
            "id": "vc_partner",
            "role": "Frontier AI & Robotics Venture Capitalist",
            "affiliation_lens": "Sand Hill / Deep-Tech & Physical AI S-Curve Lens",
            "core_metric": "Gross Margin Velocity (+500 bps YoY) & S-Curve Inflection Year",
            "headline_view": "Separate 2026–2028 vertical datacenter bottlenecks (Optics, 3D Packaging, AECs) from the 2028–2030 Physical AI hardware S-curve.",
            "key_points": [
                "VCs poured $18B+ into Physical AI (Figure, Physical Intelligence π0, Skild, 1X, Apptronik) because foundation world models finally work in simulation.",
                "However, 2026–2027 global humanoid volume is <50,000 units (pilot phase). Meanwhile, 800G/1.6T interconnects (CRDO, COHR, LITE) and CoWoS/HBM4 inspection (ONTO) are in a vertical 50–77% EPS growth super-cycle today.",
                "Keep Robotics capped at 10-12% of Total Roth (anchored by HSYDF rotary gears) as a 2028-2030 call option while compounding 88% of Roth capital in 2026-2028 semiconductor/optical choke points.",
            ],
            "top_picks": ["CRDO", "ONTO", "COHR", "NBIS", "HSYDF"],
            "avoid_or_trim": ["Over-sizing legacy CNC/auto robotics (>14% Roth) before 2028 humanoid volume"],
        },
        {
            "id": "semi_supply_chain",
            "role": "Semiconductor Supply Chain & Sub-Tier Monopoly Expert",
            "affiliation_lens": "Japanese & European Atomic Choke-Point Specialist",
            "core_metric": "Sub-Sector Market Share (75–100%) + Gross Margin (>55%) + Consumables",
            "headline_view": "Own the $3.5B–$38B sole-source bottlenecks where a single defect ruins a $40,000 CoWoS superchip.",
            "key_points": [
                "Disco (DSCSY, 80% share, 70.8% GM, 43.1% OPM) is the apex Japanese monopoly: grinding 16-Hi HBM4 wafers under 30µm requires Disco tools + recurring consumable blades.",
                "Maruwa (MRUWY, $3.6B cap, 53% GM, 33% OPM, 0.72 PEG) owns 60-70% of AlN thermal ceramic submounts inside 800G/1.6T transceivers plus high-purity EUV quartz.",
                "Nittobo (NBCLF, $3.6B cap) controls 85-90% of T-glass low-CTE yarn for CoWoS-L substrates through 2027; monitor Ibiden/Unimicron second-source qualifications closely.",
            ],
            "top_picks": ["DSCSY", "ONTO", "ASMIY", "MRUWY", "LSRCY", "VACNY"],
            "avoid_or_trim": ["Multi-sourced analog/power chips (MPWR) trading at 35x+ P/E with <30% OPM"],
        },
        {
            "id": "ai_scaling_expert",
            "role": "AI Scaling & Systems Architecture Expert",
            "affiliation_lens": "Frontier Pre-Training & Test-Time Compute Architect",
            "core_metric": "Interconnect Bandwidth-to-FLOP Ratio & HBM4 Stack Density",
            "headline_view": "Test-time reasoning (RL tokens) and MoE architectures shift the hardware bottleneck from raw FLOPs to HBM4 memory bandwidth and 200G/448G interconnects.",
            "key_points": [
                "As clusters scale to 100k–500k XPUs and NVLink domains span multi-rack pods, optical and active-copper content per GPU is compounding at 45–65% CAGR (2x faster than GPU units).",
                "The 'Next SK Hynix' is Optical I/O & 6-Inch InP Lasers (LITE 0.30 PEG, COHR 0.42 PEG, CRDO 0.40 PEG) and 3D Hybrid Bonding / HBM4 Probe Cards (BESIY 0.58 PEG, FORM 0.41 PEG, TPRO.MI 0.34 PEG).",
            ],
            "top_picks": ["CRDO", "LITE", "COHR", "BESIY", "ONTO", "SKHY"],
            "avoid_or_trim": ["Commodity server assemblers with <12% gross margins (SMCI, FN, CLS)"],
        },
        {
            "id": "google_cloud_lead",
            "role": "Google Cloud & TPU Infrastructure Perspective",
            "affiliation_lens": "Public-Domain Custom Silicon, OCS & Full-Stack Cloud Economics",
            "core_metric": "Optical Circuit Switching (OCS) Fabric Power Savings & Custom XPU TCO",
            "headline_view": "Optical Circuit Switches (OCS) and custom XPUs reshape data center fabrics while funneling 100% through TSMC CoWoS-L and 6-inch InP optics.",
            "key_points": [
                "Public architecture papers confirm Optical Circuit Switching (OCS) routes light via mirrors without O-E-O transceivers, slashing spine network power by >40% and enabling dynamic pod reconfiguration—directly benefiting Coherent (COHR) and Lumentum (LITE).",
                "Whether workloads run on TPUs, AWS Trainium, or Nvidia GPUs, 100% require TSMC N3/N2 wafers, CoWoS-L interposers, Nittobo T-glass, and Advantest/Onto inspection.",
            ],
            "top_picks": ["TSM", "COHR", "AVGO", "GOOG", "ONTO"],
            "avoid_or_trim": ["GOOG weight >28% of Brokerage_Family (enforce disciplined 10b5-1 diversification)"],
        },
        {
            "id": "aws_infra_lead",
            "role": "Amazon / AWS Custom Silicon & Datacenter Power Perspective",
            "affiliation_lens": "Annapurna Trainium Pods, AEC Copper & Nuclear PPA Lens",
            "core_metric": "Intra-Rack AEC Attach Rate & Contracted $/MW Energized Power",
            "headline_view": "Credo Active Electrical Cables (AECs) are mandatory for 200G/lane multi-rack clusters, while energized GW substations (CIFR, CORZ) own a 5-year grid moat.",
            "key_points": [
                "At 200G/lane, passive copper fails above 1.5m. Credo (CRDO) AECs deliver 2.5m-7m rack-to-rack connectivity at 50% lower power and 100x higher reliability than optics.",
                "Energized megawatts with existing substations (CIFR $11.4B+ AWS/Fluidstack leases; CORZ 2.5GW AMD pact) bypass the 5-year utility interconnection queue.",
            ],
            "top_picks": ["CRDO", "CIFR", "CORZ", "TSM"],
            "avoid_or_trim": ["Unfunded Bitcoin miners issuing toxic dilutive convertibles without IG hyperscaler leases"],
        },
        {
            "id": "tsmc_foundry_lead",
            "role": "TSMC Advanced Foundry & 3D Packaging Perspective",
            "affiliation_lens": "N2 GAA, A16 Backside Power, CoWoS-L & SoIC Roadmap",
            "core_metric": "CoWoS-L kWpm Expansion & ALD / Metrology Step Intensity",
            "headline_view": "N2 nanosheet GAA and A16 Super Power Rail trigger a step-function jump in ALD (ASMIY), backside wafer grinding (DSCSY), and 3D inspection (ONTO).",
            "key_points": [
                "Forming gate oxides around 3D suspended nanosheets in N2 requires single-wafer ALD and epitaxy—driving >35% higher tool intensity per wafer for ASM International (ASMIY).",
                "A16 backside power requires flipping the wafer and grinding silicon to sub-micron thickness (DSCSY) while 3.3x-5.5x reticle CoWoS-L doubles Dragonfly inspection passes (ONTO).",
            ],
            "top_picks": ["TSM", "ASMIY", "ONTO", "DSCSY", "BESIY", "KLAC"],
            "avoid_or_trim": ["Trailing-node mature foundries facing Chinese ICAPS overcapacity"],
        },
        {
            "id": "asml_litho_lead",
            "role": "ASML Lithography & High-NA EUV Perspective",
            "affiliation_lens": "0.33 NA (NXE:3800E) & 0.55 High-NA (EXE:5000/5200) Roadmap",
            "core_metric": "EUV Exposures per Wafer (Logic + HBM DRAM) & Actinic Mask Yield",
            "headline_view": "EUV and High-NA lithography are booked through 2030 across both 2nm/1.4nm logic and 1c/4F2 HBM4 DRAM.",
            "key_points": [
                "Every EUV scanner shipped requires a Tokyo Electron (TELWY) coater/developer track, VAT Group (VACNY) vacuum valves, and Maruwa (MRUWY) synthetic quartz.",
                "As High-NA pellicles and anamorphic masks roll out, Lasertec (LSRCY) holds 100% market share in actinic patterned mask inspection.",
            ],
            "top_picks": ["ASML", "LSRCY", "TELWY", "VACNY"],
            "avoid_or_trim": ["Trim LSRCY only if weight exceeds 20% above $62 or if KLA announces actinic mask shipment"],
        },
        {
            "id": "spacex_robotics_lead",
            "role": "SpaceX / Physical AI & Manufacturing Perspective",
            "affiliation_lens": "First-Principles 'Idiot Index' & Humanoid Actuator BOM Lens",
            "core_metric": "Idiot Index (Component Price ÷ Raw Material Cost) & Volume Price-Down Curve",
            "headline_view": "High-'Idiot Index' machined steel parts face ruthless vertical integration and Chinese price compression; own the NDAA-shielded rotary bottleneck (HSYDF) + the silicon brains (NVDA/TSM).",
            "key_points": [
                "Why does Harmonic Drive (HSYDF, 70% share) have 32.3% GM and 6.8% OPM while Disco (DSCSY) has 70.8% GM and 43.1% OPM? Because a $500 steel gear made from $15 of steel has a high Idiot Index—inviting in-house OEM designs and Chinese rivals (Leaderdrive).",
                "However, US NDAA/tariff walls shield HSYDF's Beverly, MA and Japanese plants for Western humanoids (Optimus, Figure, Boston Dynamics) across 12-14 upper-body rotary joints.",
                "Keep HSYDF (7% RF) as your purest mechanical humanoid lever, paired with NVDA/GOOG/TSM for the high-margin Physical AI brain.",
            ],
            "top_picks": ["HSYDF", "NVDA", "TSM", "KEYENCE (6861.T)"],
            "avoid_or_trim": ["Nabtesco (6268.T — heavy cycloidal RV gears are too heavy for bipedal humanoid limbs)"],
        },
        {
            "id": "broadcom_xpu_lead",
            "role": "Broadcom Custom XPU & Networking Perspective",
            "affiliation_lens": "Custom AI XPUs, 200G SerDes, Tomahawk 6 & Co-Packaged Optics",
            "core_metric": "Hyperscaler XPU Tape-Out Share & 102.4T Tomahawk 6 Port Shipments",
            "headline_view": "Custom AI XPUs and Ethernet scale-out fabrics are consolidating around 200G/448G SerDes, Tomahawk 6 switches, and 3.5D packaging.",
            "key_points": [
                "Broadcom (AVGO) captures both custom XPU silicon for hyperscaler titans and merchant Tomahawk 5/6 Ethernet switching at 75.5% GM and 44.2% FCFM—trading at 19.0x Fwd P/E vs Arista (ANET) at 38.1x and Marvell (MRVL) at 40.3x.",
                "Inside the rack, 200G SerDes requires Credo (CRDO) AECs; across rows, 102.4T switches require Coherent (COHR) and Lumentum (LITE) 1.6T transceivers & CW lasers.",
            ],
            "top_picks": ["AVGO", "TSM", "CRDO", "COHR", "LITE"],
            "avoid_or_trim": ["Paying 40x+ Fwd P/E for #2 ASIC challengers with 16% operating margins (MRVL)"],
        },
        {
            "id": "fireworks_inference_lead",
            "role": "Fireworks AI Inference Engine & Systems Perspective",
            "affiliation_lens": "Disaggregated Prefill/Decode, MoE All-to-All & Token Latency Physics",
            "core_metric": "Time-Per-Output-Token (TPOT <15ms), HBM4 TB/s & ZeroFlap Link Uptime",
            "headline_view": "Production reasoning decode is 90% memory-bandwidth (HBM4) and all-to-all interconnect latency (CRDO / COHR) bound.",
            "key_points": [
                "In disaggregated MoE serving, Prefill clusters ship 50GB+ KV-caches over 1.6T optical networks (COHR, LITE) to Decode clusters that read HBM4 (SKHY, MU, ONTO, DSCSY) on every single generated token.",
                "A single optical transceiver thermal 'link flap' stalls an entire synchronous MoE inference pod—making Credo's (CRDO) ZeroFlap AECs and optical DSPs mission-critical.",
            ],
            "top_picks": ["CRDO", "ONTO", "DSCSY", "COHR", "SKHY", "MU"],
            "avoid_or_trim": ["Hardware without bandwidth density or interconnect reliability"],
        },
        {
            "id": "anthropic_ipo_lead",
            "role": "Anthropic Frontier Model & IPO Strategy Perspective",
            "affiliation_lens": "Public-Domain Enterprise Agentic ARR & Tri-Silicon Compute Economics",
            "core_metric": "Claude Code / Enterprise API Mix (>=70%), NDR (>=145%) & Entry EV/NTM ARR",
            "headline_view": "Autonomous coding agents (Claude Code) expand developer ARPU 100x–500x while tri-silicon routing (Trainium + TPU + GPU) cuts inference COGS 30–45%.",
            "key_points": [
                "Underwrite Anthropic on Enterprise API + first-party Claude Code ARR (>=70% mix), ensuring no single 3rd-party IDE wrapper exceeds 15% of revenue.",
                "Strict Valuation Entry Discipline (assuming $15B NTM ARR at IPO compounding at 57.5% 3Y CAGR to $58.6B Year-3 Rev & $586B Base Exit EV): Strong Buy (3x in 3Y) up to $195B–$220B EV; Sleeve 1 Buy (2x in 3Y) up to $290B EV; pass on Day-1 retail pops >$350B.",
            ],
            "top_picks": ["Anthropic IPO (<= $220B Strong Buy / <= $290B 2x Buy)", "AMZN", "GOOG", "TSM", "CRDO"],
            "avoid_or_trim": ["Chasing Day-1 IPO retail pop above $350B (>23x NTM ARR)"],
        },
    ]

    # Sleeve 3 Contender Sectors comparison (US & ADR Only)
    sleeve3_contenders = [
        {
            "rank": 1,
            "sector": "Optical Interconnects, 6-Inch InP Lasers & Active Copper (AEC/CPO)",
            "match_score": 96,
            "inflection_window": "NOW (2026–2028 Vertical Super-Cycle)",
            "physics_wall": "224G/448G SerDes kills passive copper >1.5m; 100k+ XPU clusters require 1.6T/3.2T InP lasers, OCS & ZeroFlap AECs.",
            "rev_3y_range": "39% – 67%",
            "eps_3y_range": "50% – 77%",
            "gm_range": "38% – 67% (expanding)",
            "peg_range": "0.30x – 0.66x",
            "top_tickers": [
                {"ticker": "CRDO", "name": "Credo Tech", "mkt_cap": "$27.7B", "fwd_pe": 20.2, "peg": 0.40, "eps_3y": 53.4, "gm": 67.1, "status": "OWNED ($34.7k RF)"},
                {"ticker": "LITE", "name": "Lumentum", "mkt_cap": "$68.5B", "fwd_pe": 34.7, "peg": 0.30, "eps_3y": 77.2, "gm": 44.2, "status": "#1 OPTICAL BUY"},
                {"ticker": "COHR", "name": "Coherent", "mkt_cap": "$41.2B", "fwd_pe": 22.3, "peg": 0.42, "eps_3y": 49.8, "gm": 37.5, "status": "OWNED ($21.1k RF)"},
                {"ticker": "AVGO", "name": "Broadcom", "mkt_cap": "$1,570B", "fwd_pe": 19.0, "peg": 0.35, "eps_3y": 54.0, "gm": 75.5, "status": "#1 XPU / TOMAHAWK 6"},
            ],
            "verdict": "WINNER (#1 'Next SK Hynix' Analog): InP laser capacity (LITE, COHR) and AECs (CRDO) are sold out through 2027 with 50-77% EPS growth at 0.30-0.42 PEG.",
        },
        {
            "rank": 2,
            "sector": "3D Hybrid Bonding, CoWoS Metrology & HBM4 MEMS Probe Cards",
            "match_score": 94,
            "inflection_window": "NOW (2026–2029 HBM4/4E & SoIC Ramp)",
            "physics_wall": "HBM4 doubles I/O pins (1024 -> 2048) + adds logic base die; SoIC & 16-Hi HBM4E shrink bump pitch <9µm requiring Cu-Cu hybrid bonding.",
            "rev_3y_range": "24% – 48%",
            "eps_3y_range": "41% – 94%",
            "gm_range": "46% – 64%",
            "peg_range": "0.34x – 0.58x",
            "top_tickers": [
                {"ticker": "ONTO", "name": "Onto Innovation", "mkt_cap": "$9.8B", "fwd_pe": 19.3, "peg": 0.48, "eps_3y": 41.3, "gm": 55.5, "status": "OWNED ($32.2k RS)"},
                {"ticker": "BESIY", "name": "BE Semiconductor", "mkt_cap": "$13.5B", "fwd_pe": 28.0, "peg": 0.58, "eps_3y": 72.4, "gm": 64.1, "status": "#1 HYBRID BOND BUY"},
                {"ticker": "MU", "name": "Micron Tech", "mkt_cap": "$994B", "fwd_pe": 5.0, "peg": 0.07, "eps_3y": 71.0, "gm": 80.7, "status": "#1 US HBM4 LEADER"},
                {"ticker": "FORM", "name": "FormFactor", "mkt_cap": "$7.7B", "fwd_pe": 28.2, "peg": 0.41, "eps_3y": 59.2, "gm": 46.2, "status": "#1 US HBM4 PROBES"},
            ],
            "verdict": "CO-WINNER (#2 'Next SK Hynix' Analog): Software-like 55-70% gross margins on non-negotiable HBM4/CoWoS inspection, dicing (DSCSY), hybrid bonding (BESIY), and US HBM4 (MU).",
        },
        {
            "rank": 3,
            "sector": "800V HVDC Rack Power, Cold-Plate Liquid Cooling & EHV Grid Turbines",
            "match_score": 88,
            "inflection_window": "NOW (2026–2028 Blackwell NVL72 -> Rubin NVL144)",
            "physics_wall": "Air cooling fails >50kW/rack & 48V busbars melt at 250-600kW/rack, forcing mandatory 100% liquid cold plates & ±400V/800V power shelves.",
            "rev_3y_range": "16% – 41%",
            "eps_3y_range": "26% – 62%",
            "gm_range": "29% – 38%",
            "peg_range": "0.47x – 0.72x",
            "top_tickers": [
                {"ticker": "VRT", "name": "Vertiv Holdings", "mkt_cap": "$79.5B", "fwd_pe": 26.0, "peg": 0.65, "eps_3y": 40.9, "gm": 38.0, "status": "#1 US LIQUID COOLING"},
                {"ticker": "GEV", "name": "GE Vernova", "mkt_cap": "$245B", "fwd_pe": 43.8, "peg": 1.14, "eps_3y": 38.4, "gm": 34.7, "status": "#1 GAS TURBINES/GRID"},
                {"ticker": "CEG", "name": "Constellation Energy", "mkt_cap": "$96.2B", "fwd_pe": 22.0, "peg": 1.30, "eps_3y": 17.0, "gm": 36.0, "status": "#1 NUCLEAR BASELOAD"},
                {"ticker": "CORZ", "name": "Core Scientific", "mkt_cap": "$4.3B", "fwd_pe": 14.5, "peg": 0.45, "eps_3y": 35.0, "gm": 42.0, "status": "OWNED ($20.3k RS)"},
            ],
            "verdict": "STRONG CONTENDER (#3): Massive physical content per rack jump from Blackwell to Rubin plus 5-year grid turbine & transformer backlogs.",
        },
        {
            "rank": 4,
            "sector": "Specialty AI Substrates, Low-Dk T-Glass, AlN Ceramics & CMP Filtration",
            "match_score": 90,
            "inflection_window": "NOW (2026–2028 2nm GAA & CoWoS-L Substrates)",
            "physics_wall": "224G/lane electrical routing & 1.6T laser heat dissipation require Low-Dk T-glass cloth, AlN ceramics, and sub-nm liquid filtration.",
            "rev_3y_range": "22% – 36%",
            "eps_3y_range": "27% – 38%",
            "gm_range": "38% – 53%",
            "peg_range": "0.72x – 0.85x",
            "top_tickers": [
                {"ticker": "MRUWY", "name": "Maruwa Co. ADR", "mkt_cap": "$3.6B", "fwd_pe": 23.6, "peg": 0.72, "eps_3y": 32.0, "gm": 53.0, "status": "OWNED ($26.8k RF)"},
                {"ticker": "NBCLF", "name": "Nitto Boseki OTC", "mkt_cap": "$3.6B", "fwd_pe": 23.3, "peg": 0.85, "eps_3y": 27.0, "gm": 38.0, "status": "OWNED ($26.8k RF)"},
                {"ticker": "ENTG", "name": "Entegris Inc.", "mkt_cap": "$17.8B", "fwd_pe": 24.5, "peg": 0.78, "eps_3y": 31.5, "gm": 46.5, "status": "#1 GAA CMP/FOUPS"},
            ],
            "verdict": "HIGH-TORQUE MONOPOLY NICHE (#4): MRUWY ($26.8k) and NBCLF ($26.8k) are #1 materials monopolies held in Roth Fidelity; ENTG is the #1 US consumable filtration/CMP addition.",
        },
        {
            "rank": 5,
            "sector": "Physical AI, Humanoid Strain-Wave Actuators & Surgical/Warehouse Robotics",
            "match_score": 68,
            "inflection_window": "2027–2030 Commercial S-Curve (Concentrate in #1 Choke Points Only)",
            "physics_wall": "Legacy automotive factory arms (FANUY, YASKY) have <12% AI exposure; real Physical AI alpha is in #1 zero-backlash strain-wave gears (HSYDF), AI brains (NVDA), and autonomous warehouse/surgical monopolies.",
            "rev_3y_range": "15% – 45%",
            "eps_3y_range": "25% – 91%",
            "gm_range": "32% – 68%",
            "peg_range": "0.35x – 1.10x",
            "top_tickers": [
                {"ticker": "HSYDF", "name": "Harmonic Drive OTC", "mkt_cap": "$3.2B", "fwd_pe": 68.8, "peg": 0.75, "eps_3y": 91.0, "gm": 32.3, "status": "OWNED ($12.8k RF - KEEP)"},
                {"ticker": "FANUY", "name": "FANUC ADR", "mkt_cap": "$31.2B", "fwd_pe": 27.0, "peg": 2.60, "eps_3y": 10.4, "gm": 38.4, "status": "DIVEST ($20.1k RF)"},
                {"ticker": "YASKY", "name": "Yaskawa ADR", "mkt_cap": "$7.7B", "fwd_pe": 21.8, "peg": 1.13, "eps_3y": 19.3, "gm": 35.2, "status": "DIVEST ($17.3k RF)"},
            ],
            "verdict": "NO DIWORSIFICATION: Keep HSYDF ($12.8k) as the #1 NDAA humanoid rotary gear monopoly, and divest legacy industrial conglomerates FANUY ($20.1k) & YASKY ($17.3k) to fund #1 AI compute bottlenecks.",
        },
    ]

    robotics_idiot_index = [
        {
            "subsystem": "1. Foundation World Model & Edge Brain (Jetson Thor / Isaac / Gemini)",
            "bom_share_pct": 24,
            "est_cost_usd": 3800,
            "raw_material_usd": 180,
            "idiot_index_note": "Protected by lithography physics & CUDA/Isaac moat (NOT commoditizable)",
            "gross_margin_profile": "65% – 75% GM",
            "winner_tickers": ["NVDA", "TSM", "GOOG"],
            "panel_verdict": "CORE PROFIT POOL (TSM Owned + NVDA Top Watch)",
        },
        {
            "subsystem": "2. Upper-Body Rotary Actuators (12–14 Strain-Wave Gear Joints)",
            "bom_share_pct": 22,
            "est_cost_usd": 3500,
            "raw_material_usd": 210,
            "idiot_index_note": "High Idiot Index (~16x) in China, but US NDAA/tariffs shield HSYDF in Western humanoids",
            "gross_margin_profile": "32% – 40% GM",
            "winner_tickers": ["HSYDF"],
            "panel_verdict": "BEST PURE-PLAY MECHANICAL CHOKE POINT ($12,815 Owned in RF)",
        },
        {
            "subsystem": "3. Lower-Body Linear Actuators & Bearings (12–14 Roller Screws)",
            "bom_share_pct": 23,
            "est_cost_usd": 3600,
            "raw_material_usd": 240,
            "idiot_index_note": "High Idiot Index (~15x); intense competition among automotive tier-1 suppliers",
            "gross_margin_profile": "25% – 35% GM",
            "winner_tickers": ["TKR (Timken)", "RBC (RBC Bearings)"],
            "panel_verdict": "AVOID (Fragmented tier-1 margin profile)",
        },
        {
            "subsystem": "4. Machine Vision, 3D LiDAR & Multi-Modal Tactile Sensors",
            "bom_share_pct": 19,
            "est_cost_usd": 3000,
            "raw_material_usd": 190,
            "idiot_index_note": "Essential for sub-mm pick-and-place and semiconductor factory automation",
            "gross_margin_profile": "55% – 70% GM",
            "winner_tickers": ["CGNX (Cognex)", "KYCCF (Keyence OTC)"],
            "panel_verdict": "SELECTIVE WATCH (High gross margin vision software)",
        },
        {
            "subsystem": "5. Legacy 6-Axis Automotive Factory Arms & Servos",
            "bom_share_pct": 12,
            "est_cost_usd": 2100,
            "raw_material_usd": 450,
            "idiot_index_note": "Mature cyclical auto/general industrial capex (<12% AI revenue)",
            "gross_margin_profile": "35% – 38% GM",
            "winner_tickers": ["FANUY", "YASKY"],
            "panel_verdict": "DIVEST BOTH ($37,476 Combined) -> Redeploy to #1 AI Compute Bottlenecks",
        },
    ]

    anthropic_ipo_model = {
        "default_ntm_arr_b": 15.0,
        "default_rev_cagr_3y_pct": 57.5,
        "default_inference_gm_pct": 70.0,
        "default_steady_fcfm_pct": 28.0,
        "default_exit_ev_to_rev": 10.0,
        "bull_exit_ev_to_rev": 12.0,
        "tri_silicon_cogs_advantage_pct": 37.5,
        "s1_checklist": [
            {"item": "Enterprise API + First-Party Claude Code Share >= 70% of Total ARR", "target": ">= 70%", "rationale": "Autonomous SWE/enterprise loops consume 100x-500x more tokens per user than consumer chatbots."},
            {"item": "Single 3rd-Party IDE Wrapper Concentration < 15% of ARR", "target": "< 15%", "rationale": "Protects against multi-model routing by third-party IDE wrappers; first-party Claude Code CLI/Enterprise must lead."},
            {"item": "Tri-Silicon Serving Gross Margin (Trainium2/3 + TPU v6e/v7 + GPU)", "target": "65% – 74% Paid Inference GM", "rationale": "Bypassing 100% merchant GPU tax + prompt caching cuts effective token serving COGS by 30-45%."},
            {"item": "Enterprise Net Dollar Retention (NDR)", "target": ">= 145%", "rationale": "Validates autonomous background agent expansion across Fortune 500 engineering & knowledge workflows."},
        ],
        "valuation_tiers": [
            {"entry_ev_range": "$150B – $180B", "entry_arr_mult": "10.0x – 12.0x", "base_3y_moic": "3.26x – 3.91x", "bull_3y_moic": "3.91x – 4.69x", "verdict": "BACK UP THE TRUCK (8-10% Allocation)"},
            {"entry_ev_range": "$195B – $220B", "entry_arr_mult": "13.0x – 14.7x", "base_3y_moic": "2.66x – 3.01x", "bull_3y_moic": "3.20x – 3.61x", "verdict": "STRONG BUY (3x Target Ceiling = $195B)"},
            {"entry_ev_range": "$250B – $290B", "entry_arr_mult": "16.7x – 19.3x", "base_3y_moic": "2.02x – 2.34x", "bull_3y_moic": "2.42x – 2.81x", "verdict": "DISCIPLINED SLEEVE 1 BUY (2x Ceiling = $290B)"},
            {"entry_ev_range": "$350B – $450B+", "entry_arr_mult": "23.3x – 30.0x+", "base_3y_moic": "1.30x – 1.67x", "bull_3y_moic": "1.56x – 2.01x", "verdict": "PASS ON DAY-1 POP (Wait for 180-Day Lockup Release)"},
        ],
    }

    catalyst_calendar = [
        {"date": "2026-11-04", "ticker": "COHR", "event": "Q1 FY27 Earnings Print (TODAY)", "gate": "Verify Datacom book-to-bill >= 1.0, TTM GM >= 35%, 6-inch InP yield & OCS bookings", "action_pass": "Hold or upgrade to #1 LITE on strength", "action_fail": "Rotate full $21,107 into #1 LITE / CRDO"},
        {"date": "2026-11-10", "ticker": "NBIS", "event": "Q3 2026 Earnings & Backlog Update", "gate": "Verify $37.5B+ ecosystem backlog intact, zero debt >12%, zero equity dilution >10%", "action_pass": "Concentrate / add on dips <= $140", "action_fail": "Consolidate into #1 CORZ / VRT"},
        {"date": "2026-11-11", "ticker": "HSYDF", "event": "H1 FY3/27 Orders & Guidance Print", "gate": "Verify humanoid & industrial strain-wave gear orders >= +10% YoY", "action_pass": "Hold $12,815 RF #1 humanoid gear monopoly", "action_fail": "Consolidate into CRDO / ONTO"},
        {"date": "2026-11-20", "ticker": "NVDA", "event": "Q3 FY27 Earnings & Vera Rubin Ramp Guide", "gate": "Verify next-Q revenue guide >= +8% QoQ and Gross Margin >= 70%", "action_pass": "Rotate #2 MRVL ($33,029) into #1 NVDA / AVGO", "action_fail": "Hold TSM & ASML monopolies"},
        {"date": "2026-11-30", "ticker": "CRDO", "event": "Q2 FY27 Earnings & Hyperscaler AEC Ramp", "gate": "Verify sequential revenue beat-and-raise, GM >= 60%, and multi-hyperscaler 800G/1.6T AEC expansion", "action_pass": "Concentrate further into CRDO (#1 AEC monopoly, $34,737 RF)", "action_fail": "Review AEC share"},
        {"date": "2027-01-15", "ticker": "TSM", "event": "Q4 2026 Print & Full-Year 2027 USD Guidance", "gate": "Verify 2027 USD revenue growth >= 20% and Gross Margin >= 58% + CoWoS-L expansion", "action_pass": "Add to TSM ($23,960 BF) & ASML ($21,422 BF)", "action_fail": "Monitor N2 ramp"},
    ]

    for ep in expert_panel:
        ep["synthetic_persona_disclaimer"] = (
            "Synthetic Analytical Lens — Grounded Strictly in Public Filings, Earnings Transcripts "
            "& Supply-Chain Physics (Zero Non-Public / Insider Information)"
        )

    from datetime import datetime, timezone
    import hashlib
    from backend.daily_refresh_job import (
        FINDINGS_PATH,
        compute_and_persist_rating_changes,
        generate_gemini_4_argon_daily_findings,
    )

    biggest_holding_rating_change, moved_to_strong_buy = compute_and_persist_rating_changes(
        stocks=stocks,
        as_of_date="2026-11-04",
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    digest_hash = hashlib.sha256(f"{now_iso}:{grand_total:.2f}:{net_nav_usd:.2f}:{len(stocks)}".encode("utf-8")).hexdigest()[:6]
    snap_id = f"snap-2026-11-04-{digest_hash}"

    ai_findings = generate_gemini_4_argon_daily_findings(
        stocks=stocks,
        gross_equities_usd=grand_total,
        net_nav_usd=net_nav_usd,
        margin_debit_usd=margin_debit_usd,
        snapshot_id=snap_id,
        attempt_vertex=False,
    )

    seed = {
        "generated_at": now_iso,
        "snapshot_id": snap_id,
        "as_of_date": "2026-11-04",
        "playbook_version": "v4.3-pure-rubric-no-diworsification",
        "google_finance_sync": watchlist_live,
        "portfolio_summary": {
            "grand_total_usd": grand_total,
            "gross_equities_usd": grand_total,
            "net_nav_usd": net_nav_usd,
            "margin_debit_usd": margin_debit_usd,
            "cash_usd": 15.88,
            "account_totals_usd": account_totals,
            "account_net_totals_usd": account_net_totals,
            "tax_free_roth_usd": total_roth_usd,
            "tax_free_roth_pct": round(total_roth_usd / grand_total * 100, 2),
            "holdings_count": 23,
            "monitored_candidates_count": len(stocks) - 23,
            "margin_hurdle_apr_pct": 10.625,
            "weighted_3y_rev_cagr_pct": 38.2,
            "weighted_3y_eps_cagr_pct": 44.6,
            "weighted_fwd_peg": 0.62,
            "weighted_gm_pct": 62.4,
            "default_ai_model": "gemini-4-argon",
        },
        "stocks": stocks,
        "daily_ai_findings": ai_findings,
        "portfolio_caps": portfolio_caps,
        "circuit_breakers": digest_today.get("circuit_breakers", []),
        "macro_prices": digest_today.get("macro_prices", {}),
        "top_news": digest_today.get("top_news", []),
        "biggest_holding_rating_change": biggest_holding_rating_change,
        "moved_to_strong_buy": moved_to_strong_buy,
        "supply_chain_layers": supply_chain_layers,
        "expert_panel": expert_panel,
        "sleeve3_contenders": sleeve3_contenders,
        "robotics_idiot_index": robotics_idiot_index,
        "anthropic_ipo_model": anthropic_ipo_model,
        "catalyst_calendar": catalyst_calendar,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(seed, indent=2))
    FINDINGS_PATH.write_text(json.dumps(ai_findings, indent=2))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes) [snapshot_id={snap_id}] with {len(stocks)} stocks and 12 expert profiles.")


if __name__ == "__main__":
    build()
