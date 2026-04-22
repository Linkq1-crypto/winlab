import express from "express";
import labRoutes from "../modules/labs/routes.js";

const app = express();
app.use(express.json());

app.use("/labs", labRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(3000, () => {
  console.log("API running on port 3000");
});
