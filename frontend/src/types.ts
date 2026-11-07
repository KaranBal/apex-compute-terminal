export interface RecentNewsItem {
  title: string;
  publisher: string;
  published: string;
  link: string;
}

export interface DataQualityInfo {
  complete: boolean;
  missing_fields: string[];
  overridden_fields?: string[];
  override_source?: string | null;
  override_as_of?: string | null;
  override_expiry?: string | null;
  valuation_basis: string;
  cycle_warning?: string | null;
  underlying_currency?: string;
}

export interface SwarmExpertVoice {
  panel: string;
  expert: string;
  stance: string;
  score_focus: string;
  argument: string;
}

export interface SwarmSupplyChainPlacement {
  layer_id: string;
  layer_name: string;
  chain_id: string;
  chain_title: string;
  node_id: string;
  node_title: string;
  best_in_class_peer: string;
}

export interface SwarmDebateResult {
  generated_at: string;
  model_used: string;
  ticker: string;
  bottleneck_score: number;
  score_breakdown_label: string;
  inclusion_status: string;
  inclusion_badge: string;
  consensus_verdict: string;
  why_owned_or_excluded_summary: string;
  user_rationale?: string;
  llm_swarm_synthesis?: string;
  supply_chain_placement: SwarmSupplyChainPlacement;
  expert_voices: SwarmExpertVoice[];
}

export interface StockItem {
  ticker: string;
  name: string;
  sleeve_id: 1 | 2 | 3;
  sleeve_label: string;
  layer_id: string;
  layer_name: string;
  is_holding: boolean;
  owned?: boolean;
  is_custom_stock?: boolean;
  inclusion_status?: string;
  inclusion_badge?: string;
  ownership_rationale?: string;
  user_custom_rationale?: string;
  swarm_debate?: SwarmDebateResult;
  account: string;
  shares?: number;
  cost_basis_usd?: number;
  gain_loss_usd?: number;
  gain_loss_pct?: number;
  unrealized_pl?: number | null;
  unrealized_pl_pct?: number | null;
  portfolio_usd: number;
  portfolio_weight_pct: number;
  account_weight_pct: number;
  price: number;
  change_pct: number;
  market_cap_b: number;
  mkt_cap_usd_b?: number;
  fwd_pe: number | null;
  peg: number | null;
  rev_cagr_3y_pct: number | null;
  eps_cagr_3y_pct: number | null;
  eps_3y_cagr?: number | null;
  gross_margin_pct: number | null;
  gm_pct?: number | null;
  monopoly_share_pct: number;
  exit_pe_base: number | null;
  exit_pe_bull: number | null;
  bear_3y_moic?: number;
  moic_3y_bear?: number;
  moic_3y_base: number;
  moic_3y_bull: number;
  expected_3y_moic?: number;
  scenario_probabilities?: {
    bear: number;
    base: number;
    bull: number;
  };
  implied_cagr_3y_base_pct: number;
  implied_3y_mcap_base_b: number;
  rating: string;
  rating_score: number;
  bottleneck_score?: number;
  score_rank?: number;
  score_universe_count?: number;
  score_percentile?: number;
  ai_criticality_score?: number;
  tech_moat_score?: number;
  return_torque_score?: number;
  bottleneck_rank_label?: string;
  policy_decision?: string;
  no_diworsification_verdict?: string;
  quality_gate_passed?: boolean;
  quality_tier?: string;
  quality_note?: string;
  compliance_restricted?: boolean;
  compliance_label?: string | null;
  us_line?: 'NYSE' | 'Nasdaq' | 'OTC ADR' | 'OTC ordinary' | string;
  liquidity_tier?: string;
  liquidity_note?: string;
  median_daily_volume_usd?: number;
  zero_volume_days_65d?: number;
  traded_days_65d?: number;
  price_as_of?: string;
  sparkline_20d?: number[];
  underlying_currency?: string;
  data_quality?: DataQualityInfo;
  dma50?: number;
  dma200?: number;
  high_52w?: number;
  low_52w?: number;
  above_50dma?: boolean;
  above_200dma?: boolean;
  home_exchange: string;
  us_exchange: string;
  google_finance_url: string;
  yahoo_finance_url: string;
  news_search_url: string;
  adr_premium_bps: number;
  is_adr: boolean;
  choke_point: string;
  thesis: string;
  lead_indicator: string;
  invalidation_trigger: string;
  expert_champion: string;
  expert_quote: string;
  dip_rule?: string;
  breakout_rule?: string;
  kill_rule?: string;
  suppliers?: string[];
  customers?: string[];
  rivals?: string[];
  recent_news?: RecentNewsItem[];
  // Triage fields
  triage_bucket: 'DIVEST_TRIM' | 'MISSING_MONOPOLY' | 'CORE_KEEP' | 'WATCH_AVOID';
  triage_badge: string;
  triage_priority: number;
  is_critical_chokepoint: boolean;
  is_best_in_class: boolean;
  best_in_class_ticker: string;
  why_action: string;
  recommended_swap: string;
  // Investment Committee (multi-persona swarm) policy verdict — separate from the rubric score
  committee_verdict?: CommitteeVerdict;
}

