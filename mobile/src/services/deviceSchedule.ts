import { isRunningInExpoGo } from "expo";
import {
  CalendarAccessLevel,
  EntityTypes,
  createCalendar,
  getCalendarPermissions,
  getCalendars,
  getDefaultCalendarSync,
  listEvents,
  requestCalendarPermissions,
  type ExpoCalendar,
} from "expo-calendar";
import * as IntentLauncher from "expo-intent-launcher";
// Import local-only notification modules directly so Expo Go doesn't trigger
// remote push token auto-registration warnings on Android (SDK 53+).
import { cancelAllScheduledNotificationsAsync } from "expo-notifications/build/cancelAllScheduledNotificationsAsync";
import { cancelScheduledNotificationAsync } from "expo-notifications/build/cancelScheduledNotificationAsync";
import { getAllScheduledNotificationsAsync } from "expo-notifications/build/getAllScheduledNotificationsAsync";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-notifications/build/NotificationPermissions";
import { IosAuthorizationStatus } from "expo-notifications/build/NotificationPermissions.types";
import { SchedulableTriggerInputTypes } from "expo-notifications/build/Notifications.types";
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import { scheduleNotificationAsync } from "expo-notifications/build/scheduleNotificationAsync";
import { setNotificationChannelAsync } from "expo-notifications/build/setNotificationChannelAsync";
import { Platform } from "react-native";

const REMINDER_CHANNEL_ID = "friday-reminders";

let handlerInitialized = false;
let customChannelReady = false;

export function initializeNotificationsRuntime(): void {
  if (handlerInitialized || Platform.OS === "web") return;
  handlerInitialized = true;

  try {
    setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Ignore handler setup issues in unsupported preview environments
  }
}

