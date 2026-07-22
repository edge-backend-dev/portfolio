import About from "./About";
import Finder from "./Finder";
import Resume from "./Resume";
import Services from "./Services";
import Projects from "./Projects";
import Skills from "./Skills";
import Terminal from "./Terminal";
import Contact from "./Contact";
import Settings from "./Settings";
import type { AppApi } from "./appApi";

// Maps an app id to its content. Content is OS-agnostic — the surrounding
// window/home-screen chrome is what differs per skin.
export function AppContent({ id, api }: { id: string; api: AppApi }) {
  switch (id) {
    case "about":
      return <About api={api} />;
    case "finder":
      return <Finder api={api} />;
    case "resume":
      return <Resume />;
    case "services":
      return <Services api={api} />;
    case "projects":
      return <Projects api={api} />;
    case "skills":
      return <Skills />;
    case "terminal":
      return <Terminal api={api} />;
    case "contact":
      return <Contact />;
    case "settings":
      return <Settings api={api} />;
    default:
      return <div className="app">Unknown app: {id}</div>;
  }
}
