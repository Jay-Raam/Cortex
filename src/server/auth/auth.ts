import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { User, Session } from '../types';

const ACCESS_TOKEN_EXPIRY = '2h';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

/**
 * Retrieve JWT secret strictly from environment.
 * Fails closed with an explicit fatal error if the secret is missing or empty.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing or empty. Authentication failing closed.');
  }
  return secret.trim();
}

export function generateTokens(user: User, userAgent?: string): { accessToken: string; refreshToken: string } {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });

  const rawRefreshToken = `${user.id}.${Date.now()}.${Math.random().toString(36).substring(2, 15)}`;
  const refreshTokenHash = bcrypt.hashSync(rawRefreshToken, 8);

  const session: Session = {
    id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: user.id,
    refreshTokenHash,
    expiresAt: Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    userAgent,
  };

  db.createSession(session);

  return { accessToken, refreshToken: `${session.id}:${rawRefreshToken}` };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}

export function extractToken(req: Request): string | null {
  // 1. Check Bearer Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Check parsed cookies
  if ((req as any).cookies && (req as any).cookies.cortex_access_token) {
    return (req as any).cookies.cortex_access_token;
  }

  // 3. Parse raw Cookie header string if cookies middleware not applied
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/cortex_access_token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  // NOTE: Query string token extraction was removed to eliminate token leakage vectors in URLs and access logs.
  return null;
}

export function authenticateRequest(req: Request): User | null {
  const token = extractToken(req);
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = db.getUserById(payload.userId);
  return user || null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = authenticateRequest(req);
  if (!user) {
    // Strictly fail closed. Never fallback to a development user identity.
    return res.status(401).json({ error: 'Unauthorized: Valid Bearer token required' });
  }
  (req as any).user = user;
  next();
}
