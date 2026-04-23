const MOCK_USER = Object.freeze({
  id: "user_demo_001",
  name: "Demo Engineer",
  email: "demo@winlab.dev",
  plan: "PRO",
});

export function getMockSession(req) {
  const authHeader = req.get("authorization");
  const mockHeader = req.get("x-mock-auth");
  const cookieHeader = req.get("cookie") || "";
  const hasMockCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === "mock_auth=1");

  const authenticated =
    hasMockCookie ||
    mockHeader === "true" ||
    mockHeader === "1" ||
    authHeader === "Bearer mock-demo-user";

  return {
    authenticated,
    user: authenticated ? MOCK_USER : null,
  };
}

export function requireMockAuth(req, res, next) {
  const session = getMockSession(req);
  req.session = session;

  if (!session.authenticated) {
    res.status(401).json({
      error: {
        message: "Authentication required",
      },
    });
    return;
  }

  next();
}
