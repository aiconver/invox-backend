// src/middleware/verifyJwt.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import CombinedConfig from '@/lib/config/CombinedConfig';
import { JwtUser } from '@/types/typed-request';

const config = new CombinedConfig(process.env);

const client = jwksClient({
  jwksUri: `${config.keycloakServerUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/certs`,
  cache: true,
  rateLimit: true,
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
    if (err || !decoded) {
      return res.status(403).json({ message: "Token verification failed", error: err });
    }
    (req as any).user = decoded as JwtUser;
    next();
  });
}
