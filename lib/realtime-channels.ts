export function emailChannelForUser(userId: string) {
  return `private-emails-${userId}`;
}

export function notificationChannelForUser(userId: string) {
  return `private-notifications-${userId}`;
}
