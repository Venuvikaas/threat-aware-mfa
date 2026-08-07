import { useEffect, useMemo, useState } from "react";
import { evaluateScenario } from "./engine/evaluateScenario";
import { scalarBaseline } from "./engine/scalarBaseline";
import { demoPolicy } from "./policy/demoPolicy";
import { simSwapScenario } from "./scenarios/simSwap";
import { phishingScenario } from "./scenarios/phishing";
import { AppShell } from "./components/AppShell";
import { SharedRiskHeader } from "./components/SharedRiskHeader";
import { BaselineCard } from "./components/BaselineCard";
import { ComparisonWorkspace } from "./components/ComparisonWorkspace";
import { ScenarioPanel } from "./components/ScenarioPanel";
import { CapabilityToggle } from "./components/CapabilityToggle";
import { DecisionExport } from "./components/DecisionExport";
import "./styles/tokens.css";
import "./styles/app.css";

interface Capabilities {
  passkeyEnrolled: boolean;
}

const DEFAULT_CAPABILITIES: Capabilities = { passkeyEnrolled: true };
const scenarios = [simSwapScenario, phishingScenario];
const scenarioIds = ["sim-swap", "phishing"] as const;

function App() {
  const [capabilities, setCapabilities] = useState<Record<string, Capabilities>>(
    () =>
      Object.fromEntries(
        scenarioIds.map((id) => [id, { ...DEFAULT_CAPABILITIES }])
      )
  );

  const baseline = useMemo(
    () =>
      scalarBaseline({
        aggregateRisk: simSwapScenario.aggregateRisk,
        requiredAssurance: simSwapScenario.requiredAssurance,
      }),
    []
  );

  function scenarioFor(id: (typeof scenarioIds)[number]) {
    const base = id === "sim-swap" ? simSwapScenario : phishingScenario;
    return { ...base, capabilities: capabilities[id] };
  }

  const simDecision = useMemo(
    () => evaluateScenario(scenarioFor("sim-swap"), demoPolicy),
    [capabilities]
  );

  const phishingDecision = useMemo(
    () => evaluateScenario(scenarioFor("phishing"), demoPolicy),
    [capabilities]
  );

  function updateCapability(
    id: (typeof scenarioIds)[number],
    passkeyEnrolled: boolean
  ) {
    setCapabilities((prev) => ({ ...prev, [id]: { passkeyEnrolled } }));
  }

  function togglePasskey(id: (typeof scenarioIds)[number]) {
    setCapabilities((prev) => ({
      ...prev,
      [id]: { passkeyEnrolled: !prev[id].passkeyEnrolled },
    }));
  }

  function reset() {
    setCapabilities(
      Object.fromEntries(
        scenarioIds.map((id) => [id, { ...DEFAULT_CAPABILITIES }])
      )
    );
  }

  // Keyboard demo controls: 1/2 toggle passkey per panel, R resets.
  // Ignored while typing in a control so keys never hijack the UI mid-input.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "1") {
        togglePasskey("sim-swap");
      } else if (key === "2") {
        togglePasskey("phishing");
      } else if (key === "r") {
        reset();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <AppShell>
      <SharedRiskHeader scenarios={scenarios} />

      <div className="demo-controls">
        <p className="demo-controls-label">
          Capability & reset
          <span className="keyboard-hints">
            Press <kbd>1</kbd>/<kbd>2</kbd> to toggle passkey · <kbd>R</kbd> to
            reset
          </span>
        </p>
        <div className="demo-controls-actions">
          <button type="button" className="reset-button" onClick={reset}>
            Reset demo
          </button>
        </div>
      </div>

      <BaselineCard baseline={baseline} />

      <ComparisonWorkspace>
        <ScenarioPanel
          scenario={scenarioFor("sim-swap")}
          decision={simDecision}
          control={
            <CapabilityToggle
              checked={capabilities["sim-swap"].passkeyEnrolled}
              onChange={(checked) => updateCapability("sim-swap", checked)}
            />
          }
          exportButton={<DecisionExport decision={simDecision} />}
        />
        <ScenarioPanel
          scenario={scenarioFor("phishing")}
          decision={phishingDecision}
          control={
            <CapabilityToggle
              checked={capabilities["phishing"].passkeyEnrolled}
              onChange={(checked) => updateCapability("phishing", checked)}
            />
          }
          exportButton={<DecisionExport decision={phishingDecision} />}
        />
      </ComparisonWorkspace>

      <footer className="app-footer">
        <span className="footer-chip">Policy version {demoPolicy.version}</span>
        <span className="footer-chip">
          The scenario supplies synthetic indicators. The engine applies a
          deterministic demonstration policy.
        </span>
        <span className="footer-chip">
          The prototype selects a policy outcome; it does not execute
          authentication.
        </span>
      </footer>
    </AppShell>
  );
}

export default App;
