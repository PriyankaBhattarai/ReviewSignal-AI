
import { useState } from 'react'
import './styles.css'

type ReviewIssue = {
  code?: string
  message?: string
  severity?: string
  line?: number
  column?: number
  end_location?: {
    row?: number
    column?: number
  }
  location?: {
    row?: number
    column?: number
  }
  url?: string
}

type ReviewResponse = {
  tool?: string
  lines_analyzed?: number
  issue_count?: number
  issues?: ReviewIssue[]
  quality_score?: number
  score_note?: string
}

function getFixSuggestion(issue: ReviewIssue): string {
  switch (issue.code) {
    case 'I001':
      return 'Sort and format imports consistently. Run: ruff check --select I --fix'
    case 'F401':
      return 'Remove the unused import, or use it if it is needed.'
    case 'F841':
      return 'Remove the unused local variable, or use its value.'
    case 'E501':
      return 'Shorten the line or split it into multiple lines.'
    case 'E711':
      return 'Use "is None" or "is not None" when checking against None.'
    case 'F821':
      return 'Check for a misspelled variable name or a missing definition.'
    default:
      return 'Review this finding and consult the Ruff rule documentation for a rule-specific fix.'
  }
}


function getSeverity(issue: ReviewIssue): string {
  const severity = issue.severity?.toLowerCase()

  if (severity === 'critical') return 'CRITICAL'
  if (severity === 'high') return 'HIGH'
  if (severity === 'medium') return 'MEDIUM'
  if (severity === 'low') return 'LOW'
  if (severity === 'info' || severity === 'informational') return 'INFO'

  const code = issue.code ?? ''

  if (
    code === 'invalid-syntax' ||
    /^(E[4-9]|F[0-9]|S[0-9]|B[0-9])/.test(code)
  ) {
    return 'HIGH'
  }

  if (/^(I|UP|SIM|C4)/.test(code)) {
    return 'LOW'
  }

  return 'MEDIUM'
}



export default function CodeReviewPanel() {
  const [code, setCode] = useState(
    'def add(a,b):\n    return a+b\n\nprint(add(2, 3))',
  )
  const [result, setResult] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function reviewCode() {
    if (!code.trim()) {
      setError('Paste some Python code before starting the review.')
      setResult(null)
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/code-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      const body = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof body.detail === 'string'
            ? body.detail
            : 'The code review request failed.',
        )
      }

      setResult(body as ReviewResponse)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to the backend.',
      )
    } finally {
      setLoading(false)
    }
  }

  const issueCount = result?.issue_count ?? 0
  const issues = result?.issues ?? []

  return (
    <section className="panel code-review-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">STATIC ANALYSIS</p>
          <h2>Code Review</h2>
        </div>
        <span className="top-pill">RUFF</span>
      </div>

      <p className="muted">
        Paste Python code to identify linting issues without executing it.
      </p>

      <label className="code-review-label" htmlFor="review-code">
        Python source code
      </label>

      <textarea
        id="review-code"
        className="code-review-editor"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="Paste your Python code here..."
        rows={12}
      />

      <div className="code-review-actions">
        <span className="muted">
          {code.split('\n').length} lines · {code.length} characters
        </span>
        <button
          type="button"
          className="primary-button"
          onClick={reviewCode}
          disabled={loading || !code.trim()}
        >
          {loading ? 'Reviewing...' : 'Run code review'}
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="code-review-results" aria-live="polite">
          <div className="metric-grid">
            <div className="metric">
              <small>Issues found</small>
              <strong>{issueCount}</strong>
            </div>
            <div className="metric">
              <small>Lines analyzed</small>
              <strong>{result.lines_analyzed ?? 0}</strong>
            </div>
            <div className="metric">
              <small>Heuristic score</small>
              <strong>{result.quality_score ?? 0}/100</strong>
            </div>
          </div>

          <h3>{result.tool || 'Code analysis'} findings</h3>

          {issueCount === 0 ? (
            <p className="muted">No issues were reported by the analyzer.</p>
          ) : (
            <ul className="code-review-issue-list">
              {issues.map((issue, index) => {
                const severity = getSeverity(issue)
                const lineNumber = issue.line ?? issue.location?.row ?? issue.end_location?.row

                return (
                  <li key={`${issue.code ?? 'issue'}-${index}`}>
                    <div>
                      <strong>{issue.code ?? 'Issue'}</strong>
                      {' — '}
                      {issue.message ?? 'No description provided.'}
                      {lineNumber != null && (
                        <span className="muted"> (Line {lineNumber})</span>
                      )}
                    </div>
                   
                    <div className={`severity-badge severity-${severity.toLowerCase()}`}>
                      Severity: {severity}
                    </div>
                    <div className="fix-suggestion">
                      <strong>Suggested fix:</strong>{' '}
                      {getFixSuggestion(issue)}
                    </div>
                  </li>
                )
              })}
            </ul>

          )}

          {result.score_note && <p className="muted">{result.score_note}</p>}

          <p className="muted">
            Static analysis is not a guarantee that code is correct or secure.
            Submitted code is not executed by this panel.
          </p>
        </div>
      )}
    </section>
  )
}
