import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { profile } from "../../data/profile";
import { Icon } from "./icons";

// Endpoint is implemented in Phase 7 (Cloudflare Pages Function). Designed to be
// re-pointed at your own BaaS later by changing this one constant.
const CONTACT_ENDPOINT = "/api/contact";

type Status = "idle" | "sending" | "ok" | "error";

const CATEGORIES = [
  { id: "inquiry", label: "Project Inquiry", icon: "briefcase" },
  { id: "hiring", label: "Job Opportunity", icon: "userPlus" },
  { id: "collab", label: "Collaboration", icon: "gitFork" },
  { id: "other", label: "Just Saying Hello", icon: "smile" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

const MIN_MESSAGE = 15;

// profile.ts ships unfilled fields wrapped in ⟨…⟩ so nothing fabricated goes out.
// Anything still wrapped is treated as absent and its row is simply not rendered.
const isPlaceholder = (v: string | undefined) => !v || /[⟨⟩]/.test(v);

/**
 * Inquiry-type picker.
 *
 * A native <select> hands its popup to the browser/OS, which renders a Windows
 * list on Windows and a Mac sheet on Mac — the one control in the app that
 * ignores the active skin and leaks the *real* OS through. This is a listbox
 * built from markup instead, so it takes the skin's surface, border and accent
 * like every other control, and can show a glyph per option.
 *
 * The value reaches the backend through a hidden input, so the form still
 * serialises with FormData exactly as it did with the <select>.
 */
function CategorySelect({
  value,
  onChange,
  disabled,
}: {
  value: CategoryId;
  onChange: (id: CategoryId) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  // keyboard highlight, tracked separately from the committed value
  const [active, setActive] = useState(() => CATEGORIES.findIndex((c) => c.id === value));
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = CATEGORIES.find((c) => c.id === value) ?? CATEGORIES[0];

  // close on outside pointer or on scroll — the panel is absolutely positioned,
  // so it would otherwise detach from its trigger inside a scrolling window
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // move focus into the list so arrow keys and Escape land here
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  function openList() {
    if (disabled) return;
    // flip above the trigger when the panel wouldn't fit below it
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropUp(window.innerHeight - rect.bottom < 210 && rect.top > 210);
    setActive(CATEGORIES.findIndex((c) => c.id === value));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function commit(i: number) {
    onChange(CATEGORIES[i]!.id);
    close();
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openList();
    }
  }

  function onListKey(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => (i + 1) % CATEGORIES.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (i - 1 + CATEGORIES.length) % CATEGORIES.length);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(CATEGORIES.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  return (
    <div className={`select-wrap${open ? " is-open" : ""}`} ref={wrapRef}>
      {/* what the form actually submits */}
      <input type="hidden" name="category" value={value} />

      <button
        ref={triggerRef}
        type="button"
        className="select-trigger"
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="cat-label cat-value"
      >
        <span className="select-icon">
          <Icon name={selected.icon} size={16} />
        </span>
        <span className="select-value" id="cat-value">
          {selected.label}
        </span>
        <span className="select-chevron">
          <Icon name="chevronDown" size={15} />
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          className={`select-panel${dropUp ? " drop-up" : ""}`}
          role="listbox"
          tabIndex={-1}
          aria-labelledby="cat-label"
          aria-activedescendant={`cat-opt-${CATEGORIES[active]!.id}`}
          onKeyDown={onListKey}
        >
          {CATEGORIES.map((c, i) => (
            <li
              key={c.id}
              id={`cat-opt-${c.id}`}
              role="option"
              aria-selected={c.id === value}
              className={`select-option${i === active ? " is-active" : ""}${
                c.id === value ? " is-selected" : ""
              }`}
              onPointerEnter={() => setActive(i)}
              onClick={() => commit(i)}
            >
              <Icon name={c.icon} size={16} />
              <span>{c.label}</span>
              {c.id === value && (
                <span className="option-check">
                  <Icon name="check" size={14} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Contact() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [category, setCategory] = useState<CategoryId>("inquiry");
  const [message, setMessage] = useState("");

  const sending = status === "sending";

  // Only render social tiles whose href is filled in; email always resolves.
  const socials = profile.links.filter(
    (l) => l.icon !== "email" && !isPlaceholder(l.href),
  );

  async function onSubmit(e: { preventDefault: () => void; currentTarget: HTMLFormElement }) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    if (!data.name?.trim()) return fail("Please enter your name.");
    if (!/\S+@\S+\.\S+/.test(data.email ?? "")) return fail("Please enter a valid email address.");
    if (!data.subject?.trim()) return fail("Please enter a subject line.");
    if ((data.message ?? "").trim().length < MIN_MESSAGE)
      return fail(`Please write a little more — at least ${MIN_MESSAGE} characters.`);

    setStatus("sending");
    setError("");
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setStatus("ok");
        form.reset();
        setMessage("");
        setCategory("inquiry");
        return;
      }
      // 501 = endpoint not configured yet (pre-deploy); anything else = real error
      const hint =
        res.status === 501
          ? "The mail endpoint isn't live yet."
          : "Something went wrong sending your message.";
      fail(`${hint} Meanwhile, email me directly at ${profile.email}.`);
    } catch {
      fail(`Couldn't reach the server. Please email me directly at ${profile.email}.`);
    }
  }

  function fail(msg: string) {
    setError(msg);
    setStatus("error");
  }

  return (
    <div className="app contact-hub">
      <div className="contact-grid">
        {/* ---------- left column: who you're writing to ---------- */}
        <aside className="contact-aside">
          <div className="contact-intro">
            {profile.availability.open && (
              <span className="avail-pill">
                <span className="dot" />
                Available for Opportunities
              </span>
            )}

            <h2 className="contact-headline">
              Let's build something <em>extraordinary</em> together.
            </h2>

            <p className="contact-lede">
              Have a project in mind, a role to fill, or just want to share ideas? Send me
              a message and let's start a conversation.
            </p>
          </div>

          <ul className="contact-facts">
            <li>
              <span className="fact-icon">
                <Icon name="email" size={17} />
              </span>
              <div>
                <h4>Email Address</h4>
                <a href={`mailto:${profile.email}`}>{profile.email}</a>
              </div>
            </li>

            {!isPlaceholder(profile.location) && (
              <li>
                <span className="fact-icon">
                  <Icon name="mapPin" size={17} />
                </span>
                <div>
                  <h4>Based In</h4>
                  <p>{profile.location}</p>
                </div>
              </li>
            )}

            {/* Reply time sits ABOVE project timeline on purpose: the visitor is
                about to press Send, so "when will I hear back" is the question
                they have right now. The weeks-long number answers a later one. */}
            <li>
              <span className="fact-icon">
                <Icon name="send" size={16} />
              </span>
              <div>
                <h4>Reply Time</h4>
                <p>{profile.availability.replyTime}</p>
              </div>
            </li>

            <li>
              <span className="fact-icon">
                <Icon name="clock" size={17} />
              </span>
              <div>
                {/* "Project Timeline", not "Turnaround" — sitting beside a Send
                    button, "turnaround" reads as how long until I reply. */}
                <h4>Project Timeline</h4>
                <p>{profile.availability.note}</p>
              </div>
            </li>
          </ul>

          {socials.length > 0 && (
            <div className="contact-socials">
              <h4>Find Me Online</h4>
              <div className="social-grid">
                {socials.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`social-tile s-${l.icon}`}
                  >
                    <Icon name={l.icon} size={16} />
                    <span className="social-text">
                      <strong>{l.label}</strong>
                      <small>{l.handle}</small>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ---------- right column: the form card ---------- */}
        <div className="contact-card">
          {status === "ok" ? (
            <div className="contact-sent">
              <div className="sent-mark">
                <Icon name="check" size={34} />
              </div>
              <div>
                <h3>Message sent</h3>
                <p>
                  Thanks for reaching out — your message is on its way to my inbox. I'll
                  get back to you soon.
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setStatus("idle")}>
                Send another
              </button>
            </div>
          ) : (
            <>
              <header className="card-head">
                <h3>Send a Message</h3>
                <p>Got a question, proposal, or feedback? I'd love to hear from you.</p>
              </header>

              {status === "error" && (
                <p className="form-error" role="alert">
                  <Icon name="alert" size={18} />
                  <span>{error}</span>
                </p>
              )}

              <form className="contact-form" onSubmit={onSubmit} noValidate>
                {/* honeypot — hidden from humans, bots fill it and get dropped.
                    Named `website` (not `company`) because `company` is now a
                    real field visitors are meant to fill in. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="honeypot"
                />

                <div className="field-row">
                  <label className="field">
                    <span>
                      Your Name <b>*</b>
                    </span>
                    <input name="name" type="text" autoComplete="name" placeholder="Jane Doe" disabled={sending} />
                  </label>
                  <label className="field">
                    <span>
                      Email Address <b>*</b>
                    </span>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="jane@example.com"
                      disabled={sending}
                    />
                  </label>
                </div>

                <div className="field-row">
                  <label className="field">
                    <span>
                      Company / Organization <i>(Optional)</i>
                    </span>
                    <input
                      name="company"
                      type="text"
                      autoComplete="organization"
                      placeholder="Acme Corp"
                      disabled={sending}
                    />
                  </label>

                  <div className="field">
                    <span id="cat-label">Inquiry Type</span>
                    <CategorySelect
                      value={category}
                      onChange={setCategory}
                      disabled={sending}
                    />
                  </div>
                </div>

                <label className="field">
                  <span>
                    Subject Line <b>*</b>
                  </span>
                  <input
                    name="subject"
                    type="text"
                    placeholder="Collaborating on a project…"
                    disabled={sending}
                  />
                </label>

                <label className="field">
                  <span className="field-label-row">
                    <span>
                      Your Message <b>*</b>
                    </span>
                    <small className={`char-count${message.length >= MIN_MESSAGE ? " ok" : ""}`}>
                      {message.length} chars (min {MIN_MESSAGE})
                    </small>
                  </span>
                  <textarea
                    name="message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell me about your idea, timeline, tech stack, or budget…"
                    disabled={sending}
                  />
                </label>

                <button
                  className={`btn-accent send-btn${sending ? " is-sending" : ""}`}
                  type="submit"
                  disabled={sending}
                >
                  <Icon name={sending ? "spinner" : "send"} size={17} />
                  {sending ? "Sending…" : "Send message"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
