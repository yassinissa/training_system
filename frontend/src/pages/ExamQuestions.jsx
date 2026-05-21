import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import { useToast } from '../hooks/useToast.jsx'

export default function ExamQuestions() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()

  const examId = Number(id)
  const [questions, setQuestions] = useState([])
  const [qForm, setQForm] = useState({ text: '', type: 'MCQ_SINGLE', order: 1, max_points: 1 })
  const [cForm, setCForm] = useState({ question: '', text: '', is_correct: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await api.get(`/training/questions/?exam=${examId}`)
      setQuestions(res.data || [])
    } catch (e) {
      setError(e?.response?.data || 'Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (examId) load() }, [examId])

  const addQuestion = async (e) => {
    e.preventDefault(); setError('')
    try {
      await api.post('/training/questions/', {
        exam: examId,
        text: qForm.text,
        type: qForm.type,
        order: Number(qForm.order) || 1,
        max_points: Number(qForm.max_points) || 1,
      })
      success('Question added')
      setQForm({ text: '', type: 'MCQ_SINGLE', order: 1, max_points: 1 })
      load()
    } catch (e) { setError(e?.response?.data || 'Failed to add question'); toastError('Failed to add question') }
  }

  const addChoice = async (e) => {
      // Delete a question
      const deleteQuestion = async (qid) => {
        if (!window.confirm('Delete this question and all its choices?')) return;
        setError('');
        setLoading(true);
        try {
          await api.delete(`/training/questions/${qid}/`);
          success('Question deleted');
          load();
        } catch (e) {
          setError(e?.response?.data || 'Failed to delete question');
          toastError('Failed to delete question');
        } finally {
          setLoading(false);
        }
      };

      // Delete a choice
      const deleteChoice = async (cid) => {
        if (!window.confirm('Delete this choice?')) return;
        setError('');
        setLoading(true);
        try {
          await api.delete(`/training/choices/${cid}/`);
          success('Choice deleted');
          load();
        } catch (e) {
          setError(e?.response?.data || 'Failed to delete choice');
          toastError('Failed to delete choice');
        } finally {
          setLoading(false);
        }
      };
    e.preventDefault(); setError('')
    try {
      await api.post('/training/choices/', {
        question: Number(cForm.question),
        text: cForm.text,
        is_correct: !!cForm.is_correct,
      })
      success('Choice added')
      setCForm({ question: '', text: '', is_correct: false })
      load()
    } catch (e) { setError(e?.response?.data || 'Failed to add choice'); toastError('Failed to add choice') }
  }

  return (
    <div className="container">
      <h1>Manage Questions</h1>
      {loading && <div className="card">Loading questions…</div>}
      {error && <div className="card"><div className="error">{String(error)}</div></div>}

      <div className="row" style={{alignItems:'flex-start', gap:20, flexWrap:'wrap'}}>
        <div className="card" style={{flex:1, minWidth:360}}>
          <h3>Add Question</h3>
          <form className="form" onSubmit={addQuestion}>
            <div className="field">
              <label>Question Text</label>
              <textarea value={qForm.text} onChange={(e)=> setQForm((f)=> ({...f, text: e.target.value}))} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={qForm.type} onChange={(e)=> setQForm((f)=> ({...f, type: e.target.value}))}>
                {['MCQ_SINGLE','MCQ_MULTI','TRUE_FALSE','SHORT_TEXT','LONG_TEXT'].map((t)=> <option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </select>
            </div>
            <div className="row">
              <input type="number" placeholder="Order" value={qForm.order} onChange={(e)=> setQForm((f)=> ({...f, order: e.target.value}))} />
              <input type="number" placeholder="Max Points" value={qForm.max_points} onChange={(e)=> setQForm((f)=> ({...f, max_points: e.target.value}))} />
            </div>
            <button className="btn primary">Add Question</button>
          </form>
        </div>

        <div className="card" style={{flex:1, minWidth:320}}>
          <h3>Add Choice</h3>
          <form className="form" onSubmit={addChoice}>
            <div className="field">
              <label>Question</label>
              <select value={cForm.question} onChange={(e)=> setCForm((f)=> ({...f, question: e.target.value}))}>
                <option value="">Select question</option>
                {questions.map((q)=> (<option key={q.id} value={q.id}>{q.order}. {q.text?.slice(0,60) || 'Untitled'}</option>))}
              </select>
            </div>
            <div className="field">
              <label>Choice Text</label>
              <input value={cForm.text} onChange={(e)=> setCForm((f)=> ({...f, text: e.target.value}))} />
            </div>
            <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
              <input type="checkbox" checked={!!cForm.is_correct} onChange={(e)=> setCForm((f)=> ({...f, is_correct: e.target.checked}))} /> Correct
            </label>
            <button className="btn primary">Add Choice</button>
          </form>
        </div>
      </div>

      <div className="spacer" />
      <h3>Questions</h3>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th>Order</th><th>Text</th><th>Type</th><th>Max Points</th><th>Choices</th></tr></thead>
          <tbody>
            {!loading && questions.length === 0 && (
              <tr><td colSpan={5} style={{opacity:0.7}}>No questions yet.</td></tr>
            )}
            {questions.map((q) => (
              <tr key={q.id}>
                <td>{q.order}</td>
                <td>{q.text}</td>
                <td>{q.type}</td>
                <td>{q.max_points}</td>
                <td>
                  {(q.choices || []).length ? (
                    <ul style={{margin:0, paddingLeft:18}}>
                      {q.choices.map((c)=> (
                        <li key={c.id}>
                          {c.text} {c.is_correct ? '(correct)' : ''}
                          <button type="button" className="btn danger small" style={{marginLeft:8}} onClick={()=>deleteChoice(c.id)}>Delete</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{opacity:0.6}}>—</span>
                  )}
                  <div style={{marginTop:8}}>
                    <button type="button" className="btn danger small" onClick={()=>deleteQuestion(q.id)}>Delete Question</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="spacer" />
      <div className="row" style={{gap:14, flexWrap:'wrap'}}>
        <Link className="btn" to="/manager">Back to Manager Dashboard</Link>
      </div>
    </div>
  )
}
