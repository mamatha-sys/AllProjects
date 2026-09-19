const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Department-scoped roles only see requirements/candidates within their own ATS department.
const DEPT_SCOPED_ROLES = ['MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
function isDeptScopedRole(role) {
  return DEPT_SCOPED_ROLES.includes(role);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "This action isn't included in your role's permissions" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, isDeptScopedRole };
