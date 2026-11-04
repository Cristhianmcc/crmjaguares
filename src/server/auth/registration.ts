/**
 * Multi-tenant: el registro siempre está abierto. Cada usuario crea su propia
 * organización al registrarse.
 */
export async function isPublicSignupAllowed(): Promise<boolean> {
  return true;
}
