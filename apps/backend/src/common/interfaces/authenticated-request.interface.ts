import { Request } from "express";
import { Role } from "@prisma/client";

export interface RequestUser {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
