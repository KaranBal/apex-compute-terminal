import React, { useMemo, useState } from 'react';
import { Scale, Users, ArrowDownRight, ArrowUpRight, AlertTriangle, CalendarDays, Eye, Ban, MessageSquareWarning, Vote } from 'lucide-react';
import { InvestmentCommittee, CommitteeQuestion, CommitteeFollowup, StockItem } from './types';

const ACTION_STYLES: Record<string, string> = {
  SELL: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  TRIM: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  KEEP: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  HOLD: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  ADD: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  BUY: 'bg-amber-500/25 text-amber-200 border-amber-400/50',
  WATCH: 'bg-slate-700/60 text-slate-300 border-slate-600',
  AVOID: 'bg-slate-800 text-slate-400 border-slate-700',
};

const ACCOUNT_LABELS: Record<string, string> = {
  Brokerage_Family: 'Brokerage (taxable …2854)',
  Roth_Schwab: 'Schwab Roth (…0726)',
  Roth_Fidelity: 'Fidelity Roth (…5830)',
};

export const ActionPill: React.FC<{ action?: string; conviction?: number; compact?: boolean }> = ({ action, conviction, compact }) => {
  if (!action) return <span className="text-slate-500">—</span>;
  const key = action.toUpperCase();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-mono font-bold ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'} ${
        ACTION_STYLES[key] || ACTION_STYLES.WATCH
      }`}
    >
      {key}
      {conviction !== undefined && conviction !== null && <span className="font-normal opacity-80">· {conviction}/10</span>}
    </span>
  );
};

const usd = (v?: number) => (v === undefined || v === null ? '—' : `$${Math.round(v).toLocaleString()}`);
const fmtCap = (b?: number) => (b === undefined || b === null || !b ? '' : b >= 1000 ? `$${(b / 1000).toFixed(2)}T` : `$${b}B`);

const OUTCOME_STYLES: Record<string, string> = {
  APPROVED: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200',
  PARTIAL: 'border-amber-500/40 bg-amber-950/30 text-amber-200',
  REJECTED: 'border-rose-500/40 bg-rose-950/30 text-rose-200',
  NONE_YET: 'border-slate-600 bg-slate-900/60 text-slate-200',
  OPTIONAL: 'border-sky-500/40 bg-sky-950/30 text-sky-200',
};

type ReconRow = {
  ticker: string;
  score: number;
  rating: string;
  action: string;
  conviction?: number;
  rationale: string;
  kind: string;
};

// Where the committee's decision departs from the app's 0-100 bottleneck rubric (rubric buy >= 76, trim < 62).
const buildReconciliation = (stocks: StockItem[]): ReconRow[] => {
  const rows: ReconRow[] = [];
  stocks.forEach(s => {
    const v = s.committee_verdict;
    const score = s.rating_score ?? s.bottleneck_score;
    if (!v || score === undefined || score === null) return;
    const act = String(v.action || '').toUpperCase();
    const rubricTrim = s.rating.includes('TRIM') || score < 62;
    const rubricBuy = !rubricTrim && score >= 76;
    let kind = '';
    if (['BUY', 'ADD'].includes(act) && !rubricBuy) kind = 'Buys below the rubric bar';
    else if (['SELL', 'TRIM'].includes(act) && rubricBuy) kind = 'Sells a rubric buy';
    else if (['HOLD', 'KEEP'].includes(act) && rubricTrim) kind = 'Holds a rubric trim';
    else if (['WATCH', 'AVOID'].includes(act) && rubricBuy) kind = 'Waits on a rubric buy';
    if (kind) rows.push({ ticker: s.ticker, score, rating: s.rating, action: act, conviction: v.conviction, rationale: v.rationale, kind });
  });
  const order = ['Buys below the rubric bar', 'Holds a rubric trim', 'Sells a rubric buy', 'Waits on a rubric buy'];
  return rows.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.score - a.score);
};

const FollowupCard: React.FC<{ f: CommitteeFollowup; onOpenTicker: (t: string) => void }> = ({ f, onOpenTicker }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#0c121d] border border-slate-800 rounded-lg p-4 flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] font-mono uppercase tracking-wide text-sky-300">Owner proposal{f.asked_at ? ` · ${f.asked_at}` : ''}</div>
        <div className="text-sm font-semibold text-slate-100 leading-snug">{f.proposal}</div>
        <span className={`self-start max-w-full text-[11px] font-mono font-bold px-2 py-0.5 rounded border leading-relaxed ${OUTCOME_STYLES[f.outcome] || OUTCOME_STYLES.NONE_YET}`}>
          {f.verdict}
        </span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{f.summary}</p>
      {f.tallies && f.tallies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {f.tallies.map(t => (
            <button
              key={t.ticker}
              onClick={() => onOpenTicker(t.ticker)}
              title={t.note || ''}
              className="text-left rounded border border-slate-700 bg-slate-900/70 hover:border-amber-400/60 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-amber-300 text-xs">{t.ticker}</span>
                <ActionPill action={t.action} compact />
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                {t.tally}
                {t.size_usd ? ` · ${usd(t.size_usd)}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} className="self-start text-[10px] font-mono text-sky-300 hover:text-sky-200 underline">
        {open ? 'Hide persona votes' : `Show ${f.votes.length} persona votes`}
      </button>
      {open && (
        <ul className="space-y-1.5">
          {f.votes.map((v, i) => (
            <li key={i} className="text-xs text-slate-300 leading-relaxed">
              <span className="font-mono text-slate-100">{v.persona}</span>{' '}
              <span className="font-mono text-amber-200">
                {v.vote}
                {v.conviction !== undefined ? ` (${v.conviction}/10)` : ''}
              </span>{' '}
              — {v.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const QuestionCard: React.FC<{ q: CommitteeQuestion; personaNames: Record<string, string>; onOpenTicker: (t: string) => void }> = ({
  q,
  personaNames,
  onOpenTicker,
}) => {
  const [showVotes, setShowVotes] = useState(false);
  const personaIds = useMemo(() => {
    const ids = new Set<string>();
    (q.verdicts || []).forEach(v => Object.keys(v.votes || {}).forEach(k => ids.add(k)));
    return Array.from(ids);
  }, [q]);

  return (
    <div className="bg-[#0c121d] border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-wide text-amber-400">{q.title}</div>
        <p className="mt-1 text-xs text-slate-400 italic leading-relaxed">&ldquo;{q.owner_question}&rdquo;</p>
      </div>
      <div className="rounded border border-emerald-500/30 bg-emerald-950/30 px-3 py-2">
        <div className="text-sm font-semibold text-emerald-200">{q.answer_headline}</div>
        <p className="mt-1 text-xs text-slate-300 leading-relaxed">{q.consensus}</p>
      </div>

      {q.additions && q.additions.length > 0 && (
        <div>
          <div className="text-[11px] font-mono text-slate-400 mb-1.5">Recommended additions</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {q.additions.map(a => (
              <button
                key={a.ticker}
                onClick={() => onOpenTicker(a.ticker)}
                className="text-left rounded border border-amber-500/30 bg-amber-950/20 hover:border-amber-400/60 px-3 py-2 transition"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <span className="font-mono font-bold text-amber-300 whitespace-nowrap">
                    #{a.rank} {a.ticker}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {[fmtCap(a.market_cap_b), a.fwd_pe ? `${a.fwd_pe}x fwd` : '', a.votes || ''].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {a.name && <div className="text-[11px] text-slate-400">{a.name}</div>}
                {a.rationale && <p className="mt-1 text-xs text-slate-300 leading-relaxed">{a.rationale}</p>}
                {a.size_usd ? (
                  <div className="mt-1 text-[10px] font-mono text-amber-200">
                    Size {usd(a.size_usd)} {a.account ? `· ${ACCOUNT_LABELS[a.account] || a.account}` : ''}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {q.verdicts && q.verdicts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-slate-400">Verdict by name</span>
            {personaIds.length > 0 && (
              <button onClick={() => setShowVotes(v => !v)} className="text-[10px] font-mono text-sky-300 hover:text-sky-200 underline">
                {showVotes ? 'Hide persona votes' : 'Show persona votes'}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <tbody className="divide-y divide-slate-800/70">
                {q.verdicts.map(v => (
                  <tr key={v.ticker} className="align-top">
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      <button onClick={() => onOpenTicker(v.ticker)} className="font-bold text-amber-300 hover:underline">
                        {v.ticker}
                      </button>
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      <ActionPill action={v.action} conviction={v.conviction} compact />
                    </td>
                    <td className="py-1.5 font-sans text-slate-300 leading-relaxed">
                      {v.rationale}
                      {showVotes && v.votes && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(v.votes).map(([pid, vote]) => (
                            <span key={pid} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                              {personaNames[pid] || pid}: <span className="text-slate-200">{vote}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {q.rejected && q.rejected.length > 0 && (
        <div>
          <div className="text-[11px] font-mono text-slate-400 mb-1">Considered and rejected</div>
          <ul className="space-y-1">
            {q.rejected.map(r => (
              <li key={r.ticker} className="text-xs text-slate-400">
                <span className="font-mono font-bold text-slate-300">{r.ticker}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {q.notes && q.notes.length > 0 && (
        <ul className="list-disc pl-4 space-y-1">
          {q.notes.map((n, i) => (
            <li key={i} className="text-xs text-slate-400 leading-relaxed">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CommitteeTab: React.FC<{ committee: InvestmentCommittee; stocks: StockItem[]; onOpenTicker: (t: string) => void }> = ({
  committee,
  stocks,
  onOpenTicker,
}) => {
  const personaNames = useMemo(() => {
    const m: Record<string, string> = {};
    committee.personas.forEach(p => (m[p.id] = p.name));
    return m;
  }, [committee]);

  const tradesByAccount = useMemo(() => {
    const m: Record<string, typeof committee.trades> = {};
    committee.trades.forEach(t => {
      (m[t.account] = m[t.account] || []).push(t);
    });
    return m;
  }, [committee]);

  const stockNames = useMemo(() => {
    const m: Record<string, string> = {};
    stocks.forEach(s => (m[s.ticker] = s.name));
    return m;
  }, [stocks]);

  const reconRows = useMemo(() => buildReconciliation(stocks), [stocks]);

  const book = committee.post_trade_book;
  const maxW = Math.max(1, ...(book?.positions || []).map(p => p.weight_pct));

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="bg-[#0c121d] border border-amber-500/40 rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-sm font-bold text-amber-300 flex items-center gap-2">
              <Scale className="w-4 h-4" />
              {committee.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Session {committee.committee_id} · {committee.as_of} · prices {committee.prices_as_of || committee.as_of}
            </p>
            {committee.process_note && <p className="text-xs text-slate-300 mt-2 max-w-4xl leading-relaxed">{committee.process_note}</p>}
          </div>
          <div className="text-[11px] font-mono px-2 py-1 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 max-w-xs">
            {committee.disclaimer || 'Not financial advice. Public information only.'}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {committee.personas.map(p => (
            <span key={p.id} title={p.lens} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1">
              <Users className="w-3 h-3 text-sky-400" />
              {p.name}
            </span>
          ))}
        </div>
        {committee.mandate && committee.mandate.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
            {committee.mandate.map((m, i) => (
              <li key={i} className="text-xs text-slate-400">
                • {m}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* OWNER FOLLOW-UP BALLOTS (latest re-votes) */}
      {committee.followups && committee.followups.length > 0 && (
        <div className="bg-[#0b101b] border border-sky-500/30 rounded-lg p-4">
          <h3 className="font-mono text-sm font-bold text-sky-200 flex items-center gap-2">
            <Vote className="w-4 h-4" /> Follow-up ballot: your proposals, re-voted by the committee
          </h3>
          {committee.revision_note && <p className="text-xs text-slate-400 mt-0.5">{committee.revision_note}</p>}
          <div className="mt-3 grid grid-cols-1 xl:grid-cols-3 gap-3">
            {committee.followups.map(f => (
              <FollowupCard key={f.id} f={f} onOpenTicker={onOpenTicker} />
            ))}
          </div>
        </div>
      )}

      {/* RUBRIC vs COMMITTEE RECONCILIATION */}
      {reconRows.length > 0 && (
        <div className="bg-[#0b101b] border border-violet-500/30 rounded-lg p-4">
          <h3 className="font-mono text-sm font-bold text-violet-200">Where the committee and the rubric disagree</h3>
          <p className="text-xs text-slate-400 mt-0.5 max-w-5xl leading-relaxed">
            The 0-100 rubric scores chokepoint structure and valuation from sourced inputs (buy at 76+, trim below 62). The
            committee also weighs growth evidence, earnings quality, liquidity and catalysts. These are the names where the two
            disagree, with the committee&apos;s reason.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-wide text-slate-500 border-b border-slate-800">
                  <th className="py-1.5 pr-3">Ticker</th>
                  <th className="py-1.5 pr-3">Rubric</th>
                  <th className="py-1.5 pr-3">Committee</th>
                  <th className="py-1.5 pr-3">Gap</th>
                  <th className="py-1.5">Why the committee differs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {reconRows.map(r => (
                  <tr key={r.ticker} className="align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      <button onClick={() => onOpenTicker(r.ticker)} className="font-mono font-bold text-amber-300 hover:underline">
                        {r.ticker}
                      </button>
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap font-mono text-slate-300">
                      <span className="text-white font-bold">{r.score}</span> <span className="text-[10px] text-slate-400">{r.rating}</span>
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      <ActionPill action={r.action} conviction={r.conviction} compact />
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-[11px] font-mono text-violet-200">{r.kind}</td>
                    <td className="py-1.5 text-slate-300 leading-relaxed">{r.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECOMMENDED CHANGES */}
      <div className="bg-[#0b101b] border border-slate-800 rounded-lg p-4">
        <h3 className="font-mono text-sm font-bold text-white">Recommended changes (priced at live holdings)</h3>
        <p className="text-xs text-slate-400 mt-0.5">Each account funds its own buys; full exits use the live position value.</p>
        <div className="mt-3 grid grid-cols-1 xl:grid-cols-3 gap-3">
          {Object.entries(tradesByAccount).map(([acct, trades]) => {
            const flow = committee.account_cash_flows?.[acct];
            return (
              <div key={acct} className="rounded-lg border border-slate-800 bg-[#0c121d] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="font-mono text-xs font-bold text-slate-200 whitespace-nowrap">{ACCOUNT_LABELS[acct] || acct}</span>
                  {flow && (
                    <span className="text-[10px] font-mono text-slate-400">
                      sells {usd(flow.sources_usd)} · buys {usd(flow.uses_usd)} ·{' '}
                      <span className={flow.net_cash_usd >= 0 ? 'text-emerald-300' : 'text-rose-300'}>net {usd(flow.net_cash_usd)}</span>
                    </span>
                  )}
                </div>
                <ul className="mt-2 space-y-2">
                  {trades.map((t, i) => (
                    <li key={`${t.ticker}-${i}`} className="flex items-start gap-2">
                      {['SELL', 'TRIM'].includes(t.action) ? (
                        <ArrowDownRight className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ActionPill action={t.action} compact />
                          <button onClick={() => onOpenTicker(t.ticker)} className="font-mono font-bold text-amber-300 hover:underline">
                            {t.ticker}
                          </button>
                          <span className="font-mono text-xs text-white">{usd(t.amount_usd)}</span>
                          {stockNames[t.ticker] && <span className="text-[10px] text-slate-500 truncate">{stockNames[t.ticker]}</span>}
                        </div>
                        {t.rationale && <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{t.rationale}</p>}
                        {t.timing && <p className="text-[10px] font-mono text-sky-300 mt-0.5">{t.timing}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOUR QUESTIONS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {committee.questions.map(q => (
          <QuestionCard key={q.id} q={q} personaNames={personaNames} onOpenTicker={onOpenTicker} />
        ))}
      </div>

      {/* POST-TRADE BOOK + RISK */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {book && (
          <div className="bg-[#0c121d] border border-slate-800 rounded-lg p-4 xl:col-span-1">
            <h3 className="font-mono text-sm font-bold text-white">Book after the plan</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {book.names_count} names · top weight {book.max_weight_pct.toFixed(1)}% · residual cash {usd(book.residual_cash_usd)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">At the app&apos;s current prices; press Refresh for live quotes.</p>
            <div className="mt-3 space-y-1.5">
              {book.positions.map(p => (
                <button key={p.ticker} onClick={() => onOpenTicker(p.ticker)} className="w-full flex items-center gap-2 text-left group">
                  <span className="w-14 font-mono text-xs font-bold text-amber-300 group-hover:underline">{p.ticker}</span>
                  <span className="flex-1 h-2 bg-slate-800 rounded overflow-hidden">
                    <span className="block h-full bg-emerald-400/80" style={{ width: `${(p.weight_pct / maxW) * 100}%` }} />
                  </span>
                  <span className="w-12 text-right font-mono text-[11px] text-slate-300">{p.weight_pct.toFixed(1)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#0c121d] border border-rose-500/30 rounded-lg p-4 xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {committee.kill_triggers && committee.kill_triggers.length > 0 && (
            <div>
              <h3 className="font-mono text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Kill triggers
              </h3>
              <ul className="mt-2 space-y-1.5">
                {committee.kill_triggers.map(k => (
                  <li key={k.ticker} className="text-xs text-slate-300">
                    <span className="font-mono font-bold text-amber-300">{k.ticker}</span> — {k.trigger}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {committee.calendar && committee.calendar.length > 0 && (
            <div>
              <h3 className="font-mono text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Catalyst calendar
              </h3>
              <ul className="mt-2 space-y-1.5">
                {committee.calendar.map((c, i) => (
                  <li key={i} className="text-xs text-slate-300">
                    <span className="font-mono text-sky-200">{c.date}</span> — {c.event}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {committee.watchlist && committee.watchlist.length > 0 && (
            <div>
              <h3 className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Watchlist (trigger → action)
              </h3>
              <ul className="mt-2 space-y-1.5">
                {committee.watchlist.map(w => (
                  <li key={w.ticker} className="text-xs text-slate-400">
                    <span className="font-mono font-bold text-slate-200">{w.ticker}</span> — {w.trigger}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {committee.vetoes && committee.vetoes.length > 0 && (
            <div>
              <h3 className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" /> Vetoed
              </h3>
              <ul className="mt-2 space-y-1.5">
                {committee.vetoes.map(v => (
                  <li key={v.ticker} className="text-xs text-slate-400">
                    <span className="font-mono font-bold text-slate-300">{v.ticker}</span> — {v.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {committee.dissents && committee.dissents.length > 0 && (
            <div className="md:col-span-2">
              <h3 className="font-mono text-xs font-bold text-orange-300 flex items-center gap-1.5">
                <MessageSquareWarning className="w-3.5 h-3.5" /> Recorded dissents
              </h3>
              <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                {committee.dissents.map((d, i) => (
                  <li key={i} className="text-xs text-slate-400">
                    <span className="font-mono text-slate-200">{d.persona}:</span> {d.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommitteeTab;
