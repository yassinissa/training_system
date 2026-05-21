import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client.js'

/**
 * Employee-side exam review page. Mobile-friendly.
 */
export default function ExamReviewPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    api.get(`/training/exam/sessions/${sessionId}/`)
      .then((res) => { if (live) setSession(res.data) })
      .catch((e) => {
        if (!live) return
        const status = e?.response?.status
        setError(
          status === 404
            ? 'This exam session was not found.'
            : 'Failed to load the exam review.'
        )
      })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [sessionId])

  if (loading) return <div className="card" style={{ margin: 24, padding: 20 }}>Loading review…</div>
  if (error)   return <div className="card" style={{ margin: 24, padding: 20, color: '#c62828' }}>{error}</div>
  if (!session) return null

  const pct = session.max_score
    ? Math.round((Number(session.score || 0) / Number(session.max_score)) * 100)
    : 0
  const passed = pct >= 60
  const verdict = session.status === 'GRADED'
    ? (passed ? 'PASSED' : 'FAILED')
    : session.status

  const fmtChoiceSelected = (answer, choiceId) =>
    (answer.selected_choices || []).some((c) => (c.id ?? c) === choiceId)

  return (
    <div className="container" style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, wordBreak: 'break-word', flex: '1 1 200px', minWidth: 0 }}>
          {session.exam?.title || 'Exam Review'}
        </h2>
        <button className="btn" onClick={() => navigate(-1)}>Back</button>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span className="pill">Status: {session.status}</span>
          <span className="pill" style={{ color: passed ? '#7be1a1' : '#ffb4b4' }}>Result: {verdict}</span>
          {session.status === 'GRADED' && (
            <span className="pill">Score: {Number(session.score || 0)} / {Number(session.max_score || 0)} ({pct}%)</span>
          )}
          {session.submitted_at && (
            <span style={{ color: '#999', fontSize: 13, wordBreak: 'break-word' }}>
              Submitted: {new Date(session.submitted_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {(session.answers || []).map((a, idx) => {
        const q = a.question || {}
        const choices = q.choices || []
        const isTextQ = q.type === 'SHORT_TEXT' || q.type === 'LONG_TEXT'
        return (
          <div key={a.id} className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 16, flex: '1 1 200px', minWidth: 0, wordBreak: 'break-word' }}>
                Q{idx + 1}. {q.text}
              </div>
              <div style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#1976d2' }}>
                {a.points_awarded != null ? a.points_awarded : '—'} / {q.max_points ?? '?'}
              </div>
            </div>

            {!isTextQ && choices.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {choices.map((c) => {
                  const selected = fmtChoiceSelected(a, c.id)
                  const correct = !!c.is_correct
                  const bg = correct
                    ? 'rgba(46, 125, 50, 0.12)'
                    : (selected ? 'rgba(198, 40, 40, 0.10)' : 'transparent')
                  const border = correct
                    ? '1px solid rgba(46, 125, 50, 0.5)'
                    : (selected ? '1px solid rgba(198, 40, 40, 0.5)' : '1px solid rgba(255,255,255,0.06)')
                  return (
                    <div key={c.id} style={{
                      padding: '10px 12px', borderRadius: 8, background: bg, border,
                      display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
                      gap: 8, alignItems: 'center',
                    }}>
                      <span style={{ flex: '1 1 60%', minWidth: 0, wordBreak: 'break-word' }}>
                        {c.text}
                      </span>
                      {(selected || correct) && (
                        <span style={{ fontSize: 12, color: '#9aa6b2', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {selected && (correct ? 'your answer ✓' : 'your answer ✗')}
                          {!selected && correct && 'correct answer'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {isTextQ && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>Your answer</div>
                <div style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: 'rgba(255,255,255,0.04)',
                  padding: 10, borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.06)',
                  minHeight: 30,
                }}>
                  {a.text_answer || <span style={{ color: '#888' }}>(no answer)</span>}
                </div>
              </div>
            )}

            {a.manager_comment && (
              <div style={{
                marginTop: 12, padding: 10, borderRadius: 8,
                background: 'rgba(255, 193, 7, 0.10)',
                border: '1px solid rgba(255, 193, 7, 0.35)',
              }}>
                <div style={{ fontSize: 12, color: '#c79a00', fontWeight: 700, marginBottom: 4 }}>
                  Manager comment
                </div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.manager_comment}</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
