import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { TLink } from "../lib/transition";
import { usePresenter } from "../presenter/store";

const LINKS = [{ to: "/", label: "Brief" }, { to: "/evidence", label: "Evidence" }, { to: "/calculator", label: "Calculator" }];

export function Nav() {
  const loc = useLocation();
  const [api_ok, setOk] = useState<boolean | null>(null);
  const present = usePresenter();
  useEffect(() => {
    let on = true;
    const ping = () => api.health().then(() => on && setOk(true)).catch(() => on && setOk(false));
    ping(); const t = setInterval(ping, 15000);
    return () => { on = false; clearInterval(t); };
  }, []);
  return (
    <header className="nav">
      <TLink to="/" className="nav__brand" aria-label="Kernel Panic, home">
        <span className="nav__mark">KP</span>
        <span className="nav__word">Kernel Panic<i className="cursor" /></span>
      </TLink>
      <nav className="nav__links" aria-label="Pages">
        {LINKS.map((l) => (
          <TLink key={l.to} to={l.to} className={`nav__link ${loc.pathname === l.to ? "on" : ""}`}>{l.label}</TLink>
        ))}
      </nav>
      <div className="nav__right">
        <span className={`nav__api ${api_ok === true ? "up" : api_ok === false ? "down" : ""}`} title={api_ok ? "Calculator API connected" : "Calculator API not running (python -m floodready serve)"}>
          <i />{api_ok === null ? "api" : api_ok ? "api online" : "api offline"}
        </span>
        <button className={`nav__present ${present.active ? "on" : ""}`} onClick={() => present.toggle()} title="Presenter mode (Shift+P)">
          {present.active ? "Exit" : "Present"}
        </button>
      </div>
    </header>
  );
}