async function ensureAndroidChannelReady(): Promise<string | undefined> {
  if (Platform.OS !== "android") return undefined;
  if (customChannelReady) return REMINDER_CHANNEL_ID;

  // Expo Go on Android manages its own scoped notification channel internally and
  // throws a NullPointerException in ExpoNotificationChannelManager when creating custom channels.
  try {
    if (isRunningInExpoGo()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  try {
    // Note: omit `sound` so Android uses Settings.System.DEFAULT_NOTIFICATION_URI
    // (passing `sound: "default"` looks up a non-existent raw resource named "default").
    const ch = await setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: "Friday Reminders & Alerts",
      importance: AndroidImportance.HIGH,
      enableVibrate: true,
    });
    if (ch) {
      customChannelReady = true;
      return REMINDER_CHANNEL_ID;
    }
  } catch {
    customChannelReady = false;
  }
  return undefined;
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  initializeNotificationsRuntime();

  try {
    const current = await getPermissionsAsync();
    if (
      current.granted ||
      current.ios?.status === IosAuthorizationStatus.PROVISIONAL
    ) {
      return true;
    }
    const requested = await requestPermissionsAsync();
    return Boolean(
      requested.granted ||
        requested.ios?.status === IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

export function formatReadableDateTime(date: Date): string {
  try {
    return date.toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return date.toISOString();
  }
}

export function formatClock12h(hour: number, minute: number): string {
  const h = ((hour % 24) + 24) % 24;
  const m = Math.max(0, Math.min(59, minute));
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export async function scheduleLocalReminder(input: {
  title: string;
  body: string;
  delayMinutes?: number;
  triggerAtIso?: string;
  repeatDaily?: boolean;
  dailyHour?: number;
  dailyMinute?: number;
}): Promise<{
  ok: boolean;
  reminderId?: string;
  scheduledLabel?: string;
  error?: string;
}> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      error: "Local phone notifications require the Android or iOS app.",
    };
  }

  const permitted = await ensureNotificationPermission();
  if (!permitted) {
    return {
      ok: false,
      error:
        "Notification permission denied. Please enable Notifications for Friday in phone Settings.",
    };
  }

  const channelId = await ensureAndroidChannelReady();
  const cleanTitle = input.title.trim() || "Friday Reminder";
  const cleanBody = input.body.trim() || cleanTitle;

  try {
    if (
      input.repeatDaily &&
      typeof input.dailyHour === "number" &&
      !Number.isNaN(input.dailyHour)
    ) {
      const hour = Math.max(0, Math.min(23, Math.floor(input.dailyHour)));
      const minute =
        typeof input.dailyMinute === "number" && !Number.isNaN(input.dailyMinute)
          ? Math.max(0, Math.min(59, Math.floor(input.dailyMinute)))
          : 0;

      const reminderId = await scheduleNotificationAsync({
        content: {
          title: cleanTitle,
          body: cleanBody,
          sound: true,
          data: { source: "friday_reminder", repeatDaily: true },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          ...(channelId ? { channelId } : {}),
          hour,
          minute,
        },
      });

      return {
        ok: true,
        reminderId,
        scheduledLabel: `Daily at ${formatClock12h(hour, minute)}`,
      };
    }

    if (
      typeof input.delayMinutes === "number" &&
      !Number.isNaN(input.delayMinutes) &&
      input.delayMinutes > 0
    ) {
      const seconds = Math.max(2, Math.round(input.delayMinutes * 60));
      const targetDate = new Date(Date.now() + seconds * 1000);

      const reminderId = await scheduleNotificationAsync({
        content: {
          title: cleanTitle,
          body: cleanBody,
          sound: true,
          data: {
            source: "friday_reminder",
            targetIso: targetDate.toISOString(),
          },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          ...(channelId ? { channelId } : {}),
          seconds,
          repeats: false,
        },
      });

      const label =
        seconds < 60
          ? `In ${seconds} sec (${formatReadableDateTime(targetDate)})`
          : `In ${Math.round(seconds / 60)} min (${formatReadableDateTime(targetDate)})`;

      return {
        ok: true,
        reminderId,
        scheduledLabel: label,
      };
    }

    if (input.triggerAtIso?.trim()) {
      const parsed = new Date(input.triggerAtIso.trim());
      if (Number.isNaN(parsed.getTime())) {
        return {
          ok: false,
          error: `Invalid ISO date-time "${input.triggerAtIso}".`,
        };
      }
      if (parsed.getTime() <= Date.now() + 2000) {
        return {
          ok: false,
          error:
            "Reminder time must be in the future. Please check the date/time.",
        };
      }

      const reminderId = await scheduleNotificationAsync({
        content: {
          title: cleanTitle,
          body: cleanBody,
          sound: true,
          data: {
            source: "friday_reminder",
            targetIso: parsed.toISOString(),
          },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          ...(channelId ? { channelId } : {}),
          date: parsed,
        },
      });

      return {
        ok: true,
        reminderId,
        scheduledLabel: formatReadableDateTime(parsed),
      };
    }

    return {
      ok: false,
      error:
        "Provide delayMinutes, triggerAtIso, or repeatDaily (dailyHour/dailyMinute) to schedule a reminder.",
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to schedule notification.",
    };
  }
}

export async function manageScheduledReminders(input: {
  action: "list" | "cancel_one" | "cancel_all";
  reminderId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  ok: boolean;
  totalCount?: number;
  shownCount?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
  reminders?: Array<{
    id: string;
    title: string;
    body: string;
    triggerSummary: string;
  }>;
  message?: string;
  error?: string;
}> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      error: "Scheduled phone notifications are only supported on Android/iOS.",
    };
  }

  try {
    if (input.action === "cancel_all") {
      await cancelAllScheduledNotificationsAsync();
      return {
        ok: true,
        message: "All scheduled local reminders have been cancelled.",
      };
    }

    if (input.action === "cancel_one") {
      const id = (input.reminderId || "").trim();
      if (!id) {
        return {
          ok: false,
          error: "reminderId is required when action is 'cancel_one'.",
        };
      }
      await cancelScheduledNotificationAsync(id);
      return {
        ok: true,
        message: `Cancelled reminder ${id}.`,
      };
    }

    const cleanLimit = Math.max(3, Math.min(20, input.limit || 8));
    const cleanOffset = Math.max(0, Math.floor(input.offset || 0));

    const list = await getAllScheduledNotificationsAsync();
    const mapped = list.map((item) => {
      const trig = item.trigger as Record<string, unknown> | null;
      const dataObj = (item.content.data || {}) as Record<string, unknown>;
      let triggerSummary = "Scheduled";

      if (typeof dataObj.targetIso === "string") {
        const d = new Date(dataObj.targetIso);
        if (!Number.isNaN(d.getTime())) {
          triggerSummary = formatReadableDateTime(d);
        }
      } else if (
        trig &&
        typeof trig.hour === "number" &&
        typeof trig.minute === "number"
      ) {
        triggerSummary = `Daily at ${formatClock12h(trig.hour, trig.minute)}`;
      } else if (trig && typeof trig.value === "number") {
        triggerSummary = formatReadableDateTime(new Date(trig.value));
      }

      return {
        id: item.identifier,
        title: item.content.title || "Reminder",
        body: (item.content.body || "").slice(0, 120),
        triggerSummary,
      };
    });

    const slice = mapped.slice(cleanOffset, cleanOffset + cleanLimit);
    const hasMore = cleanOffset + slice.length < mapped.length;

    return {
      ok: true,
      totalCount: mapped.length,
      shownCount: slice.length,
      hasMore,
      nextOffset: hasMore ? cleanOffset + cleanLimit : null,
      reminders: slice,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not read scheduled reminders.",
    };
  }
}

