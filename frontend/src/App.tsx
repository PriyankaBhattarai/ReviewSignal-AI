import { useEffect, useMemo, useState } from 'react'
import CodeReviewPanel from './CodeReviewPanel'

type Metrics = {
  true_positives: number; false_positives: number; false_negatives: number; true_negatives: number
  precision: number; recall: number; f1: number; false_positive_rate: number
}
type ReviewerResult = {
  reviewer: string; available: boolean; note?: string | null
  findings: { sample_id: string; source: string; category: string; severity: string; message: string; line?: number | null }[]
  metrics: Metrics
}
type Experiment = {
  id: number; created_at: string; dataset_version: string; reviewers: string[]
  summary: { sample_count: number; dataset_name: string }; status: string
  results?: Record<string, ReviewerResult>
}
type Dataset = { name: string; version: string; description: string; samples: {id:string; title:string; expected_categories:string[]}[] }

const reviewerOptions = [
  { id: 'mock', label: 'Demo reviewer', detail: 'Deterministic offline example' },
  { id: 'ruff', label: 'Ruff', detail: 'Python linting rules (optional install)' },
  { id: 'bandit', label: 'Bandit', detail: 'Python security patterns (optional install)' },
  { id: 'llm', label: 'LLM reviewer', detail: 'Optional configured provider' },
]

function percent(value?: number) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [selected, setSelected] = useState<string[]>(['mock'])
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [history, setHistory] = useState<Experiment[]>([])
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadHistory() {
    try {
      const response = await fetch('/api/experiments')
      if (response.ok) setHistory(await response.json())
    } catch { /* API may not be running yet */ }
  }

  useEffect(() => {
    fetch('/api/dataset').then(r => r.json()).then(setDataset).catch(() => setError('Backend unavailable. Start FastAPI on port 8000.'))
    loadHistory()
  }, [])

  const availableResults = useMemo(
    () => Object.values(experiment?.results ?? {}).filter(result => result.available && result.metrics),
    [experiment]
  )

  async function runExperiment() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewers: selected }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Experiment failed.')
      setExperiment(body)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run experiment.')
    } finally { setBusy(false) }
  }

  async function openHistory(id: number) {
    try {
      const response = await fetch(`/api/experiments/${id}`)
      if (!response.ok) throw new Error('Could not load experiment.')
      setExperiment(await response.json())
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load experiment.') }
  }

  function toggleReviewer(id: string) {
    setSelected(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id])
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark">RS</div>
        <div className="brand-copy"><strong>ReviewSignal <span>AI</span></strong><small>CODE REVIEW RELIABILITY LAB</small></div>
        <div className="top-pill"><i /> Research MVP</div>
      </header>

      <section className="hero">
        <p className="eyebrow">MEASURE WHAT AI GETS RIGHT</p>
        <h1>Can you trust an<br /><em>AI code review?</em></h1>
        <p className="hero-copy">Run code-review methods against a controlled Python dataset. Compare detected issues with documented expected findings, then inspect precision, recall, and false alarms.</p>
        <div className="hero-tags"><span>Python</span><span>FastAPI</span><span>LLM evaluation</span><span>Reproducible experiments</span></div>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}

<section className="dashboard-kpis" aria-label="Evaluation summary">
  <Metric
    label="Mean precision"
    value={
      availableResults.length
        ? percent(
            availableResults.reduce(
              (sum, result) => sum + result.metrics.precision,
              0
            ) / availableResults.length
          )
        : '—'
    }
    hint="Current experiment"
  />

  <Metric
    label="Mean recall"
    value={
      availableResults.length
        ? percent(
            availableResults.reduce(
              (sum, result) => sum + result.metrics.recall,
              0
            ) / availableResults.length
          )
        : '—'
    }
    hint="Current experiment"
  />

  <Metric
    label="Mean F1 score"
    value={
      availableResults.length
        ? percent(
            availableResults.reduce(
              (sum, result) => sum + result.metrics.f1,
              0
            ) / availableResults.length
          )
        : '—'
    }
    hint="Current experiment"
  />

  <Metric
    label="Saved experiments"
    value={String(history.length)}
    hint="Loaded experiment records"
  />
