const ADMIN_EMAILS = [
  'dmytro@turskyi.com',
  'dmytro.turskyi@gmail.com',
  'dmitriy.turskiy@gmail.com',
];

export function isAdminUser(decodedToken: { email?: string }): boolean {
  if (!decodedToken.email) return false;
  return ADMIN_EMAILS.includes(decodedToken.email.toLowerCase().trim());
}