export async function setNativeAlarmOrTimer(input: {
  mode: "alarm" | "timer";
  label?: string;
  hour?: number;
  minute?: number;
  durationSeconds?: number;
}): Promise<{
  ok: boolean;
  summary?: string;
  method?: "android_clock_intent" | "notification_fallback";
  error?: string;
}> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      error: "System Clock alarms and timers require Android or iOS.",
    };
  }

  const label = input.label?.trim() || "Friday";

  if (input.mode === "timer") {
    const secs =
      typeof input.durationSeconds === "number" &&
      !Number.isNaN(input.durationSeconds)
        ? Math.max(5, Math.round(input.durationSeconds))
        : 0;
    if (!secs) {
      return {
        ok: false,
        error: "durationSeconds is required when mode is 'timer'.",
      };
    }

    if (Platform.OS === "android") {
      try {
        await IntentLauncher.startActivityAsync(
          "android.intent.action.SET_TIMER",
          {
            extra: {
              "android.intent.extra.alarm.LENGTH": secs,
              "android.intent.extra.alarm.MESSAGE": label,
              "android.intent.extra.alarm.SKIP_UI": false,
            },
          }
        );
        const minsLabel =
          secs >= 60 ? `${Math.round(secs / 60)} min` : `${secs} sec`;
        return {
          ok: true,
          method: "android_clock_intent",
          summary: `Opened Clock Timer (${minsLabel} · ${label})`,
        };
      } catch {
        // Fallback to local notification below if device has no Clock SET_TIMER receiver
      }
    }

    const fallback = await scheduleLocalReminder({
      title: `⏱️ Timer Done: ${label}`,
      body: `Your ${Math.round(secs / 60) || 1}-minute timer has finished!`,
      delayMinutes: secs / 60,
    });

    return fallback.ok
      ? {
          ok: true,
          method: "notification_fallback",
          summary: `Timer alert set (${fallback.scheduledLabel})`,
        }
      : { ok: false, error: fallback.error };
  }

  // mode === "alarm"
  if (typeof input.hour !== "number" || Number.isNaN(input.hour)) {
    return {
      ok: false,
      error: "24-hour 'hour' (0-23) is required when mode is 'alarm'.",
    };
  }
  const hour = Math.max(0, Math.min(23, Math.floor(input.hour)));
  const minute =
    typeof input.minute === "number" && !Number.isNaN(input.minute)
      ? Math.max(0, Math.min(59, Math.floor(input.minute)))
      : 0;
  const timeText = formatClock12h(hour, minute);

  if (Platform.OS === "android") {
    try {
      await IntentLauncher.startActivityAsync(
        "android.intent.action.SET_ALARM",
        {
          extra: {
            "android.intent.extra.alarm.HOUR": hour,
            "android.intent.extra.alarm.MINUTES": minute,
            "android.intent.extra.alarm.MESSAGE": label,
            "android.intent.extra.alarm.SKIP_UI": false,
          },
        }
      );
      return {
        ok: true,
        method: "android_clock_intent",
        summary: `Alarm set in Clock for ${timeText} (${label})`,
      };
    } catch {
      // Fallback to local notification if Clock intent unavailable
    }
  }

  // Next occurrence calculation for notification fallback
  const nextAlarm = new Date();
  nextAlarm.setHours(hour, minute, 0, 0);
  if (nextAlarm.getTime() <= Date.now()) {
    nextAlarm.setDate(nextAlarm.getDate() + 1);
  }

  const fallback = await scheduleLocalReminder({
    title: `⏰ Alarm: ${label}`,
    body: `Scheduled alarm for ${timeText}`,
    triggerAtIso: nextAlarm.toISOString(),
  });

  return fallback.ok
    ? {
        ok: true,
        method: "notification_fallback",
        summary: `Alarm alert scheduled for ${timeText}`,
      }
    : { ok: false, error: fallback.error };
}