export interface CommitteeVerdict {
  action: 'KEEP' | 'ADD' | 'TRIM' | 'SELL' | 'BUY' | 'WATCH' | 'AVOID' | 'HOLD' | string;
  conviction?: number;
  sleeve?: string;
  rationale?: string;
  kill_trigger?: string;
  votes?: Record<string, string>;
  committee_id?: string;
  as_of?: string;
}

export interface CommitteePersona {
  id: string;
  name: string;
  lens: string;
}

export interface CommitteeVoteRow {
  ticker: string;
  action: string;
  conviction?: number;
  votes?: Record<string, string>;
  rationale?: string;
}

export interface CommitteeAddition {
  rank: number;
  ticker: string;
  name?: string;
  market_cap_b?: number;
  fwd_pe?: number;
  votes?: string;
  rationale?: string;
  size_usd?: number;
  account?: string;
}

export interface CommitteeQuestion {
  id: string;
  title: string;
  owner_question: string;
  answer_headline: string;
  consensus: string;
  verdicts?: CommitteeVoteRow[];
  additions?: CommitteeAddition[];
  rejected?: { ticker: string; reason: string }[];
  notes?: string[];
}

export interface CommitteeTrade {
  account: string;
  ticker: string;
  action: string;
  amount_usd: number;
  live_position_usd?: number;
  rationale?: string;
  timing?: string;
  full_exit?: boolean;
}

export interface InvestmentCommittee {
  committee_id: string;
  as_of: string;
  prices_as_of?: string;
  title: string;
  disclaimer?: string;
  mandate?: string[];
  process_note?: string;
  personas: CommitteePersona[];
  questions: CommitteeQuestion[];
  trades: CommitteeTrade[];
  account_cash_flows?: Record<string, { sources_usd: number; uses_usd: number; net_cash_usd: number }>;
  post_trade_book?: {
    positions: { ticker: string; usd: number; weight_pct: number }[];
    names_count: number;
    residual_cash_usd: number;
    total_usd: number;
    max_weight_pct: number;
  };
  kill_triggers?: { ticker: string; trigger: string }[];
  calendar?: { date: string; event: string }[];
  dissents?: { persona: string; note: string }[];
  watchlist?: { ticker: string; trigger: string }[];
  vetoes?: { ticker: string; reason: string }[];
  per_ticker?: Record<string, CommitteeVerdict>;
  holdings_without_verdict?: string[];
  followups?: CommitteeFollowup[];
  revision_note?: string;
}

export interface CommitteeFollowup {
  id: string;
  asked_at?: string;
  proposal: string;
  outcome: 'APPROVED' | 'REJECTED' | 'PARTIAL' | 'NONE_YET' | string;
  verdict: string;
  summary: string;
  votes: { persona: string; vote: string; conviction?: number; reason: string }[];
  tallies?: { ticker: string; tally: string; action: string; size_usd?: number; note?: string }[];
}

