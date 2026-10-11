/**
 * Push Notifications — Phase A: Consumer Transaction Rail
 *
 * Sends Expo push notifications to business users when a new booking is
 * received. Uses expo-server-sdk for both development (Expo Go) and
 * production (standalone app) targets.
 *
 * Intentionally fire-and-forget: the calling code should .catch() this and
 * never await it on the hot path. A failed notification is not a booking
 * failure.
 */

import { Expo, type ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!Expo.isExpoPushToken(token)) {
    console.warn(`[push] Invalid Expo push token: ${token}`);
    return;
  }

  const message: ExpoPushMessage = {
    to: token,
    sound: "default",
    title,
    body,
    data: data ?? {},
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      for (const receipt of receipts) {
        if (receipt.status === "error") {
          console.warn("[push] Notification delivery error:", receipt.message, receipt.details);
        }
      }
    }
  } catch (err) {
    console.warn("[push] Failed to send push notification:", err);
  }
}

/**
 * Send a push notification to every active BusinessUser of a business
 * who has registered an Expo push token.
 */
export async function notifyBusinessUsers(
  businessId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  // Lazy import prisma to avoid circular deps.
  const { prisma } = await import("./prisma.js");

  const users = await prisma.businessUser.findMany({
    where: { businessId, isActive: true, expoPushToken: { not: null } },
    select: { expoPushToken: true },
  });

  await Promise.allSettled(
    users
      .filter((u): u is { expoPushToken: string } => u.expoPushToken !== null)
      .map((u) => sendPushNotification(u.expoPushToken, title, body, data)),
  );
}
