import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Terminal, ShieldAlert, Cpu, Layers, TrendingUp,
  Search, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Zap, Target,
  BarChart3, ChevronRight, X, Send, Sparkles,
  AlertOctagon, Scale, Globe, Lock, Edit3, Trash2, Plus
} from 'lucide-react';
import { TerminalPayload, StockItem, SupplyChainDiagram } from './types';
import CommitteeTab, { ActionPill } from './CommitteeTab';
import SwarmStudioPanel from './SwarmStudioPanel';

type TabId = 'triage' | 'supply_chains' | 'screener' | 'copilot' | 'risk' | 'committee';

const fmtPe = (v: number | null | undefined, basis?: string) => {
  if (v === null || v === undefined) {
    if (basis?.includes('MW')) return '— (EV/MW)';
    if (basis?.includes('ARR')) return '— (EV/ARR)';
    return '—';
  }
  return `${v.toFixed(1)}x`;
};

const fmtPeg = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(2)}x`;
};

const fmtPct = (v: number | null | undefined, plus = false) => {
  if (v === null || v === undefined) return '—';
  return `${plus && v > 0 ? '+' : ''}${v.toFixed(1)}%`;
};

const renderSparkline = (pts?: number[], isUp = true) => {
  if (!pts || pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = Math.max(0.0001, max - min);
  const w = 68;
  const h = 20;
  const coords = pts
    .map((v, idx) => {
      const x = (idx / (pts.length - 1)) * w;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke = isUp ? '#34d399' : '#fb7185';
  return (
    <svg width={w} height={h} className="inline-block overflow-visible">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
};

export default function App() {
  const [data, setData] = useState<TerminalPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshBanner, setRefreshBanner] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('triage');
  const [triageViewSection, setTriageViewSection] = useState<'actions' | 'theses' | 'keeps' | 'radar' | 'intel' | 'chart' | 'all'>('actions');
  const [commandInput, setCommandInput] = useState<string>('');
  const commandInputRef = useRef<HTMLInputElement | null>(null);

  // Selected Stock Modal / Drawer for Deep Dive + Rationale Editing
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState<boolean>(false);
  const [deepDiveMemo, setDeepDiveMemo] = useState<string | null>(null);
  const [editRationaleStatus, setEditRationaleStatus] = useState<string>('NOT_INCLUDED_EXCLUDED_PEER');
  const [editRationaleText, setEditRationaleText] = useState<string>('');
  const [editRecommendedSwap, setEditRecommendedSwap] = useState<string>('');
  const [editChainId, setEditChainId] = useState<string>('gpu_tpu_cluster');
  const [editNodeId, setEditNodeId] = useState<string>('xpu_1');
  const [editRunVertex, setEditRunVertex] = useState<boolean>(false);
  const [savingRationale, setSavingRationale] = useState<boolean>(false);
  const [rationaleSavedMsg, setRationaleSavedMsg, ] = useState<string | null>(null);

  // Add / Edit Stock + Position + 12-Expert Swarm Underwriting Modal State
  const [showSwarmStudio, setShowSwarmStudio] = useState<boolean>(true);
  const [showAddStockModal, setShowAddStockModal] = useState<boolean>(false);
  const [isEditingExistingStock, setIsEditingExistingStock] = useState<boolean>(false);
  const [catalogMap, setCatalogMap] = useState<Record<string, any>>({});
  const [newStockTicker, setNewStockTicker] = useState<string>('ARM');
  const [newStockName, setNewStockName] = useState<string>('Arm Holdings plc');
  const [newStockLayerId, setNewStockLayerId] = useState<string>('L1');
  const [newStockChainId, setNewStockChainId] = useState<string>('gpu_tpu_cluster');
  const [newStockNodeId, setNewStockNodeId] = useState<string>('xpu_1');
  const [newStockInclusionStatus, setNewStockInclusionStatus] = useState<string>('NOT_INCLUDED_EXCLUDED_PEER');
  const [newStockRationale, setNewStockRationale] = useState<string>('');
  const [newStockBestPeer, setNewStockBestPeer] = useState<string>('NVDA');
  const [newStockPrice, setNewStockPrice] = useState<string>('158.4');
  const [newStockMktCapB, setNewStockMktCapB] = useState<string>('165.0');
  const [newStockFwdPe, setNewStockFwdPe] = useState<string>('68.5');
  const [newStockEpsCagr, setNewStockEpsCagr] = useState<string>('31.8');
  const [newStockGmPct, setNewStockGmPct] = useState<string>('96.2');
  const [newStockSharePct, setNewStockSharePct] = useState<string>('90');
  const [newStockIsHolding, setNewStockIsHolding] = useState<boolean>(false);
  const [newStockWeightUsd, setNewStockWeightUsd] = useState<string>('0');
  const [newStockShares, setNewStockShares] = useState<string>('');
  const [newStockCostBasis, setNewStockCostBasis] = useState<string>('');
  const [newStockAccount, setNewStockAccount] = useState<string>('Roth_Schwab');
  const [newStockRunVertex, setNewStockRunVertex] = useState<boolean>(false);
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [addStockSubmitting, setAddStockSubmitting] = useState<boolean>(false);
  const [addStockError, setAddStockError] = useState<string | null>(null);

  // Supply Chain Filter State
  const [selectedChainId, setSelectedChainId] = useState<string>('ALL');

  // Screener Filter State
  const [sleeveFilter, setSleeveFilter] = useState<number | 'ALL'>('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'OWNED' | 'MISSING'>('ALL');
  const [usLineFilter, setUsLineFilter] = useState<'ALL' | 'NYSE_NASDAQ' | 'HIDE_ILLIQUID'>('ALL');
  const [qualityFilter, setQualityFilter] = useState<'ALL' | 'PASS_ONLY' | 'LEADER_ONLY' | 'FAIL_ONLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'rating_score' | 'expected_3y_moic' | 'moic_3y_base' | 'peg' | 'portfolio_usd'>('rating_score');

  // DCF / MOIC Interactive Calculator State
  const [dcfTicker, setDcfTicker] = useState<string>('ONTO');
  const [dcfEpsCagr, setDcfEpsCagr] = useState<number>(41.3);
  const [dcfExitMultiple, setDcfExitMultiple] = useState<number>(24.0);
  const [dcfDilutionPct, setDcfDilutionPct] = useState<number>(0.0);

  // Gemini Copilot State
  const [copilotQuery, setCopilotQuery] = useState<string>(
    'Look at my $571.8k Schwab + Fidelity portfolio ($552.3k Net NAV across 22 positions after selling MRVL for $33.0k and cutting margin debit to -$19.5k). With MRVL acquiring Lumentum (LITE) for $115B all-stock and Coherent (COHR) signing a $20B PhotonLink LTA ($2.37B Q1 FY27 rev), how should I deploy my remaining divest proceeds?'
  );
  const [copilotTickerFocus, setCopilotTickerFocus] = useState<string>('ALL');
  const [copilotModel, setCopilotModel] = useState<string>('gemini-4-argon');
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);
  const [copilotResponse, setCopilotResponse] = useState<{
    model: string;
    response: string;
    snapshot_id?: string;
  } | null>(null);
  const [refreshingIntel, setRefreshingIntel] = useState<boolean>(false);

  // Interactive Pre-Trade Compliance Ticket State
  const [ptTicker, setPtTicker] = useState<string>('ONTO');
  const [ptAccount, setPtAccount] = useState<string>('Roth_Schwab');
  const [ptAction, setPtAction] = useState<string>('BUY');
  const [ptAmount, setPtAmount] = useState<number>(15000);
  const [ptLoading, setPtLoading] = useState<boolean>(false);
  const [ptResult, setPtResult] = useState<{
    ticker: string;
    account: string;
    stock_peg: number | null;
    bottleneck_score: number | null;
    new_portfolio_weight_pct: number;
    overall_status: string;
    gates: { gate: string; passed: boolean; detail: string }[];
  } | null>(null);

  const refreshLiveIntelligenceFeeds = async () => {
    try {
      setRefreshingIntel(true);
      setRefreshBanner('Scanning live SemiAnalysis, Fabricated Knowledge, Chipstrat, Next Platform & Google News Earnings/M&A RSS feeds...');
      const res = await fetch('/api/v1/intelligence-review/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (json.terminal_state) {
        setData(json.terminal_state);
        const count = json.live_intelligence_review?.semianalysis_and_specialist_research?.length ?? 0;
        setRefreshBanner(
          `Synced ${count} live SemiAnalysis & specialist semi research articles + latest Q1 FY27/Q3 earnings & M&A at ${new Date().toLocaleTimeString()}`
        );
        setTimeout(() => setRefreshBanner(null), 9000);
      }
    } catch (err) {
      console.error('Failed to refresh intelligence feeds:', err);
    } finally {
      setRefreshingIntel(false);
    }
  };

  const fetchTerminalData = async (force = false) => {
    try {
      if (force) {
        setRefreshing(true);
        setRefreshBanner('Running live Yahoo Finance v8 quote sync, SemiAnalysis RSS sweep & Gemini Pro Next (gemini-4-argon) evaluation...');
        const res = await fetch('/api/v1/refresh-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ run_gemini: true, update_holding_prices: true })
        });
        const json = await res.json();
        if (json.terminal_state) {
          setData(json.terminal_state);
          const quotesCount = json.updated_quotes ?? 0;
          const modelUsed =
            json.ai_findings?.model ||
            json.terminal_state?.daily_ai_findings?.model ||
            'deterministic-rules-engine';
          setRefreshBanner(
            `Refreshed ${quotesCount} live quotes, SemiAnalysis/earnings feeds & unified portfolio briefing (${modelUsed}) at ${new Date().toLocaleTimeString()}`
          );
          setTimeout(() => setRefreshBanner(null), 9000);
        }
      } else {
        const res = await fetch('/api/v1/terminal');
        const json: TerminalPayload = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch terminal data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTerminalData(false);
    fetch('/api/v1/stocks/catalog')
      .then(r => r.json())
      .then(j => {
        if (j?.catalog) setCatalogMap(j.catalog);
      })
      .catch(() => {});
  }, []);

  const applyCatalogPreset = (tickerSym: string) => {
    const clean = tickerSym.toUpperCase().trim();
    setNewStockTicker(clean);
    const existing = data?.stocks.find(s => s.ticker.toUpperCase() === clean);
    const cat = catalogMap[clean];
    if (existing) {
      setNewStockName(existing.name || clean);
      setNewStockLayerId(existing.layer_id || 'L2');
      setNewStockChainId(existing.swarm_debate?.supply_chain_placement?.chain_id || cat?.chain_id || 'gpu_tpu_cluster');
      setNewStockNodeId(existing.swarm_debate?.supply_chain_placement?.node_id || cat?.node_id || 'xpu_1');
      setNewStockBestPeer(existing.swarm_debate?.supply_chain_placement?.best_in_class_peer || cat?.best_in_class_ticker || 'NVDA');
      setNewStockPrice(existing.price !== undefined ? String(existing.price) : '100');
      setNewStockMktCapB(
        (existing.market_cap_b ?? existing.mkt_cap_usd_b) !== undefined
          ? String(existing.market_cap_b ?? existing.mkt_cap_usd_b)
          : '25'
      );
      setNewStockFwdPe(existing.fwd_pe !== null && existing.fwd_pe !== undefined ? String(existing.fwd_pe) : '');
      setNewStockEpsCagr(
        (existing.eps_cagr_3y_pct ?? existing.eps_3y_cagr) !== null &&
          (existing.eps_cagr_3y_pct ?? existing.eps_3y_cagr) !== undefined
          ? String(existing.eps_cagr_3y_pct ?? existing.eps_3y_cagr)
          : '25.0'
      );
      setNewStockGmPct(
        (existing.gross_margin_pct ?? existing.gm_pct) !== null &&
          (existing.gross_margin_pct ?? existing.gm_pct) !== undefined
          ? String(existing.gross_margin_pct ?? existing.gm_pct)
          : '55.0'
      );
      setNewStockSharePct(existing.monopoly_share_pct !== undefined ? String(existing.monopoly_share_pct) : '55');
      setNewStockRationale(existing.user_custom_rationale || existing.ownership_rationale || existing.choke_point || '');
      setNewStockIsHolding(Boolean(existing.is_holding));
      setNewStockWeightUsd(String(existing.portfolio_usd || 0));
      setNewStockShares(existing.shares !== null && existing.shares !== undefined ? String(existing.shares) : '');
      setNewStockCostBasis(existing.cost_basis_usd !== null && existing.cost_basis_usd !== undefined ? String(existing.cost_basis_usd) : '');
      setNewStockAccount(existing.account && existing.account !== 'Watchlist' ? existing.account : 'Roth_Schwab');
      setNewStockInclusionStatus(
        existing.inclusion_status ||
          (existing.is_holding ? 'OWNED_IN_PORTFOLIO' : 'NOT_INCLUDED_MISSING_MONOPOLY')
      );
    } else if (cat) {
      setNewStockName(cat.name || clean);
      setNewStockLayerId(cat.layer_id || 'L2');
      setNewStockChainId(cat.chain_id || 'gpu_tpu_cluster');
      setNewStockNodeId(cat.node_id || 'xpu_1');
      setNewStockBestPeer(cat.best_in_class_ticker || 'NVDA');
      setNewStockPrice(cat.us_price !== undefined ? String(cat.us_price) : '100');
      setNewStockMktCapB(cat.mkt_cap_usd_b !== undefined ? String(cat.mkt_cap_usd_b) : '25');
      setNewStockFwdPe(cat.fwd_pe !== undefined ? String(cat.fwd_pe) : '26.0');
      setNewStockEpsCagr(cat.eps_3y_cagr !== undefined ? String(cat.eps_3y_cagr) : '25.0');
      setNewStockGmPct(cat.gm_pct !== undefined ? String(cat.gm_pct) : '55.0');
      setNewStockSharePct(cat.monopoly_share_pct !== undefined ? String(cat.monopoly_share_pct) : '55');
      setNewStockRationale(cat.bottleneck_note || '');
    }
  };

  const handleLookupLiveTicker = async (symOverride?: string) => {
    const clean = (symOverride ?? newStockTicker).toUpperCase().trim();
    if (!clean) return;
    setLookupLoading(true);
    setAddStockError(null);
    try {
      const res = await fetch(`/api/v1/stocks/lookup/${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (json?.profile) {
        const p = json.profile;
        setNewStockTicker(p.ticker || clean);
        setNewStockName(p.name || clean);
        setNewStockLayerId(p.layer_id || 'L2');
        setNewStockChainId(p.chain_id || 'gpu_tpu_cluster');
        setNewStockNodeId(p.node_id || 'xpu_1');
        setNewStockBestPeer(p.best_in_class_ticker || 'NVDA');
        if (p.us_price !== undefined) setNewStockPrice(String(p.us_price));
        if (p.mkt_cap_usd_b !== undefined) setNewStockMktCapB(String(p.mkt_cap_usd_b));
        if (p.fwd_pe !== undefined && p.fwd_pe !== null) setNewStockFwdPe(String(p.fwd_pe));
        if (p.eps_3y_cagr !== undefined) setNewStockEpsCagr(String(p.eps_3y_cagr));
        if (p.gm_pct !== undefined) setNewStockGmPct(String(p.gm_pct));
        if (p.monopoly_share_pct !== undefined) setNewStockSharePct(String(p.monopoly_share_pct));
        if (p.bottleneck_note) setNewStockRationale(p.bottleneck_note);
      }
    } catch (err) {
      console.error('Live ticker lookup failed:', err);
    } finally {
      setLookupLoading(false);
    }
  };

  const openAddStockModal = (prefillTicker?: string) => {
    setAddStockError(null);
    setIsEditingExistingStock(false);
    setNewStockIsHolding(false);
    setNewStockWeightUsd('0');
    setNewStockShares('');
    setNewStockCostBasis('');
    setNewStockAccount('Roth_Schwab');
    if (prefillTicker) {
      applyCatalogPreset(prefillTicker);
    } else {
      setNewStockTicker('');
      setNewStockName('');
      setNewStockRationale('');
    }
    setShowAddStockModal(true);
  };

  const openEditStockModal = (stock: StockItem) => {
    setAddStockError(null);
    setIsEditingExistingStock(true);
    applyCatalogPreset(stock.ticker);
    setShowAddStockModal(true);
  };

  // Keyboard shortcuts: '/' focuses command input, 'Escape' closes drawer, Alt+1..5 switches tabs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape') {
        if (showAddStockModal) {
          setShowAddStockModal(false);
          return;
        }
        if (selectedStock) {
          setSelectedStock(null);
          return;
        }
      }
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        commandInputRef.current?.focus();
        return;
      }
      if (e.altKey && !isInput) {
        if (e.key === '1') setActiveTab('triage');
        if (e.key === '2') setActiveTab('supply_chains');
        if (e.key === '3') setActiveTab('screener');
        if (e.key === '4') setActiveTab('copilot');
        if (e.key === '5') setActiveTab('risk');
        if (e.key === '6') setActiveTab('committee');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedStock, showAddStockModal]);

  const dcfStock = useMemo(() => {
    if (!data) return null;
    return data.stocks.find(s => s.ticker === dcfTicker) || data.stocks[0];
  }, [data, dcfTicker]);

  useEffect(() => {
    if (dcfStock) {
      setDcfEpsCagr(dcfStock.eps_cagr_3y_pct ?? dcfStock.rev_cagr_3y_pct ?? 30.0);
      setDcfExitMultiple(dcfStock.exit_pe_base ?? (dcfStock.fwd_pe ? Math.round(dcfStock.fwd_pe * 1.05) : 24.0));
      setDcfDilutionPct(0.0);
    }
  }, [dcfStock]);

  // Fixed Command Bar Handler: strips only trailing '<GO>' or ' GO' and checks exact ticker match first
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = commandInput
      .trim()
      .toUpperCase()
      .replace(/<GO>$/i, '')
      .replace(/\s+GO$/i, '')
      .trim();
    if (!raw) return;

    if (raw === 'ADD' || raw.startsWith('ADD ')) {
      const targetSym = raw.replace(/^ADD\s*/, '').trim();
      openAddStockModal(targetSym || 'ARM');
    } else if (raw === 'PORT' || raw === 'TRIAGE' || raw === 'AUDIT' || raw === '1') {
      setActiveTab('triage');
    } else if (raw === 'CHAIN' || raw === 'SUPPLY' || raw === 'MAP' || raw === '2') {
      setActiveTab('supply_chains');
    } else if (raw === 'SCREEN' || raw === 'DCF' || raw === 'MOIC' || raw === 'ROBOT' || raw === '3') {
      setActiveTab('screener');
    } else if (raw === 'AI' || raw === 'SWARM' || raw === 'COPILOT' || raw === '4') {
      setActiveTab('copilot');
    } else if (raw === 'RISK' || raw === 'TAX' || raw === 'MACRO' || raw === 'PRETRADE' || raw === '5') {
      setActiveTab('risk');
    } else if (raw === 'IC' || raw === 'COMMITTEE' || raw === 'VOTE' || raw === 'PLAN' || raw === '6') {
      setActiveTab('committee');
    } else if (data) {
      const exactMatch = data.stocks.find(s => s.ticker.toUpperCase() === raw);
      const found = exactMatch || data.stocks.find(s => s.name.toUpperCase().includes(raw));
      if (found) {
        openStockDrawer(found);
        setDcfTicker(found.ticker);
      } else if (/^[A-Z0-9.\-]{1,8}$/.test(raw)) {
        openAddStockModal(raw);
      }
    }
    setCommandInput('');
  };

  const openStockDrawer = async (stock: StockItem) => {
    setSelectedStock(stock);
    setEditRationaleStatus(
      stock.inclusion_status ||
        (stock.is_holding
          ? stock.triage_bucket === 'DIVEST_TRIM'
            ? 'OWNED_DIVEST_UPGRADE'
            : 'OWNED_IN_PORTFOLIO'
          : stock.triage_bucket === 'MISSING_MONOPOLY'
          ? 'NOT_INCLUDED_MISSING_MONOPOLY'
          : 'NOT_INCLUDED_EXCLUDED_PEER')
    );
    setEditRationaleText(stock.user_custom_rationale || '');
    setEditRecommendedSwap(stock.recommended_swap || '');
    setEditChainId(stock.swarm_debate?.supply_chain_placement?.chain_id || 'gpu_tpu_cluster');
    setEditNodeId(stock.swarm_debate?.supply_chain_placement?.node_id || 'xpu_1');
    setRationaleSavedMsg(null);
    setDeepDiveMemo(null);
    setDeepDiveLoading(true);
    try {
      const res = await fetch('/api/v1/ai/ticker-deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: stock.ticker, preferred_model: 'gemini-3.8-flash' })
      });
      const json = await res.json();
      if (json.memo) {
        setDeepDiveMemo(json.memo);
      }
    } catch (err) {
      console.error('Deep dive error:', err);
    } finally {
      setDeepDiveLoading(false);
    }
  };

  const handleSaveRationale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) return;
    setSavingRationale(true);
    setRationaleSavedMsg(null);
    try {
      const res = await fetch('/api/v1/stocks/rationale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: selectedStock.ticker,
          user_rationale: editRationaleText,
          inclusion_status: editRationaleStatus,
          recommended_swap: editRecommendedSwap,
          chain_id: editChainId,
          node_id: editNodeId,
          run_vertex_swarm: editRunVertex
        })
      });
      const json = await res.json();
      if (json.terminal_state) {
        setData(json.terminal_state);
      }
      if (json.stock) {
        setSelectedStock(json.stock);
      }
      setRationaleSavedMsg(`Saved rationale & updated 6-Panel Swarm Debate for ${selectedStock.ticker}`);
    } catch (err) {
      console.error('Save rationale error:', err);
    } finally {
      setSavingRationale(false);
    }
  };

  const handleAddAndUnderwriteStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStockError(null);
    const cleanTicker = newStockTicker.toUpperCase().trim();
    if (!cleanTicker) {
      setAddStockError('Ticker symbol is required.');
      return;
    }
    setAddStockSubmitting(true);
    try {
      const endpoint = isEditingExistingStock
        ? '/api/v1/stocks/edit'
        : '/api/v1/stocks/add-and-underwrite';

      const payload: Record<string, any> = {
        ticker: cleanTicker,
        name: newStockName.trim() || undefined,
        layer_id: newStockLayerId,
        chain_id: newStockChainId,
        node_id: newStockNodeId,
        inclusion_status: newStockIsHolding
          ? 'OWNED_IN_PORTFOLIO'
          : newStockInclusionStatus,
        user_rationale: newStockRationale.trim(),
        best_in_class_ticker: newStockBestPeer.toUpperCase().trim() || undefined,
        us_price: newStockPrice ? parseFloat(newStockPrice) : undefined,
        mkt_cap_usd_b: newStockMktCapB ? parseFloat(newStockMktCapB) : undefined,
        fwd_pe: newStockFwdPe ? parseFloat(newStockFwdPe) : undefined,
        eps_3y_cagr: newStockEpsCagr ? parseFloat(newStockEpsCagr) : undefined,
        gm_pct: newStockGmPct ? parseFloat(newStockGmPct) : undefined,
        monopoly_share_pct: newStockSharePct ? parseInt(newStockSharePct, 10) : undefined,
        is_holding: newStockIsHolding,
        weight_usd: newStockIsHolding ? parseFloat(newStockWeightUsd || '0') : 0,
        shares: newStockIsHolding && newStockShares ? parseFloat(newStockShares) : undefined,
        cost_basis_usd:
          newStockIsHolding && newStockCostBasis ? parseFloat(newStockCostBasis) : undefined,
        account: newStockAccount || 'Roth_Schwab',
        run_vertex_swarm: newStockRunVertex
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) {
        setAddStockError(json.detail || 'Failed to save and underwrite stock');
        return;
      }

      // If we used /api/v1/stocks/add-and-underwrite and the user also specified custom price or mkt_cap_usd_b,
      // persist those overrides cleanly via /api/v1/stocks/edit if needed
      if (!isEditingExistingStock && (newStockPrice || newStockMktCapB)) {
        const editRes = await fetch('/api/v1/stocks/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const editJson = await editRes.json();
        if (editRes.ok && editJson.terminal_state) {
          setData(editJson.terminal_state);
          setShowAddStockModal(false);
          if (editJson.stock) {
            openStockDrawer(editJson.stock);
            setRefreshBanner(
              `12-Expert Swarm underwrote ${editJson.stock.ticker} (${editJson.stock.rating_score}/100)${
                editJson.stock.is_holding
                  ? ` • Portfolio Position: $${editJson.stock.portfolio_usd.toLocaleString()}`
                  : ''
              }`
            );
            setTimeout(() => setRefreshBanner(null), 9000);
          }
          return;
        }
      }

      if (json.terminal_state) {
        setData(json.terminal_state);
      }
      setShowAddStockModal(false);
      if (json.stock) {
        openStockDrawer(json.stock);
        setRefreshBanner(
          `${isEditingExistingStock ? 'Updated' : '12-Expert Swarm underwrote'} ${json.stock.ticker} (${json.stock.rating_score}/100)${
            json.stock.is_holding ? ` • Portfolio Holding: $${json.stock.portfolio_usd.toLocaleString()}` : ''
          }`
        );
        setTimeout(() => setRefreshBanner(null), 9000);
      }
    } catch (err: any) {
      setAddStockError(err?.message || 'Error underwriting stock');
    } finally {
      setAddStockSubmitting(false);
    }
  };

  const handleDeleteCustomStock = async (tickerSym: string) => {
    try {
      const res = await fetch(`/api/v1/stocks/custom/${encodeURIComponent(tickerSym)}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.terminal_state) {
        setData(json.terminal_state);
        const stillExists = json.terminal_state.stocks.find((s: StockItem) => s.ticker === tickerSym);
        if (stillExists) {
          openStockDrawer(stillExists);
          setRationaleSavedMsg(`Reset custom rationale override for ${tickerSym}`);
        } else {
          setSelectedStock(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete custom stock:', err);
    }
  };

  const handleRemoveStockFromUniverse = async (tickerSym: string) => {
    try {
      const res = await fetch(`/api/v1/stocks/${encodeURIComponent(tickerSym)}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.terminal_state) {
        setData(json.terminal_state);
        if (selectedStock?.ticker === tickerSym) {
          setSelectedStock(null);
        }
        setRefreshBanner(
          `Removed ${tickerSym} from active portfolio & screener universe (can be restored anytime in Ticker Studio)`
        );
        setTimeout(() => setRefreshBanner(null), 9000);
      }
    } catch (err) {
      console.error('Failed to remove stock from universe:', err);
    }
  };

  const runCopilotSwarm = async () => {
    if (!copilotQuery.trim()) return;
    setCopilotLoading(true);
    try {
      const res = await fetch('/api/v1/ai/panel-consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: copilotQuery,
          focus_ticker: copilotTickerFocus === 'ALL' ? null : copilotTickerFocus,
          preferred_model: copilotModel
        })
      });
      const json = await res.json();
      setCopilotResponse(json);
    } catch (err) {
      console.error('Copilot error:', err);
    } finally {
      setCopilotLoading(false);
    }
  };

  const runPreTradeCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!data) return;
    setPtLoading(true);
    try {
      const stock = data.stocks.find(s => s.ticker === ptTicker);
      const res = await fetch('/api/v1/pretrade-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ptTicker,
          action: ptAction,
          amount_usd: ptAmount,
          account: ptAccount,
          is_monopoly_chokepoint: (stock?.rating_score ?? 80) >= 76,
          peg: stock?.peg ?? null
        })
      });
      const json = await res.json();
      setPtResult(json);
    } catch (err) {
      console.error('Pre-trade check failed:', err);
    } finally {
      setPtLoading(false);
    }
  };

  useEffect(() => {
    if (data && !ptResult) {
      runPreTradeCheck();
    }
  }, [data]);

  const scoreRankMap = useMemo(() => {
    if (!data) return {} as Record<string, { rank: number; total: number; pct: number }>;
    const sorted = [...data.stocks].sort((a, b) => b.rating_score - a.rating_score);
    const total = sorted.length;
    const map: Record<string, { rank: number; total: number; pct: number }> = {};
    sorted.forEach((s, idx) => {
      const rank = idx + 1;
      const pct = Math.min(99, Math.max(1, Math.round(((total - idx) / total) * 100)));
      map[s.ticker] = { rank, total, pct };
    });
    return map;
  }, [data]);

  const heldStocks = useMemo(() => {
    if (!data) return [];
    return data.stocks
      .filter(s => s.is_holding)
      .sort((a, b) => (b.portfolio_usd || 0) - (a.portfolio_usd || 0));
  }, [data]);

  const filteredWatchlist = useMemo(() => {
    if (!data) return [];
    return data.stocks
      .filter(s => {
        const matchSleeve = sleeveFilter === 'ALL' || s.sleeve_id === sleeveFilter;
        const matchOwn =
          ownershipFilter === 'ALL' ||
          (ownershipFilter === 'OWNED' && s.is_holding) ||
          (ownershipFilter === 'MISSING' && !s.is_holding);
        const uLine = s.us_line || s.us_exchange || 'NYSE';
        const matchUsLine =
          usLineFilter === 'ALL' ||
          (usLineFilter === 'NYSE_NASDAQ' && (uLine === 'NYSE' || uLine === 'Nasdaq' || uLine === 'NASDAQ')) ||
          (usLineFilter === 'HIDE_ILLIQUID' &&
            uLine !== 'OTC ordinary' &&
            !(s.liquidity_tier || '').includes('Illiquid'));
        const qPass = s.quality_gate_passed !== false;
        const qTier = s.quality_tier || '';
        const matchQuality =
          qualityFilter === 'ALL' ||
          (qualityFilter === 'PASS_ONLY' && qPass) ||
          (qualityFilter === 'LEADER_ONLY' && qTier.includes('PASS — #1')) ||
          (qualityFilter === 'FAIL_ONLY' && !qPass);
        const matchQuery =
          !searchQuery ||
          s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.layer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.choke_point.toLowerCase().includes(searchQuery.toLowerCase());
        return matchSleeve && matchOwn && matchUsLine && matchQuality && matchQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'peg') {
          const pa = a.peg ?? 999;
          const pb = b.peg ?? 999;
          return pa - pb;
        }
        if (sortBy === 'portfolio_usd') return (b.portfolio_usd || 0) - (a.portfolio_usd || 0);
        if (sortBy === 'expected_3y_moic') return (b.expected_3y_moic || b.moic_3y_base) - (a.expected_3y_moic || a.moic_3y_base);
        if (sortBy === 'moic_3y_base') return b.moic_3y_base - a.moic_3y_base;
        return b.rating_score - a.rating_score;
      });
  }, [data, sleeveFilter, ownershipFilter, usLineFilter, qualityFilter, searchQuery, sortBy]);

  const filteredChains = useMemo(() => {
    if (!data) return [];
    if (selectedChainId === 'ALL') return data.seven_supply_chains;
    return data.seven_supply_chains.filter(c => c.chain_id === selectedChainId);
  }, [data, selectedChainId]);

  const dcfProjection = useMemo(() => {
    if (!dcfStock) return null;
    const basePrice = dcfStock.price || 100;
    const currentPe = dcfStock.fwd_pe || 22;
    const epsMult3Y = Math.pow(1 + dcfEpsCagr / 100, 3);
    const peRerateMult = dcfExitMultiple / currentPe;
    const dilutionFactor = Math.pow(1 + dcfDilutionPct / 100, 3);
    const projectedMoic = Number(((epsMult3Y * peRerateMult) / Math.max(0.5, dilutionFactor)).toFixed(2));
    const projectedPrice = Number((basePrice * projectedMoic).toFixed(2));
    const impliedCagr = Number(((Math.pow(Math.max(0.1, projectedMoic), 1 / 3) - 1) * 100).toFixed(1));
    return {
      basePrice,
      projectedPrice,
      projectedMoic,
      impliedCagr,
      hasEarningsMultiple: dcfStock.fwd_pe !== null && dcfStock.fwd_pe !== undefined
    };
  }, [dcfStock, dcfEpsCagr, dcfExitMultiple, dcfDilutionPct]);

  // ECharts Option: Chokepoint Score vs Valuation / Return (Excludes null-PE EV/MW & EV/ARR plays with clear note)
  const scatterChartDetails = useMemo(() => {
    if (!data) return { option: {}, excludedTickers: [] as string[] };
    const validStocks = data.stocks.filter(s => s.fwd_pe !== null && s.fwd_pe !== undefined);
    const excludedTickers = data.stocks
      .filter(s => s.fwd_pe === null || s.fwd_pe === undefined)
      .map(s => `${s.ticker} (${s.data_quality?.valuation_basis || 'EV/MW'})`);

    const ownedKeep = validStocks.filter(s => s.is_holding && s.rating_score >= 76);
    const ownedDivest = validStocks.filter(s => s.is_holding && s.rating_score < 76);
    const missingTargets = validStocks.filter(s => !s.is_holding);

    const makeSeriesData = (list: StockItem[]) =>
      list.map(s => ({
        name: s.ticker,
        value: [
          s.fwd_pe ?? 0,
          s.rating_score,
          s.expected_3y_moic ?? s.moic_3y_base,
          s.name,
          s.portfolio_usd,
          s.rating,
          s.bear_3y_moic ?? 1.0
        ]
      }));

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: '#0c121d',
        borderColor: '#1e293b',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
        formatter: (params: any) => {
          const [pe, score, expMoic, name, portVal, rating, bearMoic] = params.data.value;
          const ownTag = portVal > 0 ? `<span style="color:#10b981">OWNED ($${portVal.toLocaleString()})</span>` : `<span style="color:#38bdf8">UNOWNED TARGET</span>`;
          return `
            <div style="padding:4px;">
              <div style="font-weight:700;color:#f59e0b;font-size:13px;">${params.data.name} — ${name}</div>
              <div style="margin-top:2px;">${ownTag} | <b>${rating}</b></div>
              <div style="margin-top:4px;">Unified Chokepoint Score: <b>${score}/100</b></div>
              <div>Forward P/E: <b>${pe}x</b></div>
              <div>3Y Bear / Expected MOIC: <b>${bearMoic}x / ${expMoic}x</b></div>
            </div>
          `;
        }
      },
      legend: {
        top: 0,
        textStyle: { color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        data: ['OWNED: KEEP (#1 Monopoly)', 'OWNED: DIVEST / TRIM', 'MISSING: BEST-IN-CLASS TARGET']
      },
      grid: { left: '7%', right: '6%', top: '16%', bottom: '15%' },
      xAxis: {
        name: 'Forward P/E (x)',
        nameLocation: 'middle',
        nameGap: 25,
        nameTextStyle: { color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        type: 'value',
        min: 0,
        max: 70,
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }
      },
      yAxis: {
        name: 'Unified Chokepoint Score (/100)',
        nameLocation: 'middle',
        nameGap: 36,
        nameTextStyle: { color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        type: 'value',
        min: 30,
        max: 102,
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }
      },
      series: [
        {
          name: 'OWNED: KEEP (#1 Monopoly)',
          type: 'scatter',
          symbolSize: (val: any) => Math.max(14, Math.min(30, val[2] * 7.5)),
          itemStyle: { color: '#10b981', borderColor: '#ecfdf5', borderWidth: 1.5, opacity: 0.92 },
          label: {
            show: true,
            formatter: '{b}',
            position: 'top',
            color: '#6ee7b7',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fontWeight: 'bold'
          },
          data: makeSeriesData(ownedKeep)
        },
        {
          name: 'OWNED: DIVEST / TRIM',
          type: 'scatter',
          symbolSize: 16,
          itemStyle: { color: '#ef4444', borderColor: '#fef2f2', borderWidth: 1.5, opacity: 0.95 },
          label: {
            show: true,
            formatter: '{b}',
            position: 'bottom',
            color: '#fca5a5',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fontWeight: 'bold'
          },
          data: makeSeriesData(ownedDivest)
        },
        {
          name: 'MISSING: BEST-IN-CLASS TARGET',
          type: 'scatter',
          symbolSize: (val: any) => Math.max(14, Math.min(28, val[2] * 7.5)),
          itemStyle: { color: '#f59e0b', borderColor: '#fffbeb', borderWidth: 1.5, opacity: 0.92 },
          label: {
            show: true,
            formatter: '{b}',
            position: 'top',
            color: '#fde68a',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fontWeight: 'bold'
          },
          data: makeSeriesData(missingTargets)
        }
      ]
    };

    return { option, excludedTickers };
  }, [data]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#070a0f] text-slate-200 flex flex-col items-center justify-center font-mono">
        <div className="flex items-center space-x-3 text-amber-400 mb-3">
          <Terminal className="w-7 h-7 animate-pulse" />
          <span className="text-xl font-bold tracking-wider">APEX COMPUTE TERMINAL // ACT &lt;GO&gt;</span>
        </div>
        <p className="text-xs text-slate-400">
          Loading Schwab + Fidelity Live Holdings, 7 Supply Chains, Unified Chokepoint Scores &amp; Gemini Pro Next Swarm...
        </p>
      </div>
    );
  }

  const triage = data.portfolio_triage;
  const dailyFindings = data.daily_ai_findings;
  const riskTax = data.portfolio_risk_and_tax;
  const grossEquities = data.meta.gross_equities_usd ?? data.meta.total_portfolio_usd;
  const netNav = data.meta.net_nav_usd ?? 552321.02;
  const marginDebit = data.meta.margin_debit_usd ?? -52523.98;

  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* TOP BLOOMBERG COMMAND HEADER */}
      <header className="sticky top-0 z-30 bg-[#0b1018]/95 backdrop-blur border-b border-slate-800 px-3 lg:px-5 py-2.5">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          {/* Brand + Live Portfolio Summary */}
          <div className="flex items-center justify-between lg:justify-start gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-400 font-mono font-bold text-sm shadow-inner">
                ACT
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold tracking-tight text-sm md:text-base text-white">
                    APEX COMPUTE TERMINAL
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Daily briefing · Updated Nov 5, 2026
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Schwab (...0726) + Fidelity (...5830, ...2854) • Concentration Over Diworsification
                </div>
              </div>
            </div>
          </div>

          {/* Command Bar Input */}
          <form onSubmit={handleCommandSubmit} className="flex-1 max-w-sm">
            <div className="relative flex items-center">
              <span className="absolute left-3 text-amber-400 font-mono text-xs font-bold">&gt;</span>
              <input
                ref={commandInputRef}
                type="text"
                value={commandInput}
                onChange={e => setCommandInput(e.target.value)}
                placeholder="Type ticker (e.g. ONTO, TSM)..."
                className="w-full bg-[#06090e] border border-slate-700/80 focus:border-amber-400 rounded pl-7 pr-14 py-1.5 text-xs font-mono text-amber-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold"
              >
                &lt;GO&gt;
              </button>
            </div>
          </form>

          {/* Compact Portfolio Metrics & Daily Refresh + Add Stock Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 bg-[#0f1623] border border-slate-800 rounded px-2.5 py-1 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Gross Long</span>
                <span className="text-emerald-400 font-bold">${(grossEquities / 1000).toFixed(1)}k</span>
              </div>
              <div className="h-5 w-px bg-slate-800" />
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Net NAV</span>
                <span className="text-white font-bold">${(netNav / 1000).toFixed(1)}k</span>
              </div>
              <div className="h-5 w-px bg-slate-800" />
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Margin (...2854)</span>
                <span className="text-rose-400 font-bold">-${Math.abs(marginDebit / 1000).toFixed(1)}k</span>
              </div>
              {riskTax && (
                <>
                  <div className="h-5 w-px bg-slate-800 hidden sm:block" />
                  <div className="hidden sm:block">
                    <span className="text-slate-400 block text-[9px] uppercase">
                      Eff. Bets (ρ={riskTax.correlation_and_concentration.assumed_pairwise_correlation.toFixed(2)})
                    </span>
                    <span className="text-amber-300 font-bold">
                      {riskTax.correlation_and_concentration.effective_independent_bets}
                    </span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowSwarmStudio(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono font-bold text-xs transition shadow ${
                showSwarmStudio
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  : 'bg-[#111927] hover:bg-slate-800 text-emerald-300 border border-emerald-500/40'
              }`}
              title="Open Autonomous Swarm Discovery & Dynamic Ticker Manager (Add / Edit / Remove Tickers or Discover Best Stocks)"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{showSwarmStudio ? 'Hide Swarm Studio' : 'Swarm Studio & Tickers'}</span>
            </button>

            <button
              onClick={() => openAddStockModal('ARM')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition shadow"
              title="Add or edit any stock ticker and convene the 12-Expert Swarm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ Add / Edit Ticker</span>
            </button>

            <button
              onClick={() => fetchTerminalData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs transition shadow disabled:opacity-50"
              title="Fetch live quotes & run daily refresh now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Refresh Banner Notification */}
        {refreshBanner && (
          <div className="max-w-[1600px] mx-auto mt-2 px-3 py-1.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{refreshBanner}</span>
            </div>
            <button onClick={() => setRefreshBanner(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 5 COMPACT WORKSPACE TABS (Fits cleanly on 1280px+ screens with zero cutoff) */}
        <div className="max-w-[1600px] mx-auto mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Terminal Workspace Views">
            <button
              role="tab"
              aria-selected={activeTab === 'triage'}
              onClick={() => setActiveTab('triage')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'triage'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#111927] text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>1 · Triage</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'supply_chains'}
              onClick={() => setActiveTab('supply_chains')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'supply_chains'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#111927] text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2 · Chains</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'screener'}
              onClick={() => setActiveTab('screener')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'screener'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#111927] text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>3 · Screener</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'copilot'}
              onClick={() => setActiveTab('copilot')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'copilot'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#111927] text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>4 · Copilot</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'risk'}
              onClick={() => setActiveTab('risk')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'risk'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#111927] text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>5 · Risk &amp; Tax</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'committee'}
              onClick={() => setActiveTab('committee')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'committee'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#111927] text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>6 · Committee</span>
              {data.investment_committee?.as_of && (
                <span className={`text-[9px] px-1 rounded ${activeTab === 'committee' ? 'bg-slate-950/20' : 'bg-amber-500/20 text-amber-300'}`}>
                  {data.investment_committee.as_of.slice(5)}
                </span>
              )}
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              Prices as of {data.meta.digest_date || '2026-11-05'} • {data.stocks.length} Active Securities ({heldStocks.length} Holdings)
            </span>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4 space-y-5">
        {showSwarmStudio && (
          <SwarmStudioPanel
            data={data}
            onUpdateTerminalState={(newState, bannerMsg) => {
              setData(newState);
              if (bannerMsg) {
                setRefreshBanner(bannerMsg);
                setTimeout(() => setRefreshBanner(null), 9000);
              }
            }}
            onOpenStockDrawer={openStockDrawer}
            onOpenAddModal={openAddStockModal}
            onOpenEditModal={openEditStockModal}
            onRemoveStock={handleRemoveStockFromUniverse}
          />
        )}
        {/* =====================================================================
            TAB 6: INVESTMENT COMMITTEE (MULTI-PERSONA SWARM CONSENSUS)
        ===================================================================== */}
        {activeTab === 'committee' && (
          data.investment_committee && data.investment_committee.questions ? (
            <CommitteeTab
              committee={data.investment_committee}
              stocks={data.stocks}
              onOpenTicker={(sym: string) => {
                const hit = data.stocks.find(s => s.ticker.toUpperCase() === sym.toUpperCase());
                if (hit) {
                  openStockDrawer(hit);
                } else {
                  window.open(`https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`, '_blank', 'noopener');
                }
              }}
            />
          ) : (
            <div className="bg-[#0c121d] border border-slate-800 rounded-lg p-6 text-sm text-slate-400 font-mono">
              No Investment Committee session recorded yet.
            </div>
          )
        )}

        {/* =====================================================================
            TAB 1: PORTFOLIO TRIAGE (COMPACT 22-HOLDINGS TABLE + ACTION CARDS)
        ===================================================================== */}
        {activeTab === 'triage' && triage && (
          <div className="space-y-5">
            {/* TOP ABOVE-THE-FOLD: 3 EXECUTIVE ACTION CARDS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
              <div className="bg-[#0c121d] border border-rose-500/40 rounded-lg p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" />
                    Step 1 · Divest {triage.divest_count} below-bar positions
                  </span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold">
                    {triage.divest_count} Positions • ${(triage.total_rotatable_usd / 1000).toFixed(1)}k
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  MRVL ($33.0k) exited. The rubric scores these holdings below the bar (
                  <b>
                    {triage.divest_candidates
                      .map(d => `${d.ticker} ${d.rating_score}`)
                      .join(', ')}
                  </b>
                  ). Check the IC Verdict column first: the committee holds some of them. Pair the CDNS gain with ST losses in ...2854 and retire the -$19.5k margin.
                </p>
              </div>

              <div className="bg-[#0c121d] border border-amber-500/40 rounded-lg p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    Step 2 · Acquire missing #1 bottlenecks
                  </span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                    {triage.missing_count} Unowned #1 Leaders
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Redeploy Roth proceeds into unowned #1 bottlenecks:{' '}
                  <b>
                    {triage.missing_monopolies
                      .slice(0, 6)
                      .map(m => `${m.ticker} (${m.rating_score}, ${fmtPeg(m.peg)} PEG)`)
                      .join(', ')}
                  </b>
                  .
                </p>
              </div>

              <div className="bg-[#0c121d] border border-emerald-500/40 rounded-lg p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Step 3 · Concentrate {triage.keep_count} core #1 holdings
                  </span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    ${((triage.core_keep_usd ?? 480416) / 1000).toFixed(1)}k ({(triage.core_keep_pct ?? 84.0).toFixed(1)}%)
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  All {triage.keep_count} core keeps pass the AI-Compute Quality Gate (&ge;76/100):{' '}
                  <b>
                    {triage.core_keeps
                      .slice(0, 8)
                      .map(k => `${k.ticker} (${k.rating_score})`)
                      .join(', ')}
                  </b>{' '}
                  +{Math.max(0, triage.keep_count - 8)} more.
                </p>
              </div>
            </div>

            {/* COMPACT 22-HOLDINGS PORTFOLIO TABLE (ABOVE THE FOLD) */}
            <div className="bg-[#0b101b] border border-slate-800 rounded-lg p-4 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                    <span>Current portfolio holdings ({heldStocks.length} positions • ${(grossEquities / 1000).toFixed(1)}k gross long)</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      • Prices as of Nov 5, 2026
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any row to inspect 3Y Bear/Base/Bull MOIC, US tradability &amp; liquidity, and 6-panel underwriting notes.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {triage.keep_count} Core Keeps (${((triage.core_keep_usd ?? 480416) / 1000).toFixed(1)}k)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    {triage.divest_count} Divest (${(triage.total_rotatable_usd / 1000).toFixed(1)}k)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-[#080c14]">
                      <th className="py-2 px-2">Ticker</th>
                      <th className="py-2 px-2">Company &amp; Account</th>
                      <th className="py-2 px-2">US Line &amp; Liquidity</th>
                      <th className="py-2 px-2 text-right">Price (1D)</th>
                      <th className="py-2 px-2 text-center">20D Trend</th>
                      <th className="py-2 px-2 text-right">Position $ &amp; Weight</th>
                      <th className="py-2 px-2 text-right">Unrealized P&amp;L</th>
                      <th className="py-2 px-2 text-center">AI Quality Gate</th>
                      <th className="py-2 px-2 text-center">Score &amp; Rank</th>
                      <th className="py-2 px-2">Action Verdict</th>
                      <th className="py-2 px-2" title="Investment Committee (multi-persona swarm) policy verdict">IC Verdict</th>
                      <th className="py-2 px-2 text-right">Edit / Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {heldStocks.map(stock => {
                      const isDivest = stock.triage_bucket === 'DIVEST_TRIM' || stock.rating_score < 65;
                      const rankObj = scoreRankMap[stock.ticker];
                      const uLine = stock.us_line || stock.us_exchange || 'NYSE';
                      const liqTier = stock.liquidity_tier || 'Liquid';
                      const isIlliquid = uLine === 'OTC ordinary' || liqTier.includes('Thin') || liqTier.includes('Illiquid');
                      const qPass = stock.quality_gate_passed !== false;
                      const qTier = stock.quality_tier || (qPass ? 'PASS — #1 / CO-LEADER' : 'FAIL — OFF-THESIS / NON-COMPUTE');
                      const weightPct = stock.portfolio_weight_pct ?? 0;
                      const weightBarWidth = Math.min(100, Math.round((weightPct / 10.0) * 100));
                      return (
                        <tr
                          key={stock.ticker}
                          onClick={() => openStockDrawer(stock)}
                          className={`hover:bg-slate-800/50 cursor-pointer transition ${
                            isDivest ? 'bg-rose-950/10' : ''
                          }`}
                        >
                          <td className="py-2 px-2 font-bold text-amber-300 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span>{stock.ticker}</span>
                              {stock.compliance_label && (
                                <span
                                  title={stock.compliance_label}
                                  className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px]"
                                >
                                  PRE-CLEAR
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 font-sans">
                            <div className="font-semibold text-slate-200 text-xs truncate max-w-[185px]">
                              {stock.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {stock.account} • {stock.underlying_currency || 'USD'}
                            </div>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                                uLine === 'OTC ordinary'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : uLine === 'OTC ADR'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                  : 'bg-slate-800 text-sky-300 border-slate-700'
                              }`}
                            >
                              {uLine}
                            </span>
                            {isIlliquid && (
                              <span
                                title={stock.liquidity_note || liqTier}
                                className="block text-[9px] text-amber-300 mt-0.5"
                              >
                                {uLine === 'OTC ordinary' ? 'Prefer Tokyo local' : 'Limit orders only'}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            <div className="text-white font-bold">${stock.price.toLocaleString()}</div>
                            <div
                              className={`text-[10px] ${
                                stock.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {stock.change_pct >= 0 ? '+' : ''}
                              {stock.change_pct}%
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {renderSparkline(stock.sparkline_20d, ((stock.gain_loss_pct ?? stock.unrealized_pl_pct ?? 0) >= 0))}
                          </td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            <div className="text-white font-bold">
                              ${stock.portfolio_usd.toLocaleString()}{' '}
                              <span className="text-slate-400 font-normal">({weightPct.toFixed(1)}%)</span>
                            </div>
                            <div className="w-24 ml-auto h-1.5 bg-slate-800 rounded overflow-hidden mt-1">
                              <div
                                className={`h-full ${isDivest ? 'bg-rose-400' : 'bg-emerald-400'}`}
                                style={{ width: `${weightBarWidth}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            {(stock.gain_loss_usd ?? stock.unrealized_pl) !== null && (stock.gain_loss_usd ?? stock.unrealized_pl) !== undefined ? (
                              <div>
                                <div
                                  className={`font-bold ${
                                    (stock.gain_loss_usd ?? stock.unrealized_pl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {(stock.gain_loss_usd ?? stock.unrealized_pl ?? 0) >= 0 ? '+' : ''}${Math.round(stock.gain_loss_usd ?? stock.unrealized_pl ?? 0).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {fmtPct(stock.gain_loss_pct ?? stock.unrealized_pl_pct, true)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <span
                              title={stock.quality_note || qTier}
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                                !qPass
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : qTier.includes('CONDITIONAL')
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}
                            >
                              {!qPass ? 'FAIL · OFF-THESIS' : qTier.includes('CONDITIONAL') ? 'CONDITIONAL' : 'PASS · #1'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-xs ${
                                stock.rating_score >= 88
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : stock.rating_score >= 76
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              {stock.rating_score}
                            </span>
                            {rankObj && (
                              <span className="block text-[9px] text-slate-400 mt-0.5">
                                #{rankObj.rank} of {rankObj.total}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded border font-bold inline-block ${
                                isDivest
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {isDivest ? 'Divest / Upgrade' : 'Core Keep'}
                            </span>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap" title={stock.committee_verdict?.rationale || ''}>
                            <ActionPill
                              action={stock.committee_verdict?.action}
                              conviction={stock.committee_verdict?.conviction}
                              compact
                            />
                          </td>
                          <td
                            className="py-2 px-2 text-right whitespace-nowrap"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditStockModal(stock)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 border border-slate-700 text-[10px] font-bold"
                                title={`Edit ${stock.ticker} position, price & fundamentals`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveStockFromUniverse(stock.ticker)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-300 border border-slate-700 text-[10px] font-bold"
                                title={`Remove ${stock.ticker} from portfolio & universe`}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SUB-SECTION SELECTOR BAR (Keeps Tab 1 compact and scannable while offering 1-click drilldown) */}
            <div className="bg-[#0c121d] border border-slate-800 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'actions' as const, label: `Action Cards (${triage.divest_count} Divest · ${triage.missing_count} Missing #1)` },
                  { id: 'theses' as const, label: '12-Expert 4-Thesis Audit (Q1–Q4)' },
                  { id: 'keeps' as const, label: `${triage.keep_count} Core Keeps Detail` },
                  { id: 'radar' as const, label: 'Next-Wave Bottleneck Radar (≤$25B)' },
                  { id: 'intel' as const, label: 'Earnings, M&A & SemiAnalysis' },
                  { id: 'chart' as const, label: 'Efficiency Scatter Chart' },
                  { id: 'all' as const, label: 'Show All Sections' }
                ].map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setTriageViewSection(sec.id)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition ${
                      triageViewSection === sec.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Select section to inspect or click &ldquo;Show All Sections&rdquo;
              </span>
            </div>

            {/* 12-EXPERT SWARM 4-THESIS EVALUATION (Q1: BROKERAGE + SUB-$500B, Q2: POWER/CORZ/CIFR/NBIS, Q3: ROBOTICS, Q4: 9 SMALL/MID-CAP PICKS) */}
            {(triageViewSection === 'actions' || triageViewSection === 'theses' || triageViewSection === 'all') &&
              triage.swarm_thesis_evaluations &&
              triage.swarm_thesis_evaluations.length > 0 && (
                <div className="bg-[#0b101b] border border-amber-500/40 rounded-lg p-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-3 border-b border-slate-800">
                    <div>
                      <h2 className="font-mono text-sm font-bold text-amber-300 flex items-center gap-2">
                        <Scale className="w-4 h-4 text-amber-400" />
                        <span>12-Expert Swarm 4-Thesis Underwriting Audit (3–5 Year Max Risk-Adjusted Return Mandate)</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Direct physical-layer BOM &amp; 3–5Y MOIC evaluation across Brokerage Core + Sub-$500B Additions (Q1), Contracted Power vs Capex Dilution (Q2), Japanese Robotics vs Physical AI (Q3), and Small/Mid-Cap GPU + Custom ASIC Picks &amp; Shovels (Q4).
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold whitespace-nowrap">
                      Zero Diworsification • 12-Persona Unanimous Audit
                    </span>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {triage.swarm_thesis_evaluations.map(thesis => {
                      const badgeBorder =
                        thesis.verdict_color === 'emerald'
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : thesis.verdict_color === 'rose'
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                          : thesis.verdict_color === 'cyan'
                          ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                          : 'border-amber-500/40 bg-amber-500/15 text-amber-300';
                      return (
                        <div
                          key={thesis.thesis_id}
                          className="bg-[#101726] border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h3 className="font-mono text-xs sm:text-sm font-bold text-white">
                                {thesis.title}
                              </h3>
                              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeBorder}`}>
                                {thesis.swarm_verdict_badge}
                              </span>
                            </div>

                            <div className="bg-[#090d16] border border-slate-800/80 rounded p-2.5 text-[11px] text-slate-400 italic">
                              <span className="font-mono font-bold text-slate-300 not-italic">User Thesis: </span>
                              {thesis.user_thesis_summary}
                            </div>

                            <div className="bg-amber-950/15 border border-amber-500/30 rounded p-2.5 text-xs text-slate-200 leading-relaxed">
                              <span className="font-mono font-bold text-amber-300">Swarm Verdict: </span>
                              {thesis.executive_answer}
                            </div>

                            <div className="space-y-1.5">
                              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                                Physical-Layer BOM &amp; Financial Evidence
                              </div>
                              <ul className="space-y-1.5 text-xs text-slate-300">
                                {thesis.physical_and_financial_findings.map((finding, idx) => (
                                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                                    <span className="text-amber-400 font-mono font-bold mt-0.5">•</span>
                                    <span>{finding}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {thesis.comparison_table && (
                              <div className="overflow-x-auto border border-slate-800 rounded">
                                <table className="w-full text-left border-collapse font-mono text-[11px]">
                                  <thead>
                                    <tr className="bg-[#080c14] border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                                      {thesis.comparison_table.headers.map((h, i) => (
                                        <th key={i} className="py-1.5 px-2">
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60">
                                    {thesis.comparison_table.rows.map((r, rIdx) => (
                                      <tr key={rIdx} className="hover:bg-slate-800/40">
                                        {r.map((cell, cIdx) => (
                                          <td
                                            key={cIdx}
                                            className={`py-1.5 px-2 ${
                                              cIdx === 0 ? 'font-bold text-amber-300 whitespace-nowrap' : 'text-slate-300'
                                            }`}
                                          >
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 space-y-1">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                              Recommended Portfolio Action
                            </div>
                            {thesis.recommended_trades.map((tr, tIdx) => (
                              <div
                                key={tIdx}
                                className="text-xs font-mono text-emerald-200 bg-emerald-950/25 border border-emerald-500/30 rounded px-2.5 py-1.5"
                              >
                                → {tr}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* TWO-COLUMN ACTIONABLE TRIAGE: DIVEST (LEFT) VS MISSING TARGETS (RIGHT) */}
            {(triageViewSection === 'actions' || triageViewSection === 'all') && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* COLUMN 1: DIVEST / TRIM CANDIDATES */}
                <div className="bg-[#0b101b] border border-rose-500/30 rounded-lg p-4 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h2 className="font-mono text-sm font-bold text-rose-400 flex items-center gap-2">
                        <ArrowDownRight className="w-4 h-4" />
                        Positions to divest / upgrade (fails quality gate or #2 runner-up)
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {triage.divest_count} remaining holdings to divest after MRVL ($33.0k) sale
                      </p>
                    </div>
                    <span className="font-mono text-xs text-rose-300 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/30">
                      ${triage.total_rotatable_usd.toLocaleString()} Total
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {triage.divest_candidates.map(item => (
                      <div
                        key={item.ticker}
                        className="bg-[#111827]/90 border border-rose-500/25 hover:border-rose-400/60 rounded-lg p-3.5 transition"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => openStockDrawer(item)}
                              className="font-mono font-bold text-sm text-white hover:text-amber-300 underline decoration-rose-500/50"
                            >
                              {item.ticker}
                            </button>
                            <span className="text-xs text-slate-300 font-medium">{item.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                              {item.quality_gate_passed === false ? 'FAIL · OFF-THESIS' : item.triage_badge}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              Score: {item.rating_score}/100
                            </span>
                          </div>
                          <div className="font-mono text-xs text-right">
                            <span className="text-white font-bold">${item.portfolio_usd.toLocaleString()}</span>
                            <span className="text-slate-400 ml-1.5">({item.portfolio_weight_pct}% of port)</span>
                          </div>
                        </div>

                        <div className="mt-1.5 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
                          <span>Account: {item.account} • {item.us_line || item.us_exchange}</span>
                          <span className="text-amber-300 font-semibold">
                            Upgrade To &rarr; {item.recommended_swap}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-2">{item.why_action}</p>

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400">
                              Fwd P/E:{' '}
                              <b className="text-slate-200">
                                {fmtPe(item.fwd_pe, item.data_quality?.valuation_basis)}
                              </b>
                            </span>
                            <span className="text-slate-400">
                              3Y Bear/Base/Bull:{' '}
                              <b className="text-slate-200">
                                {item.bear_3y_moic ?? 1.0}x / {item.moic_3y_base}x / {item.moic_3y_bull}x
                              </b>
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openStockDrawer(item)}
                              className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                            >
                              <span>Inspect</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={item.yahoo_finance_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-white flex items-center gap-1"
                            >
                              <span>Yahoo ({item.us_line || item.us_exchange})</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COLUMN 2: MISSING BEST-IN-CLASS MONOPOLIES TO BUY */}
                <div className="bg-[#0b101b] border border-amber-500/30 rounded-lg p-4 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h2 className="font-mono text-sm font-bold text-amber-400 flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4" />
                        Missing best-in-class chokepoints to acquire
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Unowned #1 supply-chain leaders passing the AI-Compute Quality Gate
                      </p>
                    </div>
                    <span className="font-mono text-xs text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                      Top {triage.missing_monopolies.length} Actionable Buys
                    </span>
                  </div>

                  <div className="mt-3 space-y-3 max-h-[680px] overflow-y-auto pr-1">
                    {triage.missing_monopolies.map(item => (
                      <div
                        key={item.ticker}
                        className="bg-[#111827]/90 border border-amber-500/25 hover:border-amber-400/60 rounded-lg p-3.5 transition"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => openStockDrawer(item)}
                              className="font-mono font-bold text-sm text-amber-300 hover:text-white underline decoration-amber-500/50"
                            >
                              {item.ticker}
                            </button>
                            <span className="text-xs text-slate-200 font-medium">{item.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                              Score {item.rating_score}/100
                            </span>
                            {item.compliance_label && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                                {item.compliance_label}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-right">
                            <span className="text-emerald-400 font-bold">
                              Bear/Base/Bull: {item.bear_3y_moic ?? 1.2}x / {item.moic_3y_base}x / {item.moic_3y_bull}x
                            </span>
                            <span className="text-slate-400 ml-1.5">
                              • Fwd P/E {fmtPe(item.fwd_pe, item.data_quality?.valuation_basis)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-1.5 text-[11px] font-mono text-amber-200/90 flex flex-wrap items-center justify-between gap-2">
                          <span>{item.layer_name}</span>
                          <span className="text-slate-400">
                            {item.us_line || item.us_exchange} • PEG {fmtPeg(item.peg)}
                          </span>
                        </div>

                        {item.data_quality?.cycle_warning && (
                          <div className="mt-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                            &#9888; {item.data_quality.cycle_warning}
                          </div>
                        )}

                        <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-2">{item.why_action}</p>

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-emerald-300">{item.recommended_swap}</span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openStockDrawer(item)}
                              className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                            >
                              <span>Deep Dive</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={item.yahoo_finance_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-white flex items-center gap-1"
                            >
                              <span>Yahoo Quote</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CORE KEEP MONOPOLIES (17 POSITIONS) */}
            {(triageViewSection === 'keeps' || triageViewSection === 'all') && (
              <div className="bg-[#0b101b] border border-emerald-500/30 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="font-mono text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      {triage.keep_count} core keep monopolies &amp; duopolies (${Math.round(triage.core_keep_usd ?? triage.core_keeps.reduce((acc, s) => acc + s.portfolio_usd, 0)).toLocaleString()} • {(triage.core_keep_pct ?? 84.0).toFixed(1)}% of gross long)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Every position below passes the AI-Compute Quality Gate (&ge;76/100). Click any ticker for 3Y Bear/Base/Bull MOIC and technicals.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    Sorted by Portfolio Dollar Allocation
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {triage.core_keeps.map(item => {
                    const cycleWarn = item.data_quality?.cycle_warning;
                    return (
                      <div
                        key={item.ticker}
                        onClick={() => openStockDrawer(item)}
                        className="cursor-pointer bg-[#111827]/80 hover:bg-[#162033] border border-slate-800 hover:border-emerald-500/50 rounded-lg p-3 transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-emerald-300">{item.ticker}</span>
                              <span className="text-xs text-slate-200 font-medium truncate max-w-[140px]">
                                {item.name}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-white">
                              ${item.portfolio_usd.toLocaleString()}{' '}
                              <span className="text-slate-400 font-normal">({item.portfolio_weight_pct}%)</span>
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              {item.triage_badge}
                            </span>
                            <span className="text-amber-300">
                              Score: {item.rating_score}/100 •{' '}
                              {fmtPe(item.fwd_pe, item.data_quality?.valuation_basis)}
                            </span>
                          </div>

                          {cycleWarn && (
                            <div className="mt-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                              &#9888; {cycleWarn.slice(0, 92)}...
                            </div>
                          )}

                          <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-2">{item.why_action}</p>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span className="truncate max-w-[180px]">
                            {item.account} • {item.us_line || item.us_exchange}
                          </span>
                          <span className="text-emerald-400">
                            {item.bear_3y_moic ?? 1.2}x / {item.moic_3y_base}x / {item.moic_3y_bull}x
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* NEXT-WAVE SMALL/MID-CAP BOTTLENECK RADAR */}
            {(triageViewSection === 'radar' || triageViewSection === 'all') && data.next_wave_bottleneck_radar && (
              <div className="bg-[#0b101b] border border-amber-500/40 rounded-lg p-4 space-y-4 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <h2 className="font-mono text-xs sm:text-sm font-bold text-amber-300">
                        {data.next_wave_bottleneck_radar.headline}
                      </h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/30 font-bold">
                        {data.stocks.length} Monitored Stocks • ≤${data.next_wave_bottleneck_radar.small_mid_cap_max_mkt_cap_b || 25}B Small/Mid-Cap Filter
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {data.next_wave_bottleneck_radar.subheadline}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {data.next_wave_bottleneck_radar.pillars.map(pillar => (
                    <div
                      key={pillar.pillar_id}
                      className="bg-[#0f172a]/90 border border-slate-800 hover:border-amber-500/40 rounded-lg p-3 flex flex-col justify-between space-y-3 transition"
                    >
                      <div className="space-y-2">
                        <div className="font-mono text-xs font-bold text-amber-300 leading-snug">
                          {pillar.title}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {pillar.shortage_driver}
                        </p>

                        <div className="pt-1 space-y-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-emerald-400">
                            Small/Mid-Cap (≤$25B) Inflection Champions:
                          </div>
                          {pillar.small_mid_cap_champions.map(card => {
                            const stObj = data.stocks.find(s => s.ticker === card.ticker);
                            return (
                              <div
                                key={`${pillar.pillar_id}-${card.ticker}`}
                                onClick={() => stObj && openStockDrawer(stObj)}
                                className="bg-[#090d16] border border-emerald-500/30 hover:border-emerald-400 rounded p-2 cursor-pointer transition space-y-1"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono text-xs font-bold text-white flex items-center gap-1 flex-wrap">
                                    <span>{card.ticker}</span>
                                    <span className="text-[10px] text-emerald-300 font-normal">
                                      ({card.market_cap_label})
                                    </span>
                                    {card.compliance_pre_clear && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        PRE-CLEAR
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                    {card.bottleneck_score}/100
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-amber-300">
                                  <span>${card.us_price.toFixed(2)}</span>
                                  <span>
                                    {card.fwd_pe ? `${card.fwd_pe.toFixed(1)}x P/E` : 'EV/ARR'} •{' '}
                                    {card.peg ? `${card.peg.toFixed(2)}x PEG` : 'N/A'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-300 leading-snug line-clamp-2">
                                  {card.why_10x_hook}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {data.next_wave_bottleneck_radar.local_market_watchlist &&
                  data.next_wave_bottleneck_radar.local_market_watchlist.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/90">
                      <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400 mb-2">
                        Foreign Local-Market Bottleneck Watchlist (No Verified US ADR — Tracked Outside US Screener):
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-2">
                        {data.next_wave_bottleneck_radar.local_market_watchlist.map(w => (
                          <div
                            key={w.local_ticker}
                            className="bg-[#080c14] border border-slate-800 rounded p-2 text-[10px] space-y-1"
                          >
                            <div className="flex items-center justify-between font-mono font-bold text-amber-200">
                              <span>{w.local_ticker}</span>
                              <span className="text-slate-400">{w.market_cap_label}</span>
                            </div>
                            <div className="font-semibold text-white truncate">{w.name}</div>
                            <div className="text-slate-300 leading-snug line-clamp-2">{w.chokepoint_role}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* LIVE EARNINGS, M&A & SEMIANALYSIS RESEARCH REVIEW DESK */}
            {(triageViewSection === 'intel' || triageViewSection === 'all') && data.live_intelligence_review && (
              <div className="bg-[#0b101b] border border-cyan-500/40 rounded-lg p-4 space-y-4 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <h2 className="font-mono text-xs sm:text-sm font-bold text-cyan-300">
                        Live earnings, M&amp;A &amp; SemiAnalysis research review
                      </h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-200 border border-cyan-500/30">
                        As of {data.live_intelligence_review.as_of_date} • {data.live_intelligence_review.semianalysis_and_specialist_research.length} Live Research Articles
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={refreshLiveIntelligenceFeeds}
                    disabled={refreshingIntel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition shadow disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingIntel ? 'animate-spin' : ''}`} />
                    <span>{refreshingIntel ? 'Scanning feeds...' : 'Scan Live Feeds'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-[#0f172a]/90 border border-rose-500/40 rounded-lg p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-rose-400 flex items-center gap-1.5">
                        <AlertOctagon className="w-3.5 h-3.5" />
                        M&amp;A &amp; corporate actions
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40 font-bold">
                        $115B All-Stock Deal
                      </span>
                    </div>
                    {data.live_intelligence_review.ma_and_corporate_action_alerts.map(ma => (
                      <div key={ma.event_id} className="space-y-2 text-xs">
                        <div className="font-semibold text-white leading-snug">{ma.headline}</div>
                        <p className="text-slate-300 text-[11px] leading-relaxed">{ma.swarm_verdict}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#0f172a]/90 border border-emerald-500/40 rounded-lg p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Latest earnings &amp; guidance
                      </span>
                    </div>
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {data.live_intelligence_review.earnings_and_guidance_reviews.map((er, idx) => (
                        <div key={`${er.ticker}-${idx}`} className="bg-[#090d16] border border-slate-800 rounded p-2 text-xs space-y-1">
                          <div className="font-mono font-bold text-emerald-300">
                            {er.ticker} ({er.quarter}) • {er.date}
                          </div>
                          <div className="text-white text-[11px] leading-snug">{er.headline}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0f172a]/90 border border-cyan-500/40 rounded-lg p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        SemiAnalysis &amp; specialist research
                      </span>
                    </div>
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {data.live_intelligence_review.semianalysis_and_specialist_research.slice(0, 6).map((art, idx) => (
                        <div key={`sa-${idx}`} className="bg-[#090d16] border border-slate-800 rounded p-2 text-xs space-y-1">
                          <a
                            href={art.link}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-white hover:text-cyan-300 transition block text-[11px] leading-snug"
                          >
                            {art.title} ↗
                          </a>
                          <div className="text-[10px] font-mono text-slate-400">
                            {art.source_name} • {art.published}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHOKEPOINT SCORE VS FORWARD P/E VISUALIZATION */}
            {(triageViewSection === 'chart' || triageViewSection === 'all') && (
              <div className="bg-[#0b101b] border border-slate-800 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="font-mono text-sm font-bold text-white">
                      Portfolio efficiency map: Chokepoint score (/100) vs. Forward P/E (x)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Green = Owned #1 Keeps (&ge;76) • Red = Owned Divest (&lt;65) • Amber = Unowned Targets
                    </p>
                  </div>
                  {scatterChartDetails.excludedTickers.length > 0 && (
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      Excluded (Valued on EV/MW or EV/ARR, not P/E): {scatterChartDetails.excludedTickers.join(', ')}
                    </span>
                  )}
                </div>
                <div className="h-[360px] w-full mt-2">
                  <ReactECharts option={scatterChartDetails.option} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 2: 7 SUPPLY CHAINS & CHOKEPOINT DIAGRAMS
        ===================================================================== */}
        {activeTab === 'supply_chains' && (
          <div className="space-y-6">
            {/* Supply Chain Selector Bar */}
            <div className="bg-[#0c121d] border border-slate-800 rounded-lg p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h2 className="font-mono text-base font-bold text-amber-400 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    7 end-to-end AI &amp; robotics supply chain chokepoint maps
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Every critical stage required to ship ASML EUV tools, TSMC wafers, SK hynix HBM4, Nvidia/Google AI racks, 800V DC datacenters, Anthropic frontier tokens, and Humanoid Robots—showing <b>Best-in-Class Leaders</b>, <b>What You Own ($ Value)</b>, and <b>What You Are Missing</b>.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedChainId('ALL')}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                      selectedChainId === 'ALL'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                    }`}
                  >
                    All 7 Chains
                  </button>
                  {data.seven_supply_chains.map(chain => (
                    <button
                      key={chain.chain_id}
                      onClick={() => setSelectedChainId(chain.chain_id)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition ${
                        selectedChainId === chain.chain_id
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                      }`}
                    >
                      Chain {chain.chain_number} · {chain.short_title.replace(/^\d+\.\s*/, '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Supply Chain Visual Flow Diagrams */}
            <div className="space-y-6">
              {filteredChains.map((chain: SupplyChainDiagram) => (
                <div
                  key={chain.chain_id}
                  className="bg-[#0b101b] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                          Supply Chain 0{chain.chain_number}
                        </span>
                        <h3 className="font-mono text-base font-bold text-white">{chain.title}</h3>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-300">
                          {chain.ownership_score_label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{chain.executive_summary}</p>
                    </div>
                  </div>

                  {/* Horizontal Visual Pipeline of Stages */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {chain.nodes.map(node => {
                      const statusColors =
                        node.node_status === 'OWNED_OPTIMAL'
                          ? 'border-emerald-500/50 bg-emerald-950/10'
                          : node.node_status === 'MISSING_OPPORTUNITY'
                          ? 'border-amber-500/60 bg-amber-950/10'
                          : 'border-rose-500/50 bg-rose-950/10';

                      const badgeColors =
                        node.node_status === 'OWNED_OPTIMAL'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : node.node_status === 'MISSING_OPPORTUNITY'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

                      return (
                        <div
                          key={node.node_id}
                          className={`border rounded-lg p-3.5 flex flex-col justify-between relative ${statusColors}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-2">
                              <span className="font-mono text-[10px] font-bold text-slate-400">
                                {node.step}
                              </span>
                              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border font-bold ${badgeColors}`}>
                                {node.node_status.replace(/_/g, ' ')}
                              </span>
                            </div>

                            <h4 className="font-mono text-xs font-bold text-white leading-snug">
                              {node.title}
                            </h4>
                            <div className="mt-1 text-[11px] font-mono text-amber-300 font-semibold">
                              {node.monopoly_type}
                            </div>

                            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                              {node.physics_chokepoint}
                            </p>

                            {/* Best-in-Class Companies */}
                            <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2">
                              <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                                Best-in-class US-tradable leaders:
                              </div>
                              {node.best_in_class_details.map(leader => {
                                const fullStock = data.stocks.find(w => w.ticker === leader.ticker);
                                return (
                                  <div
                                    key={leader.ticker}
                                    className="bg-[#090d16]/90 border border-slate-800 rounded p-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <button
                                        onClick={() => fullStock && openStockDrawer(fullStock)}
                                        className="font-mono font-bold text-amber-300 hover:underline flex items-center gap-1"
                                      >
                                        <span>{leader.ticker}</span>
                                        <span className="text-slate-300 font-normal truncate max-w-[115px]">
                                          ({leader.name})
                                        </span>
                                      </button>
                                      <span className="font-mono text-[10px] text-emerald-400 font-bold">
                                        {leader.monopoly_share_pct}% Share
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
                                      <span>
                                        P/E {fmtPe(leader.fwd_pe)} • PEG {fmtPeg(leader.peg)}
                                      </span>
                                      <a
                                        href={leader.google_finance_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5"
                                      >
                                        <span>GFin</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* What You Own vs Action */}
                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                              Your portfolio exposure:
                            </div>
                            {node.owned_details.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {node.owned_details.map(owned => (
                                  <span
                                    key={owned.ticker}
                                    className={`text-[11px] font-mono px-2 py-0.5 rounded border font-semibold ${
                                      owned.triage_bucket === 'DIVEST_TRIM'
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    }`}
                                  >
                                    {owned.ticker}: ${owned.portfolio_usd.toLocaleString()}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] font-mono text-amber-400 font-bold">
                                $0 owned — unowned bottleneck
                              </div>
                            )}
                            <div className="text-[11px] text-slate-200 bg-[#070a10] border border-slate-800 rounded p-2 font-mono leading-snug">
                              <span className="text-amber-400 font-bold">Verdict: </span>
                              {node.action_verdict}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: SCREENER, 3Y DCF & SLEEVE 3 ROBOTICS IDIOT-INDEX TEARDOWN
        ===================================================================== */}
        {activeTab === 'screener' && (
          <div className="space-y-6">
            {/* Interactive 3Y DCF / MOIC Scenario Modeler */}
            {dcfStock && dcfProjection && (
              <div className="bg-[#0c121d] border border-amber-500/30 rounded-lg p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="font-mono text-sm font-bold text-amber-400 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      3-year return (MOIC) sensitivity modeler — {dcfStock.ticker} ({dcfStock.name})
                    </h2>
                    <p className="text-xs text-slate-400">
                      Test whether {dcfStock.ticker} can 2x–3x over 36 months under conservative vs bull EPS growth and exit P/E multiples
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Select Stock:</span>
                    <select
                      value={dcfTicker}
                      onChange={e => setDcfTicker(e.target.value)}
                      className="bg-[#070a10] border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-amber-300"
                    >
                      {data.stocks.map(s => (
                        <option key={s.ticker} value={s.ticker}>
                          {s.ticker} — {s.name} ({s.is_holding ? `OWNED $${s.portfolio_usd.toLocaleString()}` : 'UNOWNED'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!dcfProjection.hasEarningsMultiple && (
                  <div className="mt-3 p-2.5 rounded bg-amber-950/30 border border-amber-500/40 text-xs font-mono text-amber-200">
                    Note: <b>{dcfStock.ticker}</b> is valued on <b>{dcfStock.data_quality?.valuation_basis}</b> (Fwd P/E is N/A during HPC capex buildout). Pre-computed Bear / Base / Bull 3Y MOIC: <b>{dcfStock.bear_3y_moic}x / {dcfStock.moic_3y_base}x / {dcfStock.moic_3y_bull}x</b>.
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                  <div className="bg-[#080c14] border border-slate-800 rounded p-3">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">3Y EPS CAGR (%)</span>
                      <span className="text-amber-300 font-bold">{dcfEpsCagr.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={85}
                      step={0.5}
                      value={dcfEpsCagr}
                      onChange={e => setDcfEpsCagr(parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      Consensus EPS 3Y: {fmtPct(dcfStock.eps_cagr_3y_pct)} • Rev 3Y: {fmtPct(dcfStock.rev_cagr_3y_pct)}
                    </div>
                  </div>

                  <div className="bg-[#080c14] border border-slate-800 rounded p-3">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">2029E Exit Fwd P/E (x)</span>
                      <span className="text-amber-300 font-bold">{dcfExitMultiple.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={55}
                      step={0.5}
                      value={dcfExitMultiple}
                      onChange={e => setDcfExitMultiple(parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      Current Fwd P/E: {fmtPe(dcfStock.fwd_pe, dcfStock.data_quality?.valuation_basis)}
                    </div>
                  </div>

                  <div className="bg-[#080c14] border border-slate-800 rounded p-3">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">Annual Share Dilution (%)</span>
                      <span className="text-amber-300 font-bold">{dcfDilutionPct.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min={-3}
                      max={10}
                      step={0.5}
                      value={dcfDilutionPct}
                      onChange={e => setDcfDilutionPct(parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      Gross Margin: {fmtPct(dcfStock.gross_margin_pct)}
                    </div>
                  </div>

                  <div className="bg-emerald-950/30 border border-emerald-500/40 rounded p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase text-emerald-300 font-bold">
                        Implied 3Y Target Price
                      </span>
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        {dcfProjection.projectedMoic}x MOIC ({dcfProjection.impliedCagr}% CAGR)
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2 font-mono">
                      <span className="text-2xl font-bold text-white">${dcfProjection.projectedPrice}</span>
                      <span className="text-xs text-slate-400">vs ${dcfProjection.basePrice} today</span>
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-slate-400">
                      Model Bear/Base/Bull: {dcfStock.bear_3y_moic}x / {dcfStock.moic_3y_base}x / {dcfStock.moic_3y_bull}x
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Screener Controls */}
            <div className="bg-[#0c121d] border border-slate-800 rounded-lg p-4 space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['ALL', 'OWNED', 'MISSING'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setOwnershipFilter(mode)}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                        ownershipFilter === mode
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                      }`}
                    >
                      {mode === 'ALL'
                        ? `All US-Tradable (${data.stocks.length})`
                        : mode === 'OWNED'
                        ? `Owned (${data.stocks.filter(s => s.is_holding).length})`
                        : `Unowned (${data.stocks.filter(s => !s.is_holding).length})`}
                    </button>
                  ))}

                  <div className="h-4 w-px bg-slate-800 mx-1" />

                  {[
                    { id: 'ALL' as const, label: 'All Sleeves' },
                    { id: 1 as const, label: 'Sleeve 1: Core Fortress' },
                    { id: 2 as const, label: 'Sleeve 2: 3x–5x+ Leaders' },
                    { id: 3 as const, label: 'Sleeve 3: Next-Wave / Robotics' }
                  ].map(sl => (
                    <button
                      key={String(sl.id)}
                      onClick={() => setSleeveFilter(sl.id)}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                        sleeveFilter === sl.id
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {sl.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={usLineFilter}
                    onChange={e => setUsLineFilter(e.target.value as any)}
                    className="bg-[#070a10] border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-sky-300"
                    title="Filter by US Listing Line & Liquidity"
                  >
                    <option value="ALL">US Line: All (NYSE/Nasdaq + ADRs + OTC)</option>
                    <option value="NYSE_NASDAQ">US Line: NYSE &amp; Nasdaq Only</option>
                    <option value="HIDE_ILLIQUID">US Line: Hide Illiquid OTC Ordinaries</option>
                  </select>

                  <select
                    value={qualityFilter}
                    onChange={e => setQualityFilter(e.target.value as any)}
                    className="bg-[#070a10] border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-emerald-300"
                    title="Filter by AI-Compute Quality Gate"
                  >
                    <option value="ALL">Quality Gate: All ({data.stocks.length})</option>
                    <option value="PASS_ONLY">Quality Gate: Pass Only (Compute Core)</option>
                    <option value="LEADER_ONLY">Quality Gate: #1 / Co-Leaders Only</option>
                    <option value="FAIL_ONLY">Quality Gate: Fails / Off-Thesis Only</option>
                  </select>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Filter ticker, layer..."
                      className="bg-[#070a10] border border-slate-700 rounded pl-8 pr-3 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="bg-[#070a10] border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                  >
                    <option value="rating_score">Sort: Chokepoint Score (High &rarr; Low)</option>
                    <option value="expected_3y_moic">Sort: Expected 3Y MOIC (Prob-Wtd)</option>
                    <option value="moic_3y_base">Sort: 3Y Base MOIC (High &rarr; Low)</option>
                    <option value="portfolio_usd">Sort: Portfolio Value ($)</option>
                    <option value="peg">Sort: PEG Ratio (Low &rarr; High)</option>
                  </select>
                </div>
              </div>

              {/* Watchlist Table with US Line, Liquidity Tier, AI Quality Gate, Rank & Bear/Base/Bull MOIC */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-[#080c14]">
                      <th className="py-2.5 px-2.5">Ticker &amp; US Line</th>
                      <th className="py-2.5 px-2.5">Company, Layer &amp; Rationale</th>
                      <th className="py-2.5 px-2.5">Status / Portfolio $</th>
                      <th className="py-2.5 px-2.5">Price (As of Nov 5)</th>
                      <th className="py-2.5 px-2.5 text-center">AI Quality Gate</th>
                      <th className="py-2.5 px-2.5 text-center">Score &amp; Rank</th>
                      <th className="py-2.5 px-2.5 text-right">Fwd P/E</th>
                      <th className="py-2.5 px-2.5 text-right">PEG</th>
                      <th className="py-2.5 px-2.5 text-right">3Y Bear / Base / Bull</th>
                      <th className="py-2.5 px-2.5">Action Verdict</th>
                      <th className="py-2.5 px-2.5 text-right">Actions &amp; Links</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredWatchlist.map(stock => {
                      const isCut = stock.rating.includes('TRIM') || stock.rating.includes('DIVEST') || stock.rating_score < 65;
                      const isWatch = stock.rating.includes('VALUATION WATCH');
                      const isEmployer = stock.rating.includes('EMPLOYER STOCK');
                      const basis = stock.data_quality?.valuation_basis;
                      const hasCycleWarn = Boolean(stock.data_quality?.cycle_warning);
                      const rationaleLine = stock.ownership_rationale || stock.why_action || stock.choke_point;
                      const uLine = stock.us_line || stock.us_exchange || 'NYSE';
                      const liqTier = stock.liquidity_tier || 'Liquid';
                      const isIlliquid = uLine === 'OTC ordinary' || liqTier.includes('Thin') || liqTier.includes('Illiquid');
                      const qPass = stock.quality_gate_passed !== false;
                      const qTier = stock.quality_tier || (qPass ? 'PASS — #1 / CO-LEADER' : 'FAIL — OFF-THESIS / NON-COMPUTE');
                      const rankObj = scoreRankMap[stock.ticker];
                      return (
                        <tr
                          key={stock.ticker}
                          onClick={() => openStockDrawer(stock)}
                          className="hover:bg-slate-800/40 cursor-pointer transition"
                        >
                          <td className="py-2.5 px-2.5 font-bold text-amber-300 whitespace-nowrap">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span>{stock.ticker}</span>
                              {hasCycleWarn && (
                                <span title={stock.data_quality?.cycle_warning || ''} className="text-amber-400">
                                  &#9888;
                                </span>
                              )}
                              {stock.compliance_label && (
                                <span
                                  title={stock.compliance_label}
                                  className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px]"
                                >
                                  {stock.ticker === 'GOOG' ? 'EMPLOYER' : 'PRE-CLEAR'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className={`text-[9px] px-1 py-0.2 rounded border font-normal ${
                                  uLine === 'OTC ordinary'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : uLine === 'OTC ADR'
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                    : 'bg-slate-800 text-sky-300 border-slate-700'
                                }`}
                              >
                                {uLine}
                              </span>
                              <span className="text-[9px] text-slate-400 font-normal">
                                {stock.underlying_currency || 'USD'}
                              </span>
                            </div>
                            {isIlliquid && (
                              <span
                                title={stock.liquidity_note || liqTier}
                                className="block text-[9px] text-amber-300 font-normal mt-0.5"
                              >
                                {uLine === 'OTC ordinary' ? 'Illiquid · Prefer local' : 'Thin ADR · Limit only'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 font-sans max-w-md">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-200 text-xs">{stock.name}</span>
                              <span className="text-[10px] font-mono text-slate-400">• {stock.layer_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-300/90 line-clamp-2 mt-0.5 leading-snug">
                              {rationaleLine}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 whitespace-nowrap">
                            {stock.is_holding ? (
                              <div>
                                <span className="text-emerald-400 font-bold">
                                  ${stock.portfolio_usd.toLocaleString()}
                                </span>
                                <span className="text-slate-400 text-[10px] block">
                                  {stock.portfolio_weight_pct}% • {stock.account}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-slate-300 text-[11px] font-semibold block">
                                  $0 (Unowned)
                                </span>
                                <span className="text-[9px] text-slate-400 block">
                                  {stock.triage_bucket === 'MISSING_MONOPOLY' ? '#1 Buy Target' : 'Monitored Peer'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 whitespace-nowrap">
                            <div className="text-white font-bold">${stock.price.toLocaleString()}</div>
                            <div
                              className={`text-[10px] ${
                                stock.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {stock.change_pct >= 0 ? '+' : ''}
                              {stock.change_pct}%
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            <span
                              title={stock.quality_note || qTier}
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-bold inline-block ${
                                !qPass
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : qTier.includes('CONDITIONAL')
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}
                            >
                              {!qPass ? 'FAIL · OFF-THESIS' : qTier.includes('CONDITIONAL') ? 'CONDITIONAL' : 'PASS · #1'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-xs ${
                                stock.rating_score >= 88
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : stock.rating_score >= 76
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  : stock.rating_score >= 65
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              {stock.rating_score}
                            </span>
                            {rankObj && (
                              <span className="block text-[9px] text-slate-400 mt-0.5">
                                #{rankObj.rank}/{rankObj.total} ({rankObj.pct}th)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-slate-200 whitespace-nowrap">
                            {fmtPe(stock.fwd_pe, basis)}
                          </td>
                          <td
                            className={`py-2.5 px-2.5 text-right font-bold whitespace-nowrap ${
                              stock.peg === null
                                ? 'text-slate-500'
                                : stock.peg <= 0.95
                                ? 'text-emerald-400'
                                : stock.peg <= 1.5
                                ? 'text-slate-200'
                                : 'text-amber-400'
                            }`}
                          >
                            {fmtPeg(stock.peg)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                            <span className="text-slate-400">{stock.bear_3y_moic ?? 1.0}x</span> /{' '}
                            <span className="text-white font-bold">{stock.moic_3y_base}x</span> /{' '}
                            <span className="text-emerald-400">{stock.moic_3y_bull}x</span>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded border font-bold inline-block ${
                                isCut
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : isEmployer
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                  : isWatch
                                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                  : stock.rating === 'STRONG BUY'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {stock.rating}
                            </span>
                          </td>
                          <td
                            className="py-2.5 px-2.5 text-right whitespace-nowrap"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditStockModal(stock)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 border border-slate-700 text-[10px] font-bold"
                                title={`Edit ${stock.ticker} position, price & fundamentals`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveStockFromUniverse(stock.ticker)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-300 border border-slate-700 text-[10px] font-bold"
                                title={`Remove ${stock.ticker} from portfolio & universe`}
                              >
                                Remove
                              </button>
                              <a
                                href={stock.yahoo_finance_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-400 hover:text-white underline text-[11px] ml-1"
                              >
                                Yahoo
                              </a>
                              <a
                                href={stock.google_finance_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-white underline text-[11px]"
                              >
                                GFin
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SLEEVE 3 BOTTLENECK MIGRATION CONTENDERS & SPACEX ROBOTICS 'IDIOT INDEX' TEARDOWN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sleeve 3 Contenders */}
              {data.sleeve3_contenders && (
                <div className="bg-[#0b101b] border border-sky-500/30 rounded-lg p-4">
                  <div className="pb-3 border-b border-slate-800">
                    <h3 className="font-mono text-sm font-bold text-sky-400 flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      Sleeve 3: Next Micron / SK hynix bottleneck migration contenders
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Comparing Co-Packaged Optics vs Backside Power / 3D Probe vs Physical AI Actuators
                    </p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {data.sleeve3_contenders.map(c => (
                      <div key={c.sector_id} className="bg-[#111827]/90 border border-slate-800 rounded p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-white">
                            #{c.rank}: {c.sector_name}
                          </span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                            Hynix Match: {c.hynix_parallel_score}/100
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Window: <span className="text-amber-300">{c.timeline_window}</span> • GM Profile:{' '}
                          <span className="text-emerald-300">{c.gross_margin_trajectory}</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{c.bottleneck_physics}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {c.top_candidates.map(tc => (
                            <span
                              key={tc.ticker}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300"
                            >
                              {tc.ticker} ({fmtPe(tc.fwd_pe)} • PEG {fmtPeg(tc.peg)})
                            </span>
                          ))}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-300 pt-1">
                          Verdict: {c.panel_takeaway}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SpaceX Robotics Idiot Index Teardown */}
              {data.robotics_idiot_index && (
                <div className="bg-[#0b101b] border border-amber-500/30 rounded-lg p-4">
                  <div className="pb-3 border-b border-slate-800">
                    <h3 className="font-mono text-sm font-bold text-amber-400 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Humanoid robotics BOM &amp; SpaceX &lsquo;Idiot Index&rsquo; teardown
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {data.robotics_idiot_index.summary}
                    </p>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                          <th className="py-2 px-2">Subsystem</th>
                          <th className="py-2 px-2 text-right">BOM ($ / %)</th>
                          <th className="py-2 px-2 text-right">Idiot Ratio</th>
                          <th className="py-2 px-2">Suppliers &amp; Panel Verdict</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {data.robotics_idiot_index.subsystems.map((row, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-2 font-sans">
                              <div className="font-semibold text-slate-200">{row.subsystem}</div>
                              <div className="text-[10px] font-mono text-slate-400">
                                Raw Floor: ${row.raw_material_floor_usd} • {row.compression_risk}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <div className="text-white font-bold">${row.current_cost_usd.toLocaleString()}</div>
                              <div className="text-[10px] text-amber-300">{row.bom_share_pct}% BOM</div>
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                {row.idiot_index_ratio}x
                              </span>
                            </td>
                            <td className="py-2.5 px-2 font-sans">
                              <div className="text-emerald-300 font-mono text-[11px] font-bold">
                                {row.key_suppliers}
                              </div>
                              <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                                {row.verdict}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 4: 12-EXPERT AI COPILOT SWARM (GEMINI PRO NEXT)
        ===================================================================== */}
        {activeTab === 'copilot' && (
          <div className="space-y-6">
            {/* Explicit Synthetic Persona & Public-Information-Only Disclaimer Banner */}
            <div className="bg-amber-950/25 border border-amber-500/40 rounded-lg p-3 text-xs font-mono text-amber-200 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 mr-1.5">
                  Synthetic analytical lens (public information only — zero MNPI):
                </span>
                <span>
                  All 12 expert personas below are synthetic analytical lenses constructed strictly from public SEC/foreign regulatory filings, public earnings transcripts, and published engineering literature.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Live Gemini Pro Next Query Console */}
              <div className="lg:col-span-2 bg-[#0c121d] border border-amber-500/30 rounded-lg p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <div>
                        <h2 className="font-mono text-sm font-bold text-white">
                          12-lens investment committee copilot
                        </h2>
                        <p className="text-xs text-slate-400 font-mono">
                          Models: {(data.meta.available_gemini_models || ['gemini-4-argon']).join(' → ')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Preset Prompts */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Which positions in my Schwab/Fidelity accounts should I sell today, how do I pair them with ST losses in ...2854, and what #1 monopolies should replace them?',
                      'Stress test MU at 4.98x Fwd P/E and 74.6% OPM: is this a cyclical peak trap or structural HBM4 re-rating?',
                      'Why is Onto Innovation (ONTO) a stronger 3Y risk-adjusted CoWoS metrology bet than Camtek (CAMT) or KLA (KLAC)?',
                      'Compare Nitto Boseki (NBCLF, Low-Dk T-glass monopoly) vs off-thesis robotics holdings Harmonic Drive (HSYDF), FANUC (FANUY), and Yaskawa (YASKY).'
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCopilotQuery(preset)}
                        className="text-left text-[11px] font-mono px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                      >
                        Prompt #{idx + 1}: {preset.slice(0, 68)}...
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={copilotQuery}
                      onChange={e => setCopilotQuery(e.target.value)}
                      className="w-full bg-[#070a10] border border-slate-700 rounded p-3 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                      placeholder="Ask the 12-lens swarm about any AI supply chain bottleneck, holding, or 3Y MOIC thesis..."
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={copilotTickerFocus}
                          onChange={e => setCopilotTickerFocus(e.target.value)}
                          className="bg-[#070a10] border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-300"
                        >
                          <option value="ALL">
                            Focus: Portfolio-Wide (${(grossEquities / 1000).toFixed(1)}k across {data.meta.holdings_count} positions)
                          </option>
                          {data.stocks.map(s => (
                            <option key={s.ticker} value={s.ticker}>
                              Focus: {s.ticker} ({s.name})
                            </option>
                          ))}
                        </select>

                        <select
                          value={copilotModel}
                          onChange={e => setCopilotModel(e.target.value)}
                          className="bg-[#070a10] border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-amber-300"
                        >
                          {(data.meta.available_gemini_models || ['gemini-4-argon', 'gemini-3.8-flash']).map(m => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={runCopilotSwarm}
                        disabled={copilotLoading}
                        className="flex items-center gap-2 px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs transition disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{copilotLoading ? 'Querying Gemini...' : 'Run Swarm Debate <GO>'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Output Console */}
                <div className="bg-[#070a10] border border-slate-800 rounded-lg p-4 min-h-[280px] max-h-[540px] overflow-y-auto font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {copilotLoading ? (
                    <div className="flex items-center gap-2 text-amber-400 animate-pulse">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>
                        Synthesizing across 12 synthetic domain lenses on {copilotModel}...
                      </span>
                    </div>
                  ) : copilotResponse ? (
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-emerald-400 pb-2 mb-3 border-b border-slate-800">
                        <span>Model: {copilotResponse.model}</span>
                        <span>Updated Nov 5, 2026</span>
                      </div>
                      {copilotResponse.response.replace(/\*\*/g, '')}
                    </div>
                  ) : (
                    <div className="text-slate-400 space-y-2">
                      <p className="text-amber-300 font-bold">
                        Ready. Click &ldquo;Run Swarm Debate &lt;GO&gt;&rdquo; to run a live evaluation, or review today&apos;s pre-computed findings below:
                      </p>
                      {dailyFindings?.concentration_convictions.map((f, i) => (
                        <p key={`c-${i}`} className="text-slate-300">
                          • {f}
                        </p>
                      ))}
                      {dailyFindings?.divest_and_upgrade_actions.map((f, i) => (
                        <p key={`d-${i}`} className="text-rose-300/90">
                          • {f}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: The 12 Synthetic Expert Lenses */}
              <div className="bg-[#0c121d] border border-slate-800 rounded-lg p-4 space-y-3 max-h-[760px] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="font-mono text-xs font-bold text-amber-400">
                    12 synthetic domain lenses
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    Public-Info Only
                  </span>
                </div>
                <div className="space-y-2.5">
                  {data.expert_panel.map(exp => (
                    <div key={exp.id} className="bg-[#080c14] border border-slate-800/90 rounded p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-white">{exp.role}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {exp.organization_lens}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        Core Metric: {exp.key_metric_watched}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{exp.headline_verdict}</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {exp.top_picks.map(t => (
                          <span
                            key={t}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300"
                          >
                            +{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 5: RISK, MACRO BREAKERS, TAX-LOT PAIRING & PRE-TRADE TICKET
        ===================================================================== */}
        {activeTab === 'risk' && riskTax && (
          <div className="space-y-6">
            {/* Section 1: Factor Correlation, Underlying FX, OTC ADR vs Foreign Ordinary Liquidity & Margin Call Buffer */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Card 1: Factor Correlation & Effective N */}
              <div className="bg-[#0c121d] border border-amber-500/40 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      Effective independent bets
                    </span>
                    <Scale className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 font-mono">
                    <span className="text-2xl font-bold text-white">
                      {riskTax.correlation_and_concentration.effective_independent_bets}
                    </span>
                    <span className="text-xs text-slate-400">
                      vs {riskTax.correlation_and_concentration.total_positions} positions (Wt Eff N = {riskTax.correlation_and_concentration.effective_n_by_weight})
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11px] font-mono text-amber-300">
                    Real 1Y Weekly ρ = {riskTax.correlation_and_concentration.assumed_pairwise_correlation} • Semis/Semicap = {riskTax.correlation_and_concentration.semis_and_semicap_weight_pct}%
                  </div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    {riskTax.correlation_and_concentration.summary}
                  </p>
                </div>
              </div>

              {/* Card 2: Underlying Currency Exposure */}
              <div className="bg-[#0c121d] border border-sky-500/40 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-sky-400">
                      Underlying FX exposure
                    </span>
                    <Globe className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 font-mono">
                    <span className="text-2xl font-bold text-white">
                      {riskTax.currency_and_otc_exposure.non_usd_pct_of_gross}% Non-USD
                    </span>
                    <span className="text-xs text-amber-300">
                      (${(riskTax.currency_and_otc_exposure.non_usd_market_value_usd / 1000).toFixed(1)}k)
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px]">
                    {riskTax.currency_and_otc_exposure.currencies.map(b => (
                      <span key={b.currency} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200">
                        {b.currency}: {b.pct_of_gross}% (${(b.market_value_usd / 1000).toFixed(1)}k)
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    9 Japanese holdings (39.2% JPY) + 2 European (10.1% EUR) + 1 Swiss (5.5% CHF) + TSMC (4.0% TWD).
                  </p>
                </div>
              </div>

              {/* Card 3: OTC ADRs vs OTC Foreign Ordinaries Liquidity Breakdown */}
              <div className="bg-[#0c121d] border border-purple-500/40 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-purple-400">
                      OTC ADRs vs. OTC Foreign Ordinaries
                    </span>
                    <AlertTriangle className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className="text-purple-300">
                        9 OTC ADRs ({riskTax.currency_and_otc_exposure.otc_adr_pct_of_gross}%):
                      </span>
                      <span className="text-white font-bold">
                        ${(riskTax.currency_and_otc_exposure.otc_adr_market_value_usd / 1000).toFixed(1)}k
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-rose-300">
                        {riskTax.currency_and_otc_exposure.otc_ordinary_positions?.length ?? 2} OTC Ordinaries ({riskTax.currency_and_otc_exposure.otc_ordinary_pct_of_gross ?? 6.9}%):
                      </span>
                      <span className="text-rose-300 font-bold">
                        ${((riskTax.currency_and_otc_exposure.otc_ordinary_market_value_usd ?? 39619) / 1000).toFixed(1)}k
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    <b>OTC ADRs</b> (DSCSY, LSRCY, ASMIY, VACNY, MRUWY, ATEYY, TELWY, FANUY, YASKY): use limit orders within +/-35 bps of local parity. <b>OTC Ordinaries</b> (NBCLF 3110.T, HSYDF 6324.T): thin US F-shares; route size on Tokyo TSE or exit HSYDF.
                  </p>
                </div>
              </div>

              {/* Card 4: Brokerage_Family (...2854) Margin Call Distance */}
              <div className="bg-[#0c121d] border border-rose-500/40 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-rose-400">
                      Margin buffer (...2854)
                    </span>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 font-mono">
                    <span className="text-2xl font-bold text-rose-400">
                      {riskTax.margin_and_financing.debt_to_account_mv_pct}% Debt/MV
                    </span>
                    <span className="text-xs text-slate-300">
                      ({riskTax.margin_and_financing.drop_to_breach_30pct_cap_pct}% to 30% Cap)
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11px] font-mono text-slate-300">
                    Debt: -${Math.abs(riskTax.margin_and_financing.margin_debit_usd).toLocaleString()} on ${riskTax.margin_and_financing.account_equities_usd.toLocaleString()} MV • Interest: ${riskTax.margin_and_financing.annual_margin_interest_usd.toLocaleString()}/yr ({riskTax.margin_and_financing.fidelity_margin_apr_pct}% APR vs SPX Box @ {riskTax.margin_and_financing.spx_box_spread_apr_pct}% = ${riskTax.margin_and_financing.annual_box_spread_interest_usd.toLocaleString()}/yr)
                  </div>
                  <p className="mt-2 text-xs text-rose-200/90 leading-relaxed">
                    A {Math.abs(riskTax.margin_and_financing.drop_to_breach_30pct_cap_pct).toFixed(1)}% decline in Brokerage_Family (...2854) triggers the {riskTax.margin_and_financing.hard_policy_cap_pct}% Debt-to-Market-Value (Debt/MV) policy cap. Retiring margin via CDNS sale proceeds (MRVL already exited) earns a risk-free {riskTax.margin_and_financing.fidelity_margin_apr_pct}% pre-tax return.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Margin Maintenance Schedule & 3-Scenario Drawdown Stress Test */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Margin Call Distance Schedule */}
              <div className="bg-[#0b101b] border border-slate-800 rounded-lg p-4">
                <h3 className="font-mono text-sm font-bold text-white pb-2 border-b border-slate-800">
                  Brokerage_Family (...2854) margin call distance schedule
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                        <th className="py-2 px-2">Maintenance Tier</th>
                        <th className="py-2 px-2 text-right">Margin Call MV</th>
                        <th className="py-2 px-2 text-right">Account Drop to Call</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {riskTax.margin_and_financing.maintenance_tiers.map((tier, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-2 text-slate-200 font-bold">{tier.label}</td>
                          <td className="py-2 px-2 text-right text-amber-300">
                            ${tier.margin_call_account_mv_usd.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right text-rose-400 font-bold">
                            {tier.account_decline_to_trigger_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3-Scenario Portfolio Drawdown Stress Test */}
              <div className="bg-[#0b101b] border border-slate-800 rounded-lg p-4">
                <h3 className="font-mono text-sm font-bold text-white pb-2 border-b border-slate-800">
                  Portfolio drawdown stress test (SOX -25% / -45% / -75%)
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                        <th className="py-2 px-2">Scenario</th>
                        <th className="py-2 px-2 text-right">Ending Net NAV</th>
                        <th className="py-2 px-2 text-right">...2854 Debt/MV</th>
                        <th className="py-2 px-2">Margin Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {riskTax.margin_and_financing.stress_scenarios.map((sc, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-2 text-slate-200 font-sans">
                            <div className="font-bold text-xs">{sc.scenario}</div>
                            <div className="text-[10px] font-mono text-slate-400">FX: {sc.usd_jpy_shock}</div>
                          </td>
                          <td className="py-2 px-2 text-right text-white font-bold">
                            ${sc.ending_net_nav_usd.toLocaleString()} ({sc.net_nav_drawdown_pct}%)
                          </td>
                          <td className="py-2 px-2 text-right text-rose-400 font-bold">
                            {sc.brokerage_family_debt_to_mv_pct}%
                          </td>
                          <td className="py-2 px-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                sc.status.includes('CALL') || sc.status.includes('LIQUIDATION')
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {sc.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 3: Tax-Lot Switching Hurdle & Loss-Harvest Pairing Table (...2854) */}
            <div className="bg-[#0b101b] border border-emerald-500/30 rounded-lg p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-mono text-sm font-bold text-emerald-400">
                    Tax-aware switching hurdle &amp; short-term loss-harvest pairing (Brokerage_Family ...2854)
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {riskTax.tax_and_wash_sale_engine.recommendation_priority}
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                  <span className="px-2.5 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    Unpaired Tax: ${riskTax.tax_and_wash_sale_engine.unpaired_st_tax_35_1pct_usd.toLocaleString()}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    Paired Tax: ${riskTax.tax_and_wash_sale_engine.paired_st_tax_35_1pct_usd.toLocaleString()} (Saves ${riskTax.tax_and_wash_sale_engine.tax_saved_by_loss_pairing_usd.toLocaleString()})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Harvestable Loss Lots Table */}
                <div>
                  <div className="text-xs font-mono font-bold text-emerald-300 mb-2">
                    1. Harvestable short-term loss lots in Brokerage_Family (...2854) &amp; 30-day IRA wash-sale guards
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                          <th className="py-2 px-2">Ticker</th>
                          <th className="py-2 px-2 text-right">MV / Cost</th>
                          <th className="py-2 px-2 text-right">ST Loss</th>
                          <th className="py-2 px-2">30-Day IRA Wash-Sale Guard</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {riskTax.tax_and_wash_sale_engine.harvestable_lots_brokerage_family.map((lot, i) => (
                          <tr key={i}>
                            <td className="py-2 px-2 font-bold text-amber-300">{lot.ticker}</td>
                            <td className="py-2 px-2 text-right">
                              ${lot.market_value.toLocaleString()} / ${lot.cost_basis.toLocaleString()}
                            </td>
                            <td className="py-2 px-2 text-right text-rose-400 font-bold">
                              ${lot.unrealized_pl.toLocaleString()}
                            </td>
                            <td className="py-2 px-2 font-sans text-[11px] text-amber-200/90">
                              {lot.wash_sale_risk}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* All Taxable Divest Lots */}
                <div>
                  <div className="text-xs font-mono font-bold text-rose-300 mb-2">
                    2. Divest / trim candidates across accounts (tax-lot breakdown)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                          <th className="py-2 px-2">Ticker</th>
                          <th className="py-2 px-2">Account</th>
                          <th className="py-2 px-2 text-right">MV / Cost</th>
                          <th className="py-2 px-2 text-right">Unrealized G/L</th>
                          <th className="py-2 px-2">Tax Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {riskTax.tax_and_wash_sale_engine.all_account_lots
                          .filter(l => l.triage_bucket === 'DIVEST_TRIM')
                          .map((lot, i) => (
                            <tr key={i}>
                              <td className="py-2 px-2 font-bold text-amber-300">{lot.ticker}</td>
                              <td className="py-2 px-2 text-slate-300">{lot.account}</td>
                              <td className="py-2 px-2 text-right">
                                ${lot.market_value.toLocaleString()} / ${lot.cost_basis.toLocaleString()}
                              </td>
                              <td
                                className={`py-2 px-2 text-right font-bold ${
                                  lot.unrealized_pl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {lot.unrealized_pl >= 0 ? '+' : ''}${lot.unrealized_pl.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-slate-300">{lot.holding_period}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Interactive Pre-Trade Compliance Ticket & 7 Live Macro Circuit Breakers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Interactive Pre-Trade Compliance Ticket */}
              <div className="bg-[#0b101b] border border-amber-500/40 rounded-lg p-4 space-y-4">
                <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-mono text-sm font-bold text-amber-400">
                      Interactive 6-gate pre-trade compliance ticket
                    </h3>
                    <p className="text-xs text-slate-400">
                      Validates AI-Compute Quality Gate (&ge;76), Live 10Y Treasury Yield + Stock PEG, Margin Hurdle, 30-Day IRA Wash-Sale &amp; GOOG/AVGO/IBIDY Pre-Clearance
                    </p>
                  </div>
                </div>

                <form onSubmit={runPreTradeCheck} className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Action</label>
                    <select
                      value={ptAction}
                      onChange={e => setPtAction(e.target.value)}
                      className="w-full bg-[#070a10] border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-emerald-300"
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL / TRIM</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Ticker</label>
                    <select
                      value={ptTicker}
                      onChange={e => setPtTicker(e.target.value)}
                      className="w-full bg-[#070a10] border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-amber-300"
                    >
                      {data.stocks.map(s => (
                        <option key={s.ticker} value={s.ticker}>
                          {s.ticker} ({s.rating_score}/100)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Account</label>
                    <select
                      value={ptAccount}
                      onChange={e => setPtAccount(e.target.value)}
                      className="w-full bg-[#070a10] border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-slate-200"
                    >
                      <option value="Roth_Schwab">Schwab (...0726)</option>
                      <option value="Roth_Fidelity">Fidelity Roth (...5830)</option>
                      <option value="Brokerage_Family">Fidelity Margin (...2854)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      value={ptAmount}
                      onChange={e => setPtAmount(Number(e.target.value))}
                      className="w-full bg-[#070a10] border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-white"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={ptLoading}
                      className="w-full py-1.5 px-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs transition"
                    >
                      {ptLoading ? 'Checking...' : 'Verify 6 Gates'}
                    </button>
                  </div>
                </form>

                {ptResult && (
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center justify-between bg-[#080c14] border border-slate-800 rounded p-2.5 font-mono text-xs">
                      <span>
                        Ticket: <b className="text-amber-300">{ptResult.ticker}</b> in <b>{ptResult.account}</b> (New Wt: {ptResult.new_portfolio_weight_pct}%)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          ptResult.overall_status.includes('APPROVED')
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {ptResult.overall_status}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {ptResult.gates.map((g, idx) => (
                        <div
                          key={idx}
                          className="bg-[#080c14] border border-slate-800/90 rounded p-2 text-xs font-mono flex items-start justify-between gap-2"
                        >
                          <div>
                            <span className="font-bold text-slate-200">{g.gate}: </span>
                            <span className="text-slate-400">{g.detail}</span>
                          </div>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              g.passed
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {g.passed ? 'PASS' : 'WARN'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 7 Live Macro & Credit Circuit Breakers */}
              <div className="bg-[#0b101b] border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="pb-2 border-b border-slate-800">
                  <h3 className="font-mono text-sm font-bold text-white">
                    7 live macro, hyperscaler capex &amp; credit circuit breakers
                  </h3>
                  <p className="text-xs text-slate-400">
                    Real-time regime triggers governing PEG hurdles, sleeve caps, and neocloud debt-spread alerts
                  </p>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {data.circuit_breakers.map(cb => (
                    <div
                      key={cb.id}
                      className="bg-[#080c14] border border-slate-800 rounded p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-amber-300">{cb.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          {cb.status} ({cb.current_value})
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Threshold: <span className="text-slate-300">{cb.action_threshold}</span>
                      </div>
                      <p className="text-slate-300 leading-snug">{cb.automated_action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          STOCK DEEP-DIVE DRAWER / MODAL (PRESS ESC TO CLOSE)
      ===================================================================== */}
      {selectedStock && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedStock.ticker} Deep-Dive Research Flash`}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedStock(null)}
        >
          <div
            className="bg-[#0b101b] border border-amber-500/50 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-lg font-bold text-amber-300">{selectedStock.ticker}</span>
                  <span className="text-base font-bold text-white">{selectedStock.name}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-sky-300">
                    {selectedStock.us_line || selectedStock.us_exchange}
                  </span>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded border font-bold ${
                      selectedStock.quality_gate_passed === false
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : (selectedStock.quality_tier || '').includes('CONDITIONAL')
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {selectedStock.quality_tier || 'PASS — #1 / CO-LEADER'}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1">
                  {selectedStock.sleeve_label} • {selectedStock.layer_name} • Underlying FX:{' '}
                  {selectedStock.underlying_currency || 'USD'} • As of {selectedStock.price_as_of || '2026-11-05'}
                </div>
              </div>
              <button
                onClick={() => setSelectedStock(null)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ownership & Verdict Banner */}
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Your Portfolio Position</span>
                {selectedStock.is_holding ? (
                  <span className="text-emerald-400 font-bold">
                    OWNED: ${selectedStock.portfolio_usd.toLocaleString()} ({selectedStock.portfolio_weight_pct}% •{' '}
                    {selectedStock.account})
                  </span>
                ) : (
                  <span className="text-amber-300 font-bold">$0 OWNED — UNOWNED TARGET</span>
                )}
                {selectedStock.compliance_label && (
                  <span className="block text-[10px] text-amber-300 mt-0.5 font-bold">
                    Compliance: {selectedStock.compliance_label}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase">Attractiveness Score &amp; Rank</span>
                <span className="text-white font-bold">
                  {selectedStock.rating} (Score {selectedStock.rating_score}/100
                  {scoreRankMap[selectedStock.ticker]
                    ? ` • Rank #${scoreRankMap[selectedStock.ticker].rank} of ${scoreRankMap[selectedStock.ticker].total} · ${scoreRankMap[selectedStock.ticker].pct}th pct`
                    : ''}
                  )
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">
                  AI Crit {selectedStock.ai_criticality_score}/40 + Moat {selectedStock.tech_moat_score}/35 + Torque{' '}
                  {selectedStock.return_torque_score}/25
                </span>
              </div>
            </div>

            {/* US Tradability & Liquidity + AI-Compute Quality Gate Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
              <div className="bg-[#080c14] border border-slate-800 rounded p-2.5">
                <span className="text-slate-400 text-[10px] uppercase block">US Tradability &amp; 65D Liquidity</span>
                <span className="text-sky-300 font-bold">
                  {selectedStock.us_line || selectedStock.us_exchange} • {selectedStock.liquidity_tier || 'Liquid'}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">
                  {selectedStock.liquidity_note || 'Standard US exchange execution.'}
                </span>
              </div>
              <div className="bg-[#080c14] border border-slate-800 rounded p-2.5">
                <span className="text-slate-400 text-[10px] uppercase block">AI-Compute Quality Gate</span>
                <span
                  className={`font-bold ${
                    selectedStock.quality_gate_passed === false ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  {selectedStock.quality_tier || 'PASS — #1 / CO-LEADER'}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">
                  {selectedStock.quality_note || 'Verified best-in-class AI compute supply-chain leader.'}
                </span>
              </div>
            </div>

            {/* Cycle Warning / Data Quality Alert if Present */}
            {selectedStock.data_quality?.cycle_warning && (
              <div className="bg-amber-950/30 border border-amber-500/40 rounded p-3 text-xs font-mono text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase text-amber-300 mr-1">CYCLICAL / VALUATION BASIS ALERT:</span>
                  <span>{selectedStock.data_quality.cycle_warning}</span>
                </div>
              </div>
            )}

            {/* Key Metrics Grid (USD-Normalized Technicals & Bear/Base/Bull MOIC) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="bg-[#080c14] border border-slate-800 rounded p-2.5">
                <span className="text-slate-400 text-[10px] block">Price (As of {selectedStock.price_as_of || 'Nov 5'})</span>
                <span className="text-white font-bold text-sm">${selectedStock.price}</span>
                <span
                  className={`ml-1.5 text-[10px] ${
                    selectedStock.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  ({selectedStock.change_pct >= 0 ? '+' : ''}
                  {selectedStock.change_pct}%)
                </span>
              </div>
              <div className="bg-[#080c14] border border-slate-800 rounded p-2.5">
                <span className="text-slate-400 text-[10px] block">Fwd P/E • PEG</span>
                <span className="text-white font-bold text-sm">
                  {fmtPe(selectedStock.fwd_pe, selectedStock.data_quality?.valuation_basis)} •{' '}
                  {fmtPeg(selectedStock.peg)}
                </span>
              </div>
              <div className="bg-[#080c14] border border-slate-800 rounded p-2.5">
                <span className="text-slate-400 text-[10px] block">3Y Bear / Base / Bull</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {selectedStock.bear_3y_moic ?? 1.0}x / {selectedStock.moic_3y_base}x / {selectedStock.moic_3y_bull}x
                </span>
              </div>
              <div className="bg-[#080c14] border border-slate-800 rounded p-2.5">
                <span className="text-slate-400 text-[10px] block">50-DMA / 52W High (USD)</span>
                <span className="text-slate-200 font-bold text-sm">
                  ${selectedStock.dma50 ?? '—'} / ${selectedStock.high_52w ?? '—'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="bg-[#080c14] border border-slate-800 rounded p-3">
                <div className="font-mono text-[10px] uppercase text-amber-400 font-bold mb-1">
                  Supply-chain chokepoint position ({selectedStock.monopoly_share_pct}% share)
                </div>
                <p className="text-slate-200">{selectedStock.choke_point}</p>
              </div>

              {/* LATEST EARNINGS, M&A & SEMIANALYSIS NEWS FOR THIS TICKER */}
              {selectedStock.recent_news && selectedStock.recent_news.length > 0 && (
                <div className="bg-[#080c14] border border-cyan-500/35 rounded p-3 space-y-2">
                  <div className="font-mono text-[10px] uppercase text-cyan-400 font-bold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Latest Earnings, M&amp;A &amp; SemiAnalysis Coverage ({selectedStock.ticker})</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedStock.recent_news.slice(0, 4).map((rn, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 bg-[#0b1220] border border-slate-800 rounded p-2">
                        <a
                          href={rn.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-100 hover:text-cyan-300 font-medium text-xs leading-snug"
                        >
                          {rn.title} ↗
                        </a>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          {rn.publisher} • {rn.published}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WHY OWNED / WHY NOT INCLUDED — RATIONALE & EDIT DESK */}
              <div className="bg-[#080c14] border border-emerald-500/40 rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-mono text-[11px] uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>WHY OWNED / WHY NOT INCLUDED — PORTFOLIO RATIONALE DESK</span>
                  </div>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    {selectedStock.inclusion_badge || selectedStock.triage_badge}
                  </span>
                </div>

                <p className="text-slate-100 bg-[#0b1220] border border-slate-800 rounded p-2.5 leading-relaxed">
                  {selectedStock.ownership_rationale || selectedStock.why_action}
                </p>

                {selectedStock.committee_verdict && (
                  <div className="bg-amber-950/20 border border-amber-500/30 rounded p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase text-amber-300 flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5" /> Investment Committee ({selectedStock.committee_verdict.as_of})
                      </span>
                      <ActionPill
                        action={selectedStock.committee_verdict.action}
                        conviction={selectedStock.committee_verdict.conviction}
                        compact
                      />
                    </div>
                    {selectedStock.committee_verdict.rationale && (
                      <p className="text-xs text-slate-200 leading-relaxed">{selectedStock.committee_verdict.rationale}</p>
                    )}
                    {selectedStock.committee_verdict.kill_trigger && (
                      <p className="text-[11px] text-rose-300 leading-relaxed">
                        <span className="font-mono font-bold">Kill trigger:</span> {selectedStock.committee_verdict.kill_trigger}
                      </p>
                    )}
                  </div>
                )}

                <form onSubmit={handleSaveRationale} className="space-y-2.5 pt-1 border-t border-slate-800/80">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                        Ownership / Inclusion Status
                      </label>
                      <select
                        value={editRationaleStatus}
                        onChange={e => setEditRationaleStatus(e.target.value)}
                        className="w-full bg-[#06090f] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-amber-300"
                      >
                        <option value="OWNED_IN_PORTFOLIO">OWNED — Core #1 Monopoly (Concentrate)</option>
                        <option value="OWNED_DIVEST_UPGRADE">OWNED — Divest / Upgrade to #1 Leader</option>
                        <option value="OWNED_EXTERNAL_OR_PLANNED">OWNED — External Account / Planned Allocation</option>
                        <option value="NOT_INCLUDED_MISSING_MONOPOLY">NOT INCLUDED — Missing #1 Monopoly Buy Target</option>
                        <option value="NOT_INCLUDED_SOLD_EXITED">SOLD &amp; EXITED — Proceeds Applied to Margin / Rotation</option>
                        <option value="NOT_INCLUDED_ACQUIRED_BY_MRVL">ACQUIRED BY MRVL — $115B All-Stock Deal (Avoid Dilution)</option>
                        <option value="NOT_INCLUDED_EXCLUDED_PEER">NOT INCLUDED — Excluded #2 Peer (Avoid Diworsification)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                        Supply Chain Placement (Chain #1–#7)
                      </label>
                      <select
                        value={editChainId}
                        onChange={e => setEditChainId(e.target.value)}
                        className="w-full bg-[#06090f] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-sky-300"
                      >
                        <option value="asml_euv">1. Shipping ASML EUV &amp; High-NA Equipment</option>
                        <option value="tsmc_cowos">2. Shipping TSMC 2nm (N2 GAA) &amp; CoWoS-L Chips</option>
                        <option value="hbm4_memory">3. SK Hynix / Micron HBM4 16-Hi Memory Stack</option>
                        <option value="gpu_tpu_cluster">4. Bringing Nvidia GPUs or Google TPUs to Cluster Scale</option>
                        <option value="datacenter_power">5. Building Datacenters with GW-Scale Power</option>
                        <option value="anthropic_serving">6. Serving Anthropic Frontier Models (Claude Token Factory)</option>
                        <option value="robotics_physical_ai">7. Physical AI &amp; Humanoid Robotics (Idiot-Index Audit)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                      Add / Edit Your Personal Rationale (Why Owned or Why Not Included)
                    </label>
                    <textarea
                      rows={2}
                      value={editRationaleText}
                      onChange={e => setEditRationaleText(e.target.value)}
                      placeholder={`Enter your rationale for why ${selectedStock.ticker} is owned or excluded (e.g., "#2 behind AVGO at 2x the P/E" or "100% actinic EUV mask inspection monopoly")...`}
                      className="w-full bg-[#06090f] border border-slate-700 rounded p-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editRunVertex}
                        onChange={e => setEditRunVertex(e.target.checked)}
                        className="accent-emerald-400"
                      />
                      <span>Also synthesize with live Vertex AI Gemini Swarm</span>
                    </label>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openEditStockModal(selectedStock)}
                        className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-[11px] font-bold flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Position &amp; Fundamentals</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStockFromUniverse(selectedStock.ticker)}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono text-[11px] font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove Ticker</span>
                      </button>
                      {(selectedStock.is_custom_stock || selectedStock.user_custom_rationale) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomStock(selectedStock.ticker)}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-[11px] font-bold"
                        >
                          Reset Override
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={savingRationale}
                        className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition disabled:opacity-50"
                      >
                        {savingRationale ? 'SAVING & RUNNING SWARM...' : 'SAVE RATIONALE & RE-RUN SWARM'}
                      </button>
                    </div>
                  </div>

                  {rationaleSavedMsg && (
                    <div className="text-[11px] font-mono text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 rounded px-2.5 py-1">
                      {rationaleSavedMsg}
                    </div>
                  )}
                </form>
              </div>

              {/* 12-EXPERT / 6-PANEL SWARM DEBATE & SUPPLY-CHAIN PLACEMENT */}
              {selectedStock.swarm_debate && (
                <div className="bg-[#080c14] border border-cyan-500/40 rounded-lg p-3.5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                    <div>
                      <div className="font-mono text-[11px] uppercase text-cyan-400 font-bold flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        <span>12-EXPERT / 6-PANEL SWARM DEBATE &amp; SUPPLY-CHAIN PLACEMENT</span>
                      </div>
                      <div className="font-mono text-xs font-bold text-white mt-0.5">
                        {selectedStock.swarm_debate.consensus_verdict}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cid = selectedStock.swarm_debate?.supply_chain_placement?.chain_id || 'ALL';
                        setSelectedChainId(cid);
                        setSelectedStock(null);
                        setActiveTab('supply_chains');
                      }}
                      className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-[10px] font-bold"
                    >
                      View in Supply Chain &rarr;
                    </button>
                  </div>

                  {/* Placement Card */}
                  <div className="bg-[#0b1220] border border-slate-800 rounded p-2.5 font-mono text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Assigned Supply-Chain Chokepoint</span>
                      <span className="text-cyan-300 font-bold">
                        {selectedStock.swarm_debate.supply_chain_placement.chain_title}
                      </span>
                      <span className="text-slate-300 block text-[10px]">
                        {selectedStock.swarm_debate.supply_chain_placement.node_title}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Pure-Rubric Additive Breakdown</span>
                      <span className="text-amber-300 font-bold">
                        {selectedStock.swarm_debate.score_breakdown_label}
                      </span>
                      <span className="text-slate-300 block text-[10px]">
                        Layer #1 Benchmark Peer: <b>{selectedStock.swarm_debate.supply_chain_placement.best_in_class_peer}</b>
                      </span>
                    </div>
                  </div>

                  {selectedStock.swarm_debate.llm_swarm_synthesis && (
                    <div className="bg-cyan-950/30 border border-cyan-500/30 rounded p-2.5 text-xs text-cyan-100 font-mono">
                      <span className="text-[10px] uppercase text-cyan-400 font-bold block mb-0.5">
                        Vertex AI Live Swarm Synthesis ({selectedStock.swarm_debate.model_used})
                      </span>
                      {selectedStock.swarm_debate.llm_swarm_synthesis}
                    </div>
                  )}

                  {/* 6 Panel Expert Voices */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedStock.swarm_debate.expert_voices.map((ev, idx) => (
                      <div key={idx} className="bg-[#0b101b] border border-slate-800 rounded p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                          <span className="text-amber-300 font-bold truncate">{ev.panel}</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 shrink-0">
                            {ev.score_focus}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-emerald-300 font-semibold">
                          {ev.expert}: {ev.stance}
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">{ev.argument}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#080c14] border border-rose-500/30 rounded p-3">
                <div className="font-mono text-[10px] uppercase text-rose-400 font-bold mb-1">
                  Kill Switch &amp; Bear-Case Risk ({selectedStock.bear_3y_moic ?? 1.0}x Bear MOIC)
                </div>
                <p className="text-slate-300">{selectedStock.invalidation_trigger}</p>
              </div>

              {/* Live DES <GO> Memo */}
              <div className="bg-[#080c14] border border-amber-500/30 rounded p-3 font-mono text-xs">
                <div className="text-[10px] uppercase text-amber-400 font-bold mb-1.5">
                  BLOOMBERG DES &lt;GO&gt; AI RESEARCH FLASH (PUBLIC INFO ONLY)
                </div>
                {deepDiveLoading ? (
                  <div className="text-slate-400 animate-pulse">Generating live research flash...</div>
                ) : deepDiveMemo ? (
                  <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {deepDiveMemo.replace(/\*\*/g, '')}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 font-mono text-xs">
              <button
                onClick={() => {
                  setDcfTicker(selectedStock.ticker);
                  setSelectedStock(null);
                  setActiveTab('screener');
                }}
                className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
              >
                Open in 3Y DCF Calculator
              </button>

              <div className="flex items-center gap-3">
                <a
                  href={selectedStock.yahoo_finance_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 flex items-center gap-1.5"
                >
                  <span>Yahoo Finance ({selectedStock.ticker})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={selectedStock.google_finance_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
                >
                  <span>Google Finance</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD / EDIT STOCK, POSITION & 12-EXPERT SWARM UNDERWRITING MODAL
      ===================================================================== */}
      {showAddStockModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add or Edit Stock & Convene 12-Expert Swarm"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddStockModal(false)}
        >
          <div
            className="bg-[#0b101b] border border-cyan-500/50 rounded-xl max-w-3xl w-full p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <h2 className="font-mono text-base font-bold text-white uppercase">
                    {isEditingExistingStock
                      ? `EDIT ${newStockTicker} POSITION, FUNDAMENTALS & SWARM UNDERWRITING`
                      : 'ADD ANY STOCK TICKER & CONVENE 12-EXPERT SWARM UNDERWRITING'}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Enter any global/US ticker, fetch live Yahoo Finance quotes &amp; fundamentals, configure your owned position ($) or watchlist status, and score through the 12-Expert Swarm.
                </p>
              </div>
              <button
                onClick={() => setShowAddStockModal(false)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick-Pick AI Supply Chain Presets */}
            <div>
              <div className="font-mono text-[10px] uppercase text-slate-400 mb-1.5">
                Quick-Pick Popular AI Supply-Chain Candidates (Or Type Any Custom Ticker Below):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'NVDA', 'TSM', 'ASML', 'AVGO', 'KLAC', 'LRCX', 'AMAT', 'SNPS',
                  'CDNS', 'ARM', 'INTC', 'CIFR', 'CORZ', 'IREN', 'CRWV', 'APH',
                  'ONTO', 'VRT', 'CRDO', 'COHR', 'LITE', 'MU', 'ANET', 'MOD'
                ].map(sym => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => applyCatalogPreset(sym)}
                    className={`px-2 py-0.5 rounded font-mono text-xs font-bold border transition ${
                      newStockTicker.toUpperCase() === sym
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-[#080c14] text-slate-300 border-slate-700 hover:border-cyan-400'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddAndUnderwriteStock} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    Ticker Symbol (Any Stock) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newStockTicker}
                      onChange={e => applyCatalogPreset(e.target.value)}
                      placeholder="e.g. ARM, CIFR, AAPL"
                      className="w-full bg-[#06090f] border border-slate-700 rounded px-2.5 py-1.5 font-mono text-sm font-bold text-amber-300 uppercase"
                    />
                    <button
                      type="button"
                      disabled={lookupLoading || !newStockTicker.trim()}
                      onClick={() => handleLookupLiveTicker()}
                      className="px-2.5 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-[10px] font-bold whitespace-nowrap disabled:opacity-40"
                      title="Fetch live Yahoo Finance quote, market cap & AI fundamental profile"
                    >
                      {lookupLoading ? 'Fetching...' : 'Live Lookup'}
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-8">
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    Company Name (Auto-Filled on Live Lookup)
                  </label>
                  <input
                    type="text"
                    value={newStockName}
                    onChange={e => setNewStockName(e.target.value)}
                    placeholder="e.g. Arm Holdings plc"
                    className="w-full bg-[#06090f] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* PORTFOLIO POSITION SIZING & OWNERSHIP CARD */}
              <div className="bg-[#080d18] border border-emerald-500/40 rounded-lg p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStockIsHolding}
                      onChange={e => {
                        const checked = e.target.checked;
                        setNewStockIsHolding(checked);
                        if (checked && (!newStockWeightUsd || Number(newStockWeightUsd) <= 0)) {
                          setNewStockWeightUsd('25000');
                        }
                      }}
                      className="accent-emerald-400 w-4 h-4"
                    />
                    <span>Own in My Portfolio (Include in Active Holdings &amp; Gross Long $)</span>
                  </label>
                  <span className="font-mono text-[10px] text-slate-400">
                    {newStockIsHolding ? 'Active Portfolio Position' : 'Watchlist / Screener Candidate ($0 Held)'}
                  </span>
                </div>

                {newStockIsHolding && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono pt-1">
                    <div>
                      <label className="block text-[10px] text-emerald-300 mb-1">
                        Position Value ($ USD) *
                      </label>
                      <input
                        type="number"
                        step="100"
                        value={newStockWeightUsd}
                        onChange={e => setNewStockWeightUsd(e.target.value)}
                        placeholder="e.g. 25000"
                        className="w-full bg-[#06090f] border border-emerald-500/50 rounded px-2 py-1 text-xs text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Account
                      </label>
                      <select
                        value={newStockAccount}
                        onChange={e => setNewStockAccount(e.target.value)}
                        className="w-full bg-[#06090f] border border-slate-700 rounded px-2 py-1 text-xs text-amber-300"
                      >
                        <option value="Roth_Schwab">Roth_Schwab (...0726)</option>
                        <option value="Margin_Fidelity_2854">Margin_Fidelity (...2854)</option>
                        <option value="Fidelity_Cash_5830">Fidelity_Cash (...5830)</option>
                        <option value="External_Brokerage">External_Brokerage</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Shares (Optional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newStockShares}
                        onChange={e => setNewStockShares(e.target.value)}
                        placeholder="Auto from $"
                        className="w-full bg-[#06090f] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Cost Basis ($ Total)
                      </label>
                      <input
                        type="number"
                        step="100"
                        value={newStockCostBasis}
                        onChange={e => setNewStockCostBasis(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-[#06090f] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    Why Owned or Why Not Included Status *
                  </label>
                  <select
                    value={newStockInclusionStatus}
                    onChange={e => setNewStockInclusionStatus(e.target.value)}
                    className="w-full bg-[#06090f] border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-emerald-300"
                  >
                    <option value="OWNED_IN_PORTFOLIO">OWNED — Core #1 Monopoly</option>
                    <option value="OWNED_DIVEST_UPGRADE">OWNED — Candidate to Divest / Upgrade</option>
                    <option value="OWNED_EXTERNAL_OR_PLANNED">OWNED — External Account / Planned Allocation</option>
                    <option value="NOT_INCLUDED_MISSING_MONOPOLY">NOT INCLUDED — Missing #1 Monopoly Buy Target</option>
                    <option value="NOT_INCLUDED_EXCLUDED_PEER">NOT INCLUDED — Excluded #2 Peer / Avoid Diworsification</option>
                    <option value="NOT_INCLUDED_SOLD_EXITED">SOLD &amp; EXITED — Proceeds Applied to Margin / Rotation</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    Supply-Chain Layer (L1–L7)
                  </label>
                  <select
                    value={newStockLayerId}
                    onChange={e => setNewStockLayerId(e.target.value)}
                    className="w-full bg-[#06090f] border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-sky-300"
                  >
                    <option value="L1">L1: Silicon Design, Custom XPUs &amp; EDA</option>
                    <option value="L2">L2: Leading-Edge Foundry &amp; EUV WFE Monopolies</option>
                    <option value="L3">L3: HBM4 Memory, 3D Packaging, Substrates &amp; Test</option>
                    <option value="L4">L4: Scale-Up Copper (AEC) &amp; 1.6T Optical Interconnects</option>
                    <option value="L5">L5: Gigawatt Power, Thermal &amp; Neocloud Shells</option>
                    <option value="L6">L6: Physical AI &amp; Humanoid Robotics Actuators</option>
                    <option value="L7">L7: Frontier AI Foundation Models &amp; Cloud Platforms</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    Place in End-to-End Supply Chain (#1–#7)
                  </label>
                  <select
                    value={newStockChainId}
                    onChange={e => setNewStockChainId(e.target.value)}
                    className="w-full bg-[#06090f] border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-cyan-300"
                  >
                    <option value="asml_euv">1. Shipping ASML EUV &amp; High-NA Equipment</option>
                    <option value="tsmc_cowos">2. Shipping TSMC 2nm (N2 GAA) &amp; CoWoS-L Chips</option>
                    <option value="hbm4_memory">3. SK Hynix / Micron HBM4 16-Hi Memory Stack</option>
                    <option value="gpu_tpu_cluster">4. Bringing Nvidia GPUs or Google TPUs to Cluster Scale</option>
                    <option value="datacenter_power">5. Building Datacenters with GW-Scale Power</option>
                    <option value="anthropic_serving">6. Serving Anthropic Frontier Models (Claude Token Factory)</option>
                    <option value="robotics_physical_ai">7. Physical AI &amp; Humanoid Robotics (Idiot-Index Audit)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    #1 Best-in-Class Benchmark Peer in This Node
                  </label>
                  <input
                    type="text"
                    value={newStockBestPeer}
                    onChange={e => setNewStockBestPeer(e.target.value)}
                    placeholder="e.g. NVDA, AVGO, CRDO, VRT, ASML"
                    className="w-full bg-[#06090f] border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-amber-300 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  Your Rationale (Why Owned or Why Not Included in Portfolio)
                </label>
                <textarea
                  rows={2}
                  value={newStockRationale}
                  onChange={e => setNewStockRationale(e.target.value)}
                  placeholder="Explain why this stock is owned or why it is not included..."
                  className="w-full bg-[#06090f] border border-slate-700 rounded p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Fundamental & Moat Inputs for Pure-Rubric Scoring */}
              <div className="bg-[#080c14] border border-slate-800 rounded p-3">
                <div className="font-mono text-[10px] uppercase text-amber-400 font-bold mb-2">
                  Price, Valuation &amp; Moat Inputs for v4.3 Pure-Rubric Scoring (Editable)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 font-mono">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newStockPrice}
                      onChange={e => setNewStockPrice(e.target.value)}
                      className="w-full bg-[#06090f] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Mkt Cap ($B)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newStockMktCapB}
                      onChange={e => setNewStockMktCapB(e.target.value)}
                      className="w-full bg-[#06090f] border border-slate-700 rounded px-2 py-1 text-xs text-amber-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Fwd P/E (x)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newStockFwdPe}
                      onChange={e => setNewStockFwdPe(e.target.value)}
                      placeholder="Blank = EV/MW"
                      className="w-full bg-[#06090f] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">3Y EPS CAGR (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newStockEpsCagr}
                      onChange={e => setNewStockEpsCagr(e.target.value)}
                      className="w-full bg-[#06090f] border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Gross Margin (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newStockGmPct}
                      onChange={e => setNewStockGmPct(e.target.value)}
                      className="w-full bg-[#06090f] border border-slate-700 rounded px-2 py-1 text-xs text-sky-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Moat Share (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={newStockSharePct}
                      onChange={e => setNewStockSharePct(e.target.value)}
                      className="w-full bg-[#06090f] border border-slate-700 rounded px-2 py-1 text-xs text-amber-300"
                    />
                  </div>
                </div>
              </div>

              {addStockError && (
                <div className="bg-rose-950/50 border border-rose-500/40 rounded p-2.5 text-xs font-mono text-rose-300">
                  {addStockError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 font-mono text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStockRunVertex}
                    onChange={e => setNewStockRunVertex(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span>Also invoke live Vertex AI Gemini Swarm synthesis</span>
                </label>

                <div className="flex items-center gap-2">
                  {isEditingExistingStock && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddStockModal(false);
                        handleRemoveStockFromUniverse(newStockTicker);
                      }}
                      className="px-3 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono text-xs font-bold"
                    >
                      Remove Ticker
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAddStockModal(false)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addStockSubmitting}
                    className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition shadow disabled:opacity-50"
                  >
                    {addStockSubmitting
                      ? 'SAVING & RUNNING 12-EXPERT SWARM...'
                      : isEditingExistingStock
                      ? 'SAVE CHANGES & RE-RUN 12-EXPERT SWARM'
                      : 'ADD TICKER & CONVENE 12-EXPERT SWARM'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
