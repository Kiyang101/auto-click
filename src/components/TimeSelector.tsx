
interface TimeSelectorProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export const TimeSelector = ({
  value,
  onChange,
  disabled,
}: TimeSelectorProps) => {
  const h = Math.floor(value / 3600000);
  const m = Math.floor((value % 3600000) / 60000);
  const s = Math.floor((value % 60000) / 1000);
  const ms = value % 1000;

  const update = (newH: number, newM: number, newS: number, newMs: number) => {
    const total = newH * 3600000 + newM * 60000 + newS * 1000 + newMs;
    onChange(Math.max(1, total));
  };

  return (
    <div className="time-selector">
      <div className="time-field">
        <input
          type="number"
          value={h}
          onChange={(e) => update(parseInt(e.target.value) || 0, m, s, ms)}
          disabled={disabled}
          min={0}
        />
        <label>HRS</label>
      </div>
      <div className="time-field">
        <input
          type="number"
          value={m}
          onChange={(e) => update(h, parseInt(e.target.value) || 0, s, ms)}
          disabled={disabled}
          min={0}
          max={59}
        />
        <label>MIN</label>
      </div>
      <div className="time-field">
        <input
          type="number"
          value={s}
          onChange={(e) => update(h, m, parseInt(e.target.value) || 0, ms)}
          disabled={disabled}
          min={0}
          max={59}
        />
        <label>SEC</label>
      </div>
      <div className="time-field">
        <input
          type="number"
          value={ms}
          onChange={(e) => update(h, m, s, parseInt(e.target.value) || 0)}
          disabled={disabled}
          min={0}
          max={999}
        />
        <label>MS</label>
      </div>
    </div>
  );
};
