interface EvidenceListProps {
  evidence: string[];
  primary?: string;
}

export function EvidenceList({ evidence, primary }: EvidenceListProps) {
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
        <li
          key={item}
          className={`evidence-chip${item === primary ? " is-primary" : ""}`}
        >
          <span className="evidence-chip-dot" aria-hidden="true" />
          {item}
          {item === primary && (
            <span className="evidence-primary-tag">drives hypothesis</span>
          )}
        </li>
      ))}
    </ul>
  );
}