export interface DailyAiFindings {
  generated_at: string;
  snapshot_id?: string;
  model: string;
  algorithm_version: string;
  compliance_guardrail?: string;
  gross_equities_usd: number;
  net_nav_usd: number;
  margin_debit_usd: number;
  headline_summary: string;
  concentration_convictions: string[];
  divest_and_upgrade_actions: string[];
  missing_monopoly_alerts: string[];
  bear_case_premortem?: string;
}

export interface SupplyChainTickerMini {
  ticker: string;
  name: string;
  is_holding: boolean;
  portfolio_usd: number;
  account: string;
  fwd_pe: number | null;
  peg: number | null;
  eps_cagr_3y_pct: number | null;
  gross_margin_pct: number | null;
  moic_3y_base: number;
  monopoly_share_pct: number;
  triage_bucket: string;
  triage_badge: string;
  google_finance_url: string;
}

export interface SupplyChainNode {
  node_id: string;
  step: string;
  title: string;
  physics_chokepoint: string;
  private_or_foreign_note: string;
  monopoly_type: string;
  best_in_class_tickers: string[];
  owned_tickers: string[];
  missing_tickers: string[];
  divest_tickers: string[];
  node_status: 'OWNED_OPTIMAL' | 'MISSING_OPPORTUNITY' | 'DIVEST_AND_SWAP';
  action_verdict: string;
  best_in_class_details: SupplyChainTickerMini[];
  owned_details: SupplyChainTickerMini[];
  missing_details: SupplyChainTickerMini[];
  divest_details: SupplyChainTickerMini[];
}

export interface SupplyChainDiagram {
  chain_id: string;
  chain_number: number;
  title: string;
  short_title: string;
  subtitle: string;
  theme_color: string;
  ownership_score_label: string;
  ownership_status: string;
  executive_summary: string;
  nodes: SupplyChainNode[];
}

export interface RotationTradeStep {
  step: number;
  account: string;
  sell_ticker: string;
  sell_name: string;
  sell_usd: number;
  sell_reason: string;
  buy_ticker: string;
  buy_name: string;
  buy_usd: number;
  buy_reason: string;
}

export interface SwarmThesisEvaluation {
  thesis_id: string;
  question_number: number;
  title: string;
  user_thesis_summary: string;
  swarm_verdict_badge: string;
  verdict_color: 'emerald' | 'amber' | 'rose' | 'cyan' | string;
  executive_answer: string;
  physical_and_financial_findings: string[];
  comparison_table?: {
    headers: string[];
    rows: string[][];
  };
  recommended_trades: string[];
}

export interface PortfolioTriageSummary {
  freed_taxable_usd: number;
  freed_roth_usd: number;
  total_rotatable_usd: number;
  core_keep_usd?: number;
  core_keep_pct?: number;
  divest_upgrade_usd?: number;
  divest_pct?: number;
  divest_count: number;
  missing_count: number;
  keep_count: number;
  divest_candidates: StockItem[];
  missing_monopolies: StockItem[];
  core_keeps: StockItem[];
  rotation_trades: RotationTradeStep[];
  swarm_thesis_evaluations?: SwarmThesisEvaluation[];
}

export interface SupplyChainLayer {
  layer_id: string;
  layer_name: string;
  subtitle: string;
  bottleneck_severity: number;
  lead_time_months: number;
  pricing_power: string;
  primary_choke_point: string;
  quarterly_signal: string;
  signal_status: string;
  upstream_dependencies: string[];
  downstream_dependents: string[];
  tickers: string[];
}

export interface ExpertMember {
  id: string;
  name?: string;
  role: string;
  organization_lens: string;
  synthetic_persona_disclaimer?: string;
  avatar_code: string;
  color: string;
  core_mandate: string;
  top_picks: string[];
  headline_verdict: string;
  detailed_thesis: string;
  key_metric_watched: string;
}

