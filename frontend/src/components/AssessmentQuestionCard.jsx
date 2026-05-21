import React from "react";

/**
 * Renders ONE exam question with its answer input.
 *
 * Mobile-first: MCQ + True/False options render as tappable "option cards"
 * with a min tap target of 44px, no overlapping labels, automatic wrapping
 * on narrow screens.
 */
export default function AssessmentQuestionCard({ question, answer, onAnswer }) {
  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid #c8d3e8',
    fontSize: 15,
    fontFamily: 'inherit',
    color: '#222',
    background: '#fff',
    outline: 'none',
  };

  // Pill-style option card used by MCQ + True/False.
  const optionStyle = (selected) => ({
    flex: '1 1 220px',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 12,
    border: selected ? '2px solid #1976d2' : '1.5px solid #d6dde8',
    background: selected ? '#e8f0fe' : '#ffffff',
    color: '#1a2236',
    fontSize: 15,
    fontWeight: selected ? 700 : 500,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s, transform 0.05s',
    boxShadow: selected ? '0 4px 12px -4px rgba(25, 118, 210, 0.35)' : 'none',
    minHeight: 52,
    wordBreak: 'break-word',
  });

  const radioDot = (selected) => ({
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: selected ? '6px solid #1976d2' : '2px solid #c8d3e8',
    background: '#fff',
    transition: 'border 0.15s',
  });

  const checkBox = (selected) => ({
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: 5,
    border: '2px solid ' + (selected ? '#1976d2' : '#c8d3e8'),
    background: selected ? '#1976d2' : '#fff',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 800,
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      background: '#f8fafd',
      borderRadius: 14,
      padding: 18,
      marginBottom: 18,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        fontWeight: 700,
        fontSize: 16,
        marginBottom: 14,
        color: '#0f1c34',
        lineHeight: 1.45,
        wordBreak: 'break-word',
      }}>
        {question.order}. {question.text}
      </div>

      {question.type === "MCQ_SINGLE" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(question.choices || []).map((choice) => {
            const selected = answer === choice.id;
            return (
              <label
                key={choice.id}
                style={optionStyle(selected)}
                onClick={() => onAnswer(choice.id)}
              >
                <span style={radioDot(selected)} />
                <span style={{ flex: 1 }}>{choice.text}</span>
                <input
                  type="radio"
                  name={`q_${question.id}`}
                  checked={selected}
                  onChange={() => onAnswer(choice.id)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
              </label>
            );
          })}
        </div>
      )}

      {question.type === "MCQ_MULTI" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>
            Select all that apply.
          </div>
          {(question.choices || []).map((choice) => {
            const selected = Array.isArray(answer) && answer.includes(choice.id);
            return (
              <label
                key={choice.id}
                style={optionStyle(selected)}
                onClick={(e) => {
                  // Only handle clicks on the label itself (not the hidden input)
                  if (e.target.tagName === 'INPUT') return;
                  const prev = Array.isArray(answer) ? answer : [];
                  if (selected) onAnswer(prev.filter((id) => id !== choice.id));
                  else onAnswer([...prev, choice.id]);
                }}
              >
                <span style={checkBox(selected)}>{selected ? '✓' : ''}</span>
                <span style={{ flex: 1 }}>{choice.text}</span>
                <input
                  type="checkbox"
                  checked={selected}
                  readOnly
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
              </label>
            );
          })}
        </div>
      )}

      {question.type === "TRUE_FALSE" && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {["True", "False"].map((label, idx) => {
            const choiceId = question.choices?.[idx]?.id;
            const selected = answer === choiceId;
            return (
              <label
                key={label}
                style={optionStyle(selected)}
                onClick={() => choiceId != null && onAnswer(choiceId)}
              >
                <span style={radioDot(selected)} />
                <span style={{ flex: 1, fontSize: 16 }}>{label}</span>
              </label>
            );
          })}
        </div>
      )}

      {question.type === "SHORT_TEXT" && (
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Your answer..."
          style={inputStyle}
        />
      )}

      {question.type === "LONG_TEXT" && (
        <textarea
          value={answer || ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Type your answer..."
          rows={5}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 110 }}
        />
      )}
    </div>
  );
}
