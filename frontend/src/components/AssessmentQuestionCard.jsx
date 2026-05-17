import React from "react";

export default function AssessmentQuestionCard({ question, answer, onAnswer }) {
  const inputStyle = {
    width: '100%',
    padding: 10,
    borderRadius: 6,
    border: '1px solid #c8d3e8',
    fontSize: 15,
    fontFamily: 'inherit',
    color: '#222',
    background: '#fff',
  };

  return (
    <div style={{ background:'#f8fafd', borderRadius:12, padding:20, marginBottom:18, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ fontWeight:600, fontSize:17, marginBottom:10 }}>
        {question.order}. {question.text}
      </div>

      {question.type === "MCQ_SINGLE" && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {(question.choices || []).map((choice) => (
            <label key={choice.id} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input
                type="radio"
                name={`q_${question.id}`}
                checked={answer === choice.id}
                onChange={() => onAnswer(choice.id)}
              />
              {choice.text}
            </label>
          ))}
        </div>
      )}

      {question.type === "MCQ_MULTI" && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:13, color:'#666', marginBottom:4 }}>
            Select all that apply.
          </div>
          {(question.choices || []).map((choice) => {
            const selected = Array.isArray(answer) && answer.includes(choice.id);
            return (
              <label key={choice.id} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <input
                  type="checkbox"
                  name={`q_${question.id}_${choice.id}`}
                  checked={selected}
                  onChange={(e) => {
                    const prev = Array.isArray(answer) ? answer : [];
                    if (e.target.checked) {
                      onAnswer([...prev, choice.id]);
                    } else {
                      onAnswer(prev.filter((id) => id !== choice.id));
                    }
                  }}
                />
                {choice.text}
              </label>
            );
          })}
        </div>
      )}

      {question.type === "TRUE_FALSE" && (
        <div style={{ display:'flex', gap:18 }}>
          {["True","False"].map((val, idx) => (
            <label key={val} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input
                type="radio"
                name={`q_${question.id}`}
                checked={answer === (idx === 0 ? question.choices?.[0]?.id : question.choices?.[1]?.id)}
                onChange={() => onAnswer(idx === 0 ? question.choices?.[0]?.id : question.choices?.[1]?.id)}
              />
              {val}
            </label>
          ))}
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
          style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
        />
      )}
    </div>
  );
}