export interface Sleeve3Contender {
  sector_id: string;
  rank: number;
  sector_name: string;
  timeline_window: string;
  hynix_parallel_score: number;
  verdict_badge: string;
  bottleneck_physics: string;
  supply_deficit_duration: string;
  gross_margin_trajectory: string;
  idiot_index_risk: string;
  top_candidates: {
    ticker: string;
    name: string;
    role: string;
    fwd_pe: number | null;
    peg: number | null;
    moic_3y: number;
  }[];
  panel_takeaway: string;
}

export interface RoboticsIdiotIndex {
  target_unit_bom_2026_usd: number;
  target_mass_production_bom_2030_usd: number;
  summary: string;
  subsystems: {
    subsystem: string;
    bom_share_pct: number;
    current_cost_usd: number;
    raw_material_floor_usd: number;
    idiot_index_ratio: number;
    compression_risk: string;
    key_suppliers: string;
    verdict: string;
  }[];
}

export interface AnthropicIpoModel {
  company: string;
  status: string;
  est_ipo_window: string;
  current_arr_run_rate_b: number;
  projected_ipo_ntm_arr_b: number;
  gross_margin_steady_state_pct: number;
  fcf_margin_steady_state_pct: number;
  s1_checklist: string[];
}

export interface CircuitBreaker {
  id: string;
  name: string;
  metric: string;
  current_value: string;
  warning_threshold: string;
  action_threshold: string;
  status: string;
  automated_action: string;
}

export interface PortfolioCapRule {
  rule_id: string;
  name: string;
  current_pct: number;
  cap_pct: number;
  status: string;
  detail: string;
}

export interface CatalystEvent {
  date: string;
  ticker: string;
  event: string;
  category: string;
  key_watch_metric: string;
  impact_level: string;
}

export interface MaterialNewsItem {
  ticker: string;
  title: string;
  publisher: string;
  published: string;
  link: string;
  sleeve_id: number;
}

export interface PortfolioRiskAndTaxReport {
  correlation_and_concentration: {
    total_positions: number;
    hhi_index: number;
    effective_n_by_weight: number;
    assumed_pairwise_correlation: number;
    effective_independent_bets: number;
    semis_and_semicap_weight_pct: number;
    summary: string;
  };
  currency_and_otc_exposure: {
    non_usd_market_value_usd: number;
    non_usd_pct_of_gross: number;
    otc_adr_market_value_usd: number;
    otc_adr_pct_of_gross: number;
    otc_ordinary_market_value_usd?: number;
    otc_ordinary_pct_of_gross?: number;
    total_otc_market_value_usd?: number;
    total_otc_pct_of_gross?: number;
    currencies: {
      currency: string;
      label: string;
      market_value_usd: number;
      pct_of_gross: number;
      tickers: string[];
    }[];
    otc_adr_positions: {
      ticker: string;
      name: string;
      us_line?: string;
      market_value_usd: number;
      pct_of_gross: number;
      home_ticker: string;
      home_exchange: string;
      underlying_currency: string;
      adr_ratio: string;
      est_spread_bps: number;
      order_execution_rule: string;
    }[];
    otc_ordinary_positions?: {
      ticker: string;
      name: string;
      us_line?: string;
      market_value_usd: number;
      pct_of_gross: number;
      home_ticker: string;
      home_exchange: string;
      underlying_currency: string;
      adr_ratio: string;
      est_spread_bps: number;
      order_execution_rule: string;
    }[];
  };
  margin_and_financing: {
    account: string;
    account_equities_usd: number;
    margin_debit_usd: number;
    debt_to_account_mv_pct: number;
    debt_to_total_nav_pct: number;
    hard_policy_cap_pct: number;
    account_mv_at_30pct_cap_usd: number;
    drop_to_breach_30pct_cap_pct: number;
    fidelity_margin_apr_pct: number;
    annual_margin_interest_usd: number;
    spx_box_spread_apr_pct: number;
    annual_box_spread_interest_usd: number;
    annual_interest_savings_via_retire_or_box_usd: number;
    maintenance_tiers: {
      maintenance_requirement_pct: number;
      label: string;
      margin_call_account_mv_usd: number;
      account_decline_to_trigger_pct: number;
    }[];
    stress_scenarios: {
      scenario: string;
      sox_shock_pct: number;
      usd_jpy_shock: string;
      gross_equities_loss_usd: number;
      ending_net_nav_usd: number;
      net_nav_drawdown_pct: number;
      brokerage_family_debt_to_mv_pct: number;
      status: string;
    }[];
  };
  tax_and_wash_sale_engine: {
    brokerage_family_divest_gains_usd: number;
    unpaired_st_tax_35_1pct_usd: number;
    unpaired_st_tax_50_3pct_usd: number;
    brokerage_family_harvestable_losses_usd: number;
    net_taxable_gain_after_pairing_usd: number;
    paired_st_tax_35_1pct_usd: number;
    tax_saved_by_loss_pairing_usd: number;
    recommendation_priority: string;
    harvestable_lots_brokerage_family: {
      ticker: string;
      market_value: number;
      cost_basis: number;
      unrealized_pl: number;
      held_in_roth_ira: boolean;
      wash_sale_risk: string;
    }[];
    all_account_lots: {
      account: string;
      taxable: boolean;
      ticker: string;
      market_value: number;
      cost_basis: number;
      unrealized_pl: number;
      holding_period: string;
      triage_bucket: string;
    }[];
    roth_ira_wash_sale_tickers: string[];
  };
}

