// API endpoint: Stripe checkout session for early access ($5)
import express from "express";

const router = express.Router();

router.post("/api/checkout", async (req, res) => {
  try {
    const stripe = (await import("stripe")).default(process.env.STRIPE_SECRET_KEY);

    // Use early access price ID from env
    const priceId = process.env.STRIPE_PRICE_EARLY_ACCESS || "price_early_access_5";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.BASE_URL || "https://winlab.cloud"}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL || "https://winlab.cloud"}`,
      metadata: {
        source: "72h_launch_landing",
        campaign: "early_access_5",
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("[Stripe Checkout Error]", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;
