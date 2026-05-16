import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import FloatingShapes from "@/components/FloatingShapes";
import Hero from "@/components/Hero";
import PreviewCard from "@/components/PreviewCard";
import BentoGrid from "@/components/BentoGrid";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import Footer from "@/components/Footer";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

export default function Landing() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const previewRef = useRef(null);

  // Track scroll for hero parallax
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reveal-on-scroll for [data-reveal] elements
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const handleSubmit = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await axios.post(`${API}/preview`, { url });
      setPreview(res.data);
      // Smooth scroll to preview section
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    } catch (e) {
      const msg =
        e?.response?.data?.detail || e?.message || "Could not fetch preview";
      setError(typeof msg === "string" ? msg : "Could not fetch preview");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" style={{ background: "#000", minHeight: "100vh" }}>
      <FloatingShapes />

      {/* Top nav — pure minimal */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-5"
        data-testid="top-nav"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0))",
        }}
      >
        <div
          className="font-mono text-[12px] tracking-[0.4em] text-white"
          data-testid="nav-wordmark"
        >
          GRABIT
        </div>
        <div className="flex items-center gap-5 font-mono text-[11px] text-white/55">
          <a href="#how" className="hover:text-white transition-colors">
            HOW
          </a>
          <a href="#platforms" className="hover:text-white transition-colors">
            PLATFORMS
          </a>
          <a
            href="#"
            className="hover:text-white transition-colors hidden sm:inline"
          >
            GITHUB
          </a>
        </div>
      </nav>

      <Hero
        url={url}
        setUrl={setUrl}
        onSubmit={handleSubmit}
        loading={loading}
        scrollY={scrollY}
      />

      {/* Preview Section */}
      <section
        ref={previewRef}
        data-testid="preview-section"
        className="relative z-10 mx-auto"
        style={{ maxWidth: 1080, padding: "80px 24px 40px" }}
      >
        <div className="reveal" data-reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/40 mb-3">
            Paste once. Get everything.
          </p>
          <h2 className="text-[32px] sm:text-[40px] leading-[1.05] font-extrabold tracking-tight text-white max-w-2xl">
            One bar.
            <br />
            Five platforms.
          </h2>
        </div>

        <div className="mt-10 reveal" data-reveal>
          <PreviewCard data={preview} loading={loading} error={error} />
        </div>
      </section>

      <div id="platforms">
        <BentoGrid />
      </div>

      <div id="how">
        <HowItWorks />
      </div>

      <Features />

      <Footer />
    </div>
  );
}
