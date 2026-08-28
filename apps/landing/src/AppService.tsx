import { FormEvent, useState } from "react";
import App from "./App.js";
import { portfolioPath } from "./portfolio.js";

export default function AppService() {
  const [username, setUsername] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = username.trim();
    if (!value) return;
    window.location.assign(portfolioPath(value));
  }

  return (
    <>
      <App />
      <aside className="portfolio-launcher" aria-label="GitHub portfolio generator">
        <div className="portfolio-launcher-copy">
          <span className="portfolio-launcher-kicker">FOR EVERY DEVELOPER</span>
          <strong>Turn GitHub into a living portfolio.</strong>
        </div>
        <form onSubmit={submit}>
          <span>@</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="github username"
            aria-label="GitHub username"
          />
          <button type="submit">Build →</button>
        </form>
        <a href="/u/wellorbetter?view=recruiter">Recruiter view ↗</a>
      </aside>
    </>
  );
}
