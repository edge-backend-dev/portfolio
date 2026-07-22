import { skills } from "../../data/skills";

export default function Skills() {
  return (
    <div className="app skills">
      <p className="app-para" style={{ marginTop: 0 }}>
        The stack I build and ship with.
      </p>
      {skills.map((g) => (
        <div className="skill-group" key={g.category}>
          <h3 className="skill-cat">{g.category}</h3>
          <div className="chip-row">
            {g.items.map((it) => (
              <span className="chip" key={it}>
                {it}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