export interface ResearchIntelligenceItem {
  source_id: string;
  source_name: string;
  category: string;
  title: string;
  published: string;
  link: string;
  summary: string;
  related_tickers: string[];
  impact_type: string;
  severity: string;
  portfolio_action: string;
}

export interface MaAndCorporateActionAlert {
  date: string;
  event_id: string;
  acquirer_ticker: string;
  target_ticker: string;
  deal_value_usd_b: number;
  structure: string;
  status: string;
  headline: string;
  portfolio_status_acquirer: string;
  portfolio_status_target: string;
  swarm_verdict: string;
  sources: { publisher: string; link: string }[];
}

export interface EarningsAndGuidanceReviewItem {
  date: string;
  ticker: string;
  name: string;
  quarter: string;
  is_holding: boolean;
  portfolio_usd: number;
  headline: string;
  revenue_actual: string;
  eps_actual: string;
  forward_guidance: string;
  swarm_action: string;
  link: string;
}

export interface ExecutiveIntelligenceDigestItem {
  ticker: string;
  title: string;
  publisher: string;
  published: string;
  link: string;
  impact_tag: string;
  materiality_score: number;
  summary_note?: string;
}

export interface LiveIntelligenceReview {
  generated_at: string;
  as_of_date: string;
  review_version: string;
  sources_polled: {
    id: string;
    name: string;
    category: string;
    homepage: string;
    status: string;
  }[];
  ma_and_corporate_action_alerts: MaAndCorporateActionAlert[];
  earnings_and_guidance_reviews: EarningsAndGuidanceReviewItem[];
  semianalysis_and_specialist_research: ResearchIntelligenceItem[];
  executive_intelligence_digest: ExecutiveIntelligenceDigestItem[];
  tickers_with_fresh_news_count: number;
}

export interface NextWaveBottleneckCard {
  ticker: string;
  name: string;
  market_cap_label: string;
  market_cap_b?: number;
  role_tag: string;
  is_holding: boolean;
  portfolio_usd: number;
  us_price: number;
  change_1d_pct: number;
  bottleneck_score: number;
  verdict: string;
  fwd_pe: number | null;
  peg: number | null;
  gross_margin_pct: number | null;
  eps_cagr_3y_pct: number | null;
  moic_3y_base: number;
  moic_3y_bull: number;
  monopoly_share_pct: number;
  why_10x_hook: string;
  source_url?: string;
  source_date?: string;
  inflection_evidence?: string;
  kill_trigger?: string;
  compliance_pre_clear?: boolean;
}

