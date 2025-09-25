// src/middleware/verifyJwt.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { JwtUser } from "../types/typed-request";
import { hasRole } from "../utils/has-role";
import { AppRoles } from "../types/app-roles";
import config from "../lib/config";

const client = jwksClient({
  jwksUri: `${config.keycloakServerUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxEntries: 8,
  cacheMaxAge: 30 * 60 * 1000,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid!, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(err, signingKey);
  });
}

export function verifyJwt(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token verification failed", error: err });
    }
    (req as any).user = decoded as JwtUser;
    next();
  });
}

interface ExtendedRequest extends Request {
  user: JwtUser;
}

export function hasAnyRole(req: ExtendedRequest | Request, res: Response, next: NextFunction) {
  const reqCast = req as ExtendedRequest;
  const user = reqCast.user;
  if (!user) {
    return res.status(403).json({ message: "User role missing." });
  }
  if (!Object.values(AppRoles).some((role) => hasRole(user, role))) {
    return res.status(403).json({ message: "User lacks required role." });
  }
  next();
}
