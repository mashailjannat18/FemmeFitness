import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Dimensions,
  Animated,
  Easing,
  Pressable,
  RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Logo from '@/assets/images/Logo.png';
import MealsImg from '@/assets/images/6.jpg';

type MealPlan = {
  dayName: string;
  dailyWorkoutId: string;
  dailyCalories: number;
  caloriesIntake: number;
  workoutDate: string | null;
  isCompleted: boolean;
  isCurrentDay: boolean;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Meals() {
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user } = useUserAuth();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const fetchMealPlan = useCallback(async () => {
    if (!user || !user.id) {
      console.log('No user or user ID, redirecting to Login');
      router.push('/Login');
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const { data: workoutPlan, error: workoutPlanError } = await supabase
        .from('WorkoutPlans')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      console.log('Fetched workoutPlan:', workoutPlan, 'Error:', workoutPlanError);

      if (workoutPlanError || !workoutPlan) {
        console.error('Error fetching workout plan:', workoutPlanError?.message || 'No active workout plan found');
        setLoading(false);
        return;
      }

      const { data: mealPlans, error: mealPlanError } = await supabase
        .from('DailyMealPlans')
        .select(`
          daily_workout_id,
          daily_calories,
          calories_intake,
          DailyWorkouts (
            id,
            day_name,
            daily_workout_date
          )
        `)
        .eq('workout_plan_id', workoutPlan.id)
        .order('daily_workout_id', { ascending: true });

      console.log('Fetched mealPlans:', mealPlans, 'Error:', mealPlanError);

      if (mealPlanError || !mealPlans) {
        console.error('Error fetching meal plan:', mealPlanError?.message || 'No meal plan found');
        setLoading(false);
        return;
      }

      const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      
      const mealData = mealPlans.map((meal, index) => ({
        dayName: meal.DailyWorkouts?.day_name || `Day ${index + 1}`,
        dailyWorkoutId: meal.daily_workout_id,
        dailyCalories: meal.daily_calories || 0,
        caloriesIntake: meal.calories_intake || 0,
        workoutDate: meal.DailyWorkouts?.daily_workout_date || null,
        isCompleted: (meal.calories_intake || 0) >= (meal.daily_calories || 0) && (meal.daily_calories || 0) > 0,
        isCurrentDay: meal.DailyWorkouts?.daily_workout_date === today,
      }));

      console.log('Processed mealData:', mealData);

      setMeals(mealData);

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
      ]).start(() => setLoading(false));
    } catch (error) {
      console.error('Error fetching meal plan:', error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, [user, router]);

  useFocusEffect(
    useCallback(() => {
      fetchMealPlan();
    }, [fetchMealPlan])
  );

  const onRefresh = useCallback(async () => {
    await fetchMealPlan();
  }, [fetchMealPlan]);

  const navigateToMealDetail = (meal: string, dailyWorkoutId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(screens)/MealDetail',
      params: { meal, dailyWorkoutId, from: 'meals' },
    });
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/Home');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingAnimation, { 
          transform: [{ rotate: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg']
          }) }]
        }]}>
          <FontAwesome5 name="utensils" size={SCREEN_WIDTH * 0.1} color="#e45ea9" />
        </Animated.View>
        <Text style={styles.loadingText}>Loading your meals...</Text>
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
          <Text style={styles.headerText}>Meals</Text>
          <Text style={styles.usernameText}>{user?.username || 'User'}</Text>
        </Animated.View>

        <View style={styles.errorContainer}>
          <MaterialCommunityIcons 
            name="account-alert" 
            size={SCREEN_WIDTH * 0.15} 
            color="#e45ea9" 
          />
          <Text style={styles.errorText}>Please log in to view your meals</Text>
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
        <Text style={styles.headerText}>Meals</Text>
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
              source={MealsImg} 
              style={styles.image}
              resizeMode="cover"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meal Plans</Text>
            <Text style={styles.sectionDescription}>Select a day to view its meal plan</Text>
          </View>

          <View style={styles.mealDaysContainer}>
            {meals.length > 0 ? (
              meals.map((meal) => {
                const workoutDate = meal.workoutDate ? new Date(meal.workoutDate) : null;
                const dayNumber = workoutDate ? workoutDate.getDate() : '';
                const monthName = workoutDate ? workoutDate.toLocaleString('default', { month: 'short' }) : '';

                return (
                  <TouchableOpacity
                    key={meal.dailyWorkoutId}
                    onPress={() => meal.isCurrentDay && navigateToMealDetail(meal.dayName, meal.dailyWorkoutId)}
                    style={[
                      styles.mealDayCard,
                      meal.isCompleted && styles.completedMealDay,
                      !meal.isCurrentDay && styles.disabledMealDay
                    ]}
                    activeOpacity={meal.isCurrentDay ? 0.8 : 1}
                    disabled={!meal.isCurrentDay}
                  >
                    <View style={styles.dayNumberContainer}>
                      <Text style={styles.dayNumberText}>{dayNumber}</Text>
                      <Text style={styles.monthText}>{monthName}</Text>
                    </View>

                    <View style={styles.mealInfo}>
                      <Text style={styles.dayNameText}>{meal.dayName}</Text>
                      
                      <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                          <MaterialIcons 
                            name="local-fire-department" 
                            size={SCREEN_WIDTH * 0.04} 
                            color="#FFA500" 
                          />
                          <Text style={styles.statText}>{meal.dailyCalories} cal</Text>
                        </View>
                        <View style={styles.statItem}>
                          <MaterialCommunityIcons 
                            name="food" 
                            size={SCREEN_WIDTH * 0.04} 
                            color="#4CAF50" 
                          />
                          <Text style={styles.statText}>{meal.caloriesIntake} cal</Text>
                        </View>
                      </View>
                    </View>

                    {meal.isCompleted && (
                      <View style={styles.completedBadge}>
                        <MaterialIcons 
                          name="check-circle" 
                          size={SCREEN_WIDTH * 0.06} 
                          color="#4CAF50" 
                        />
                      </View>
                    )}
                    {!meal.isCurrentDay && (
                      <View style={styles.disabledOverlay}>
                        <MaterialIcons 
                          name="lock-outline" 
                          size={SCREEN_WIDTH * 0.1} 
                          color="white" 
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.noMealsContainer}>
                <MaterialCommunityIcons 
                  name="food-off" 
                  size={SCREEN_WIDTH * 0.1} 
                  color="#E0E0E0" 
                />
                <Text style={styles.noMealsText}>No meal plan available</Text>
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
  mealDaysContainer: {
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  mealDayCard: {
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
  completedMealDay: {
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
  mealInfo: {
    flex: 1,
  },
  dayNameText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.005,
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
    zIndex: 1,
  },
  disabledMealDay: {
    opacity: 0.5,
  },
  disabledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMealsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.05,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  noMealsText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#999',
    marginTop: SCREEN_HEIGHT * 0.015,
    textAlign: 'center',
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