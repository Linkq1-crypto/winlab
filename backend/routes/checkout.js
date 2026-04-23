import express from "express";

const router = express.Router();

router.post("/session", (req, res) => {
  res.json({
    checkoutUrl: "https://checkout.winlab.dev/session/mock_pro_monthly",
  });
});

export default router;
