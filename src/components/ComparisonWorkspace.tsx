import type { ReactNode } from "react";

interface ComparisonWorkspaceProps {
  children: ReactNode[];
}

export function ComparisonWorkspace({ children }: ComparisonWorkspaceProps) {
  return (
    <div className="comparison-workspace">
      {children.map((panel, index) => (
        <div className="comparison-column" key={index}>
          {panel}
        </div>
      ))}
    </div>
  );
}
