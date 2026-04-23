import Stripe from 'stripe'
import Redis from 'ioredis'

const stripe = new Stripe(process.env.STRIPE_KEY)
const redis = new Redis()

export async function createCheckout(sessionId, userId) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: 'WinLab Access' },
        unit_amount: 500
      },
      quantity: 1
    }],
    success_url: `https://yourapp/success?session=${sessionId}`,
    cancel_url: `https://yourapp/cancel`
  })

  await redis.set(`paywall:${sessionId}`, 'pending', 'EX', 600)

  return session.url
}

export async function unlockSession(sessionId) {
  await redis.set(`paywall:${sessionId}`, 'paid', 'EX', 3600)
}
