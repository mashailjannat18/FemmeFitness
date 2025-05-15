import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Dimensions, 
  ScrollView, 
  Image,
  Animated,
  Easing,
  TouchableOpacity,
  Pressable
} from 'react-native';
import { FontAwesome, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar } from 'react-native-calendars';
import { useRouter, useFocusEffect } from 'expo-router';
import Logo from '@/assets/images/Logo.png';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Metrics {
  totalWorkouts: number;
  totalCalories: number;
  totalDuration: number;
}

interface MarkedDate {
  [date: string]: { marked: boolean; dotColor: string };
}

interface DailyCalories {
  date: string;
  caloriesBurned: number;
  caloriesGained: number;
}

interface DailySleep {
  date: string;
  sleepHours: number;
}

export default function Progress() {
  const { user } = useUserAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics>({
    totalWorkouts: 0,
    totalCalories: 0,
    totalDuration: 0,
  });
  const [signupMonth, setSignupMonth] = useState<string>('');
  const [signupDate, setSignupDate] = useState<Date | null>(null);
  const [markedDates, setMarkedDates] = useState<MarkedDate>({});
  const [caloriesData, setCaloriesData] = useState<any>(null);
  const [sleepData, setSleepData] = useState<any>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      console.log('No user logged in, cannot fetch data');
      router.push('/Login');
      return;
    }

    try {
      // Fetch signup date from User table
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('created_at')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching signup date from User:', userError);
        return;
      }

      if (userData && userData.created_at) {
        const signup = new Date(userData.created_at);
        setSignupDate(signup);
        setSignupMonth(signup.toISOString().substring(0, 7));
      }

      // Fetch data from ExerciseCompletions
      const { data: completionsData, error: completionsError } = await supabase
        .from('ExerciseCompletions')
        .select('calories_burned, time_spent_seconds, completion_date, status')
        .eq('user_id', user.id);

      if (completionsError) {
        console.error('Error fetching metrics from ExerciseCompletions:', completionsError);
        return;
      }

      // Fetch data from DailyMealPlans
      const { data: mealPlansData, error: mealPlansError } = await supabase
        .from('DailyMealPlans')
        .select(`
          calories_intake,
          DailyWorkouts (
            id,
            daily_workout_date
          )
        `)
        .not('calories_intake', 'is', null)
        .in(
          'daily_workout_id',
          await supabase
            .from('DailyWorkouts')
            .select('id')
            .in(
              'workout_plan_id',
              await supabase
                .from('WorkoutPlans')
                .select('id')
                .eq('user_id', user.id)
                .then(({ data }) => data?.map((wp) => wp.id) || [])
            )
            .then(({ data }) => data?.map((dw) => dw.id) || [])
        );

      if (mealPlansError) {
        console.error('Error fetching data from DailyMealPlans:', mealPlansError);
        return;
      }

      // Fetch data from DailySleepRecords
      const { data: sleepRecordsData, error: sleepRecordsError } = await supabase
        .from('DailySleepRecords')
        .select('sleep_date, sleep_hours')
        .eq('user_id', user.id);

      if (sleepRecordsError) {
        console.error('Error fetching data from DailySleepRecords:', sleepRecordsError);
        return;
      }

      // Process calories data
      const caloriesBurnedByDate: { [key: string]: number } = {};
      if (completionsData) {
        completionsData.forEach((record) => {
          if (record.status === 'completed') {
            const date = record.completion_date.split('T')[0];
            if (!caloriesBurnedByDate[date]) {
              caloriesBurnedByDate[date] = 0;
            }
            caloriesBurnedByDate[date] += record.calories_burned || 0;
          }
        });
      }

      const caloriesGainedByDate: { [key: string]: number } = {};
      if (mealPlansData) {
        mealPlansData.forEach((record) => {
          if (record.calories_intake && record.DailyWorkouts?.daily_workout_date) {
            const date = record.DailyWorkouts.daily_workout_date.split('T')[0];
            caloriesGainedByDate[date] = record.calories_intake;
          }
        });
      }

      const allDates = Array.from(
        new Set([
          ...Object.keys(caloriesBurnedByDate),
          ...Object.keys(caloriesGainedByDate),
        ])
      ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      if (allDates.length === 0) {
        console.log('No exercises or meal plans found for user:', user.id);
        setCaloriesData({
          labels: ['No Data'],
          datasets: [
            {
              data: [0],
              color: (opacity = 1) => `rgba(106, 90, 205, ${opacity})`,
              strokeWidth: 3,
              withDots: true,
            },
            {
              data: [0],
              color: (opacity = 1) => `rgba(72, 61, 139, ${opacity})`,
              strokeWidth: 3,
              withDots: true,
            },
            {
              data: [1000], // Dummy dataset to set y-axis range
              color: (opacity = 1) => `rgba(0, 0, 0, 0)`, // Invisible
              strokeWidth: 0,
              withDots: false,
            },
          ],
        });
      } else {
        const dailyCalories: DailyCalories[] = allDates.map((date) => ({
          date,
          caloriesBurned: caloriesBurnedByDate[date] || 0,
          caloriesGained: caloriesGainedByDate[date] || 0,
        }));

        const labels: string[] = [];
        const caloriesBurnedData: number[] = [];
        const caloriesGainedData: number[] = [];

        dailyCalories.forEach((entry) => {
          const date = new Date(entry.date);
          const day = date.getDate();
          const month = date.toLocaleString('default', { month: 'short' });
          labels.push(`${day} ${month}`);
          caloriesBurnedData.push(entry.caloriesBurned);
          caloriesGainedData.push(entry.caloriesGained);
        });

        setCaloriesData({
          labels,
          datasets: [
            {
              data: caloriesGainedData,
              color: (opacity = 1) => `rgba(106, 90, 205, ${opacity})`,
              strokeWidth: 3,
              withDots: true,
            },
            {
              data: caloriesBurnedData,
              color: (opacity = 1) => `rgba(72, 61, 139, ${opacity})`,
              strokeWidth: 3,
              withDots: true,
            },
          ],
        });
      }

      // Process sleep data
      if (!sleepRecordsData || sleepRecordsData.length === 0) {
        console.log('No sleep records found for user:', user.id);
        setSleepData({
          labels: ['No Data'],
          datasets: [
            {
              data: [0],
              color: (opacity = 1) => `rgba(255, 219, 88, ${opacity})`,
            },
            {
              data: [8],
              color: (opacity = 1) => `rgba(255, 219, 88, ${opacity})`,
            },
          ],
        });
      } else {
        const sleepRecords: DailySleep[] = sleepRecordsData.map((record) => ({
          date: record.sleep_date,
          sleepHours: record.sleep_hours,
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const labels: string[] = [];
        const sleepHoursData: number[] = [];
        const targetSleepHoursData: number[] = [];

        sleepRecords.forEach((entry) => {
          const date = new Date(entry.date);
          const day = date.getDate();
          const month = date.toLocaleString('default', { month: 'short' });
          labels.push(`${day} ${month}`);
          sleepHoursData.push(entry.sleepHours);
          targetSleepHoursData.push(8);
        });

        setSleepData({
          labels,
          datasets: [
            {
              data: sleepHoursData,
              color: (opacity = 1) => `rgba(255, 219, 88, ${opacity})`,
            },
            {
              data: targetSleepHoursData,
              color: (opacity = 1) => `rgba(255, 219, 88, ${opacity})`,
            },
          ],
        });
      }

      // Calculate metrics for completed exercises
      const completedExercises = completionsData?.filter((record) => record.status === 'completed') || [];
      const totalWorkouts = completedExercises.length;
      const totalCalories = completedExercises.reduce(
        (sum, record) => sum + (record.calories_burned || 0),
        0
      );
      const totalDurationSeconds = completedExercises.reduce(
        (sum, record) => sum + (record.time_spent_seconds || 0),
        0
      );
      const totalDuration = totalDurationSeconds / 60;

      setMetrics({
        totalWorkouts,
        totalCalories,
        totalDuration,
      });

      // Mark dates with completed or skipped exercises
      const marked: MarkedDate = {};
      if (completionsData) {
        completionsData.forEach((record) => {
          const date = record.completion_date.split('T')[0];
          marked[date] = {
            marked: true,
            dotColor: record.status === 'completed' ? '#00FF00' : '#FF0000',
          };
        });
      }
      setMarkedDates(marked);

      // Animate on successful load
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
      ]).start();
    } catch (err) {
      console.error('Unexpected error fetching data:', err);
    }
  }, [user?.id, router]);

  // Reload data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Set up real-time subscriptions for database changes
  useEffect(() => {
    if (!user?.id) return;

    // Subscription for ExerciseCompletions table
    const exerciseSubscription = supabase
      .channel('exercise-completions-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ExerciseCompletions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('ExerciseCompletions change detected:', payload);
          fetchData();
        }
      )
      .subscribe();

    // Subscription for DailyMealPlans table
    const mealPlanSubscription = supabase
      .channel('daily-meal-plans-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'DailyMealPlans',
        },
        (payload) => {
          console.log('DailyMealPlans change detected:', payload);
          fetchData();
        }
      )
      .subscribe();

    // Subscription for DailySleepRecords table
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
        (payload) => {
          console.log('DailySleepRecords change detected:', payload);
          fetchData();
        }
      )
      .subscribe();

    // Cleanup subscriptions on component unmount
    return () => {
      supabase.removeChannel(exerciseSubscription);
      supabase.removeChannel(mealPlanSubscription);
      supabase.removeChannel(sleepSubscription);
    };
  }, [user?.id, fetchData]);

  const handleDayPress = (day: { dateString: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/DailyProgress',
      params: { selectedDate: day.dateString },
    });
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/Home');
  };

  const chartWidth = caloriesData
    ? Math.max(SCREEN_WIDTH - 60, caloriesData.labels.length * 60)
    : SCREEN_WIDTH - 60;
  const chartHeight = 200;

  const sleepChartWidth = sleepData
    ? Math.max(SCREEN_WIDTH - 80, sleepData.labels.length * 60)
    : SCREEN_WIDTH - 80;
  const sleepChartHeight = 220;

  if (!user || !user.id) {
    return (
      <View style={styles.container}>
        {/* Custom Header */}
        <Animated.View style={[styles.headerContainer, {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }]}>
          <Text style={styles.headerText}>Progres</Text>
          <Text style={styles.usernameText}>{user.username || 'User'}</Text>
        </Animated.View>

        <View style={styles.errorContainer}>
          <MaterialCommunityIcons 
            name="account-alert" 
            size={SCREEN_WIDTH * 0.15} 
            color="#e45ea9" 
          />
          <Text style={styles.errorText}>Please log in to view your progress</Text>
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
      {/* Custom Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Image
          source={Logo}
          style={styles.logo}
        />
        <Text style={styles.headerText}>Progress</Text>
        <Text style={styles.usernameText}>{user.username || 'User'}</Text>
      </Animated.View>

      {/* Main Content */}
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
          {/* Metrics Cards */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricCard}>
              <FontAwesome name="heartbeat" size={SCREEN_WIDTH * 0.08} color="#FF0000" />
              <Text style={styles.metricLabel}>Workouts</Text>
              <Text style={styles.metricValue}>{metrics.totalWorkouts.toFixed(0)}</Text>
            </View>
            <View style={styles.metricCard}>
              <MaterialIcons name="local-fire-department" size={SCREEN_WIDTH * 0.08} color="#FFA500" />
              <Text style={styles.metricLabel}>Calories</Text>
              <Text style={styles.metricValue}>{metrics.totalCalories.toFixed(0)}</Text>
            </View>
            <View style={styles.metricCard}>
              <FontAwesome name="clock-o" size={SCREEN_WIDTH * 0.08} color="#00008B" />
              <Text style={styles.metricLabel}>Minutes</Text>
              <Text style={styles.metricValue}>{metrics.totalDuration.toFixed(0)}</Text>
            </View>
          </View>

          {/* Calendar Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout History</Text>
            <View style={styles.calendarWrapper}>
              {signupMonth ? (
                <Calendar
                  current={signupMonth}
                  markedDates={markedDates}
                  onDayPress={handleDayPress}
                  theme={{
                    calendarBackground: '#fff',
                    textSectionTitleColor: '#333',
                    selectedDayBackgroundColor: '#e45ea9',
                    selectedDayTextColor: '#fff',
                    todayTextColor: '#e45ea9',
                    dayTextColor: '#333',
                    textDisabledColor: '#d9e1e8',
                    dotColor: '#00FF00',
                    selectedDotColor: '#fff',
                    arrowColor: '#e45ea9',
                    monthTextColor: '#333',
                    textDayFontWeight: '400',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '600',
                  }}
                  style={styles.calendar}
                />
              ) : (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No workout history available</Text>
                </View>
              )}
            </View>
          </View>

          {/* Calories Chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calories Gained vs Burned</Text>
            <View style={styles.chartWrapper}>
              <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={true}
                style={{ flexGrow: 0 }}
              >
                {caloriesData && (
                  <LineChart
                    data={caloriesData}
                    width={chartWidth}
                    height={chartHeight}
                    yAxisSuffix=" cal"
                    yAxisInterval={400}
                    withDots={true}
                    withShadow={false}
                    withInnerLines={true}
                    withOuterLines={true}
                    withHorizontalLines={true}
                    withVerticalLines={true}
                    withHorizontalLabels={true}
                    withVerticalLabels={true}
                    chartConfig={{
                      backgroundGradientFrom: '#fff',
                      backgroundGradientTo: '#fff',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      propsForDots: {
                        r: 5,
                        strokeWidth: 2,
                      },
                      propsForBackgroundLines: {
                        strokeWidth: 0.5,
                        stroke: '#e0e0e0',
                      },
                      fillShadowGradient: 'transparent',
                      fillShadowGradientOpacity: 0,
                    }}
                    bezier
                    style={styles.chart}
                  />
                )}
              </ScrollView>
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#6a5acd' }]} />
                  <Text style={styles.legendText}>Gained</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#483d8b' }]} />
                  <Text style={styles.legendText}>Burned</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Sleep Chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sleep Track</Text>
            <View style={styles.chartWrapper}>
              <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={true}
                style={{ flexGrow: 0 }}
              >
                {sleepData && (
                  <BarChart
                    data={sleepData}
                    width={sleepChartWidth}
                    height={sleepChartHeight}
                    yAxisLabel=""
                    yAxisSuffix=" hrs"
                    chartConfig={{
                      backgroundGradientFrom: '#fff',
                      backgroundGradientTo: '#fff',
                      decimalPlaces: 1,
                      color: (opacity = 1) => `rgba(255, 219, 88, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      propsForBackgroundLines: {
                        strokeWidth: 0.4,
                        stroke: '#e0e0e0',
                      },
                      barPercentage: 0.9,
                    }}
                    style={styles.chart}
                  />
                )}
              </ScrollView>
            </View>
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
  // Header Styles
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
    marginLeft: 'auto',
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Content Styles
  contentContainer: {
    paddingBottom: SCREEN_HEIGHT * 0.04,
  },
  // Metrics Cards
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    marginTop: SCREEN_HEIGHT * 0.025,
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderLeftColor: '#e45ea9',
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    width: '30%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  metricLabel: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
    marginTop: SCREEN_HEIGHT * 0.01,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    marginTop: SCREEN_HEIGHT * 0.005,
  },
  // Sections
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.02,
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
    paddingLeft: SCREEN_WIDTH * 0.03,
  },
  // Calendar
  calendarWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  calendar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  // Charts
  chartWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  chart: {
    borderRadius: 12,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SCREEN_WIDTH * 0.03,
  },
  legendColor: {
    width: SCREEN_WIDTH * 0.03,
    height: SCREEN_WIDTH * 0.03,
    borderRadius: SCREEN_WIDTH * 0.015,
    marginRight: SCREEN_WIDTH * 0.01,
  },
  legendText: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#555',
  },
  // No Data
  noDataContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.05,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  noDataText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#999',
    textAlign: 'center',
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