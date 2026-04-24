export type MacroActionType =
  | "click"
  | "right_click"
  | "double_click"
  | "scroll"
  | "wait"
  | "key";

export type ScrollDirection = "up" | "down" | "left" | "right";

export interface MacroAction {
  id: string;
  type: MacroActionType;
  // click / right_click / double_click / scroll
  x?: number;
  y?: number;
  // scroll only
  direction?: ScrollDirection;
  amount?: number;
  // key only
  key?: string;
  // ms to wait after this action runs (for "wait" type this IS the duration)
  delay_after: number;
}

export interface SavedMacro {
  id: string;
  name: string;
  actions: MacroAction[];
  repeat: number;   // -1 = infinite
  speed: number;    // 1.0 = normal, 2.0 = 2x faster
  shortcut: string;
  createdAt: number;
}

export const ACTION_TYPE_LABELS: Record<MacroActionType, string> = {
  click: "L-CLICK",
  right_click: "R-CLICK",
  double_click: "DBL-CLICK",
  scroll: "SCROLL",
  wait: "WAIT",
  key: "KEY",
};

export const SPEED_OPTIONS = [0.25, 0.5, 1.0, 2.0, 5.0];

export function makeAction(type: MacroActionType): MacroAction {
  const base = { id: Date.now().toString() + Math.random(), delay_after: 100 };
  switch (type) {
    case "click":
    case "right_click":
    case "double_click":
      return { ...base, type, x: 0, y: 0 };
    case "scroll":
      return { ...base, type, x: 0, y: 0, direction: "down", amount: 3 };
    case "key":
      return { ...base, type, key: "" };
    case "wait":
      return { ...base, type, delay_after: 500 };
  }
}
