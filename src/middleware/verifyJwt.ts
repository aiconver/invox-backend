import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { JwtUser } from "../types/typed-request";
import { hasRole } from "../utils/has-role";
import { AppRoles } from "../types/app-roles";
import config from "@/lib/config";


const client = jwksClient({
  jwksUri: `${config.keycloakServerUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxEntries: 8,      // How many keys to cache
  cacheMaxAge: 30 * 60 * 1000 // 30 minutes
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
    if (err) return res.status(403).json({ message: "Token verification failed", error: err });
    (req as any).user = decoded; // you can cast to `JwtUser` here too
    next();
  });
}

export function hasAnyRole(req: ExtendedRequest | Request, res: Response, next: NextFunction) {
    const reqCast = (<ExtendedRequest>req);
    if (!reqCast.user) {
      return res.status(403).json({ message: "User role missing." });
    }
    const user = reqCast.user;
    if (
      !user ||
      // Check if user has at least one of the roles defined in AppRoles
      !Object.values(AppRoles).some(role => hasRole(user, role))
    ) {
      return res.status(403).json({ message: "User role missing." });
    }
    next();
  }

interface ExtendedRequest extends Request {
  user: JwtUser;
}