import React from "react";

export default function SubmitButton({ onSubmit, disabled = false }) {
  return (
    <button
      className="btn-exam btn-exam--submit"
      onClick={onSubmit}
      disabled={disabled}
    >
      {disabled ? "Bitiriliyor..." : "Sınavı Bitir"}
    </button>
  );
}
