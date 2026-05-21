import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api/client.js'

export default function EmployeeExamQuestions() {
  const { id } = useParams()
  const examId = Number(id)
  const [questions, setQuestions] = useState([])
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const examRes = await api.get(`/training/exams/${examId}/`)
        setExam(examRes.data)
        const qRes = await api.get(`/training/questions/?exam=${examId}`)
        setQuestions(qRes.data || [])
      } catch (e) {
        setError(e?.response?.data || 'Failed to load exam/questions')
      } finally {
        setLoading(false)
      }
    }
    if (examId) load()
  }, [examId])

  return (
    <div className="container py-5">
      <h1 className="mb-3 text-center text-primary fw-bold">Exam Questions</h1>
      {exam && <h2 className="mb-4 text-center">{exam.title}</h2>}
      {loading && <div className="card">Loading…</div>}
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
                        <li key={c.id}>{c.text} {c.is_correct ? '(correct)' : ''}</li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{opacity:0.6}}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
