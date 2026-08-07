/**
 * API response inspector (docs/EXECUTION.md Phase 9): expose the exact
 * machine-readable decision the backend returned, with a copy action.
 */
import { useState } from "react";

export function JsonInspector({ record }: { record: unknown }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(record, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; nothing to do in a demo
    }
  }

  return (
    <section className="panel-section json-section">
      <div className="json-toggle-row">
        <button
          className="btn ghost small"
          onClick={() => setOpen((o) => !o)}
          type="button"
        >
          {open ? "Hide" : "Show"} raw API response
        </button>
        {open ? (
          <button className="btn ghost small" onClick={copy} type="button">
            {copied ? "Copied!" : "Copy JSON"}
          </button>
        ) : null}
      </div>
      {open ? (
        <pre className="json-pre">
          <code>{json}</code>
        </pre>
      ) : null}
    </section>
  );
}
