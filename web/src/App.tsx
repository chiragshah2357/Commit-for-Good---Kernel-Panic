import Lenis from "lenis";
import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import { Presenter } from "./presenter/Presenter";
import { Curtain } from "./lib/transition";

const Landing = lazy(() => import("./pages/Landing"));
const Evidence = lazy(() => import("./pages/Evidence"));
const Calculator = lazy(() => import("./pages/calculator"));

declare global { interface Window { __lenis?: Lenis | null } }

/** Smooth, weighted scrolling on the long pages; off on the calculator, which scrolls inside its own panels. */
function useSmoothScroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    if (pathname === "/calculator" || matchMedia("(prefers-reduced-motion: reduce)").matches) { window.__lenis = null; return; }
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95, smoothWheel: true });
    window.__lenis = lenis;
    let id = 0;
    const loop = (t: number) => { lenis.raf(t); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(id); lenis.destroy(); window.__lenis = null; };
  }, [pathname]);
}

export function App() {
  useSmoothScroll();
  const { pathname } = useLocation();
  return (
    <>
      <Nav />
      <Suspense fallback={<div style={{ minHeight: "70vh" }} />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
      {pathname !== "/calculator" && <Footer />}
      <Presenter />
      <Curtain />
    </>
  );
}
