import React from "react";

export default function QuestionCard({ question, selectedOption, onOptionSelect, disabled = false }) {
  if (!question) return null;

  return (
    <div className="question-card">
      <p className="question-text">{question.text || question.content}</p>
      <div className="options-list">
        {(question.options || []).map((opt, i) => {
          const optionText = typeof opt === "string" ? opt : opt?.text || opt?.label || String(opt?.value ?? "");
          return (
          <label key={i} className="option-item">
            <input 
              type="radio" 
              name={`q_${question._id}`} 
              className="option-radio" 
              checked={selectedOption === i}
              onChange={() => onOptionSelect(i)}
              disabled={disabled}
            />
            <span className="option-text">{optionText}</span>
          </label>
          );
        })}
      </div>
    </div>
  );
}
