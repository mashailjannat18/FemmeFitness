import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import * as Notifications from 'expo-notifications';
import { notificationRefresh } from '@/services/notificationRefresh';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Layout() {
  const { user } = useUserAuth();

  useEffect(() => {
    // Initialize notification refresh with the current user ID
    notificationRefresh.initialize(user?.id || null);

    // Clean up on unmount or user change
    return () => {
      notificationRefresh.stop();
    };
  }, [user?.id]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="MessageScreen" options={{ headerShown: false }} />
      <Stack.Screen name="EntryScreen" options={{ headerShown: false }} />
      <Stack.Screen name="Question1" options={{ headerShown: false }} />
      <Stack.Screen name="Question2" options={{ headerShown: false }} />
      <Stack.Screen name="Question2.1" options={{ headerShown: false }} />
      <Stack.Screen name="Question3" options={{ headerShown: false }} />
      <Stack.Screen name="Question4" options={{ headerShown: false }} />
      <Stack.Screen name="Question5" options={{ headerShown: false }} />
      <Stack.Screen name="Question6" options={{ headerShown: false }} />
      <Stack.Screen name="Question7" options={{ headerShown: false }} />
      <Stack.Screen name="Question8" options={{ headerShown: false }} />
      <Stack.Screen name="Question9" options={{ headerShown: false }} />
      <Stack.Screen name="Question10" options={{ headerShown: false }} />
      <Stack.Screen name="Login" options={{ headerShown: false }} />
      <Stack.Screen name="Exercises" options={{ headerShown: false }} />
      <Stack.Screen name="ExerciseDetail" options={{ headerShown: false }} />
      <Stack.Screen name="ExercisePlayback" options={{ headerShown: false }} />
      <Stack.Screen name="AccountInformation" options={{ headerShown: false }} />
      <Stack.Screen name="DiseaseInformation" options={{ headerShown: false }} />
      <Stack.Screen name="GoalSetting" options={{ headerShown: false }} />
      <Stack.Screen name="IntensitySetting" options={{ headerShown: false }} />
      <Stack.Screen name="MealDetail" options={{ headerShown: false }} />
      <Stack.Screen name="MealDetails2" options={{ headerShown: false }} />
      <Stack.Screen name="SuggestedMeals" options={{ headerShown: false }} />
      <Stack.Screen name="PeriodsCalendar" options={{ headerShown: false }} />
      <Stack.Screen name="PeriodsLog" options={{ headerShown: false }} />
      <Stack.Screen name="PersonalInformation" options={{ headerShown: false }} />
      <Stack.Screen name="Reminder" options={{ headerShown: false }} />
      <Stack.Screen name="DailyProgress" options={{ headerShown: false }} />
      <Stack.Screen name="LoggedFood" options={{ headerShown: false }} />
      <Stack.Screen name="SleepTrack" options={{ headerShown: false }} />
      <Stack.Screen name="WaterIntake" options={{ headerShown: false }} />
      <Stack.Screen name="ConfirmCode" options={{ headerShown: false }} />
      <Stack.Screen name="ConfirmResetCode" options={{ headerShown: false }} />
      <Stack.Screen name="ForgotPassword" options={{ headerShown: false }} />
      <Stack.Screen name="ResetPassword" options={{ headerShown: false }} />
      <Stack.Screen name="VerifyCurrentEmail" options={{ headerShown: false }} />
      <Stack.Screen name="VerifyNewEmail" options={{ headerShown: false }} />
    </Stack>
  );
}