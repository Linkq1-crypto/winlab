import { useEffect, useState } from "react";

export default function ReplayViewer({ sessionId }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetch(`/api/replay/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
        play(data);
      });
  }, []);

  function play(data) {
    let i = 0;

    const interval = setInterval(() => {
      if (i >= data.length) return clearInterval(interval);

      const e = data[i];

      if (e.cmd) {
        append(`$ ${e.cmd}\n`);
      }

      if (e.type === "hint") {
        append(`[AI] ${e.message}\n`);
      }

      i++;
    }, 200);
  }

  function append(text) {
    setEvents((prev) => [...prev, text]);
  }

  return (
    <div style={{ background: "black", color: "lime", padding: 10, height: "100%", overflow: "auto" }}>
      {events.map((e, i) => (
        <div key={i}>{e}</div>
      ))}
    </div>
  );
}
