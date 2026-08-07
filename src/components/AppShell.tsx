import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-kicker">Policy decision simulator</p>
          <h1 className="app-title">Threat-Aware MFA</h1>
          <p className="app-tagline">
            Risk tells you how worried to be. Threat context tells you what not
            to trust.
          </p>
        </div>
        <div className="app-disclosure">
          <span className="disclosure-chip">Synthetic indicators</span>
          <span className="disclosure-chip">Deterministic demonstration policy</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
