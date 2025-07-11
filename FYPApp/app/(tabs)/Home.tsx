declare module '*.png' {
  const value: any;
  export default value;
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  BackHandler, 
  Modal, 
  TextInput, 
  Dimensions,
  RefreshControl,
  Animated,
  Easing
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, LinearGradient, Defs, Stop } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { Calendar } from 'react-native-calendars';
import Logo from '@/assets/images/Logo.png';
import Water from '@/assets/images/4.png';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Exercise = {
  id: string;
  exercise_name: string;
  calories_burned: number;
  reps: string;
  description: string;
  daily_workout_id: string;
  image?: string;
};

type DailyWorkout = {
  id: string;
  day_name: string;
  daily_workout_date: string;
  focus: string;
  total_duration_min: number;
  total_calories_burned: number;
  exercises: Exercise[];
};

type DailyMeal = {
  id: string;
  daily_workout_id: string;
  daily_calories: number;
  carbs_grams: number;
  protein_grams: number;
  fat_grams: number;
  sleep_hours: number;
  water_litres: number;
};

type WorkoutDay = {
  day_number: number;
  day_name: string;
  date: string;
};

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  gradientId: string;
  displayText?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 160,
  strokeWidth = 16,
  gradientId,
  displayText,
}): JSX.Element => {
  const cardWidth = SCREEN_WIDTH * 0.48 - SCREEN_WIDTH * 0.08;
  const dynamicSize = cardWidth * 0.7;
  const dynamicStrokeWidth = dynamicSize * 0.1;
  const radius = (dynamicSize - dynamicStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const stops =
    gradientId === 'caloriesBurntGradient'
      ? [
          { offset: '0%', stopColor: '#FF4040' },
          { offset: '100%', stopColor: '#8B0000' },
        ]
      : gradientId === 'caloriesGainedGradient'
      ? [
          { offset: '0%', stopColor: '#FF69B4' },
          { offset: '100%', stopColor: '#FF1493' },
        ]
      : [
          { offset: '0%', stopColor: '#BA55D3' },
          { offset: '100%', stopColor: '#4B0082' },
        ];

  return (
    <View style={{ position: 'relative', width: dynamicSize, height: dynamicSize, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={dynamicSize} height={dynamicSize}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {stops.map((stop, index) => (
              <Stop key={index} offset={stop.offset} stopColor={stop.stopColor} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle
          stroke="#E5E7EB"
          fill="none"
          cx={dynamicSize / 2}
          cy={dynamicSize / 2}
          r={radius}
          strokeWidth={2}
        />
        <Circle
          stroke={`url(#${gradientId})`}
          fill="none"
          cx={dynamicSize / 2}
          cy={dynamicSize / 2}
          r={radius}
          strokeWidth={dynamicStrokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${dynamicSize / 2} ${dynamicSize / 2})`}
        />
      </Svg>
      {displayText && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: dynamicSize * 0.10,
              fontWeight: '600',
              color:
                gradientId === 'caloriesBurntGradient'
                  ? '#FF4040'
                  : gradientId === 'caloriesGainedGradient'
                  ? '#e45ea9'
                  : '#BA55D3',
              textAlign: 'center',
            }}
          >
            {displayText}
          </Text>
        </View>
      )}
    </View>
  );
};

interface WaterGlassProps {
  progress: number;
  actualLiters: number;
  expectedLiters: number;
  onLogPress: () => void;
}

const WaterGlass: React.FC<WaterGlassProps> = ({ actualLiters, expectedLiters, onLogPress }): JSX.Element => {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={styles.progressText}>{actualLiters.toFixed(1)}/{expectedLiters.toFixed(1)} L</Text>
      <TouchableOpacity style={styles.logButton} onPress={onLogPress}>
        <Text style={styles.logButtonText}>Log Water</Text>
      </TouchableOpacity>
    </View>
  );
};

interface SleepCardProps {
  progress: number;
  expectedHours: number;
  onLogPress: () => void;
}

const SleepCard: React.FC<SleepCardProps> = ({ progress, expectedHours, onLogPress }): JSX.Element => {
  return (
    <View style={styles.sleepContainer}>
      <View style={styles.sleepContent}>
        <MaterialCommunityIcons name="sleep" size={SCREEN_WIDTH * 0.08} color="#fff" />
        <Text style={styles.sleepTitle}>Sleep</Text>
        <Text style={styles.sleepProgressText}>
          {progress.toFixed(1)}/{expectedHours.toFixed(1)} hrs
        </Text>
        <TouchableOpacity style={styles.sleepLogButton} onPress={onLogPress}>
          <Text style={styles.sleepLogButtonText}>Log Sleep</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

function getCurrentMonth() {
  const now = new Date();
  return now.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function getWorkoutDays(challengeDays: number, startDate: string): WorkoutDay[] {
  const days: WorkoutDay[] = [];
  const start = new Date(startDate);
  for (let i = 1; i <= challengeDays; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + (i - 1));
    const dayName = date.toLocaleString('default', { weekday: 'long' });
    days.push({
      day_number: i,
      day_name: `Day ${i} (${dayName})`,
      date: date.toISOString().split('T')[0],
    });
  }
  return days;
}

const getTodayDate = () => {
  return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
};

export default function Home() {
  const [userGoal, setUserGoal] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [dailyWorkout, setDailyWorkout] = useState<DailyWorkout | null>(null);
  const [dailyMeal, setDailyMeal] = useState<DailyMeal | null>(null);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [preferredRestDay, setPreferredRestDay] = useState<string | null>(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [totalCaloriesToBurn, setTotalCaloriesToBurn] = useState(0);
  const [caloriesBurnedToday, setCaloriesBurnedToday] = useState(0);
  const [expectedCaloriesGained, setExpectedCaloriesGained] = useState(0);
  const [actualCaloriesGained, setActualCaloriesGained] = useState(0);
  const [currentDay, setCurrentDay] = useState(getTodayDate());
  const [sleepHours, setSleepHours] = useState<number>(0);
  const [expectedSleepHours, setExpectedSleepHours] = useState<number>(0);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [inputSleepHours, setInputSleepHours] = useState<string>('');
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [inputWaterLiters, setInputWaterLiters] = useState<string>('');
  const [actualWaterLiters, setActualWaterLiters] = useState<number>(0);
  const [expectedWaterLiters, setExpectedWaterLiters] = useState<number>(0);
  const [streak, setStreak] = useState(0);
  const [markedDates, setMarkedDates] = useState<{ [key: string]: { marked: boolean; dotColor?: string; selected?: boolean; selectedColor?: string } }>({});
  const [renderKey, setRenderKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { user } = useUserAuth();
  const schedulerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    if (!user || !user.id) {
      router.push('/Login');
      return;
    }
    fetchUserGoal();
    fetchStreakAndCompletions();
  }, [user, router]);

  useEffect(() => {
    const checkDayChange = () => {
      const newDay = getTodayDate();
      if (newDay !== currentDay) {
        console.log('Day changed from', currentDay, 'to', newDay);
        setCurrentDay(newDay);
        setCurrentMonth(getCurrentMonth());
        fetchWorkoutData();
      }
    };
  
    const intervalId = setInterval(checkDayChange, 60 * 1000);
  
    return () => clearInterval(intervalId);
  }, [currentDay]);

  useFocusEffect(
    useCallback(() => {
      fetchWorkoutData();
      const backAction = () => true;
      BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => BackHandler.removeEventListener('hardwareBackPress', backAction);
    }, [user])
  );

  useEffect(() => {
    const scheduleStreakReset = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(0, 0, 0, 0);
      midnight.setDate(midnight.getDate() + 1);

      const timeUntilMidnight = midnight.getTime() - now.getTime();
      console.log('Time until next midnight:', timeUntilMidnight / (1000 * 60), 'minutes');

      const resetStreak = async () => {
        if (!user?.id) return;
        const localDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
        const { error } = await supabase.rpc('reset_streak_local', { current_local_date: localDate });
        if (error) console.log('Error resetting streak:', error.message);
        else await fetchStreakAndCompletions();
      };

      if (now.getHours() === 0 && now.getMinutes() === 0) {
        resetStreak();
      }

      schedulerIntervalRef.current = setTimeout(() => {
        resetStreak();
        schedulerIntervalRef.current = setInterval(resetStreak, 24 * 60 * 60 * 1000);
      }, timeUntilMidnight);

      return () => {
        if (schedulerIntervalRef.current) {
          clearTimeout(schedulerIntervalRef.current);
          clearInterval(schedulerIntervalRef.current);
        }
      };
    };

    scheduleStreakReset();
  }, [user]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const fetchStreakAndCompletions = async () => {
    if (!user?.id) return;

    try {
      const { data: streakData, error: streakError } = await supabase
        .from('Streak')
        .select('current_streak, last_completion_date')
        .eq('user_id', user.id)
        .single();

      if (streakError && streakError.code !== 'PGRST116') {
        console.error('Error fetching streak:', streakError.message);
        return;
      }

      if (streakData) {
        setStreak(streakData.current_streak || 0);
      } else {
        await supabase.from('Streak').insert({
          user_id: user.id,
          current_streak: 0,
          last_completion_date: null,
        });
        setStreak(0);
      }

      const { data: dailyWorkouts, error: dailyWorkoutsError } = await supabase
        .from('DailyWorkouts')
        .select('id, daily_workout_date')
        .eq('workout_plan_id', (await supabase
          .from('WorkoutPlans')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single()).data?.id);

      if (dailyWorkoutsError) {
        console.error('Error fetching daily workouts:', dailyWorkoutsError.message);
        return;
      }

      const dailyWorkoutIds = dailyWorkouts.map(dw => dw.id);
      const { data: exercises, error: exercisesError } = await supabase
        .from('Workouts')
        .select('id, daily_workout_id')
        .in('daily_workout_id', dailyWorkoutIds);

      if (exercisesError) {
        console.error('Error fetching exercises:', exercisesError.message);
        return;
      }

      const exercisesByDailyWorkout: { [key: string]: number } = {};
      exercises.forEach(ex => {
        exercisesByDailyWorkout[ex.daily_workout_id] = (exercisesByDailyWorkout[ex.daily_workout_id] || 0) + 1;
      });

      const { data: completions, error: completionsError } = await supabase
        .from('ExerciseCompletions')
        .select('daily_workout_id, completion_date, status')
        .eq('user_id', user.id)
        .in('status', ['completed', 'skipped']);

      if (completionsError) {
        console.error('Error fetching completions for calendar:', completionsError.message);
        return;
      }

      const completionsByDailyWorkout: { [key: string]: number } = {};
      completions.forEach(comp => {
        if (comp.status === 'completed' || comp.status === 'skipped') {
          completionsByDailyWorkout[comp.daily_workout_id] = (completionsByDailyWorkout[comp.daily_workout_id] || 0) + 1;
        }
      });

      const completedOrSkippedDays: Set<string> = new Set();
      dailyWorkouts.forEach(dw => {
        const totalExercises = exercisesByDailyWorkout[dw.id] || 0;
        const completedOrSkippedExercises = completionsByDailyWorkout[dw.id] || 0;
        if (totalExercises > 0 && totalExercises === completedOrSkippedExercises) {
          const date = new Date(dw.daily_workout_date).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
          completedOrSkippedDays.add(date);
        }
      });

      const today = getTodayDate();
      const newMarkedDates: { [key: string]: { marked: boolean; dotColor?: string; selected?: boolean; selectedColor?: string } } = {};

      completedOrSkippedDays.forEach(date => {
        newMarkedDates[date] = { marked: true, dotColor: '#FFA500', selected: true, selectedColor: '#FFA500' };
      });

      if (!completedOrSkippedDays.has(today)) {
        newMarkedDates[today] = { marked: true, dotColor: '#EC4899', selected: true, selectedColor: '#EC4899' };
      }

      setMarkedDates(newMarkedDates);
    } catch (error: any) {
      console.error('Error in fetchStreakAndCompletions:', error.message);
    }
  };

  const fetchUserGoal = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('User')
        .select('goal')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      setUserGoal(data?.goal || 'No goal set');
    } catch (error) {
      console.error('Error fetching user goal:', error);
      setUserGoal('Error loading goal');
    }
  };

  const fetchWorkoutData = async () => {
    if (!user || !user.id) return;

    let completionSubscription: RealtimeChannel | null = null;
    let mealSubscription: RealtimeChannel | null = null;

    try {
      const { data: userData } = await supabase
        .from('User')
        .select('preferred_rest_day')
        .eq('id', user.id)
        .single();
      setPreferredRestDay(userData?.preferred_rest_day || null);

      const { data: planData, error: planError } = await supabase
        .from('WorkoutPlans')
        .select('id, start_date, challenge_days')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (planError || !planData) throw new Error('No active workout plan found.');

      console.log('Workout Plan:', { id: planData.id, startDate: planData.start_date, challengeDays: planData.challenge_days });

      const days = getWorkoutDays(planData.challenge_days || 30, planData.start_date);
      setWorkoutDays(days);

      const today = getTodayDate();
      const startOfDay = `${today} 00:00:00`;
      const endOfDay = `${today} 23:59:59`;

      console.log('Real-time Date (today):', today);

      const { data: dailyData, error: dailyError } = await supabase
        .from('DailyWorkouts')
        .select('id, day_name, daily_workout_date, focus, total_duration_min, total_calories_burned')
        .eq('workout_plan_id', planData.id)
        .eq('daily_workout_date', today)
        .single();

      console.log('Fetched Daily Workout:', dailyData, 'Error:', dailyError);

      if (!dailyError && dailyData) {
        const { data: exerciseData, error: exerciseError } = await supabase
          .from('Workouts')
          .select('id, exercise_name, calories_burned, reps, description, daily_workout_id')
          .eq('daily_workout_id', dailyData.id);

        if (exerciseError) throw new Error('Error fetching exercises: ' + exerciseError.message);

        if (dailyData.focus.toLowerCase().includes('rest') && (!exerciseData || exerciseData.length === 0)) {
          setDailyWorkout({
            id: dailyData.id,
            day_name: dailyData.day_name,
            daily_workout_date: dailyData.daily_workout_date,
            focus: dailyData.focus,
            total_duration_min: dailyData.total_duration_min,
            total_calories_burned: dailyData.total_calories_burned,
            exercises: [],
          });
          setProgressPercentage(0);
          setTotalCaloriesToBurn(0);
          setCaloriesBurnedToday(0);
          setExpectedCaloriesGained(0);
          setActualCaloriesGained(0);
        } else {
          const totalCalories = exerciseData?.reduce((sum: number, exercise: Exercise) => sum + (exercise.calories_burned || 0), 0) || 0;
          setTotalCaloriesToBurn(totalCalories);

          const { data: completionData, error: completionError } = await supabase
            .from('ExerciseCompletions')
            .select('workout_id, calories_burned, status')
            .eq('user_id', user.id)
            .eq('daily_workout_id', dailyData.id)
            .gte('completion_date', startOfDay)
            .lte('completion_date', endOfDay);

          if (completionError) throw new Error('Error fetching completions: ' + completionError.message);

          const burnedCalories = completionData?.reduce((sum: number, completion: any) => sum + (completion.calories_burned || 0), 0) || 0;
          setCaloriesBurnedToday(burnedCalories);

          const totalExercises = exerciseData?.length || 1;
          const completedOrSkippedExercises = completionData?.filter(comp => comp.status === 'completed' || comp.status === 'skipped').length || 0;
          console.log(`Exercises for today (${today}): ${completedOrSkippedExercises} out of ${totalExercises} completed or skipped`);
          const calculatedPercentage = Math.round((completedOrSkippedExercises / totalExercises) * 100);

          setProgressPercentage(calculatedPercentage);
          setDailyWorkout({
            id: dailyData.id,
            day_name: dailyData.day_name,
            daily_workout_date: dailyData.daily_workout_date,
            focus: dailyData.focus,
            total_duration_min: dailyData.total_duration_min,
            total_calories_burned: dailyData.total_calories_burned,
            exercises: exerciseData || [],
          });

          completionSubscription = supabase
            .channel('exercise-completions-channel')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'ExerciseCompletions',
                filter: `user_id=eq.${user.id}`,
              },
              async (payload) => {
                console.log('ExerciseCompletions change received:', payload);
                const currentToday = getTodayDate();
                const currentStartOfDay = `${currentToday} 00:00:00`;
                const currentEndOfDay = `${currentToday} 23:59:59`;

                const { data: updatedCompletions, error: updatedError } = await supabase
                  .from('ExerciseCompletions')
                  .select('workout_id, calories_burned, status')
                  .eq('user_id', user.id)
                  .eq('daily_workout_id', dailyData.id)
                  .gte('completion_date', currentStartOfDay)
                  .lte('completion_date', currentEndOfDay);

                if (updatedError) {
                  console.error('Error fetching updated completions:', updatedError.message);
                  return;
                }

                const updatedBurnedCalories = updatedCompletions?.reduce((sum: number, completion: any) => sum + (completion.calories_burned || 0), 0) || 0;
                setCaloriesBurnedToday(updatedBurnedCalories);

                const updatedCompletedOrSkippedExercises = updatedCompletions?.filter(comp => comp.status === 'completed' || comp.status === 'skipped').length || 0;
                console.log(`Updated exercises for today (${currentToday}): ${updatedCompletedOrSkippedExercises} out of ${totalExercises} completed or skipped`);
                const updatedPercentage = Math.round((updatedCompletedOrSkippedExercises / totalExercises) * 100);
                setProgressPercentage(updatedPercentage);

                await fetchStreakAndCompletions();

                setRenderKey((prev) => prev + 1);
              }
            )
            .subscribe();
        }

        const { data: mealData, error: mealError } = await supabase
          .from('DailyMealPlans')
          .select('id, daily_workout_id, daily_calories, carbs_grams, protein_grams, fat_grams, calories_intake, water_litres, sleep_hours')
          .eq('daily_workout_id', dailyData.id)
          .single();

        if (!mealError && mealData) {
          setDailyMeal({
            id: mealData.id,
            daily_workout_id: mealData.daily_workout_id,
            daily_calories: mealData.daily_calories,
            carbs_grams: mealData.carbs_grams,
            protein_grams: mealData.protein_grams,
            fat_grams: mealData.fat_grams,
            sleep_hours: mealData.sleep_hours || 0,
            water_litres: mealData.water_litres || 0,
          });
          setExpectedCaloriesGained(mealData.daily_calories || 0);
          setActualCaloriesGained(mealData.calories_intake || 0);
          setExpectedWaterLiters(mealData.water_litres || 0);
          setExpectedSleepHours(mealData.sleep_hours || 0);

          mealSubscription = supabase
            .channel('daily-meal-plans-channel')
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'DailyMealPlans',
                filter: `daily_workout_id=eq.${dailyData.id}`,
              },
              async (payload) => {
                console.log('DailyMealPlans change received:', payload);
                const { data: updatedMeal, error: updatedMealError } = await supabase
                  .from('DailyMealPlans')
                  .select('calories_intake, water_litres, sleep_hours')
                  .eq('daily_workout_id', dailyData.id)
                  .single();

                if (updatedMealError) {
                  console.error('Error fetching updated meal data:', updatedMealError.message);
                  return;
                }

                setActualCaloriesGained(updatedMeal.calories_intake || 0);
                setExpectedWaterLiters(updatedMeal.water_litres || 0);
                setExpectedSleepHours(updatedMeal.sleep_hours || 0);

                setRenderKey((prev) => prev + 1);
              }
            )
            .subscribe();
        } else {
          console.warn('No DailyMeal found for daily_workout_id:', dailyData.id, 'Error:', mealError?.message);
          setDailyMeal(null);
          setExpectedCaloriesGained(0);
          setActualCaloriesGained(0);
          setExpectedWaterLiters(0);
          setExpectedSleepHours(0);
        }

        await fetchSleepHours(today);
        await fetchWaterIntake(today);

        const waterSubscription = supabase
          .channel('daily-water-records-channel')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'DailyWaterRecords',
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              console.log('DailyWaterRecords change received:', payload);
              const currentToday = getTodayDate();
              await fetchWaterIntake(currentToday);
              setRenderKey((prev) => prev + 1);
            }
          )
          .subscribe();

        const sleepSubscription = supabase
          .channel('daily-sleep-records-channel')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'DailySleepRecords',
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              console.log('DailySleepRecords change received:', payload);
              const currentToday = getTodayDate();
              await fetchSleepHours(currentToday);
              setRenderKey((prev) => prev + 1);
            }
          )
          .subscribe();

        const streakSubscription = supabase
          .channel('streak-channel')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'Streak',
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              console.log('Streak change received:', payload);
              await fetchStreakAndCompletions();
              setRenderKey((prev) => prev + 1);
            }
          )
          .subscribe();

        await fetchStreakAndCompletions();

        return () => {
          supabase.removeChannel(waterSubscription);
          supabase.removeChannel(sleepSubscription);
          supabase.removeChannel(streakSubscription);
          if (mealSubscription) supabase.removeChannel(mealSubscription);
          if (completionSubscription) supabase.removeChannel(completionSubscription);
        };
      } else {
        setDailyWorkout(null);
        setProgressPercentage(0);
        setTotalCaloriesToBurn(0);
        setCaloriesBurnedToday(0);
        setExpectedCaloriesGained(0);
        setActualCaloriesGained(0);
        setDailyMeal(null);
        setSleepHours(0);
        setExpectedSleepHours(0);
        setActualWaterLiters(0);
        setExpectedWaterLiters(0);
        setStreak(0);
        setMarkedDates({});
      }
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      setDailyWorkout(null);
      setDailyMeal(null);
      setWorkoutDays([]);
      setProgressPercentage(0);
      setTotalCaloriesToBurn(0);
      setCaloriesBurnedToday(0);
      setExpectedCaloriesGained(0);
      setActualCaloriesGained(0);
      setSleepHours(0);
      setExpectedSleepHours(0);
      setActualWaterLiters(0);
      setExpectedWaterLiters(0);
      setStreak(0);
      setMarkedDates({});
    }

    // fetchWorkoutData function
  };

  const fetchSleepHours = async (today: string) => {
    if (!user || !user.id) return;
    try {
      const { data: sleepData, error: sleepError } = await supabase
        .from('DailySleepRecords')
        .select('sleep_hours')
        .eq('user_id', user.id)
        .eq('sleep_date', today)
        .single();

      if (sleepError && sleepError.code !== 'PGRST116') {
        throw new Error('Error fetching sleep hours: ' + sleepError.message);
      }

      const newSleepHours = sleepData && sleepData.sleep_hours !== null ? sleepData.sleep_hours : 0;
      setSleepHours(newSleepHours);
    } catch (error) {
      console.error('Error fetching sleep hours:', error);
      setSleepHours(0);
    }
  };

  const fetchWaterIntake = async (today: string) => {
    if (!user || !user.id) return;
    try {
      const { data: waterData, error: waterError } = await supabase
        .from('DailyWaterRecords')
        .select('water_liters')
        .eq('user_id', user.id)
        .eq('water_date', today)
        .single();

      if (waterError && waterError.code !== 'PGRST116') {
        throw new Error('Error fetching water intake: ' + waterError.message);
      }

      const newWaterLiters = waterData && waterData.water_liters !== null ? waterData.water_liters : 0;
      setActualWaterLiters(newWaterLiters);
    } catch (error) {
      console.error('Error fetching water intake:', error);
      setActualWaterLiters(0);
    }
  };

  const handleLogSleep = async () => {
    if (!user || !user.id || !inputSleepHours) return;

    const hours = parseFloat(inputSleepHours);
    if (isNaN(hours) || hours < 0 || hours > 24) {
      alert('Please enter a valid number of hours between 0 and 24.');
      return;
    }

    const today = getTodayDate();

    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('DailySleepRecords')
        .select('id, sleep_hours')
        .eq('user_id', user.id)
        .eq('sleep_date', today)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error('Error checking existing sleep record: ' + fetchError.message);
      }

      const previousHours = existingRecord && existingRecord.sleep_hours !== null ? existingRecord.sleep_hours : 0;
      const totalHours = previousHours + hours;

      if (totalHours > 24) {
        alert('Total sleep hours for the day cannot exceed 24 hours.');
        return;
      }

      if (existingRecord) {
        const { error: updateError } = await supabase
          .from('DailySleepRecords')
          .update({ sleep_hours: totalHours, created_at: new Date().toISOString() })
          .eq('id', existingRecord.id);

        if (updateError) throw new Error('Error updating sleep hours: ' + updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('DailySleepRecords')
          .insert({
            user_id: user.id,
            sleep_date: today,
            sleep_hours: hours,
            created_at: new Date().toISOString(),
          });

        if (insertError) throw new Error('Error logging sleep hours: ' + insertError.message);
      }

      await fetchSleepHours(today);
      setShowSleepModal(false);
      setInputSleepHours('');
      setRenderKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error logging sleep hours:', error);
      alert('Failed to log sleep hours. Please try again.');
    }
  };

  const handleLogWater = async () => {
    if (!user || !user.id || !inputWaterLiters) return;

    const liters = parseFloat(inputWaterLiters);
    if (isNaN(liters) || liters < 0) {
      alert('Please enter a valid number of liters (greater than or equal to 0).');
      return;
    }

    const today = getTodayDate();

    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('DailyWaterRecords')
        .select('id, water_liters')
        .eq('user_id', user.id)
        .eq('water_date', today)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error('Error checking existing water record: ' + fetchError.message);
      }

      const previousLiters = existingRecord && existingRecord.water_liters !== null ? existingRecord.water_liters : 0;
      const totalLiters = previousLiters + liters;

      if (existingRecord) {
        const { error: updateError } = await supabase
          .from('DailyWaterRecords')
          .update({ water_liters: totalLiters, created_at: new Date().toISOString() })
          .eq('id', existingRecord.id);

        if (updateError) throw new Error('Error updating water intake: ' + updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('DailyWaterRecords')
          .insert({
            user_id: user.id,
            water_date: today,
            water_liters: liters,
            created_at: new Date().toISOString(),
          });

        if (insertError) throw new Error('Error logging water intake: ' + insertError.message);
      }

      await fetchWaterIntake(today);
      setShowWaterModal(false);
      setInputWaterLiters('');
      setRenderKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error logging water intake:', error);
      alert('Failed to log water intake. Please try again.');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWorkoutData();
    setRefreshing(false);
  }, []);

  const navigateToExercises = (dayName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(screens)/Exercises',
      params: { day: dayName, source: 'Home' },
    });
  };

  const navigateToMealDetail = () => {
    if (!dailyWorkout || !dailyMeal) {
      console.warn('Cannot navigate to MealDetail: dailyWorkout or dailyMeal is null');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(screens)/MealDetail',
      params: {
        meal: dailyWorkout.day_name,
        dailyWorkoutId: dailyWorkout.id,
        from: 'home',
      },
    });
  };

  const resetStreakOnUpdate = async () => {
    if (!user?.id) return;
    const localDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    await supabase.rpc('reset_streak_local', { current_local_date: localDate });
    await fetchStreakAndCompletions();
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/Home');
  };

  if (!user || !user.id) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.headerContainer, {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }]}>
          <Text style={styles.headerText}>Home</Text>
          <Text style={styles.usernameText}>{user?.username || 'User'}</Text>
        </Animated.View>

        <View style={styles.errorContainer}>
          <MaterialCommunityIcons 
            name="account-alert" 
            size={SCREEN_WIDTH * 0.15} 
            color="#e45ea9" 
          />
          <Text style={styles.errorText}>Please log in to view your home</Text>
          <TouchableOpacity
            style={styles.backButton1}
            onPress={() => router.push('/Login')}
          >
            <Text style={styles.backButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentDate = new Date();
  const currentMonthIndex = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const filteredWorkoutDays = workoutDays.filter((day) => {
    const dayDate = new Date(day.date);
    return dayDate.getMonth() === currentMonthIndex && dayDate.getFullYear() === currentYear;
  });

  return (
    <View key={renderKey} style={styles.container}>
      {/* Custom Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Image
          source={Logo}
          style={styles.logo}
        />
        <Text style={styles.headerText}>Home</Text>
        <Text style={styles.usernameText}>{user.username || 'User'}</Text>
      </Animated.View>

      {/* Main Content */}
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e45ea9"
            colors={['#e45ea9']}
          />
        }
      >
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
          <View style={styles.goalContainer}>
            <View style={styles.goalHeader}>
              <MaterialCommunityIcons 
                name="target" 
                size={SCREEN_WIDTH * 0.06} 
                color="#e45ea9" 
              />
              <Text style={styles.goalTitle}>My Fitness Goal: </Text>
              <Text style={styles.goalText}>{userGoal}</Text>
            </View>
          </View>
          {/* Streak Card */}
          <View style={[styles.card, styles.streakCard]}>
            <View style={styles.streakHeader}>
              <View style={{ flex: 1, flexDirection: 'row' }}>
                <MaterialCommunityIcons name="fire" size={SCREEN_WIDTH * 0.07} color="#FFA500" />
                <Text style={styles.streakTitle}>Current Streak</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCalendar(!showCalendar);
                }} 
                style={styles.calendarButton}
              >
                <Text style={styles.calendarLink}>{showCalendar ? 'Hide' : 'View'} Calendar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calendarText}>
              <Text style={styles.month}>{currentMonth}</Text>
              <Text style={[styles.streakDays, { color: '#FFA500' }]}>{streak} day(s)</Text>
            </View>
            {showCalendar ? (
              <Calendar
                style={styles.calendar}
                theme={{
                  calendarBackground: '#FFF',
                  textSectionTitleColor: '#000',
                  todayTextColor: '#000',
                  dayTextColor: '#000',
                  arrowColor: '#e45ea9',
                  selectedDayBackgroundColor: 'transparent',
                  dotColor: '#FFA500',
                }}
                markedDates={markedDates}
              />
            ) : (
              <FlatList
                data={filteredWorkoutDays}
                keyExtractor={(item) => item.date}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateList}
                renderItem={({ item }) => {
                  const today = getTodayDate();
                  const isCompletedOrSkipped = markedDates[item.date]?.dotColor === '#FFA500';
                  const isCurrentDate = item.date === today;
                  const backgroundColor = isCompletedOrSkipped ? '#FFA500' : isCurrentDate ? '#e45ea9' : '#F3F4F6';
                  const textColor = isCompletedOrSkipped || isCurrentDate ? '#FFFFFF' : '#1F2937';

                  return (
                    <TouchableOpacity
                      style={[
                        styles.dateItem,
                        { backgroundColor },
                        (isCompletedOrSkipped || isCurrentDate) && { width: 48, height: 72 },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={[styles.dateDay, { color: textColor }]}>
                        {item.date.split('-')[2]}
                      </Text>
                      <Text style={[styles.dateText, { color: textColor }]}>{item.day_number}</Text>
                      {isCurrentDate && !isCompletedOrSkipped && <View style={styles.currentDayIndicator} />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>

          {/* Progress Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle1}>Today's Progress</Text>
            <View style={styles.progressGrid}>
              <View style={[styles.progressCard, { height: SCREEN_HEIGHT * 0.25 }]}>
                <MaterialCommunityIcons name="food-apple" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />
                <Text style={styles.progressTitle}>Calories Gained</Text>
                <CircularProgress
                  progress={
                    expectedCaloriesGained > 0
                      ? Math.min((actualCaloriesGained / expectedCaloriesGained) * 100, 100)
                      : 0
                  }
                  gradientId="caloriesGainedGradient"
                  displayText={`${actualCaloriesGained.toFixed(1)}/${expectedCaloriesGained.toFixed(1)} cal`}
                />
              </View>

              <View style={[styles.progressCard, { height: SCREEN_HEIGHT * 0.25 }]}>
                <MaterialCommunityIcons name="fire" size={SCREEN_WIDTH * 0.06} color="#FF4040" />
                <Text style={styles.progressTitle}>Calories Burnt</Text>
                <CircularProgress
                  progress={totalCaloriesToBurn > 0 ? (caloriesBurnedToday / totalCaloriesToBurn) * 100 : 0}
                  gradientId="caloriesBurntGradient"
                  displayText={`${caloriesBurnedToday.toFixed(1)}/${totalCaloriesToBurn.toFixed(1)} cal`}
                />
              </View>

              <View style={[styles.progressCard, { height: SCREEN_HEIGHT * 0.25 }]}>
                <SleepCard
                  progress={sleepHours}
                  expectedHours={expectedSleepHours}
                  onLogPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowSleepModal(true);
                  }}
                />
              </View>

              <View style={[styles.progressCard, { height: SCREEN_HEIGHT * 0.25, alignItems: 'center', justifyContent: 'center' }]}>
                <MaterialCommunityIcons name="cup-water" size={SCREEN_WIDTH * 0.06} color="#5bc6ff" />
                <Text style={styles.progressTitle}>Water</Text>
                <WaterGlass
                  progress={expectedWaterLiters > 0 ? (actualWaterLiters / expectedWaterLiters) * 100 : 0}
                  actualLiters={actualWaterLiters}
                  expectedLiters={expectedWaterLiters}
                  onLogPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowWaterModal(true);
                  }}
                />
              </View>
            </View>
          </View>

          {/* Workout Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Workout</Text>
            </View>
            {dailyWorkout ? (
              dailyWorkout.focus.toLowerCase().includes('rest') && dailyWorkout.exercises.length === 0 ? (
                <View style={[styles.card, styles.workoutCard]}>
                  <MaterialCommunityIcons name="power-sleep" size={SCREEN_WIDTH * 0.1} color="#9CA3AF" />
                  <Text style={styles.noWorkoutText}>Today is a Rest Day. No exercises scheduled.</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.card, styles.workoutCard]}
                  onPress={() => navigateToExercises(dailyWorkout.day_name)}
                  activeOpacity={0.8}
                >
                  <View style={styles.workoutRow}>
                    <View style={styles.workoutInfo}>
                      <Text style={styles.workoutName}>{dailyWorkout.day_name}</Text>
                      <View style={styles.workoutStats}>
                        <View style={styles.workoutStatItem}>
                          <MaterialCommunityIcons name="target" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
                          <Text style={styles.workoutStatText}>
                            {dailyWorkout.focus}
                          </Text>
                        </View>
                        <View style={styles.workoutStatItem}>
                          <MaterialCommunityIcons name="clock-outline" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
                          <Text style={styles.workoutStatText}>
                            {dailyWorkout.total_duration_min} min
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={SCREEN_WIDTH * 0.05} color="#9CA3AF" />
                  </View>
                  <View style={styles.workoutProgress}>
                    <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
                    <Text style={styles.progressLabel}>{progressPercentage}% completed</Text>
                  </View>
                </TouchableOpacity>
              )
            ) : (
              <View style={[styles.card, styles.workoutCard]}>
                <MaterialCommunityIcons name="emoticon-confused" size={SCREEN_WIDTH * 0.1} color="#9CA3AF" />
                <Text style={styles.noWorkoutText}>No workout scheduled for today.</Text>
              </View>
            )}
          </View>

          {/* Nutrition Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Nutrition</Text>
            </View>
            {dailyMeal ? (
              <TouchableOpacity
                style={[styles.card, styles.mealContainer]}
                onPress={navigateToMealDetail}
                activeOpacity={0.8}
              >
                <View style={styles.mealHeader}>
                  <Text style={styles.mealText}>{dailyWorkout?.day_name}</Text>
                  <Ionicons name="chevron-forward" size={SCREEN_WIDTH * 0.05} color="#9CA3AF" />
                </View>
                <View style={styles.mealDetails}>
                  <View style={styles.mealDetailItem}>
                    <MaterialCommunityIcons name="fire" size={SCREEN_WIDTH * 0.04} color="#FF7043" />
                    <Text style={styles.mealDetailText}>
                      {dailyMeal.daily_calories.toFixed(1)} cal
                    </Text>
                  </View>
                  <View style={styles.mealDetailItem}>
                    <MaterialCommunityIcons name="bread-slice" size={SCREEN_WIDTH * 0.04} color="#8BC34A" />
                    <Text style={styles.mealDetailText}>
                      {dailyMeal.carbs_grams.toFixed(1)}g carbs
                    </Text>
                  </View>
                  <View style={styles.mealDetailItem}>
                    <MaterialCommunityIcons name="dumbbell" size={SCREEN_WIDTH * 0.04} color="#2196F3" />
                    <Text style={styles.mealDetailText}>
                      {dailyMeal.protein_grams.toFixed(1)}g protein
                    </Text>
                  </View>
                  <View style={styles.mealDetailItem}>
                    <MaterialCommunityIcons name="food-steak" size={SCREEN_WIDTH * 0.04} color="#795548" />
                    <Text style={styles.mealDetailText}>
                      {dailyMeal.fat_grams.toFixed(1)}g fat
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.card, styles.mealContainer]}>
                <MaterialCommunityIcons name="food-off" size={SCREEN_WIDTH * 0.1} color="#9CA3AF" />
                <Text style={styles.noMealText}>No meal plan available for today.</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Sleep Modal */}
      <Modal
        visible={showSleepModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSleepModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Log Sleep Hours</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter hours slept (e.g., 7.5)"
              keyboardType="numeric"
              value={inputSleepHours}
              onChangeText={setInputSleepHours}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSleepModal(false);
                  setInputSleepHours('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleLogSleep}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Water Modal */}
      <Modal
        visible={showWaterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWaterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Log Water Intake</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter liters of water (e.g., 0.5)"
              keyboardType="numeric"
              value={inputWaterLiters}
              onChangeText={setInputWaterLiters}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowWaterModal(false);
                  setInputWaterLiters('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleLogWater}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_WIDTH * 0.043,
    paddingVertical: SCREEN_HEIGHT * 0.015,
    backgroundColor: '#e45ea9',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
  logo: {
    width: SCREEN_WIDTH * 0.12,
    height: SCREEN_WIDTH * 0.12,
    borderRadius: SCREEN_WIDTH * 0.05,
    marginRight: SCREEN_WIDTH * 0.023,
  },
  usernameText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#fff',
    fontWeight: '600',
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Content Styles
  contentContainer: {
    paddingBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  // Add to your stylesheet
  goalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingTop: SCREEN_WIDTH * 0.04,
    paddingRight: SCREEN_WIDTH * 0.04,
    paddingLeft: SCREEN_WIDTH * 0.04,
    paddingBottom: SCREEN_WIDTH * 0.03,
    marginBottom: SCREEN_HEIGHT * 0.005,
    marginTop: SCREEN_HEIGHT * 0.025,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  goalTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: '#333',
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  goalText: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#666',
    lineHeight: SCREEN_WIDTH * 0.065,
  },
  editGoalButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    paddingVertical: SCREEN_HEIGHT * 0.008,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    borderRadius: 20,
  },
  editGoalButtonText: {
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
    color: '#e45ea9',
  },
  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  streakCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
    marginTop: SCREEN_HEIGHT * 0.025,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  streakTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: '#333',
  },
  calendarButton: {
    marginLeft: 'auto',
  },
  calendarLink: {
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
    color: '#e45ea9',
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    paddingVertical: SCREEN_HEIGHT * 0.005,
    paddingHorizontal: SCREEN_WIDTH * 0.03,
    borderRadius: 20,
  },
  calendarText: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  month: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
  },
  streakDays: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  calendar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  dateList: {
    paddingVertical: SCREEN_HEIGHT * 0.01,
  },
  dateItem: {
    width: SCREEN_WIDTH * 0.1,
    height: SCREEN_WIDTH * 0.17,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SCREEN_WIDTH * 0.02,
  },
  dateDay: {
    fontSize: SCREEN_WIDTH * 0.035,
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  dateText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  currentDayIndicator: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.005,
    width: SCREEN_WIDTH * 0.015,
    height: SCREEN_WIDTH * 0.015,
    borderRadius: SCREEN_WIDTH * 0.0075,
    backgroundColor: '#FFFFFF',
  },
  // Sections
  section: {
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  sectionTitle1: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
    paddingLeft: SCREEN_WIDTH * 0.03,
    marginBottom: SCREEN_HEIGHT * 0.015,
    marginTop: SCREEN_HEIGHT * 0.015,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
    paddingLeft: SCREEN_WIDTH * 0.03,
  },
  // Progress Grid
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  progressCard: {
    width: '48%',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.015,
    alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  progressTitle: {
    fontSize: SCREEN_WIDTH * 0.038,
    fontWeight: '600',
    color: '#666',
    marginVertical: SCREEN_HEIGHT * 0.01,
    textAlign: 'center',
  },
  progressText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  waterImage: {
    width: SCREEN_WIDTH * 0.09,
    height: SCREEN_WIDTH * 0.1,
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  logButton: {
    backgroundColor: '#5bc6ff',
    paddingVertical: SCREEN_HEIGHT * 0.01,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    borderRadius: 20,
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  logButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
  },
  // Sleep Card
  sleepContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_WIDTH * 0.06,
  },
  sleepContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepTitle: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  sleepProgressText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    marginVertical: SCREEN_HEIGHT * 0.01,
  },
  sleepLogButton: {
    backgroundColor: '#fff',
    paddingVertical: SCREEN_HEIGHT * 0.01,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    borderRadius: 20,
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  sleepLogButtonText: {
    color: '#9C27B0',
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
  },
  // Workout Card
  workoutCard: {
    padding: 0,
    overflow: 'hidden',
  },
  workoutRow: {
    flexDirection: 'row',
    padding: SCREEN_WIDTH * 0.04,
    alignItems: 'center',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  workoutStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  workoutStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  workoutStatText: {
    fontSize: SCREEN_WIDTH * 0.038,
    color: '#666',
    marginLeft: SCREEN_WIDTH * 0.015,
  },
  workoutProgress: {
    padding: SCREEN_WIDTH * 0.04,
    paddingTop: SCREEN_HEIGHT * 0.01,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  progressBar: {
    height: SCREEN_HEIGHT * 0.01,
    borderRadius: SCREEN_HEIGHT * 0.005,
    backgroundColor: '#e45ea9',
    marginBottom: SCREEN_HEIGHT * 0.01,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: SCREEN_HEIGHT * 0.005,
  },
  progressLabel: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
  },
  noWorkoutText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    textAlign: 'center',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  // Meal Container
  mealContainer: {
    padding: SCREEN_WIDTH * 0.04,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  mealText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  mealDetails: {
    width: '100%',
  },
  mealDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  mealDetailText: {
    fontSize: SCREEN_WIDTH * 0.038,
    color: '#666',
    marginLeft: SCREEN_WIDTH * 0.015,
  },
  noMealText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    textAlign: 'center',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.06,
    width: '80%',
  },
  modalTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.02,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.03,
    fontSize: SCREEN_WIDTH * 0.04,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.06,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#e45ea9',
  },
  modalButtonText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    color: '#fff',
  },
  // Error Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.075,
    backgroundColor: '#F9F9F9',
  },
  errorText: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#333',
    textAlign: 'center',
    marginVertical: SCREEN_HEIGHT * 0.02,
    lineHeight: SCREEN_WIDTH * 0.065,
  },
  backButton1: {
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    borderRadius: 25,
    marginTop: SCREEN_HEIGHT * 0.02,
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  backButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});