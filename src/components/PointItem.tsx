import { IconTarget } from "./Icons";
import { TimeSelector } from "./TimeSelector";
import { emit } from "@tauri-apps/api/event";

interface PointItemProps {
  id: string;
  index: number;
  interval: number;
  isClicking: boolean;
  onRemove: (id: string) => void;
  onIntervalChange: (newVal: number) => void;
}

export const PointItem = ({
  id,
  index,
  interval,
  isClicking,
  onRemove,
  onIntervalChange,
}: PointItemProps) => {
  return (
    <div
      className="point-item"
      onMouseEnter={() => emit("highlight-point", { id, active: true })}
      onMouseLeave={() => emit("highlight-point", { id, active: false })}
    >
      <div className="point-item-header">
        <span>
          <IconTarget /> Target {index + 1}
        </span>
        <button
          className="delete-btn"
          onClick={() => onRemove(id)}
          disabled={isClicking}
        >
          DELETE
        </button>
      </div>
      <TimeSelector
        value={interval}
        onChange={onIntervalChange}
        disabled={isClicking}
      />
    </div>
  );
};
