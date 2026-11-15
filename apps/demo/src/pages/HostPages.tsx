import { Link } from 'react-router';
import { useShell } from '../App';

export function HomePage() {
  const { s } = useShell();
  return <div className="demo__page"><h1>{s('home')}</h1><p>{s('homeText')}</p></div>;
}

/** A route that belongs to the host application only (AC-NAV-06). */
export function AboutPage() {
  const { s } = useShell();
  return (
    <div className="demo__page" data-demo-about>
      <h1>{s('about')}</h1>
      <p>{s('aboutText')}</p>
      <Link to="/po">{s('po')}</Link>
    </div>
  );
}
