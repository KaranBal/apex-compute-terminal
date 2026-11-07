import React, { useState } from 'react';
import {
  Sparkles, Cpu, Plus, Trash2, Edit3,
  Zap, RotateCcw, Play
} from 'lucide-react';
import {
  TerminalPayload,
  StockItem,
  SwarmPortfolioAnalysisReport,
  SwarmDiscoveryResult,
  SwarmDiscoveryPick
} from './types';

interface SwarmStudioPanelProps {
  data: TerminalPayload;
  onUpdateTerminalState: (newState: TerminalPayload, bannerMsg?: string) => void;
  onOpenStockDrawer: (stock: StockItem) => void;
  onOpenAddModal: (prefillTicker?: string) => void;
  onOpenEditModal: (stock: StockItem) => void;
  onRemoveStock: (ticker: string) => Promise<void>;
}

const PRESET_DISCOVERY_THESES = [
  {
    label: 'Best-in-Class AI Monopolies (<$500B)',
    thesis:
      'Find the highest-quality, safest #1 AI compute pure-play monopolies under $500B market cap with irreplaceable physical chokepoints, high gross margins, and strong 3Y MOIC.',
    maxCap: '500',
    minShare: '50',
    layer: 'ALL'
  },
  {
    label: 'Scarce AI Power & Datacenter Capacity (<$50B)',
    thesis:
      'Power and datacenter capacity is the scarcest resource in an AI bull case. Find best-in-class contracted GW power shells, utility interconnects, and thermal/power infrastructure plays under $50B with multi-bagger torque.',
    maxCap: '50',
    minShare: '35',
    layer: 'L5'
  },
  {
    label: 'Next SK Hynix Bottleneck: Optics & 3D Packaging',
    thesis:
      'Identify the next memory-like supply-chain bottleneck migration across 1.6T co-packaged optics, AEC copper, CoWoS/HBM4 3D metrology, and T-glass substrates with explosive earnings torque.',
    maxCap: '',
    minShare: '50',
    layer: 'ALL'
  },
  {
    label: 'Full-Stack Top Pick (Unconstrained Any Cap)',
    thesis:
      'Autonomously evaluate the entire AI compute stack from EUV lithography and 2nm foundry to HBM4, networking, power, and frontier silicon to find the single best risk-adjusted investment today.',
    maxCap: '',
    minShare: '60',
    layer: 'ALL'
  }
];

