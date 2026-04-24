export type MacroActionType =
  | "click"
  | "right_click"
  | "double_click"
  | "scroll"
  | "wait"
  | "key"
  | "type_text"
  | "hold_left"
  | "hold_right"
  | "release_left"
  | "release_right";

export type ScrollDirection = "up" | "down" | "left" | "right";

export interface MacroAction {
  id: string;
  type: MacroActionType;
  x?: number;
  y?: number;
  direction?: ScrollDirection;
  amount?: number;
  key?: string;
  text?: string;
  delay_after: number;
}

export interface SavedMacro {
  id: string;
  name: string;
  actions: MacroAction[];
  repeat: number;
  speed: number;
  shortcut: string;
  createdAt: number;
}

export const ACTION_TYPE_LABELS: Record<MacroActionType, string> = {
  click:         "L-CLICK",
  right_click:   "R-CLICK",
  double_click:  "DBL-CLICK",
  scroll:        "SCROLL",
  wait:          "WAIT",
  key:           "KEY",
  type_text:     "TYPE TEXT",
  hold_left:     "HOLD-L",
  hold_right:    "HOLD-R",
  release_left:  "REL-L",
  release_right: "REL-R",
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
    case "type_text":
      return { ...base, type, text: "" };
    case "hold_left":
    case "hold_right":
    case "release_left":
    case "release_right":
      return { ...base, type, delay_after: 0 };
  }
}
