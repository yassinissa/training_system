import React from "react";

export default function AssessmentQuestionCard({ question, answer, onAnswer }) {
  return (
    <div style={{background:'#f8fafd',borderRadius:12,padding:20,marginBottom:18,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
      <div style={{fontWeight:600,fontSize:17,marginBottom:10}}>{question.order}. {question.text}</div>
      {question.type === "MCQ_SINGLE" && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {question.choices.map((choice) => (
            <label key={choice.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
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
      {question.type === "TRUE_FALSE" && (
        <div style={{display:'flex',gap:18}}>
          {["True","False"].map((val, idx) => (
            <label key={val} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
              <input
                type="radio"
                name={`q_${question.id}`}
                checked={answer === (idx === 0 ? question.choices[0]?.id : question.choices[1]?.id)}
                onChange={() => onAnswer(idx === 0 ? question.choices[0]?.id : question.choices[1]?.id)}
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
          onChange={e => onAnswer(e.target.value)}
          style={{width:'100%',padding:8,borderRadius:6,border:'1px solid #e3eafc'}}
        />
      )}
      {/* Add more types as needed */}
    </div>
  );
}
