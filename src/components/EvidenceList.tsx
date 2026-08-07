interface EvidenceListProps {
  evidence: string[];
}

export function EvidenceList({ evidence }: EvidenceListProps) {
  if (evidence.length === 0) {
    return (
      <p className="evidence-empty">
        No supported indicators observed in this scenario.
      </p>
    );
  }

  return (
    <ul className="evidence-list">
      {evidence.map((item) => (
        <li key={item} className="evidence-chip">
          <span className="evidence-chip-dot" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}
