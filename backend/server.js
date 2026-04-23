import express from "express";

import authRouter from "./routes/auth.js";
import checkoutRouter from "./routes/checkout.js";
import incidentsRouter from "./routes/incidents.js";
import labsRouter from "./routes/labs.js";
import progressRouter from "./routes/progress.js";
import publicRouter from "./routes/public.js";

const app = express();
const port = Number.parseInt(process.env.PORT || "3000", 10);

// Small JSON API, no heavy middleware stack.
app.use(express.json());

app.use("/api/public", publicRouter);
app.use("/api/auth", authRouter);
app.use("/api/labs", labsRouter);
app.use("/api/incidents", incidentsRouter);
app.use("/api/me", progressRouter);
app.use("/api/checkout", checkoutRouter);

app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "Not found",
    },
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    next(err);
    return;
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    error: {
      message: status >= 500 ? "Internal server error" : err.message,
    },
  });
});

app.listen(port, () => {
  console.log(`Minimal API listening on port ${port}`);
});
