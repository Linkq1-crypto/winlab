import React, { useEffect, useState } from "react";

export default function Dashboard() {
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    // placeholder fetch
    setCandidates([
      { id: "1", name: "Mario", score: 78, level: "mid" },
      { id: "2", name: "Luca", score: 55, level: "junior" }
    ]);
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Assessment Dashboard</h1>

      <table width="100%" border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Name</th>
            <th>Score</th>
            <th>Level</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.score}</td>
              <td>{c.level}</td>
              <td>
                <a href={`/report/${c.id}`}>View Report</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
