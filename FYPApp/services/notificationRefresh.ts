import { supabase } from '@/lib/supabase';
import { scheduleDailyReminder } from '@/services/notificationUtils';
import * as Notifications from 'expo-notifications';

// Singleton to manage the refresh interval
class NotificationRefresh {
  private static instance: NotificationRefresh | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private lastScheduledTime: string | null = null;
  private lastUserId: string | null = null;

  private constructor() {}

  public static getInstance(): NotificationRefresh {
    if (!NotificationRefresh.instance) {
      NotificationRefresh.instance = new NotificationRefresh();
    }
    return NotificationRefresh.instance;
  }

  public initialize(userId: string | null) {
    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Skip if no user ID
    if (!userId) {
      this.lastUserId = null;
      this.lastScheduledTime = null;
      return;
    }

    // Set up interval only if user ID changes or is new
    if (userId !== this.lastUserId) {
      this.lastUserId = userId;
      this.lastScheduledTime = null;

      // Check immediately and then every minute
      this.checkAndScheduleNotifications(userId);
      this.intervalId = setInterval(() => this.checkAndScheduleNotifications(userId), 60 * 1000);
    }
  }

  private async checkAndScheduleNotifications(userId: string) {
    try {
      const { data, error } = await supabase
        .from('UserNotifications')
        .select('reminder_enabled, reminder_time')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching reminder settings:', error);
        return;
      }

      if (data && data.reminder_enabled && data.reminder_time) {
        // Only schedule if the time has changed or no schedule exists
        if (data.reminder_time !== this.lastScheduledTime) {
          const success = await scheduleDailyReminder(data.reminder_time, userId);
          if (success) {
            this.lastScheduledTime = data.reminder_time;
          }
        }
      } else {
        // Cancel notifications if reminder is disabled or no time is set
        await Notifications.cancelAllScheduledNotificationsAsync();
        this.lastScheduledTime = null;
      }
    } catch (error) {
      console.error('Error in checkAndScheduleNotifications:', error);
    }
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.lastScheduledTime = null;
      this.lastUserId = null;
    }
  }
}

export const notificationRefresh = NotificationRefresh.getInstance();