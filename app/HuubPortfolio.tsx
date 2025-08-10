"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Mail, MapPin, Globe, ArrowUpRight, X, Sparkles, PlayCircle, PauseCircle, ExternalLink } from "lucide-react";

function WebGLBackground({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startTimeRef = useRef<number>(0);
  const timeUniformRef = useRef<WebGLUniformLocation | null>(null);
  const resUniformRef = useRef<WebGLUniformLocation | null>(null);
  const mouseUniformRef = useRef<WebGLUniformLocation | null>(null);
  const clicksUniformRef = useRef<WebGLUniformLocation | null>(null);
  const clickCountUniformRef = useRef<WebGLUniformLocation | null>(null);
  const [clicks, setClicks] = useState<Array<{ x: number; y: number; t: number }>>([]);

  const frag = useMemo(
    () => `
    precision mediump float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec2 u_mouse; // 0-1
    uniform vec3 u_clicks[16]; // x, y, t
    uniform int u_clickCount;

    float hash(vec2 p){return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123);}  
    float noise(in vec2 p){
      vec2 i = floor(p); vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0,0.0));
      float c = hash(i + vec2(0.0,1.0));
      float d = hash(i + vec2(1.0,1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / u_res.xy; 
      vec2 p = (gl_FragCoord.xy - 0.5*u_res.xy) / u_res.y;

      vec2 par = (u_mouse - 0.5) * 0.1; 
      p += par;

      vec3 colA = vec3(0.02,0.02,0.07);
      vec3 colB = vec3(0.03,0.05,0.15);
      vec3 base = mix(colA, colB, uv.y + 0.1*sin(u_time*0.1));

      float band = 0.15*sin(uv.y*6.0 + u_time*0.6) + 0.15*sin(uv.x*8.0 - u_time*0.4);
      float n = noise(uv*6.0 + u_time*0.05);
      float glow = smoothstep(0.2, 0.9, band + n*0.6);

      vec3 color = base + vec3(0.02,0.03,0.05)*glow;

      for(int i=0;i<16;i++){
        if(i>=u_clickCount) break;
        vec2 cp = u_clicks[i].xy; // 0-1
        float t0 = u_clicks[i].z;
        vec2 q = (cp - uv);
        float d = length(q);
        float r = 0.0;
        float tt = (u_time - t0);
        if(tt>0.0){
          float w = 0.4 + 0.4*sin(tt*1.2);
          r = 0.03 * (sin(20.0*d - tt*6.0) * exp(-6.0*d) * smoothstep(0.0,1.0,1.2-tt*0.35));
        }
        color += vec3(0.06,0.08,0.12) * r;
      }

      float vg = smoothstep(1.2, 0.2, length(p));
      color *= vg;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return;
    glRef.current = gl;

    const vertSrc = `
      attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos,0.0,1.0);} 
    `;

    function compile(type: number, src: string){
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
        console.error(gl.getShaderInfoLog(s));
      }
      return s;
    }

    const vs = compile(gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
      console.error(gl.getProgramInfoLog(prog));
    }
    programRef.current = prog;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1,
      ]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    timeUniformRef.current = gl.getUniformLocation(prog, "u_time");
    resUniformRef.current = gl.getUniformLocation(prog, "u_res");
    mouseUniformRef.current = gl.getUniformLocation(prog, "u_mouse");
    clicksUniformRef.current = gl.getUniformLocation(prog, "u_clicks");
    clickCountUniformRef.current = gl.getUniformLocation(prog, "u_clickCount");

    function resize(){
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth; const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      gl.viewport(0,0,canvas.width, canvas.height);
      gl.useProgram(programRef.current);
      gl.uniform2f(resUniformRef.current, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener("resize", resize);

    let mouse = { x: 0.5, y: 0.5 };
    function onMove(e: MouseEvent){
      const rect = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / rect.width;
      mouse.y = 1.0 - (e.clientY - rect.top) / rect.height;
    }
    canvas.addEventListener("mousemove", onMove);

    function onClick(e: MouseEvent){
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      setClicks((prev) => {
        const now = (performance.now() - startTimeRef.current) / 1000;
        const next = [...prev, { x, y, t: now }].slice(-16);
        return next;
      });
    }
    canvas.addEventListener("click", onClick);

    startTimeRef.current = performance.now();

    function render(){
      if (!glRef.current || !programRef.current) return;
      const gl = glRef.current!;
      const t = (performance.now() - startTimeRef.current) / 1000;
      gl.useProgram(programRef.current);
      gl.uniform1f(timeUniformRef.current, t);
      gl.uniform2f(mouseUniformRef.current, mouse.x, mouse.y);

      const data = new Float32Array(16 * 3).fill(0);
      clicks.forEach((c, i) => {
        data[i * 3 + 0] = c.x;
        data[i * 3 + 1] = c.y;
        data[i * 3 + 2] = c.t;
      });
      gl.uniform1i(clickCountUniformRef.current, clicks.length);
      gl.uniform3fv(clicksUniformRef.current, data);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    }

    if (!paused) {
      rafRef.current = requestAnimationFrame(render);
    }

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [frag]);

  useEffect(() => {
    if (!glRef.current) return;
    if (paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    } else if (!rafRef.current) {
      const tick = () => {
        if (!glRef.current) return;
        const gl = glRef.current;
        const t = (performance.now() - startTimeRef.current) / 1000;
        gl.useProgram(programRef.current);
        gl.uniform1f(timeUniformRef.current, t);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 block w-full h-full"
      aria-hidden
    />
  );
}

type Project = {
  id: string;
  title: string;
  role: string;
  year: string;
  tags: string[];
  blurb: string;
  link?: string;
};

const PROJECTS: Project[] = [
  {
    id: "postnl-typical-dutch",
    title: "PostNL — ‘Typically Dutch’ Stamp Series",
    role: "Concept & Creative Direction",
    year: "2024",
    tags: ["branding", "illustration", "national series"],
    blurb: "A playful, collectible series celebrating Dutch quirks. Concept to execution, balancing heritage with bold modern simplicity.",
  },
  {
    id: "timechimp-hours-in-the-wild",
    title: "TimeChimp — Hours in the Wild",
    role: "Creative Strategy & Campaign",
    year: "2025",
    tags: ["saas", "campaign", "storytelling"],
    blurb: "Turning timesheets into characters and comics. We made time tracking unexpectedly fun and very shareable.",
  },
  {
    id: "surf-pill-amsterdam",
    title: "Surf Pill — Amsterdam’s Standing Wave",
    role: "Branding & Community Activation",
    year: "2025",
    tags: ["activation", "sustainability", "sport"],
    blurb: "Compact urban wave concept. Minimal footprint, maximal joy; built on accessibility, design and neighborhood love.",
  },
  {
    id: "moco-zig",
    title: "Moco Museum — Zig When They Zag",
    role: "Concept Development",
    year: "2024",
    tags: ["arts", "experiential", "social"],
    blurb: "Unconventional on-site moments for a museum that loves rule-bending. Surprise-and-delight as a brand behavior.",
  },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs tracking-wide backdrop-blur-sm">
      {children}
    </span>
  );
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative mx-auto mt-24 w-[min(900px,92vw)] rounded-2xl border border-white/15 bg-black/70 p-6 shadow-2xl"
          >
            <button onClick={onClose} className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/5 p-2 hover:bg-white/10" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function HuubPortfolio() {
  const [active, setActive] = useState<Project | null>(null);
  const [paused, setPaused] = useState(false);

  return (
    <div className="relative min-h-screen text-white">
      <WebGLBackground paused={paused} />

      <header className="pointer-events-auto sticky top-0 z-40 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5" />
            <div className="leading-tight">
              <h1 className="text-sm font-medium tracking-wide">Huub van Veenhuijzen</h1>
              <p className="text-xs text-white/70">Creative Director · Amsterdam</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <a href="#work" className="rounded-full px-3 py-1 hover:bg-white/10">Work</a>
            <a href="#about" className="rounded-full px-3 py-1 hover:bg-white/10">About</a>
            <a href="#experiments" className="rounded-full px-3 py-1 hover:bg-white/10">Experiments</a>
            <a href="#contact" className="rounded-full px-3 py-1 hover:bg-white/10">Contact</a>
            <button className="ml-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs hover:bg-white/10" onClick={()=>setPaused(p=>!p)}>
              {paused ? <span className="inline-flex items-center gap-1"><PlayCircle className="h-4 w-4"/>Play bg</span> : <span className="inline-flex items-center gap-1"><PauseCircle className="h-4 w-4"/>Pause bg</span>}
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 pb-10 pt-12 md:grid-cols-2">
        <div>
          <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-3xl font-semibold leading-tight md:text-5xl">
            Concept-first creative who zigzags on purpose.
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-4 max-w-xl text-white/80">
            I build original brand ideas, campaigns and interactive toys. Recent work spans stamps for PostNL, playful SaaS for TimeChimp, and a compact standing wave for Amsterdam.
          </motion.p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Chip>Branding</Chip>
            <Chip>Campaign</Chip>
            <Chip>Interactive</Chip>
            <Chip>AI & Generative</Chip>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm leading-relaxed">
          <div className="flex items-center gap-2 text-white/80"><MapPin className="h-4 w-4"/>Amsterdam</div>
          <div className="mt-2 text-white/70">
            AuDHD-powered thinking. Fast, curious, slightly chaotic. I like ideas that don’t look like anyone else’s—and then making them work in the real world.
          </div>
        </motion.div>
      </section>

      <section id="work" className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-end justify-between">
          <h3 className="text-xl font-medium tracking-wide">Selected Work</h3>
          <span className="text-xs text-white/60">Click a card to open details</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PROJECTS.map((p, i) => (
            <motion.button
              key={p.id}
              onClick={() => setActive(p)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="group relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 to-white/5 p-4 text-left shadow-lg"
            >
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl transition-all duration-300 group-hover:scale-125" />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold leading-tight">{p.title}</h4>
                  <p className="text-xs text-white/70">{p.role} · {p.year}</p>
                </div>
                <ArrowUpRight className="h-5 w-5 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="mt-3 text-sm text-white/80">{p.blurb}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.tags.map(t => <Chip key={t}>{t}</Chip>)}
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      <section id="experiments" className="mx-auto max-w-6xl px-4 py-10">
        <h3 className="mb-4 text-xl font-medium tracking-wide">Experiments</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {["WebGL toy: ripple field","AI prompt-to-comic","Shader sketch: neon tunnels"].map((label, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i*0.06 }} className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="mb-2 text-sm text-white/70">#{i+1}</div>
              <div className="text-base font-medium">{label}</div>
              <div className="mt-2 text-sm text-white/70">Tiny interactive sketches & playful prototypes that often grow into bigger ideas.</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-4 py-10">
        <h3 className="mb-4 text-xl font-medium tracking-wide">About</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
            Dutch creative director and concept developer. Ex CODE D'AZUR, Norvell Jefferson, Leukwerkt Worldwide. Currently Concept Director at Total Design. I like work that’s clear, surprising and useful.
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
            Selected clients include Heinz, KFC, Hero, Nikon, Vodafone, Ford, Microsoft, and PostNL. Talk to me about branding, comms, interactive experiments, or AI workflows.
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/80">Open for collaborations, weird briefs and good coffee.</div>
            <div className="flex items-center gap-2 text-sm">
              <a className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 hover:bg-white/10" href="mailto:huub@example.com"><Mail className="h-4 w-4"/>Email</a>
              <a className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 hover:bg-white/10" href="https://github.com/" target="_blank" rel="noreferrer"><Github className="h-4 w-4"/>GitHub</a>
              <a className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 hover:bg-white/10" href="#" target="_blank" rel="noreferrer"><Globe className="h-4 w-4"/>Elsewhere</a>
            </div>
          </div>
        </div>
      </section>

      <Modal open={!!active} onClose={() => setActive(null)}>
        {active && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="md:col-span-3">
              <div className="aspect-video w-full rounded-xl bg-gradient-to-tr from-white/10 to-white/5" />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-white/60">{active.year} · {active.role}</div>
              <h4 className="mt-1 text-xl font-semibold">{active.title}</h4>
              <p className="mt-3 text-sm text-white/80">{active.blurb}</p>
              <div className="mt-4 flex flex-wrap gap-2">{active.tags.map(t => <Chip key={t}>{t}</Chip>)}</div>
              {active.link && (
                <a href={active.link} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm hover:bg白/10">
                  <ExternalLink className="h-4 w-4"/> View case study
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/60">
        <div className="mx-auto max-w-6xl px-4">
          © {new Date().getFullYear()} Huub van Veenhuijzen — Crafted with React, WebGL & a mild obsession with ripple shaders.
        </div>
      </footer>

      <style>{`
        html, body, #__next { height: 100%; background: #03040a; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