export interface NextWaveBottleneckPillar {
  pillar_id: string;
  title: string;
  shortage_driver: string;
  theme_color: string;
  small_mid_cap_champions: NextWaveBottleneckCard[];
  mega_cap_anchors: NextWaveBottleneckCard[];
}

export interface NextWaveBottleneckRadar {
  headline: string;
  subheadline: string;
  small_mid_cap_max_mkt_cap_b?: number;
  top_small_mid_cap_picks: string[];
  newly_added_tickers: string[];
  pillars: NextWaveBottleneckPillar[];
  local_market_watchlist?: {
    local_ticker: string;
    name: string;
    exchange: string;
    market_cap_label: string;
    chokepoint_role: string;
    why_not_in_us_screener: string;
    source_url: string;
    source_date: string;
    kill_trigger: string;
  }[];
}

export interface SwarmAnalysisStockRow {
  ticker: string;
  name: string;
  layer: string;
  is_holding: boolean;
  current_usd: number;
  us_price?: number | null;
  mkt_cap_usd_b?: number | null;
  fwd_pe?: number | null;
  peg?: number | null;
  gm_pct?: number | null;
  monopoly_share_pct?: number | null;
  bottleneck_score?: number | null;
  quality_tier?: string;
  quality_gate_passed?: boolean | null;
  bear_3y_moic?: number | null;
  base_3y_moic?: number | null;
  bull_3y_moic?: number | null;
  expected_3y_moic?: number | null;
  consensus_verdict?: string;
  rationale?: string;
  swarm_action: string;
}

export interface SwarmPortfolioAnalysisReport {
  analysis_id: string;
  analyzed_at: string;
  scope: string;
  mandate: string;
  ticker_count: number;
  holdings_count: number;
  total_current_usd: number;
  target_capital_usd: number;
  portfolio_health_score: number;
  weighted_expected_3y_moic: number;
  quality_gate_pass_rate_pct: number;
  executive_synthesis: string;
  strong_buys_and_adds: SwarmAnalysisStockRow[];
  core_holds: SwarmAnalysisStockRow[];
  trim_or_divest: SwarmAnalysisStockRow[];
  recommended_allocations: {
    ticker: string;
    name: string;
    layer: string;
    bottleneck_score?: number | null;
    swarm_action: string;
    current_usd: number;
    target_usd: number;
    target_weight_pct: number;
    delta_usd: number;
    expected_3y_moic?: number | null;
  }[];
  panel_consensus_matrix: {
    panel_id: string;
    panel_name: string;
    lead_persona: string;
    top_pick: string;
    verdict: string;
  }[];
  supply_chain_coverage: {
    layer_id: string;
    layer_name: string;
    stock_count: number;
    tickers: string[];
    top_ticker?: string | null;
    top_score?: number | null;
    status: string;
    benchmark_monopoly: string;
  }[];
}

export interface SwarmDiscoveryPick {
  rank: number;
  ticker: string;
  name: string;
  us_exchange: string;
  layer_id: string;
  layer: string;
  is_currently_held: boolean;
  us_price?: number | null;
  mkt_cap_usd_b?: number | null;
  fwd_pe?: number | null;
  peg?: number | null;
  eps_3y_cagr?: number | null;
  rev_3y_cagr?: number | null;
  gm_pct?: number | null;
  opm_pct?: number | null;
  monopoly_share_pct?: number | null;
  bottleneck_score?: number | null;
  ai_criticality_score?: number | null;
  tech_moat_score?: number | null;
  return_torque_score?: number | null;
  discovery_conviction_score?: number | null;
  quality_tier?: string;
  quality_gate_passed?: boolean | null;
  bear_3y_moic?: number | null;
  base_3y_moic?: number | null;
  bull_3y_moic?: number | null;
  expected_3y_moic?: number | null;
  recommended_weight_pct: number;
  recommended_allocation_usd: number;
  estimated_shares?: number | null;
  why_selected: string;
  kill_switch_trigger: string;
  supply_chain_placement?: SwarmSupplyChainPlacement;
  swarm_debate?: SwarmDebateResult;
  headline?: string;
  why_number_one_over_alternatives?: string;
  unanimous_panel_vote?: string;
}

