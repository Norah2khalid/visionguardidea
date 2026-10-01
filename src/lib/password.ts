export function assertPasswordPolicy(password: string): void {
  const hasLetter = /[A-Za-z\u0600-\u06FF]/.test(password);
  if (password.length < 10 || !hasLetter || !/\d/.test(password)) {
    throw new Error("كلمة المرور يجب أن تكون 10 خانات على الأقل وتضم حرفًا ورقمًا.");
  }
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
