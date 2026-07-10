import { createAuthClient } from "better-auth/react";

// Tanpa baseURL — client & server auth berjalan same-origin (app Next.js yang sama),
// better-auth otomatis pakai window.location.origin di browser.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
