export default function DataState({ loading, error, isEmpty, emptyMessage = 'No data found.', children }) {
  if (loading) {
    return <div className="card">Loading…</div>
  }
  if (error) {
    return (
      <div className="card">
        <div className="error">{String(error)}</div>
      </div>
    )
  }
  if (isEmpty) {
    return (
      <div className="card">
        <div className="helper">{emptyMessage}</div>
      </div>
    )
  }
  return children
}
