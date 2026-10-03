import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler, ApiError } from '../middleware/error';
import { login, logout, refresh, register } from '../services/authService';
import { loginSchema, refreshSchema, registerSchema } from '../validation';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'too_many_attempts', message: 'Too many attempts - try again in a few minutes' } },
});

export const authRouter = Router();
authRouter.use(authLimiter);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);
    const result = await register(name, email, password);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await login(email, password));
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    res.json(await refresh(refreshToken));
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (parsed.success) await logout(parsed.data.refreshToken);
    res.json({ ok: true });
  }),
);
