export const C = {
  paper: "#f4efe6", paper2: "#ece5d6", paper3: "#e1d8c4", ink: "#14110f", ink2: "#4a443b", ink3: "#82796a", rule: "#cfc5af", rule2: "#b5aa92",
  flood: "#1d4e89", flood2: "#6e93c2", floodSoft: "#d3dcea", cut: "#c0392b", cutSoft: "#efd4ce", delay: "#c98a1b", delaySoft: "#f1e1bd", ok: "#2f6b5e", okSoft: "#cfe0d9", grey: "#9c9486",
  mild: "#c98a1b", moderate: "#c2652b", severe: "#c0392b",
} as const;
export const SEV_COLOR: Record<string, string> = { mild: C.mild, moderate: C.moderate, severe: C.severe };
