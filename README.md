# Apex Compute Terminal (`ACT <GO>`) — v4.9

**Bloomberg-Terminal-Grade AI Compute Supply Chain Investing Platform & 12-Expert Agent Swarm**

Apex Compute Terminal (`ACT <GO>`) is a full-stack equity research, portfolio underwriting, and autonomous agentic investment discovery platform purpose-built for the physical AI & compute supply chain across **Layers L1–L7** (`Silicon Design & EDA`, `EUV & Wafer Fab Equipment`, `CoWoS-L / SoIC / HBM4 Packaging & Metrology`, `800G/1.6T Optical & AEC Fabric`, `Gigawatt Power & Thermal Infrastructure`, `Physical AI & Robotics`, and `Frontier AI Foundation Models`).

---

## Key Capabilities (v4.9)

1. **Zero-Hardcoded Autonomous Agent Swarm Discovery (`POST /api/v1/swarm/discover`)**:
   - Run the **12-Expert / 6-Panel Agent Swarm** **without providing any stock tickers** — just an investment thesis/mandate, market-cap ceiling (e.g., `<$50B`), minimum monopoly share floor (e.g., `>=50%`), layer filter (`L1–L7`), and capital budget (`$`).
   - Autonomously discovers candidate equities via live Yahoo Finance search/quote APIs, Vertex AI Gemini, and physical supply-chain bottleneck mapping.
   - Scores every candidate through the pure 0–100 Bottleneck Inflection Rubric, runs the 6-Panel Swarm Debate, spotlights the **#1 Single Best Investment**, ranks the **Top-N Conviction Portfolio** with dollar allocations, and supports 1-click portfolio application.

2. **Dynamic Agent Swarm Analysis on Customer Tickers (`POST /api/v1/swarm/analyze`)**:
   - Run the 12-Expert Agent Swarm across your active holdings, watchlist universe, or any custom list of stock tickers.
   - Outputs **Portfolio Rubric Health Score (`0–100`)**, **Weighted 3Y Expected MOIC**, **Quality Gate Pass Rate (`%`)**, **Strong Buys / Core Holds / Trim & Divest** buckets, **6-Panel Consensus Matrix**, **L1–L7 Supply-Chain Coverage & Gap Analysis**, and a **Conviction-Weighted Target Allocation Plan**.

3. **Full Ticker CRUD — Add, Edit, or Remove Any Stock (`Zero Hardcoded Lock-In`)**:
   - **Add / Live Lookup (`GET /api/v1/stocks/lookup/{ticker}`, `POST /api/v1/stocks/add-and-underwrite`)**: Fetch live Yahoo Finance market price, 50/200-DMA, 52W range, company name, exchange, and fundamentals for any ticker.
   - **Edit Any Stock (`POST /api/v1/stocks/edit`, `PUT /api/v1/stocks/{ticker}`)**: Modify holding status (`is_holding`), position value (`$`), shares, cost basis, account, supply-chain layer/node (`L1–L7` / `#1–#7`), or fundamental overrides (`Fwd P/E`, `PEG`, `3Y EPS CAGR`, `Gross Margin %`, `Monopoly Share %`).
   - **Remove / Bulk Manage / Blank Slate (`DELETE /api/v1/stocks/{ticker}`, `POST /api/v1/stocks/bulk-manage`)**: Remove any stock (including baseline holdings), bulk-add or replace tickers, clear all holdings (`$0`), clear all stocks (`0 hardcoded stocks`) to build from scratch, or restore defaults.

4. **7 End-to-End Physical Supply Chain Chokepoint Diagrams & Multi-Persona Investment Committee**:
   - Interactive node-by-node physical BOM & chokepoint diagrams for ASML High-NA EUV, TSMC N2 & CoWoS-L, HBM4 16-Hi Memory, GPU/TPU Cluster Interconnects, Gigawatt Datacenter Power, Frontier Model Token Factories, and Humanoid Robotics.
   - Self-funding per-account Investment Committee trade generation, empirical 1Y weekly return correlation matrix, tax-lot harvesting engine, and pre-trade compliance guardrails.

---

## Architecture & Tech Stack

- **Backend (`backend/`)**: Python 3.11+, FastAPI, Pydantic v2, Google Cloud Vertex AI (`google-genai`), BigQuery, and live Yahoo Finance market quote/search integration.
- **Frontend (`frontend/`)**: React 18, TypeScript, Vite, Tailwind CSS, Apache ECharts, and Lucide Icons.
- **Test Suite (`tests/test_terminal_integrity.py`)**: 27 end-to-end unit & data-integrity tests covering pure-rubric scoring, narrative consistency, tax-lot reconciliation, dynamic ticker CRUD, and autonomous swarm discovery.

---

## Quick Start

### 1. Build the Frontend
```bash
cd frontend
npm install
npm run build
cd ..
```

### 2. Run the FastAPI Server
```bash
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8080
```

Open `http://localhost:8080` in your browser.

### 3. Run the 27-Test Integrity Suite
```bash
python3 -m unittest discover -s tests -v
```