async function ensureCalendarAccess(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const existing = await getCalendarPermissions();
    if (existing.granted) return true;
    const requested = await requestCalendarPermissions();
    return Boolean(requested.granted);
  } catch {
    return false;
  }
}

export async function readPhoneCalendarEvents(input: {
  startDateIso?: string;
  endDateIso?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  ok: boolean;
  permission?: "granted" | "denied" | "unavailable";
  rangeStart?: string;
  rangeEnd?: string;
  totalMatching?: number;
  shownCount?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
  followUpHint?: string;
  events?: Array<{
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    allDay: boolean;
    location?: string;
    notes?: string;
  }>;
  error?: string;
}> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      permission: "unavailable",
      error: "Phone calendar access requires Android or iOS.",
    };
  }

  const granted = await ensureCalendarAccess();
  if (!granted) {
    return {
      ok: false,
      permission: "denied",
      error:
        "Calendar permission denied. Please grant Calendar access in phone Settings.",
    };
  }

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  );

  const startDate = input.startDateIso?.trim()
    ? new Date(input.startDateIso.trim())
    : startOfToday;
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, error: `Invalid startDateIso: ${input.startDateIso}` };
  }

  const endDate = input.endDateIso?.trim()
    ? new Date(input.endDateIso.trim())
    : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    return { ok: false, error: "endDateIso must be after startDateIso." };
  }

  try {
    const calendars =
      Platform.OS === "ios"
        ? await getCalendars(EntityTypes.EVENT)
        : await getCalendars();

    if (calendars.length === 0) {
      return {
        ok: true,
        permission: "granted",
        rangeStart: startDate.toISOString(),
        rangeEnd: endDate.toISOString(),
        events: [],
      };
    }

    const rawEvents = await listEvents(calendars, startDate, endDate);
    const q = (input.query || "").trim().toLowerCase();
    const cleanLimit = Math.max(3, Math.min(20, input.limit || 8));
    const cleanOffset = Math.max(0, Math.floor(input.offset || 0));

    const sortedAll = rawEvents
      .filter((ev) => {
        if (!q) return true;
        const hay = `${ev.title || ""} ${ev.location || ""} ${ev.notes || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ta = new Date(a.startDate).getTime();
        const tb = new Date(b.startDate).getTime();
        return ta - tb;
      });

    const filtered = sortedAll
      .slice(cleanOffset, cleanOffset + cleanLimit)
      .map((ev) => ({
        id: ev.id,
        title: ev.title || "(Untitled Event)",
        startDate: new Date(ev.startDate).toLocaleString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        endDate: new Date(ev.endDate).toLocaleString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        allDay: Boolean(ev.allDay),
        ...(ev.location ? { location: ev.location.slice(0, 100) } : {}),
        ...(ev.notes ? { notes: ev.notes.slice(0, 120) } : {}),
      }));

    const hasMore = cleanOffset + filtered.length < sortedAll.length;

    return {
      ok: true,
      permission: "granted",
      rangeStart: formatReadableDateTime(startDate),
      rangeEnd: formatReadableDateTime(endDate),
      totalMatching: sortedAll.length,
      shownCount: filtered.length,
      hasMore,
      nextOffset: hasMore ? cleanOffset + cleanLimit : null,
      ...(hasMore
        ? {
            followUpHint: `Showing ${cleanOffset + 1}–${cleanOffset + filtered.length} of ${sortedAll.length} events. Present ONLY these and ask if user wants more (offset=${cleanOffset + cleanLimit}).`,
          }
        : {}),
      events: filtered,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to read events from phone calendar.",
    };
  }
}

async function resolveWritableCalendar(): Promise<ExpoCalendar | null> {
  if (Platform.OS === "ios") {
    try {
      const def = getDefaultCalendarSync();
      if (def) return def;
    } catch {
      // Fallback to getCalendars
    }
    const cals = await getCalendars(EntityTypes.EVENT);
    return cals.find((c) => c.allowsModifications) || cals[0] || null;
  }

  const cals = await getCalendars();
  const primaryWritable =
    cals.find((c) => c.allowsModifications && c.isPrimary) ||
    cals.find((c) => c.allowsModifications);
  if (primaryWritable) return primaryWritable;

  // Create a local Friday Calendar on Android if none exists
  return await createCalendar({
    title: "Friday Assistant",
    color: "#F27D52",
    name: "friday_assistant_calendar",
    ownerAccount: "personal",
    accessLevel: CalendarAccessLevel.OWNER,
    source: {
      isLocalAccount: true,
      name: "Friday Assistant",
      type: "LOCAL",
    },
  });
}

export async function createPhoneCalendarEvent(input: {
  title: string;
  startDateIso: string;
  endDateIso?: string;
  location?: string;
  notes?: string;
  reminderMinutesBefore?: number;
}): Promise<{
  ok: boolean;
  eventId?: string;
  calendarTitle?: string;
  error?: string;
}> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      error: "Saving to phone calendar is only supported on Android/iOS.",
    };
  }

  const granted = await ensureCalendarAccess();
  if (!granted) {
    return {
      ok: false,
      error:
        "Calendar permission denied. Please grant Calendar access in phone Settings.",
    };
  }

  const start = new Date(input.startDateIso.trim());
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Invalid start date/time." };
  }

  const end = input.endDateIso?.trim()
    ? new Date(input.endDateIso.trim())
    : new Date(start.getTime() + 60 * 60 * 1000);
  const validEnd =
    !Number.isNaN(end.getTime()) && end > start
      ? end
      : new Date(start.getTime() + 60 * 60 * 1000);

  const reminderMin =
    typeof input.reminderMinutesBefore === "number" &&
    !Number.isNaN(input.reminderMinutesBefore) &&
    input.reminderMinutesBefore >= 0
      ? Math.round(input.reminderMinutesBefore)
      : 15;

  try {
    const targetCalendar = await resolveWritableCalendar();
    if (!targetCalendar) {
      return {
        ok: false,
        error: "No writable calendar found on this device.",
      };
    }

    const created = await targetCalendar.createEvent({
      title: input.title.trim() || "Meeting",
      startDate: start,
      endDate: validEnd,
      location: input.location?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      alarms: [{ relativeOffset: -reminderMin }],
    });

    return {
      ok: true,
      eventId: created.id,
      calendarTitle: targetCalendar.title,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not create event in phone calendar.",
    };
  }
}
