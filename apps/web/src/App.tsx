/**
 * Web client shell — Phase 0.
 *
 * This shell deliberately contains NO decision logic. The frontend submits
 * transactions to the backend and renders whatever the API returns
 * (docs/EXECUTION.md PART 3 contract rule: the frontend never calculates
 * risk, threat, or factor eligibility). The full client — transaction form,
 * decision visualization, audit timeline, hero comparison — is rebuilt in
 * Phase 5 against the live API.
 */
export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Threat-Aware MFA Decision Service</h1>
        <p>
          Most risk systems decide how much authentication is required. This
          service also decides which authentication factors should not be
          trusted for the suspected attack path.
        </p>
      </header>
      <main className="app-main">
        <section className="shell-status">
          <h2>Backend-first prototype in progress</h2>
          <p>
            The transaction form, decision visualization, and audit timeline
            land in Phase 5. The API contract is frozen in{" "}
            <code>packages/contracts</code> and documented in{" "}
            <code>docs/API.md</code>.
          </p>
          <p>
            API status: <code>GET /health</code> → proxied to the API during
            dev.
          </p>
        </section>
      </main>
    </div>
  );
}
