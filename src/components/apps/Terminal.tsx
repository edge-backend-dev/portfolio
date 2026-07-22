import { useEffect, useRef, useState } from "react";
import { profile } from "../../data/profile";
import { skills } from "../../data/skills";
import { services } from "../../data/services";
import type { AppApi } from "./appApi";

type Line = { kind: "in" | "out"; text: string };

const PROMPT = "guest@portfolio:~$";

export default function Terminal({ api }: { api: AppApi }) {
  const [lines, setLines] = useState<Line[]>([
    { kind: "out", text: `Portfolio Shell — type 'help' to get started.` },
  ]);
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines]);

  function run(raw: string) {
    const cmd = raw.trim().toLowerCase();
    const out: string[] = [];
    switch (cmd) {
      case "":
        break;
      case "help":
        out.push("Commands: help, whoami, about, skills, services, projects, contact, clear");
        break;
      case "whoami":
        out.push(`${profile.name} — ${profile.role}`);
        break;
      case "about":
        out.push(profile.tagline, "", profile.bio[0]);
        break;
      case "skills":
        skills.forEach((g) => out.push(`${g.category}: ${g.items.join(", ")}`));
        break;
      case "services":
        services.forEach((s) => out.push(`• ${s.title} — ${s.pitch}`));
        break;
      case "projects":
        out.push("Case studies coming soon. Opening Projects…");
        setTimeout(() => api.openApp("projects"), 250);
        break;
      case "contact":
        out.push(`Email: ${profile.email}`, "Opening Contact…");
        setTimeout(() => api.openApp("contact"), 250);
        break;
      case "clear":
        setLines([]);
        return;
      default:
        out.push(`command not found: ${cmd} — try 'help'`);
    }
    setLines((prev) => [
      ...prev,
      { kind: "in", text: raw },
      ...out.map((t) => ({ kind: "out" as const, text: t })),
    ]);
  }

  return (
    <div className="app terminal" onClick={() => inputRef.current?.focus()}>
      <div className="term-body" ref={bodyRef}>
        {lines.map((l, i) =>
          l.kind === "in" ? (
            <div className="term-line" key={i}>
              <span className="term-prompt">{PROMPT}</span> {l.text}
            </div>
          ) : (
            <div className="term-out" key={i}>
              {l.text || " "}
            </div>
          ),
        )}
        <form
          className="term-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(input);
            setInput("");
          }}
        >
          <span className="term-prompt">{PROMPT}</span>
          <input
            ref={inputRef}
            className="term-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-label="Terminal input"
          />
        </form>
      </div>
    </div>
  );
}