</section>

      <section className="layout">
        <CodeReviewPanel />
        <aside className="panel setup-panel">
          <div className="section-head"><div><p className="eyebrow">EXPERIMENT SETUP</p><h2>Choose reviewers</h2></div><span className="step-number">01</span></div>
          <p className="muted">Run each selected method on the same versioned examples.</p>
          <div className="reviewer-list">
            {reviewerOptions.map(option => (
              <label className={`reviewer-option ${selected.includes(option.id) ? 'selected' : ''}`} key={option.id}>
                <input type="checkbox" checked={selected.includes(option.id)} onChange={() => toggleReviewer(option.id)} />
                <span className="checkmark">{selected.includes(option.id) ? '✓' : ''}</span>
                <span className="option-copy"><strong>{option.label}</strong><small>{option.detail}</small></span>
              </label>
            ))}
          </div>
          <button className="primary-button" disabled={busy || selected.length === 0} onClick={runExperiment}>
            {busy ? 'Running experiment…' : '▶  Run experiment'}
          </button>
          <p className="footnote">Submitted source is analyzed statically; the app does not execute the snippets.</p>
          <div className="dataset-box">
            <div className="dataset-icon">▤</div>
            <div><strong>{dataset?.name ?? 'Loading dataset…'}</strong><small>Version {dataset?.version ?? '—'} · {dataset?.samples.length ?? '—'} cases</small></div>
          </div>
        </aside>

        <section className="results-column">
          <div className="panel results-panel">
            <div className="section-head"><div><p className="eyebrow">EVALUATION OUTPUT</p><h2>{experiment ? `Experiment #${experiment.id}` : 'Your results will appear here'}</h2></div><span className="step-number">02</span></div>
            {!experiment && <div className="empty-state"><div className="empty-symbol">⌁</div><strong>No experiment selected</strong><p>Choose reviewers and run an experiment to see the first report.</p></div>}
            {experiment && <>
              <div className="result-meta"><span>{experiment.summary?.sample_count} samples</span><span>Dataset {experiment.dataset_version}</span><span>{experiment.status}</span></div>
              <div className="metric-grid">
                <Metric label="Reviewers available" value={`${availableResults.length}/${Object.keys(experiment.results ?? {}).length}`} hint="Configured and run" />
                <Metric label="Mean precision" value={availableResults.length ? percent(availableResults.reduce((a,r)=>a+r.metrics.precision,0)/availableResults.length) : '—'} hint="Across available reviewers" />
                <Metric label="Mean recall" value={availableResults.length ? percent(availableResults.reduce((a,r)=>a+r.metrics.recall,0)/availableResults.length) : '—'} hint="Across available reviewers" />
              </div>
              

<div className="comparison-panel">
                <div className="comparison-heading">
                  <div>
                    <p className="eyebrow">PERFORMANCE ANALYTICS</p>
                    <h3>Reviewer comparison</h3>
                    <p className="muted">
                      Compare precision, recall, and F1 for available reviewers.
                    </p>
                  </div>
                  <span className="comparison-unit">0–100%</span>
                </div>

                {availableResults.length === 0 ? (
                  <p className="muted">No reviewer metrics are available for comparison.</p>
                ) : (
                  <>
                    <div className="comparison-legend">
                      <span><i className="legend-precision" /> Precision</span>
                      <span><i className="legend-recall" /> Recall</span>
                      <span><i className="legend-f1" /> F1 score</span>
                    </div>
                    <div className="comparison-chart">
                      {availableResults.map((result) => (
                        <div className="comparison-reviewer" key={result.reviewer}>
                          <div className="comparison-reviewer-name">
                            <strong>{result.reviewer}</strong>
                          </div>
                          {([
                            { label: 'Precision', value: result.metrics.precision, className: 'precision' },
                            { label: 'Recall', value: result.metrics.recall, className: 'recall' },
                            { label: 'F1 score', value: result.metrics.f1, className: 'f1' },
                          ]).map((metric) => {
                            const score = Math.max(0, Math.min(100, metric.value * 100))
                            return (
                              <div className="comparison-row" key={metric.label}>
                                <span className="comparison-label">{metric.label}</span>
                                <div
                                  className="comparison-track"
                                  role="progressbar"
                                  aria-label={`${result.reviewer} ${metric.label}`}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={Number(score.toFixed(1))}
                                >
                                  <div
                                    className={`comparison-fill ${metric.className}`}
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                                <span className="comparison-value">{percent(metric.value)}</span>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                    <p className="comparison-footnote">
                      Scores reflect this experiment's dataset and evaluation rules.
                      They should not be interpreted as general performance guarantees.
                    </p>
                  </>
                )}
              </div>

              <div className="reviewer-results">
                {Object.values(experiment.results ?? {}).map(result => (
                  <article className="reviewer-result" key={result.reviewer}>
                    <div className="reviewer-result-head"><div><strong>{result.reviewer}</strong><small>{result.available ? 'Reviewer available' : 'Unavailable'}</small></div><span className={result.available ? 'status ok' : 'status warn'}>{result.available ? 'READY' : 'NOT CONFIGURED'}</span></div>
                    {result.available && result.metrics && <div className="metric-row">
                      <Metric label="Precision" value={percent(result.metrics.precision)} />
                      <Metric label="Recall" value={percent(result.metrics.recall)} />
                      <Metric label="F1" value={percent(result.metrics.f1)} />
                      <Metric label="False positives" value={String(result.metrics.false_positives)} />
                    </div>}
                    {result.note && <p className="note">{result.note}</p>}
                    {result.findings.length > 0 && <details><summary>Inspect {result.findings.length} findings</summary><div className="findings-list">{result.findings.slice(0, 20).map((finding, i) => <div className="finding" key={`${finding.sample_id}-${finding.category}-${i}`}><span className="category">{finding.category}</span><div><strong>{finding.sample_id}</strong><p>{finding.message}</p></div></div>)}</div></details>}
                  </article>
                ))}
              </div>
              <a className="export-link" href={`/api/experiments/${experiment.id}/export`} target="_blank" rel="noreferrer">Export experiment JSON ↗</a>
              <p className="footnote">Metrics apply only to this small dataset and its category-matching rules. They are not a general claim about AI reviewer accuracy.</p>
            </>}
          </div>
        </section>
      </section>

      
<section className="panel history-panel">
  <div className="section-head">
    <div>
      <p className="eyebrow">PAST RUNS</p>
      <h2>Experiment history</h2>
      <p className="muted">
        Revisit previous evaluations and compare their results.
      </p>
    </div>

    <span className="history-count">
      {history.length} runs
    </span>
  </div>

  {history.length === 0 ? (
    <div className="history-empty">
      <strong>No experiments yet</strong>
      <p>Your completed experiments will appear here.</p>
    </div>
  ) : (
    <>
      <div className="history-list">
        {(showAllHistory ? history : history.slice(0, 6)).map((item) => (
          <button
            key={item.id}
            className={`history-item ${
              experiment?.id === item.id ? 'active' : ''
            }`}
            onClick={() => openHistory(item.id)}
            aria-current={experiment?.id === item.id ? 'true' : undefined}
            title={`Open experiment #${item.id}`}
          >
            <span className="history-id">#{item.id}</span>

            <span className="history-main">
              <strong>
                {item.summary?.dataset_name ?? 'Experiment'}
              </strong>

              <small>
                {item.reviewers.join(', ') || 'No reviewers listed'}
              </small>

              <small>
                {new Date(item.created_at).toLocaleString()}
              </small>
            </span>

            <span
              className={`history-status ${
                item.status?.toLowerCase() === 'completed'
                  ? 'completed'
                  : 'other'
              }`}
            >
              {item.status ?? 'Unknown'}
            </span>

            <span className="history-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>

      {history.length > 6 && (
        <button
          type="button"
          className="history-toggle"
          onClick={() => setShowAllHistory((current) => !current)}
        >
          {showAllHistory
            ? 'Show recent experiments ↑'
            : `View all ${history.length} experiments →`}
        </button>
      )}
    </>
  )}
</section>

      <footer><span>ReviewSignal AI</span><span>Built to evaluate evidence, not replace human judgment.</span></footer>
    </main>
  )
}

function Metric({ label, value, hint }: {label: string; value: string; hint?: string}) {
  return <div className="metric"><small>{label}</small><strong>{value}</strong>{hint && <span>{hint}</span>}</div>
}
