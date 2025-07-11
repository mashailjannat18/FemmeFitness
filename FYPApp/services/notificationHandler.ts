import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import { checkWorkoutCompletion } from './workoutUtils';

// Handle received notifications
export const setupNotificationHandler = () => {
  Notifications.addNotificationReceivedListener(handleNotification);
  Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
};

const handleNotification = async (notification: Notifications.Notification) => {
  if (notification.request.content.data.type === 'daily_reminder') {
    // Check if user has completed today's workout
    const userId = notification.request.content.data.userId;
    if (userId) {
      const isCompleted = await checkWorkoutCompletion(userId);
      
      // Log the notification
      await supabase.from('NotificationLogs').insert({
        user_id: userId,
        notification_type: 'daily_reminder',
        was_triggered: true,
        workout_completed: isCompleted,
      });

      // If workout is already completed, no need to show the notification
      if (isCompleted) {
        await Notifications.dismissNotificationAsync(notification.request.identifier);
      }
    }
  }
};

const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
  // Handle when user taps on the notification
  // You can navigate to the workout screen here if needed
  console.log('Notification tapped:', response);
};