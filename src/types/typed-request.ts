import { Request } from "express";

// 🔐 Define a proper JWT user payload
export interface JwtUser {
  sub: string;
  email: string;
  preferred_username: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles: string[];
  };
  [key: string]: any;
}

// ✅ Use this type for all authenticated requests
export type TypedRequest<T = any> = Request<any, any, T> & {
  user?: JwtUser;
};