export interface SwarmDiscoveryResult {
  discovery_id: string;
  discovered_at: string;
  thesis_or_mandate: string;
  filters_applied: {
    max_market_cap_usd_b?: number | null;
    min_monopoly_share_pct: number;
    focus_layers: string[];
    top_n: number;
    capital_usd: number;
    exclude_currently_held: boolean;
  };
  matched_themes: string[];
  discovery_sources_used: string[];
  candidates_audited_count: number;
  qualified_count: number;
  best_investment_spotlight?: SwarmDiscoveryPick | null;
  discovered_picks: SwarmDiscoveryPick[];
  panel_discovery_roundtable: {
    panel: string;
    lead: string;
    selected_ticker: string;
    rationale: string;
  }[];
  rejected_or_runner_up_candidates: {
    ticker: string;
    name: string;
    mkt_cap_usd_b?: number | null;
    bottleneck_score?: number | null;
    rejection_reason: string;
  }[];
  apply_mode: string;
  applied_tickers: string[];
}

export interface TerminalPayload {
  snapshot_id?: string;
  investment_committee?: InvestmentCommittee;
  live_intelligence_review?: LiveIntelligenceReview;
  next_wave_bottleneck_radar?: NextWaveBottleneckRadar;
  last_swarm_portfolio_analysis?: SwarmPortfolioAnalysisReport | null;
  last_swarm_discovery?: SwarmDiscoveryResult | null;
  removed_tickers?: string[];
  meta: {
    app_name: string;
    terminal_code: string;
    snapshot_id?: string;
    generated_at: string;
    digest_date: string;
    gcp_project: string;
    google_finance_account: string;
    google_finance_synced: boolean;
    compliance_guardrail?: string;
    total_portfolio_usd: number;
    gross_equities_usd?: number;
    net_nav_usd?: number;
    margin_debit_usd?: number;
    cash_usd?: number;
    holdings_count: number;
    universe_count: number;
    default_gemini_model?: string;
    available_gemini_models?: string[];
    daily_refresh_schedule?: string;
  };
  portfolio_summary: {
    total_usd: number;
    gross_equities_usd?: number;
    net_nav_usd?: number;
    margin_debit_usd?: number;
    cash_usd?: number;
    accounts: Record<string, { usd: number; net_usd?: number; pct: number }>;
    sleeves: {
      sleeve_id: number;
      name: string;
      short_name: string;
      target_return: string;
      portfolio_usd: number;
      portfolio_pct: number;
      description: string;
    }[];
  };
  stocks: StockItem[];
  portfolio_triage: PortfolioTriageSummary;
  portfolio_risk_and_tax?: PortfolioRiskAndTaxReport;
  daily_ai_findings?: DailyAiFindings;
  seven_supply_chains: SupplyChainDiagram[];
  supply_chain_layers: SupplyChainLayer[];
  expert_panel: ExpertMember[];
  sleeve3_contenders: Sleeve3Contender[];
  robotics_idiot_index: RoboticsIdiotIndex;
  anthropic_ipo_model: AnthropicIpoModel;
  circuit_breakers: CircuitBreaker[];
  portfolio_caps: PortfolioCapRule[];
  catalyst_calendar: CatalystEvent[];
  top_material_news: MaterialNewsItem[];
  biggest_rating_change: {
    ticker: string;
    name: string;
    old_score: number;
    new_score: number;
    delta: number;
    rating: string;
    catalyst: string;
  };
  strong_buy_spotlight: {
    ticker: string;
    name: string;
    score: number;
    rating: string;
    catalyst: string;
  };
}

