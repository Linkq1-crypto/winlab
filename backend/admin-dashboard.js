import express from 'express'
import Redis from 'ioredis'

const app = express()
const redis = new Redis()

app.get('/admin/sessions', async (req, res) => {
  const keys = await redis.keys('session:*:user')
  const sessions = []

  for (const key of keys) {
    const user = await redis.get(key)
    sessions.push({ session: key, user })
  }

  res.json(sessions)
})

app.get('/admin/stream/:sessionId', async (req, res) => {
  const { sessionId } = req.params
  const data = await redis.xrange(`stream:commands`, '-', '+', 'COUNT', 50)
  res.json(data)
})

app.listen(4000, () => {
  console.log('Admin dashboard running on 4000')
})
