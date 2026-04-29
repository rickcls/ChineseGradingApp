export {};

type AppRole = "student" | "teacher" | "admin";

declare global {
  interface UserPublicMetadata {
    role?: AppRole;
  }

  interface CustomJwtSessionClaims {
    role?: AppRole;
    publicMetadata?: {
      role?: AppRole;
    };
    metadata?: {
      role?: AppRole;
    };
  }
}
