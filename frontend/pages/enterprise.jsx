import React from "react";

export default function Enterprise() {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>WinLab for Teams</h1>

      <p>
        Evaluate real sysadmin skills through live terminal environments.
        No quizzes. No theory. Real behavior.
      </p>

      <h2>What you get</h2>
      <ul>
        <li>Real terminal sessions</li>
        <li>AI-powered evaluation</li>
        <li>Replay candidate behavior</li>
        <li>Cheat detection</li>
      </ul>

      <h2>How it works</h2>
      <ol>
        <li>Create assessment</li>
        <li>Invite candidate</li>
        <li>Review report + replay</li>
      </ol>

      <button style={{ marginTop: 20, padding: 10 }}>
        Request Demo
      </button>
    </div>
  );
}
