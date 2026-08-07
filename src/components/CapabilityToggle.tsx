interface CapabilityToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CapabilityToggle({ checked, onChange }: CapabilityToggleProps) {
  return (
    <label className="capability-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="capability-toggle-text">
        Passkey enrolled
        <small>Changes user capability only</small>
      </span>
    </label>
  );
}
