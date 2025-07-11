import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

export const scheduleDailyReminder = async (timeString: string, userId: string): Promise<boolean> => {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== 'granted') {
      Alert.alert(
        'Notification Permission Required',
        'Please enable notifications to set reminders.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [time, period] = timeString.split(' ');
    let [hour, minute] = time.split(':').map(Number);

    if (period === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }

    const now = new Date();
    const triggerDate = new Date();
    triggerDate.setHours(hour, minute, 0, 0);

    // If time has already passed today, schedule for tomorrow
    if (triggerDate <= now) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time for your workout!",
        body: "Don't forget to complete your daily exercises.",
        sound: true,
        data: { type: 'daily_reminder', userId },
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });

    console.log(`Daily reminder scheduled for ${timeString}`);
    return true;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return false;
  }
};