declare module '*.png' {
  const value: any;
  export default value;
}

import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  RefreshControl, 
  View, 
  Text, 
  Pressable,
  Animated,
  Easing
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons, Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Logo from '@/assets/images/Logo.png';

type DailyWorkout = {
  id: string;
  day_name: string;
  day_number: number;
  daily_workout_date: string;
  focus: string;
  total_calories_burned: number;
  total_duration_min: number;
  isAllCompletedOrSkipped: boolean;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Workouts() {
  const [dailyWorkouts, setDailyWorkouts] = useState<DailyWorkout[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true); // New loading state
  const router = useRouter();
  const { user } = useUserAuth();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const fetchWorkoutPlan = useCallback(async () => {
    if (!user || !user.id) {
      router.push('/Login');
      setLoading(false); // Stop loading if no user
      return;
    }

    try {
      setRefreshing(true);
      const { data: planData, error: planError } = await supabase
        .from('WorkoutPlans')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (planError || !planData) {
        throw new Error('No active workout plan found');
      }

      const { data: dailyData, error: dailyError } = await supabase
        .from('DailyWorkouts')
        .select('id, day_name, day_number, daily_workout_date, focus, total_calories_burned, total_duration_min')
        .eq('workout_plan_id', planData.id)
        .order('day_number', { ascending: true });

      if (dailyError) {
        throw new Error('Error fetching daily workouts: ' + dailyError.message);
      }

      if (!dailyData || dailyData.length === 0) {
        setDailyWorkouts([]);
        setRefreshing(false);
        setLoading(false); // Stop loading
        return;
      }

      const dailyWorkoutIds = dailyData.map((day) => day.id);
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('Workouts')
        .select('daily_workout_id, id')
        .in('daily_workout_id', dailyWorkoutIds);

      if (workoutsError) {
        throw new Error('Error fetching workouts: ' + workoutsError.message);
      }

      const totalExercisesPerDay: { [key: string]: number } = {};
      workoutsData.forEach((workout) => {
        const dailyWorkoutId = workout.daily_workout_id.toString();
        totalExercisesPerDay[dailyWorkoutId] = (totalExercisesPerDay[dailyWorkoutId] || 0) + 1;
      });

      const { data: completionsData, error: completionsError } = await supabase
        .from('ExerciseCompletions')
        .select('daily_workout_id, status')
        .in('daily_workout_id', dailyWorkoutIds)
        .in('status', ['completed', 'skipped']);

      if (completionsError) {
        throw new Error('Error fetching exercise completions: ' + completionsError.message);
      }

      const completedExercisesPerDay: { [key: string]: number } = {};
      completionsData.forEach((completion) => {
        const dailyWorkoutId = completion.daily_workout_id.toString();
        completedExercisesPerDay[dailyWorkoutId] = (completedExercisesPerDay[dailyWorkoutId] || 0) + 1;
      });

      const updatedDailyWorkouts = dailyData.map((day) => {
        const dailyWorkoutId = day.id.toString();
        const totalExercises = totalExercisesPerDay[dailyWorkoutId] || 0;
        const completedExercises = completedExercisesPerDay[dailyWorkoutId] || 0;
        const isAllCompletedOrSkipped = totalExercises > 0 && completedExercises === totalExercises;
        return {
          ...day,
          isAllCompletedOrSkipped,
        };
      });

      setDailyWorkouts(updatedDailyWorkouts);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => setLoading(false)); // Stop loading after animation
    } catch (error: any) {
      console.error('Error fetching workout plan:', error.message);
      setDailyWorkouts([]);
      setLoading(false); // Stop loading on error
    } finally {
      setRefreshing(false);
    }
  }, [user, router]);

  useFocusEffect(
    useCallback(() => {
      fetchWorkoutPlan();
    }, [fetchWorkoutPlan])
  );

  useEffect(() => {
    fetchWorkoutPlan();
  }, [fetchWorkoutPlan]);

  const onRefresh = useCallback(async () => {
    await fetchWorkoutPlan();
  }, [fetchWorkoutPlan]);

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/Home');
  };

  const navigateToExercises = (dayName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(screens)/Exercises',
      params: { day: dayName, source: 'Workouts' },
    });
  };

  // Loading UI
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingAnimation, { 
          transform: [{ rotate: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg']
          }) }]
        }]}>
          <FontAwesome5 name="dumbbell" size={SCREEN_WIDTH * 0.1} color="#e45ea9" />
        </Animated.View>
        <Text style={styles.loadingText}>Loading your workouts...</Text>
      </View>
    );
  }

  if (!user || !user.id) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.headerContainer, {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }]}>
          <Text style={styles.headerText}>Workouts</Text>
          <Text style={styles.usernameText}>{user?.username || 'User'}</Text>
        </Animated.View>

        <View style={styles.errorContainer}>
          <MaterialCommunityIcons 
            name="account-alert" 
            size={SCREEN_WIDTH * 0.15} 
            color="#e45ea9" 
          />
          <Text style={styles.errorText}>Please log in to view your workouts</Text>
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

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Image
          source={Logo}
          style={styles.logo}
        />
        <Text style={styles.headerText}>Workouts</Text>
        <Text style={styles.usernameText}>{user.username || 'User'}</Text>
      </Animated.View>

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
          <View style={styles.imageSection}>
            <Image 
              source={require('../../assets/images/2.jpg')} 
              style={styles.image}
              resizeMode="cover"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout of the Day</Text>
            <Text style={styles.sectionDescription}>Select a day to view its workout plan</Text>
          </View>

          <View style={styles.workoutDaysContainer}>
            {dailyWorkouts.length > 0 ? (
              dailyWorkouts.map((item) => {
                const workoutDate = new Date(item.daily_workout_date);
                const dayNumber = workoutDate.getDate();
                const monthName = workoutDate.toLocaleString('default', { month: 'short' });
                
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => navigateToExercises(item.day_name)}
                    style={[
                      styles.workoutDayCard,
                      item.isAllCompletedOrSkipped && styles.completedWorkoutDay
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dayNumberContainer}>
                      <Text style={styles.dayNumberText}>{dayNumber}</Text>
                      <Text style={styles.monthText}>{monthName}</Text>
                    </View>

                    <View style={styles.workoutInfo}>
                      <Text style={styles.dayNameText}>{item.day_name}</Text>
                      <Text style={styles.focusText}>{item.focus}</Text>
                      
                      <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                          <MaterialIcons 
                            name="local-fire-department" 
                            size={SCREEN_WIDTH * 0.04} 
                            color="#FFA500" 
                          />
                          <Text style={styles.statText}>{item.total_calories_burned || 0} cal</Text>
                        </View>
                        <View style={styles.statItem}>
                          <MaterialIcons 
                            name="access-time" 
                            size={SCREEN_WIDTH * 0.04} 
                            color="#4CAF50" 
                          />
                          <Text style={styles.statText}>{item.total_duration_min || 0} min</Text>
                        </View>
                      </View>
                    </View>

                    {item.isAllCompletedOrSkipped && (
                      <View style={styles.completedBadge}>
                        <MaterialIcons 
                          name="check-circle" 
                          size={SCREEN_WIDTH * 0.06} 
                          color="#4CAF50" 
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.noWorkoutsContainer}>
                <MaterialCommunityIcons 
                  name="weight-lifter" 
                  size={SCREEN_WIDTH * 0.1} 
                  color="#E0E0E0" 
                />
                <Text style={styles.noWorkoutsText}>No workout plan available</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  loadingAnimation: {
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  loadingText: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#666',
    fontWeight: '500',
  },
  contentContainer: {
    paddingBottom: SCREEN_HEIGHT * 0.04,
  },
  imageSection: {
    marginTop: SCREEN_HEIGHT * 0.025,
    marginBottom: SCREEN_HEIGHT * 0.02,
    height: SCREEN_HEIGHT * 0.3,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  section: {
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    lineHeight: SCREEN_WIDTH * 0.06,
    textAlign: 'center',
  },
  workoutDaysContainer: {
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  workoutDayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.015,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  completedWorkoutDay: {
    backgroundColor: '#FCE7F3',
  },
  dayNumberContainer: {
    width: SCREEN_WIDTH * 0.16,
    height: SCREEN_WIDTH * 0.16,
    borderRadius: SCREEN_WIDTH * 0.08,
    backgroundColor: '#e45ea9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SCREEN_WIDTH * 0.04,
  },
  dayNumberText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#fff',
  },
  monthText: {
    fontSize: SCREEN_WIDTH * 0.03,
    color: '#fff',
    marginTop: -SCREEN_WIDTH * 0.01,
    textTransform: 'uppercase',
  },
  workoutInfo: {
    flex: 1,
  },
  dayNameText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  focusText: {
    fontSize: SCREEN_WIDTH * 0.038,
    color: '#666',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SCREEN_WIDTH * 0.05,
  },
  statText: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#555',
    marginLeft: SCREEN_WIDTH * 0.015,
  },
  completedBadge: {
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  noWorkoutsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.05,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  noWorkoutsText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#999',
    marginTop: SCREEN_HEIGHT * 0.015,
    textAlign: 'center',
  },
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