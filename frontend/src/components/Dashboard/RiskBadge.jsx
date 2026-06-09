import React from "react";

export default function RiskBadge({ score, level }) {
  const badgeClass = `risk-badge risk-badge--${level}`; // normal, high, critical
  return <span className={badgeClass}>{score}</span>;
}