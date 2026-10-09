import { useInView } from "motion/react";
import { ComponentProps, useRef, useState } from "react";
import { MapCanvas } from "./MapCanvas";

/** A map for a figure: mounts only when scrolled near, and keeps the page wheel-scroll unless the reader asks for pan and zoom. */
export function FigMap({ height = 460, ...props }: { height?: number } & Omit<ComponentProps<typeof MapCanvas>, "interactive" | "controls">) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "300px" });
  const [on, setOn] = useState(false);
  return (
    <div ref={ref} className="figmap" style={{ height }}>
      {seen ? <MapCanvas {...props} interactive={on} controls={on} /> : <div className="skel" style={{ width: "100%", height: "100%" }} />}
      <button className="chip figmap__t" aria-pressed={on} onClick={() => setOn(!on)}>{on ? "Pan and zoom: on" : "Pan and zoom"}</button>
    </div>
  );
}
