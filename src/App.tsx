import { useMemo, useState } from "react";
import { evaluateScenario } from "./engine/evaluateScenario";
import { demoPolicy } from "./policy/demoPolicy";
import { simSwapScenario } from "./scenarios/simSwap";
import { AppShell } from "./components/AppShell";
import { ScenarioPanel } from "./components/ScenarioPanel";
import { CapabilityToggle } from "./components/CapabilityToggle";
import "./styles/tokens.css";
import "./styles/app.css";

const DEFAULT_CAPABILITIES = { passkeyEnrolled: true };

function App() {
  const [capabilities, setCapabilities] = useState(DEFAULT_CAPABILITIES);

  const scenario = useMemo(
    () => ({ ...simSwapScenario, capabilities }),
    [capabilities]
  );

  const decision = useMemo(
    () => evaluateScenario(scenario, demoPolicy),
    [scenario]
  );

  function reset() {
    setCapabilities(DEFAULT_CAPABILITIES);
  }

  return (
    <AppShell>
      <div className="demo-controls">
        <CapabilityToggle
          checked={capabilities.passkeyEnrolled}
          onChange={(passkeyEnrolled) => setCapabilities({ passkeyEnrolled })}
        />
        <button type="button" className="reset-button" onClick={reset}>
          Reset demo
        </button>
      </div>
      <ScenarioPanel scenario={scenario} decision={decision} />
      <footer className="app-footer">
        <span className="footer-chip">Policy version {demoPolicy.version}</span>
        <span className="footer-chip">
          The prototype selects a policy outcome; it does not execute
          authentication.
        </span>
      </footer>
    </AppShell>
  );
}

export default App;