export default function SwarmStudioPanel({
  data,
  onUpdateTerminalState,
  onOpenStockDrawer,
  onOpenAddModal,
  onOpenEditModal,
  onRemoveStock
}: SwarmStudioPanelProps) {
  const [studioTab, setStudioTab] = useState<'discover' | 'analyze' | 'manage'>('discover');

  // --- Mode 1: Autonomous Swarm Discovery State (Zero Hardcoded Tickers) ---
  const [discoveryThesis, setDiscoveryThesis] = useState<string>(
    PRESET_DISCOVERY_THESES[0].thesis
  );
  const [discoveryMaxCap, setDiscoveryMaxCap] = useState<string>('500');
  const [discoveryMinShare, setDiscoveryMinShare] = useState<string>('50');
  const [discoveryLayer, setDiscoveryLayer] = useState<string>('ALL');
  const [discoveryTopN, setDiscoveryTopN] = useState<number>(8);
  const [discoveryCapital, setDiscoveryCapital] = useState<number>(100000);
  const [discoveryUseVertex, setDiscoveryUseVertex] = useState<boolean>(true);
  const [discoveryLoading, setDiscoveryLoading] = useState<boolean>(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [localDiscoveryResult, setLocalDiscoveryResult] = useState<SwarmDiscoveryResult | null>(
    data.last_swarm_discovery || null
  );

  // --- Mode 2: Dynamic Swarm Analysis State (On Active or Custom Tickers) ---
  const [analyzeScope, setAnalyzeScope] = useState<'HOLDINGS' | 'UNIVERSE' | 'CUSTOM'>('HOLDINGS');
  const [analyzeCustomTickers, setAnalyzeCustomTickers] = useState<string>(
    'SNPS, CDNS, TSM, ASML, TOELY, ATEYY, KLAC, AMAT, LRCX, ARM, INTC, CIFR, CORZ, IREN, CRWV'
  );
  const [analyzeMandate, setAnalyzeMandate] = useState<string>(
    'Evaluate these tickers through the 12-Expert Swarm: rank the #1 best additions, stress-test valuation vs 3Y MOIC torque, and output a conviction-weighted allocation plan.'
  );
  const [analyzeCapital, setAnalyzeCapital] = useState<number>(
    Math.round(data.meta.gross_equities_usd || 571845)
  );
  const [analyzeUseVertex, setAnalyzeUseVertex] = useState<boolean>(true);
  const [analyzeLoading, setAnalyzeLoading] = useState<boolean>(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [localAnalysisReport, setLocalAnalysisReport] =
    useState<SwarmPortfolioAnalysisReport | null>(data.last_swarm_portfolio_analysis || null);

  // --- Mode 3: Bulk & Dynamic Ticker Manager State ---
  const [bulkTickersInput, setBulkTickersInput] = useState<string>('');
  const [bulkAllocationUsd, setBulkAllocationUsd] = useState<number>(25000);
  const [bulkAccount, setBulkAccount] = useState<string>('Roth_Schwab');
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [quickFilter, setQuickFilter] = useState<string>('');

  const activeDiscovery = localDiscoveryResult || data.last_swarm_discovery || null;
  const activeAnalysis = localAnalysisReport || data.last_swarm_portfolio_analysis || null;

  const handleRunDiscovery = async (
    applyMode: 'none' | 'add_top_pick' | 'add_all_picks' | 'replace_portfolio' = 'none'
  ) => {
    setDiscoveryLoading(true);
    setDiscoveryError(null);
    try {
      const res = await fetch('/api/v1/swarm/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thesis_or_mandate: discoveryThesis,
          max_market_cap_usd_b: discoveryMaxCap.trim() ? parseFloat(discoveryMaxCap) : null,
          min_monopoly_share_pct: discoveryMinShare.trim() ? parseFloat(discoveryMinShare) : 30,
          focus_layers: discoveryLayer === 'ALL' ? [] : [discoveryLayer],
          top_n: discoveryTopN,
          capital_usd: discoveryCapital,
          run_vertex_swarm: discoveryUseVertex,
          apply_mode: applyMode
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setDiscoveryError(json.detail || 'Failed to run autonomous swarm discovery.');
        return;
      }
      if (json.discovery) {
        setLocalDiscoveryResult(json.discovery);
      }
      if (json.terminal_state) {
        const topSym = json.discovery?.best_investment_spotlight?.ticker || 'Top Pick';
        const topScore = json.discovery?.best_investment_spotlight?.bottleneck_score || 0;
        const msg =
          applyMode === 'replace_portfolio'
            ? `Autonomous Swarm replaced portfolio with ${json.discovery?.discovered_picks?.length || 0} discovered picks (#1: ${topSym})`
            : applyMode === 'add_top_pick'
            ? `Added #1 Swarm Conviction Winner ${topSym} directly to your portfolio holdings`
            : applyMode === 'add_all_picks'
            ? `Added ${json.discovery?.discovered_picks?.length || 0} Swarm-discovered stocks to your portfolio`
            : `Autonomous 12-Expert Swarm audited ${json.discovery?.candidates_audited_count || 0} candidates — #1 Best Investment: ${topSym} (${topScore}/100)`;
        onUpdateTerminalState(json.terminal_state, msg);
      }
    } catch (err: any) {
      setDiscoveryError(err?.message || 'Network error running swarm discovery');
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleAddDiscoveredPickToPortfolio = async (pick: SwarmDiscoveryPick, asHolding: boolean) => {
    try {
      const allocUsd = pick.recommended_allocation_usd || 25000;
      const res = await fetch('/api/v1/stocks/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: pick.ticker,
          name: pick.name,
          layer_id: pick.layer_id,
          is_holding: asHolding,
          weight_usd: asHolding ? allocUsd : 0,
          account: 'Roth_Schwab',
          us_price: pick.us_price ?? undefined,
          mkt_cap_usd_b: pick.mkt_cap_usd_b ?? undefined,
          fwd_pe: pick.fwd_pe ?? undefined,
          eps_3y_cagr: pick.eps_3y_cagr ?? undefined,
          gm_pct: pick.gm_pct ?? undefined,
          monopoly_share_pct: pick.monopoly_share_pct ?? undefined,
          user_rationale: pick.why_number_one_over_alternatives || pick.why_selected,
          inclusion_status: asHolding ? 'OWNED_IN_PORTFOLIO' : 'NOT_INCLUDED_MISSING_MONOPOLY'
        })
      });
      const json = await res.json();
      if (json.terminal_state) {
        onUpdateTerminalState(
          json.terminal_state,
          asHolding
            ? `Added ${pick.ticker} ($${allocUsd.toLocaleString()}) to your portfolio holdings`
            : `Added ${pick.ticker} to your active screener & supply-chain universe`
        );
      }
    } catch (err) {
      console.error('Failed to add discovered pick:', err);
    }
  };

  const handleRunSwarmAnalysis = async () => {
    setAnalyzeLoading(true);
    setAnalyzeError(null);
    try {
      let tickersToAnalyze: string[] | null = null;
      if (analyzeScope === 'HOLDINGS') {
        tickersToAnalyze = data.stocks.filter(s => s.is_holding).map(s => s.ticker);
      } else if (analyzeScope === 'UNIVERSE') {
        tickersToAnalyze = data.stocks.map(s => s.ticker);
      } else {
        tickersToAnalyze = analyzeCustomTickers
          .split(/[\s,;]+/)
          .map(t => t.trim().toUpperCase())
          .filter(Boolean);
      }

      const res = await fetch('/api/v1/swarm/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: analyzeScope === 'HOLDINGS' ? 'active_holdings' : analyzeScope === 'UNIVERSE' ? 'all_universe' : 'custom_tickers',
          tickers: tickersToAnalyze,
          mandate: analyzeMandate,
          capital_usd: analyzeCapital,
          run_vertex_swarm: analyzeUseVertex
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setAnalyzeError(json.detail || 'Swarm analysis failed');
        return;
      }
      if (json.analysis) {
        setLocalAnalysisReport(json.analysis);
      }
      if (json.terminal_state) {
        onUpdateTerminalState(
          json.terminal_state,
          `12-Expert Swarm analyzed ${json.analysis?.ticker_count || 0} tickers — Health Score: ${json.analysis?.portfolio_health_score || 0}/100 • Weighted 3Y MOIC: ${json.analysis?.weighted_expected_3y_moic || 0}x`
        );
      }
    } catch (err: any) {
      setAnalyzeError(err?.message || 'Failed to run swarm portfolio analysis');
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const handleBulkAction = async (
    action:
      | 'add_tickers'
      | 'replace_universe'
      | 'replace_holdings'
      | 'clear_all'
      | 'clear_holdings'
      | 'reset_default',
    asHoldings = false
  ) => {
    const parsedTickers = bulkTickersInput
      .split(/[\s,;]+/)
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);

    if (
      (action === 'add_tickers' || action === 'replace_universe' || action === 'replace_holdings') &&
      parsedTickers.length === 0
    ) {
      return;
    }

    const modeMap: Record<string, { mode: string; scope: string }> = {
      add_tickers: { mode: 'add_tickers', scope: 'universe' },
      replace_universe: { mode: 'replace_universe', scope: 'universe' },
      replace_holdings: { mode: 'replace_universe', scope: 'holdings_only' },
      clear_all: { mode: 'clear_all', scope: 'universe' },
      clear_holdings: { mode: 'clear_all', scope: 'holdings_only' },
      reset_default: { mode: 'reset_default', scope: 'universe' }
    };

    const { mode, scope } = modeMap[action];
    setBulkLoading(true);
    try {
      const res = await fetch('/api/v1/stocks/bulk-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          scope,
          tickers: parsedTickers,
          as_holdings: asHoldings,
          weight_usd_each: bulkAllocationUsd,
          account: bulkAccount
        })
      });
      const json = await res.json();
      if (json.terminal_state) {
        const msgMap: Record<string, string> = {
          add_tickers: `Added ${parsedTickers.length} tickers (${parsedTickers.join(', ')}) and ran 12-Expert Swarm underwriting`,
          replace_universe: `Replaced entire terminal universe with ${parsedTickers.length} custom tickers (${parsedTickers.join(', ')})`,
          replace_holdings: `Replaced portfolio holdings with ${parsedTickers.length} custom positions`,
          clear_all:
            'Cleared all tickers — terminal now has 0 hardcoded stocks. Add your own or run Autonomous Swarm Discovery!',
          clear_holdings:
            'Cleared all owned holdings to $0 — ready to build a custom portfolio from scratch',
          reset_default:
            'Restored default portfolio holdings and 56-stock AI supply-chain universe'
        };
        onUpdateTerminalState(json.terminal_state, msgMap[action] || 'Updated ticker universe');
        if (
          action === 'add_tickers' ||
          action === 'replace_universe' ||
          action === 'replace_holdings'
        ) {
          setBulkTickersInput('');
        }
      }
    } catch (err) {
      console.error('Bulk ticker management failed:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleRestoreRemovedTicker = async (sym: string) => {
    setBulkLoading(true);
    try {
      const res = await fetch('/api/v1/stocks/bulk-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'add_tickers',
          scope: 'universe',
          tickers: [sym],
          as_holdings: false,
          weight_usd_each: 0,
          account: 'Roth_Schwab'
        })
      });
      const json = await res.json();
      if (json.terminal_state) {
        onUpdateTerminalState(json.terminal_state, `Restored ${sym} to active terminal universe`);
      }
    } catch (err) {
      console.error('Failed to restore ticker:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  const filteredManageStocks = data.stocks.filter(s => {
    if (!quickFilter.trim()) return true;
    const q = quickFilter.toLowerCase();
    return (
      s.ticker.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.layer_id.toLowerCase().includes(q)
    );
  });

  const spotlight = activeDiscovery?.best_investment_spotlight || null;

  return (
    <div className="bg-[#0b111e] border border-cyan-500/40 rounded-xl p-4 shadow-xl space-y-4">
      {/* Studio Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[10px] font-bold uppercase">
              DYNAMIC TICKER &amp; AGENT SWARM ENGINE
            </span>
            <h2 className="font-mono text-sm md:text-base font-bold text-white">
              Custom Portfolio Builder &amp; Zero-Hardcoded Autonomous Swarm Discovery
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Add, edit, or remove any stock ticker in your portfolio/universe — or run the 12-Expert Agent Swarm autonomously with zero hardcoded symbols to discover the #1 best investment.
          </p>
        </div>

        {/* 3 Mode Switcher Pills */}
        <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
          <button
            type="button"
            onClick={() => setStudioTab('discover')}
            className={`px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition ${
              studioTab === 'discover'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'bg-[#111927] text-slate-300 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1 · Autonomous Swarm Discovery (No Tickers)</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioTab('analyze')}
            className={`px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition ${
              studioTab === 'analyze'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-[#111927] text-slate-300 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>2 · Run Swarm on My Tickers ({data.stocks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioTab('manage')}
            className={`px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition ${
              studioTab === 'manage'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'bg-[#111927] text-slate-300 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>
              3 · Add / Edit / Remove Tickers ({data.stocks.filter(s => s.is_holding).length} Held ·{' '}
              {data.stocks.length} Total)
            </span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          MODE 1: AUTONOMOUS SWARM DISCOVERY (ZERO HARDCODED STOCK SYMBOLS)
      ===================================================================== */}
      {studioTab === 'discover' && (
        <div className="space-y-4">
          <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="font-mono text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>
                  Zero-Hardcoded Swarm Mandate — Describe Your Thesis &amp; Constraints (Swarm Finds the Best Investments)
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_DISCOVERY_THESES.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setDiscoveryThesis(p.thesis);
                      setDiscoveryMaxCap(p.maxCap);
                      setDiscoveryMinShare(p.minShare);
                      setDiscoveryLayer(p.layer);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={2}
              value={discoveryThesis}
              onChange={e => setDiscoveryThesis(e.target.value)}
              placeholder="Describe what you want the 12-Expert Agent Swarm to find (e.g. 'Find the top 2 AI compute monopolies under $500B market cap' or 'Contracted GW data center power plays under $10B with multi-bagger potential')..."
              className="w-full bg-[#05080e] border border-slate-700 rounded p-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">
                  Max Market Cap ($B)
                </label>
                <input
                  type="number"
                  value={discoveryMaxCap}
                  onChange={e => setDiscoveryMaxCap(e.target.value)}
                  placeholder="No limit (e.g. 500)"
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-2 py-1 text-xs text-amber-300"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">
                  Min Moat Share (%)
                </label>
                <input
                  type="number"
                  value={discoveryMinShare}
                  onChange={e => setDiscoveryMinShare(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">
                  Supply-Chain Layer
                </label>
                <select
                  value={discoveryLayer}
                  onChange={e => setDiscoveryLayer(e.target.value)}
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-2 py-1 text-xs text-sky-300"
                >
                  <option value="ALL">All Layers (L1–L7)</option>
                  <option value="L1">L1: Silicon &amp; EDA</option>
                  <option value="L2">L2: Foundry &amp; WFE</option>
                  <option value="L3">L3: HBM4 &amp; Packaging</option>
                  <option value="L4">L4: Optics &amp; Interconnect</option>
                  <option value="L5">L5: GW Power &amp; Thermal</option>
                  <option value="L6">L6: Physical AI &amp; Robotics</option>
                  <option value="L7">L7: Frontier Models &amp; Cloud</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">
                  Capital to Allocate ($)
                </label>
                <input
                  type="number"
                  step="5000"
                  value={discoveryCapital}
                  onChange={e => setDiscoveryCapital(Number(e.target.value) || 100000)}
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">
                  Top N Picks
                </label>
                <select
                  value={discoveryTopN}
                  onChange={e => setDiscoveryTopN(Number(e.target.value))}
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value={3}>Top 3 Picks</option>
                  <option value={5}>Top 5 Picks</option>
                  <option value={8}>Top 8 Picks</option>
                  <option value={12}>Top 12 Picks</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  disabled={discoveryLoading}
                  onClick={() => handleRunDiscovery('none')}
                  className="w-full py-1.5 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${discoveryLoading ? 'animate-spin' : ''}`} />
                  <span>{discoveryLoading ? 'Swarm Discovering...' : 'Discover Best Stock <GO>'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={discoveryUseVertex}
                  onChange={e => setDiscoveryUseVertex(e.target.checked)}
                  className="accent-cyan-400"
                />
                <span>Use Live Vertex AI Gemini + Yahoo Finance Autonomous Candidate Discovery</span>
              </label>
              <span>
                Zero hardcoded symbols required — dynamically scores &amp; ranks candidates through the 6-Panel / 12-Expert Swarm
              </span>
            </div>

            {discoveryError && (
              <div className="p-2.5 rounded bg-rose-950/60 border border-rose-500/40 text-xs font-mono text-rose-300">
                {discoveryError}
              </div>
            )}
          </div>

          {/* Discovery Output Display */}
          {activeDiscovery && spotlight && (
            <div className="space-y-4">
              {/* #1 SINGLE BEST INVESTMENT SPOTLIGHT CARD */}
              <div className="bg-gradient-to-r from-cyan-950/50 via-[#0b1322] to-emerald-950/40 border-2 border-cyan-400/60 rounded-xl p-4 shadow-lg space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded bg-cyan-400 text-slate-950 font-mono text-[11px] font-extrabold uppercase">
                        #1 SWARM CONVICTION WINNER
                      </span>
                      <span className="font-mono text-lg font-extrabold text-amber-300">
                        {spotlight.ticker}
                      </span>
                      <span className="font-sans text-sm font-bold text-white">
                        {spotlight.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold">
                        Score: {spotlight.bottleneck_score}/100 ({spotlight.unanimous_panel_vote || 'STRONG BUY'})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-xs">
                        {spotlight.layer}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-200 font-mono mt-1">
                      {spotlight.headline}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => handleAddDiscoveredPickToPortfolio(spotlight, true)}
                      className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        + Add #{spotlight.ticker} to Portfolio ($
                        {(spotlight.recommended_allocation_usd || 25000).toLocaleString()})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunDiscovery('replace_portfolio')}
                      className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold"
                    >
                      Build Portfolio from Top {activeDiscovery.discovered_picks.length} Picks
                    </button>
                  </div>
                </div>

                {/* Key Metrics Strip for #1 Pick */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 font-mono text-xs">
                  <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                    <span className="text-[10px] text-slate-400 block">Live Price</span>
                    <span className="text-white font-bold text-sm">
                      ${(spotlight.us_price || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                    <span className="text-[10px] text-slate-400 block">Market Cap</span>
                    <span className="text-amber-300 font-bold text-sm">
                      ${spotlight.mkt_cap_usd_b ?? '—'}B
                    </span>
                  </div>
                  <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                    <span className="text-[10px] text-slate-400 block">Fwd P/E &amp; PEG</span>
                    <span className="text-sky-300 font-bold text-sm">
                      {spotlight.fwd_pe ? `${spotlight.fwd_pe.toFixed(1)}x` : 'EV/MW'} (
                      {spotlight.peg ? `${spotlight.peg.toFixed(2)}x` : '—'})
                    </span>
                  </div>
                  <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                    <span className="text-[10px] text-slate-400 block">3Y EPS CAGR</span>
                    <span className="text-emerald-300 font-bold text-sm">
                      {spotlight.eps_3y_cagr ?? spotlight.rev_3y_cagr ?? '—'}%
                    </span>
                  </div>
                  <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                    <span className="text-[10px] text-slate-400 block">Gross Margin &amp; Share</span>
                    <span className="text-white font-bold text-sm">
                      {spotlight.gm_pct ?? '—'}% GM · {spotlight.monopoly_share_pct ?? '—'}% Share
                    </span>
                  </div>
                  <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                    <span className="text-[10px] text-slate-400 block">3Y Bear / Exp / Bull</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {spotlight.bear_3y_moic}x / {spotlight.expected_3y_moic}x /{' '}
                      {spotlight.bull_3y_moic}x
                    </span>
                  </div>
                  <div className="bg-[#070b12] border border-emerald-500/40 rounded p-2">
                    <span className="text-[10px] text-emerald-300 block">Target Allocation</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      ${(spotlight.recommended_allocation_usd || 0).toLocaleString()} (
                      {spotlight.recommended_weight_pct}%)
                    </span>
                  </div>
                </div>

                {/* Why #1 Pick + 6-Panel Roundtable */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#070b12]/90 border border-slate-800 rounded p-3 space-y-1">
                    <div className="font-mono text-[10px] uppercase text-cyan-400 font-bold">
                      Why the 12-Expert Swarm Crowned {spotlight.ticker} #1 Over {activeDiscovery.candidates_audited_count} Candidates
                    </div>
                    <p className="text-slate-200 leading-relaxed">
                      {spotlight.why_number_one_over_alternatives || spotlight.why_selected}
                    </p>
                    <p className="text-[11px] text-amber-300/90 font-mono pt-1">
                      Rubric Breakdown:{' '}
                      {spotlight.swarm_debate?.score_breakdown_label ||
                        `${spotlight.bottleneck_score}/100 (${spotlight.ai_criticality_score}/40 Crit + ${spotlight.tech_moat_score}/35 Moat + ${spotlight.return_torque_score}/25 Torque)`}
                    </p>
                  </div>

                  <div className="bg-[#070b12]/90 border border-slate-800 rounded p-3 space-y-1">
                    <div className="font-mono text-[10px] uppercase text-emerald-400 font-bold">
                      6-Panel Discovery Roundtable ({activeDiscovery.qualified_count} Qualified of {activeDiscovery.candidates_audited_count} Audited)
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      {activeDiscovery.panel_discovery_roundtable.slice(0, 4).map((pr, idx) => (
                        <div key={idx} className="text-slate-300">
                          <span className="text-amber-300 font-bold">{pr.selected_ticker}</span> —{' '}
                          <span className="text-slate-400">{pr.lead}:</span> {pr.rationale}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-rose-300/90 font-mono pt-1">
                      Kill-Switch Trigger: {spotlight.kill_switch_trigger}
                    </p>
                  </div>
                </div>
              </div>

              {/* RANKED DISCOVERED PORTFOLIO TABLE */}
              <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="font-mono text-xs font-bold text-white">
                    Swarm-Discovered Top {activeDiscovery.discovered_picks.length} Ranked Investments ($
                    {(activeDiscovery.filters_applied?.capital_usd || discoveryCapital).toLocaleString()} Allocation Plan)
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRunDiscovery('add_all_picks')}
                    className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-[11px] font-bold"
                  >
                    + Add All {activeDiscovery.discovered_picks.length} Discovered Stocks to Portfolio
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-[#060910]">
                        <th className="py-2 px-2">Rank &amp; Ticker</th>
                        <th className="py-2 px-2">Company &amp; Layer</th>
                        <th className="py-2 px-2 text-right">Mkt Cap</th>
                        <th className="py-2 px-2 text-center">Score</th>
                        <th className="py-2 px-2 text-right">Fwd P/E · PEG</th>
                        <th className="py-2 px-2 text-right">3Y Exp MOIC</th>
                        <th className="py-2 px-2 text-right">Target $ (%)</th>
                        <th className="py-2 px-2">Chokepoint Thesis</th>
                        <th className="py-2 px-2 text-right">Add / Own</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeDiscovery.discovered_picks.map(pick => (
                        <tr key={pick.ticker} className="hover:bg-slate-800/40">
                          <td className="py-2 px-2 font-bold text-amber-300 whitespace-nowrap">
                            #{pick.rank} {pick.ticker}
                          </td>
                          <td className="py-2 px-2 font-sans">
                            <div className="font-semibold text-slate-200 text-xs">{pick.name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{pick.layer}</div>
                          </td>
                          <td className="py-2 px-2 text-right text-slate-300 whitespace-nowrap">
                            ${pick.mkt_cap_usd_b ?? '—'}B
                          </td>
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                              {pick.bottleneck_score}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            {pick.fwd_pe ? `${pick.fwd_pe.toFixed(1)}x` : 'EV/MW'} ·{' '}
                            <span className="text-emerald-300">
                              {pick.peg ? `${pick.peg.toFixed(2)}x` : '—'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-400 whitespace-nowrap">
                            {pick.expected_3y_moic}x
                          </td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            <span className="text-white font-bold">
                              ${(pick.recommended_allocation_usd || 0).toLocaleString()}
                            </span>{' '}
                            <span className="text-slate-400">({pick.recommended_weight_pct}%)</span>
                          </td>
                          <td className="py-2 px-2 font-sans max-w-xs">
                            <div className="text-[11px] text-slate-300 line-clamp-2">
                              {pick.why_selected}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleAddDiscoveredPickToPortfolio(pick, true)}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold"
                                title="Add as owned portfolio holding"
                              >
                                + Own
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddDiscoveredPickToPortfolio(pick, false)}
                                className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold"
                                title="Add to watchlist / screener"
                              >
                                + Watch
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 2: RUN AGENT SWARM ANALYSIS ON DYNAMIC CUSTOMER TICKERS
      ===================================================================== */}
      {studioTab === 'analyze' && (
        <div className="space-y-4">
          <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="font-mono text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>
                  Convene 12-Expert Agent Swarm Across Your Dynamic Portfolio or Any Custom Ticker List
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setAnalyzeScope('HOLDINGS')}
                  className={`px-2.5 py-1 rounded border ${
                    analyzeScope === 'HOLDINGS'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  My Holdings ({data.stocks.filter(s => s.is_holding).length})
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyzeScope('UNIVERSE')}
                  className={`px-2.5 py-1 rounded border ${
                    analyzeScope === 'UNIVERSE'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  Active Universe ({data.stocks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyzeScope('CUSTOM')}
                  className={`px-2.5 py-1 rounded border ${
                    analyzeScope === 'CUSTOM'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  Custom Ticker List
                </button>
              </div>
            </div>

            {analyzeScope === 'CUSTOM' && (
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  Enter Any Stock Tickers (Comma or Space Separated — Live Yahoo Quotes Fetched Automatically)
                </label>
                <input
                  type="text"
                  value={analyzeCustomTickers}
                  onChange={e => setAnalyzeCustomTickers(e.target.value)}
                  placeholder="e.g. SNPS, CDNS, TSM, ASML, TOELY, ATEYY, KLAC, AMAT, LRCX, ARM, INTC, CIFR, CORZ"
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-amber-300 uppercase"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  Swarm Evaluation Mandate / Question
                </label>
                <input
                  type="text"
                  value={analyzeMandate}
                  onChange={e => setAnalyzeMandate(e.target.value)}
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  Target Portfolio Capital ($)
                </label>
                <input
                  type="number"
                  step="10000"
                  value={analyzeCapital}
                  onChange={e => setAnalyzeCapital(Number(e.target.value) || 100000)}
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  disabled={analyzeLoading}
                  onClick={handleRunSwarmAnalysis}
                  className="w-full py-1.5 px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{analyzeLoading ? 'Running 12-Expert Swarm...' : 'Run Swarm Analysis <GO>'}</span>
                </button>
              </div>
            </div>

            {analyzeError && (
              <div className="p-2.5 rounded bg-rose-950/60 border border-rose-500/40 text-xs font-mono text-rose-300">
                {analyzeError}
              </div>
            )}
          </div>

          {activeAnalysis && (
            <div className="bg-[#080d16] border border-amber-500/40 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800 font-mono">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                    Portfolio Health: {activeAnalysis.portfolio_health_score}/100
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                    Wtd 3Y Expected MOIC: {activeAnalysis.weighted_expected_3y_moic}x
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs">
                    Quality Gate Pass: {activeAnalysis.quality_gate_pass_rate_pct}% ({activeAnalysis.ticker_count} Tickers)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Target Capital: ${(activeAnalysis.target_capital_usd || 0).toLocaleString()}
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-mono bg-[#06090f] border border-slate-800 rounded p-3 whitespace-pre-wrap">
                {activeAnalysis.executive_synthesis}
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 font-mono text-xs">
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 space-y-1.5">
                  <div className="text-emerald-400 font-bold uppercase text-[11px]">
                    Strong Buys / Concentrate #1 ({activeAnalysis.strong_buys_and_adds.length})
                  </div>
                  {activeAnalysis.strong_buys_and_adds.slice(0, 6).map((r, idx) => (
                    <div key={r.ticker} className="flex items-center justify-between text-[11px]">
                      <span className="text-white font-bold">
                        #{idx + 1} {r.ticker} ({r.bottleneck_score ?? '—'})
                      </span>
                      <span className="text-emerald-300">
                        {r.expected_3y_moic}x MOIC · {r.peg ? `${r.peg}x PEG` : 'EV/MW'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-sky-950/20 border border-sky-500/30 rounded p-3 space-y-1.5">
                  <div className="text-sky-400 font-bold uppercase text-[11px]">
                    Core Holds ({activeAnalysis.core_holds.length})
                  </div>
                  {activeAnalysis.core_holds.slice(0, 6).map((r, idx) => (
                    <div key={r.ticker} className="flex items-center justify-between text-[11px]">
                      <span className="text-white font-bold">
                        #{idx + 1} {r.ticker} ({r.bottleneck_score ?? '—'})
                      </span>
                      <span className="text-sky-300">
                        {r.expected_3y_moic}x MOIC · ${(r.current_usd || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-rose-950/20 border border-rose-500/30 rounded p-3 space-y-1.5">
                  <div className="text-rose-400 font-bold uppercase text-[11px]">
                    Trim / Divest / Avoid ({activeAnalysis.trim_or_divest.length})
                  </div>
                  {activeAnalysis.trim_or_divest.slice(0, 6).map((r, idx) => (
                    <div key={r.ticker} className="flex items-center justify-between text-[11px]">
                      <span className="text-rose-200 font-bold">
                        #{idx + 1} {r.ticker} ({r.bottleneck_score ?? 'N/A'})
                      </span>
                      <span className="text-rose-400">
                        {r.swarm_action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 3: MANAGE TICKERS (ADD / EDIT / REMOVE / BULK REPLACE / CLEAR / RESET)
      ===================================================================== */}
      {studioTab === 'manage' && (
        <div className="space-y-4">
          {/* Bulk Operations Bar */}
          <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="font-mono text-xs font-bold text-emerald-300">
                Bulk Ticker Operations — Build Any Custom Portfolio or Start From Zero
              </div>
              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => onOpenAddModal('')}
                  className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Single Ticker</span>
                </button>
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => handleBulkAction('clear_holdings')}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold"
                >
                  Clear Holdings ($0)
                </button>
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => handleBulkAction('clear_all')}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold"
                >
                  Clear All Tickers (0 Stocks)
                </button>
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => handleBulkAction('reset_default')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restore Default Portfolio</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 font-mono text-xs">
              <div className="lg:col-span-6">
                <input
                  type="text"
                  value={bulkTickersInput}
                  onChange={e => setBulkTickersInput(e.target.value)}
                  placeholder="Enter tickers (e.g. NVDA, TSM, ASML, AVGO, KLAC, CIFR, CORZ, ARM, LRCX)..."
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-3 py-1.5 text-xs text-amber-300 uppercase"
                />
              </div>
              <div className="lg:col-span-2">
                <input
                  type="number"
                  step="5000"
                  value={bulkAllocationUsd}
                  onChange={e => setBulkAllocationUsd(Number(e.target.value) || 25000)}
                  placeholder="$ per holding"
                  title="Default position $ when adding as holdings"
                  className="w-full bg-[#05080e] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div className="lg:col-span-4 flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  disabled={bulkLoading || !bulkTickersInput.trim()}
                  onClick={() => handleBulkAction('add_tickers', true)}
                  className="px-2.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] disabled:opacity-40"
                >
                  + Add as Holdings
                </button>
                <button
                  type="button"
                  disabled={bulkLoading || !bulkTickersInput.trim()}
                  onClick={() => handleBulkAction('add_tickers', false)}
                  className="px-2.5 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-[11px] disabled:opacity-40"
                >
                  + Add to Watchlist
                </button>
                <button
                  type="button"
                  disabled={bulkLoading || !bulkTickersInput.trim()}
                  onClick={() => handleBulkAction('replace_universe', true)}
                  className="px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-[11px] disabled:opacity-40"
                  title="Replace all stocks in the terminal with only these tickers"
                >
                  Replace All With List
                </button>
              </div>
            </div>

            {/* Removed tickers quick-restore bar */}
            {data.removed_tickers && data.removed_tickers.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 font-mono text-[11px]">
                <span className="text-slate-400">Removed Tickers ({data.removed_tickers.length}):</span>
                {data.removed_tickers.slice(0, 18).map(sym => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleRestoreRemovedTicker(sym)}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                    title={`Click to restore ${sym}`}
                  >
                    + {sym}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Ticker Grid with Instant Edit & Remove */}
          <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="font-mono text-xs font-bold text-white">
                Active Tickers ({filteredManageStocks.length}) — Click Edit to Modify Position $ / Fundamentals or Remove to Delete
              </div>
              <input
                type="text"
                value={quickFilter}
                onChange={e => setQuickFilter(e.target.value)}
                placeholder="Search active tickers..."
                className="bg-[#05080e] border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
              />
            </div>

            {filteredManageStocks.length === 0 ? (
              <div className="p-6 text-center font-mono text-xs text-slate-400 space-y-2">
                <p>No tickers currently in your universe (0 hardcoded stocks).</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenAddModal('NVDA')}
                    className="px-3 py-1.5 rounded bg-cyan-500 text-slate-950 font-bold"
                  >
                    + Add Your First Ticker
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioTab('discover')}
                    className="px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-bold"
                  >
                    Run Autonomous Swarm Discovery
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-[340px] overflow-y-auto pr-1">
                {filteredManageStocks.map(stock => (
                  <div
                    key={stock.ticker}
                    className="bg-[#0b1220] border border-slate-800 hover:border-slate-700 rounded p-2.5 flex items-center justify-between gap-2 font-mono text-xs"
                  >
                    <div
                      className="min-w-0 cursor-pointer"
                      onClick={() => onOpenStockDrawer(stock)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-amber-300">{stock.ticker}</span>
                        <span className="text-[10px] px-1 rounded bg-slate-800 text-emerald-300">
                          {stock.rating_score}
                        </span>
                        {stock.is_holding && (
                          <span className="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            ${(stock.portfolio_usd / 1000).toFixed(1)}k
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{stock.name}</div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenEditModal(stock)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 border border-slate-700"
                        title={`Edit ${stock.ticker} position, price & fundamentals`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveStock(stock.ticker)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-300 border border-slate-700"
                        title={`Remove ${stock.ticker} from portfolio & terminal`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
