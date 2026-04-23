import jwt from 'jsonwebtoken'

const SECRET = 'supersecret'

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).send('Unauthorized')

  try {
    const decoded = jwt.verify(token, SECRET)
    req.user = decoded
    next()
  } catch (e) {
    res.status(401).send('Invalid token')
  }
}

export function generateToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: '7d' })
}
