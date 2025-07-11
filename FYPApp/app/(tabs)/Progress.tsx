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
  RefreshControl,
  StyleProp,
  ViewStyle
} from 'react-native';
import { FontAwesome, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
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

interface DailyWater {
  date: string;
  amount: number; // in liters
  recommended?: number; // in liters
  percentage?: number;
}

interface WeightRecord {
  date: string;
  weight: number;
  change?: number;
  previous_weight?: number;
}

const CollapsibleSection = ({ 
  title, 
  iconName, 
  iconComponent: IconComponent = MaterialCommunityIcons, 
  iconColor, 
  children 
}: {
  title: string;
  iconName: string;
  iconComponent?: any;
  iconColor: string;
  children: React.ReactNode;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const rotateAnim = useState(new Animated.Value(0))[0];

  const toggleCollapse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(rotateAnim, {
      toValue: isCollapsed ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setIsCollapsed(!isCollapsed);
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.section}>
      <TouchableOpacity onPress={toggleCollapse} activeOpacity={0.8}>
        <View style={styles.sectionHeader}>
          <IconComponent name={iconName} size={24} color={iconColor} />
          <Text style={styles.sectionTitle}>{title}</Text>
          <Animated.View style={{ transform: [{ rotate }], marginLeft: 'auto' }}>
            <MaterialCommunityIcons 
              name="chevron-down" 
              size={24} 
              color="#666" 
            />
          </Animated.View>
        </View>
      </TouchableOpacity>
      
      {!isCollapsed && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );
};

const WeightIndicator = ({ 
  weight, 
  change, 
  date 
}: { 
  weight: number; 
  change?: number; 
  date: string 
}) => {
  const isPositive = change ? change >= 0 : false;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  const displayDate = new Date(date).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });

  return (
    <Animated.View style={[styles.weightIndicator, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.weightDateContainer}>
        <Text style={styles.weightDate}>{displayDate}</Text>
      </View>
      <View style={styles.weightCircle}>
        <Text style={styles.weightValue}>{weight.toFixed(1)}</Text>
        <Text style={styles.weightUnit}>kg</Text>
      </View>
      {change !== undefined && (
        <View style={[styles.weightChange, isPositive ? styles.positiveChange : styles.negativeChange]}>
          <MaterialCommunityIcons 
            name={isPositive ? "arrow-up" : "arrow-down"} 
            size={16} 
            color="#fff" 
          />
          <Text style={styles.weightChangeText}>{Math.abs(change).toFixed(1)}</Text>
        </View>
      )}
    </Animated.View>
  );
};

const WaterIndicator = ({ 
  amount, 
  recommended = 2.1, // Default to 2.1L if not provided
  date 
}: { 
  amount: number; // in liters
  recommended?: number; // in liters
  date: string 
}) => {
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const percentage = Math.min((amount / recommended) * 100, 100);

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  const displayDate = new Date(date).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });

  return (
    <Animated.View style={[styles.waterBottleContainer, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.waterBottleDate}>{displayDate}</Text>
      <View style={styles.waterBottle}>
        <View style={styles.waterBottleOutline}>
          <View 
            style={[
              styles.waterFill,
              { 
                height: `${percentage}%`,
                backgroundColor: '#40a4df'
              }
            ]}
          />
          <View 
            style={[
              styles.waterTargetLine,
              { bottom: `${(2.1 / recommended) * 100}%` } // Position target line at 2.1L
            ]}
          />
        </View>
      </View>
      <Text style={styles.waterBottleAmount}>
        {(amount).toFixed(2)}L ({Math.round(percentage)}%)
      </Text>
    </Animated.View>
  );
};

export default function Progress() {
  const { user, loading: authLoading } = useUserAuth();
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
  const [waterRecords, setWaterRecords] = useState<DailyWater[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      console.log('No user logged in, cannot fetch data');
      router.push('/Login');
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      
      // Fetch signup date from User table
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('created_at')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching signup date from User:', userError);
        setLoading(false);
        return;
      }

      if (userData && userData.created_at) {
        const signup = new Date(userData.created_at);
        setSignupDate(signup);
        setSignupMonth(signup.toISOString().substring(0, 7));
      }

      // Fetch weight data from WeightHistory table
      const { data: weightData, error: weightError } = await supabase
        .from('WeightHistory')
        .select('weight_now, recorded_at, previous_weight')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: true });

      if (weightError) {
        console.error('Error fetching weight data:', weightError);
      } else if (weightData && weightData.length > 0) {
        const formattedWeightRecords: WeightRecord[] = weightData.map((record) => {
          const change = record.previous_weight != null ? record.weight_now - record.previous_weight : undefined;
          console.log(`Weight record [${record.recorded_at}]: weight_now=${record.weight_now}, previous_weight=${record.previous_weight}, change=${change}`);
          return {
            date: record.recorded_at,
            weight: record.weight_now,
            change,
            previous_weight: record.previous_weight
          };
        });
        console.log('Fetched weightRecords:', formattedWeightRecords);
        setWeightRecords(formattedWeightRecords);
      } else {
        console.log('No weight records found for user:', user.id);
        setWeightRecords([]);
      }

      // Fetch data from ExerciseCompletions
      const { data: completionsData, error: completionsError } = await supabase
        .from('ExerciseCompletions')
        .select('calories_burned, time_spent_seconds, completion_date, status')
        .eq('user_id', user.id);

      if (completionsError) {
        console.error('Error fetching metrics from ExerciseCompletions:', completionsError);
        setLoading(false);
        return;
      }

      // Fetch data from DailyMealPlans
      const { data: mealPlansData, error: mealPlansError } = await supabase
        .from('DailyMealPlans')
        .select(`
          calories_intake,
          water_litres,
          DailyWorkouts (
            id,
            daily_workout_date
          )
        `)
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
        setLoading(false);
        return;
      }

      // Fetch water data from DailyWaterRecords
      const { data: waterData, error: waterError } = await supabase
        .from('DailyWaterRecords')
        .select('water_date, water_liters')
        .eq('user_id', user.id)
        .order('water_date', { ascending: true });

      if (waterError) {
        console.error('Error fetching water data:', waterError);
        setWaterRecords([]);
      } else {
        const waterRecommendations: { [date: string]: number } = {};
        mealPlansData?.forEach(record => {
          if (record.water_litres != null && record.DailyWorkouts?.daily_workout_date) {
            const date = record.DailyWorkouts.daily_workout_date.split('T')[0];
            waterRecommendations[date] = record.water_litres; // Keep in liters
          }
        });
        console.log('Fetched waterRecommendations:', waterRecommendations);

        const formattedWaterRecords: DailyWater[] = waterData?.map(record => ({
          date: record.water_date,
          amount: record.water_liters,
          recommended: waterRecommendations[record.water_date] || 2.1, // Fallback to 2.1L
          percentage: waterRecommendations[record.water_date] 
            ? (record.water_liters / waterRecommendations[record.water_date]) * 100 
            : (record.water_liters / 2.1) * 100 // Fallback percentage
        })) || [];
        console.log('Fetched waterRecords:', formattedWaterRecords);
        setWaterRecords(formattedWaterRecords);
      }

      // Fetch data from DailySleepRecords
      const { data: sleepRecordsData, error: sleepRecordsError } = await supabase
        .from('DailySleepRecords')
        .select('sleep_date, sleep_hours')
        .eq('user_id', user.id);

      if (sleepRecordsError) {
        console.error('Error fetching data from DailySleepRecords:', sleepRecordsError);
        setLoading(false);
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
            },
            {
              data: [0],
              color: (opacity = 1) => `rgba(72, 61, 139, ${opacity})`,
              strokeWidth: 3,
            },
            {
              data: [1000],
              color: (opacity = 1) => `rgba(0, 0, 0, 0)`,
              strokeWidth: 0,
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
            },
            {
              data: caloriesBurnedData,
              color: (opacity = 1) => `rgba(72, 61, 139, ${opacity})`,
              strokeWidth: 3,
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
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b).getTime());

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
      ]).start(() => setLoading(false));
    } catch (err) {
      console.error('Unexpected error fetching data:', err);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, router]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user?.id) return;

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

    const weightSubscription = supabase
      .channel('weight-history-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'WeightHistory',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('WeightHistory change detected:', payload);
          fetchData();
        }
      )
      .subscribe();

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
        (payload) => {
          console.log('DailyWaterRecords change detected:', payload);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(exerciseSubscription);
      supabase.removeChannel(mealPlanSubscription);
      supabase.removeChannel(sleepSubscription);
      supabase.removeChannel(weightSubscription);
      supabase.removeChannel(waterSubscription);
    };
  }, [user?.id, fetchData]);

  const handleDayPress = (day: { dateString: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(screens)/DailyProgress',
      params: { selectedDate: day.dateString },
    });
  };

  const navigateToSleepTrack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(screens)/SleepTrack');
  };

  const navigateToWaterIntake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(screens)/WaterIntake');
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

  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingAnimation, { 
          transform: [{ rotate: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg']
          }) }]
        }]}>
          <FontAwesome5 name="chart-line" size={SCREEN_WIDTH * 0.1} color="#e45ea9" />
        </Animated.View>
        <Text style={styles.loadingText}>Loading your progress...</Text>
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
          <Image
            source={Logo}
            style={styles.logo}
          />
          <Text style={styles.headerText}>Progress</Text>
          <Text style={styles.usernameText}>{user?.username || 'User'}</Text>
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
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Image
          source={Logo}
          style={styles.logo}
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerText}>Progress</Text>
        </View>
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
        } as StyleProp<ViewStyle>}>
          <View>
            <View style={styles.metricsContainer}>
              <View style={[styles.metricCard, styles.workoutCard]}>
                <View style={styles.metricIconContainer}>
                  <FontAwesome name="heartbeat" size={SCREEN_WIDTH * 0.08} color="#FF6B6B" />
                </View>
                <Text style={styles.metricLabel}>Workouts</Text>
                <Text style={styles.metricValue}>{metrics.totalWorkouts.toFixed(0)}</Text>
                <Text style={styles.metricUnit}>sessions</Text>
              </View>
              <View style={[styles.metricCard, styles.caloriesCard]}>
                <View style={styles.metricIconContainer}>
                  <MaterialIcons name="local-fire-department" size={SCREEN_WIDTH * 0.08} color="#FFA500" />
                </View>
                <Text style={styles.metricLabel}>Calories</Text>
                <Text style={styles.metricValue}>{metrics.totalCalories.toFixed(0)}</Text>
                <Text style={styles.metricUnit}>kcal</Text>
              </View>
              <View style={[styles.metricCard, styles.durationCard]}>
                <View style={styles.metricIconContainer}>
                  <FontAwesome name="clock-o" size={SCREEN_WIDTH * 0.08} color="#4ECDC4" />
                </View>
                <Text style={styles.metricLabel}>Minutes</Text>
                <Text style={styles.metricValue}>{metrics.totalDuration.toFixed(0)}</Text>
                <Text style={styles.metricUnit}>mins</Text>
              </View>
            </View>

            <CollapsibleSection 
              title="Weight Track" 
              iconName="scale-bathroom" 
              iconColor="#9c27b0"
            >
              <View style={styles.weightContainer}>
                {weightRecords.length > 0 ? (
                  <>
                    <View style={styles.weightIndicatorsContainer}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {weightRecords.map((record, index) => (
                          <WeightIndicator
                            key={index}
                            weight={record.weight}
                            change={record.change}
                            date={record.date}
                          />
                        ))}
                      </ScrollView>
                    </View>
                    <View style={styles.weightSummaryContainer}>
                      <View style={styles.weightSummary}>
                        <Text style={styles.weightSummaryLabel}>Current:</Text>
                        <Text style={styles.weightSummaryValue}>
                          {weightRecords.length > 0 ? 
                            weightRecords[weightRecords.length - 1].weight.toFixed(1) + 'kg' : '--'}
                        </Text>
                      </View>
                      <View style={styles.weightSummary}>
                        <Text style={styles.weightSummaryLabel}>Latest Change:</Text>
                        <Text style={[
                          styles.weightSummaryValue,
                          weightRecords.length > 0 && weightRecords[weightRecords.length - 1].change !== undefined && 
                          weightRecords[weightRecords.length - 1].change < 0 
                            ? styles.negativeValue 
                            : styles.positiveValue
                        ]}>
                          {weightRecords.length > 0 && weightRecords[weightRecords.length - 1].change !== undefined ? 
                            weightRecords[weightRecords.length - 1].change.toFixed(1) + 'kg' : '--'}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.noDataContainer}>
                    <MaterialCommunityIcons name="scale-off" size={40} color="#999" />
                    <Text style={styles.noDataText}>No weight data available</Text>
                  </View>
                )}
              </View>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Workout History" 
              iconName="calendar-month" 
              iconColor="#e45ea9"
            >
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
                      textDayFontFamily: 'Inter-Medium',
                      textMonthFontFamily: 'Inter-Bold',
                      textDayHeaderFontFamily: 'Inter-SemiBold',
                      textDayFontSize: 14,
                      textMonthFontSize: 16,
                      textDayHeaderFontSize: 14,
                    }}
                    style={styles.calendar}
                  />
                ) : (
                  <View style={styles.noDataContainer}>
                    <MaterialCommunityIcons name="calendar-remove" size={40} color="#999" />
                    <Text style={styles.noDataText}>No workout history available</Text>
                  </View>
                )}
              </View>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Calories Gained vs Burned" 
              iconName="chart-line" 
              iconColor="#6a5acd"
            >
              <View style={styles.chartWrapper}>
                <ScrollView
                  horizontal={true}
                  showsHorizontalScrollIndicator={true}
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={styles.chartScrollContainer}
                >
                  {caloriesData && (
                    <LineChart
                      data={caloriesData}
                      width={chartWidth}
                      height={chartHeight}
                      yAxisSuffix=" cal"
                      yAxisInterval={400}
                      withShadow={false}
                      withInnerLines={true}
                      withOuterLines={true}
                      withHorizontalLines={true}
                      withVerticalLines={true}
                      withHorizontalLabels={true}
                      withVerticalLabels={true}
                      chartConfig={{
                        backgroundColor: '#fff',
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        propsForDots: {
                          r: 5,
                          strokeWidth: 2,
                          stroke: '#fff',
                        },
                        propsForBackgroundLines: {
                          strokeWidth: 0.5,
                          stroke: '#e0e0e0',
                        },
                        fillShadowGradient: 'transparent',
                        fillShadowGradientOpacity: 0,
                        style: {
                          borderRadius: 16,
                        },
                      }}
                      bezier
                      style={styles.chart}
                    />
                  )}
                </ScrollView>
                <View style={styles.legendContainer}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#6a5acd' }]} />
                    <Text style={styles.legendText}>Calories Gained</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#483d8b' }]} />
                    <Text style={styles.legendText}>Calories Burned</Text>
                  </View>
                </View>
              </View>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Sleep Track" 
              iconName="sleep" 
              iconColor="#FFD700"
            >
              <View style={styles.chartWrapper}>
                <ScrollView
                  horizontal={true}
                  showsHorizontalScrollIndicator={true}
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={styles.chartScrollContainer}
                >
                  {sleepData && (
                    <LineChart
                      data={sleepData}
                      width={sleepChartWidth}
                      height={sleepChartHeight}
                      yAxisSuffix=" hrs"
                      yAxisInterval={1}
                      withShadow={false}
                      withInnerLines={true}
                      withOuterLines={true}
                      chartConfig={{
                        backgroundColor: '#fff',
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        decimalPlaces: 1,
                        color: (opacity = 1) => `rgba(255, 219, 88, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        propsForDots: {
                          r: 5,
                          strokeWidth: 2,
                          stroke: '#fff',
                        },
                        propsForBackgroundLines: {
                          strokeWidth: 0.5,
                          stroke: '#e0e0e0',
                        },
                      }}
                      bezier
                      style={styles.chart}
                    />
                  )}
                </ScrollView>
                <View style={styles.legendContainer}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#FFD700' }]} />
                    <Text style={styles.legendText}>Your Sleep</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#FFD700', opacity: 0.4 }]} />
                    <Text style={styles.legendText}>8-hour Target</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.historyButton}
                onPress={navigateToSleepTrack}
              >
                <Text style={styles.historyButtonText}>View Sleep History</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#FFD700" />
              </TouchableOpacity>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Water Intake" 
              iconName="cup-water" 
              iconColor="#40a4df"
            >
              <View style={styles.waterContainer}>
                {waterRecords.length > 0 ? (
                  <>
                    <View style={styles.waterBottlesContainer}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {waterRecords.map((record, index) => (
                          <WaterIndicator
                            key={index}
                            amount={record.amount}
                            recommended={record.recommended}
                            date={record.date}
                          />
                        ))}
                      </ScrollView>
                    </View>
                    <View style={styles.waterSummary}>
                      <Text style={styles.waterSummaryText}>
                        Average: {(waterRecords.reduce((sum, record) => sum + record.amount, 0) / waterRecords.length).toFixed(2)}L/day
                      </Text>
                      <Text style={styles.waterSummaryText}>
                        Average Target Completion: {Math.round(waterRecords.reduce((sum, record) => sum + (record.percentage || 0), 0) / waterRecords.length)}%
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.noDataContainer}>
                    <MaterialCommunityIcons name="cup-off" size={40} color="#999" />
                    <Text style={styles.noDataText}>No water data available</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.historyButton}
                onPress={navigateToWaterIntake}
              >
                <Text style={styles.historyButtonText}>View Water History</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#40a4df" />
              </TouchableOpacity>
            </CollapsibleSection>
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
  headerTextContainer: {
    flex: 1,
    marginTop: 8,
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contentContainer: {
    paddingBottom: 30,
    paddingTop: 8,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '30%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  workoutCard: {
    borderTopWidth: 4,
    borderTopColor: '#FF6B6B',
  },
  caloriesCard: {
    borderTopWidth: 4,
    borderTopColor: '#FFA500',
  },
  durationCard: {
    borderTopWidth: 4,
    borderTopColor: '#4ECDC4',
  },
  metricIconContainer: {
    backgroundColor: 'rgba(228, 94, 169, 0.1)',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#333',
    marginTop: 4,
  },
  metricUnit: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#999',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionContent: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  calendarWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  calendar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  chartWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  chartScrollContainer: {
    paddingBottom: 8,
  },
  chart: {
    borderRadius: 12,
    marginRight: 8,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#555',
  },
  noDataContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  noDataText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F9F9F9',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#333',
    textAlign: 'center',
    marginVertical: 16,
    lineHeight: 24,
  },
  loginButton: {
    backgroundColor: '#e45ea9',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    marginTop: 16,
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  weightContainer: {
    padding: 8,
  },
  weightIndicatorsContainer: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  weightIndicator: {
    alignItems: 'center',
    marginHorizontal: 12,
    width: 80,
  },
  weightDateContainer: {
    marginBottom: 8,
  },
  weightDate: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#666',
  },
  weightCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f3e5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9c27b0',
  },
  weightValue: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#9c27b0',
  },
  weightUnit: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#9c27b0',
  },
  weightChange: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  positiveChange: {
    backgroundColor: '#f44336',
  },
  negativeChange: {
    backgroundColor: '#4caf50',
  },
  weightChangeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
    marginLeft: 2,
  },
  weightSummaryContainer: {
    backgroundColor: '#f3e5f5',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  weightSummary: {
    alignItems: 'center',
    minWidth: 100,
    marginVertical: 4,
  },
  weightSummaryLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#9c27b0',
  },
  weightSummaryValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#9c27b0',
    marginTop: 4,
  },
  positiveValue: {
    color: '#4caf50',
  },
  negativeValue: {
    color: '#f44336',
  },
  waterContainer: {
    padding: 8,
  },
  waterBottlesContainer: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  waterBottleContainer: {
    alignItems: 'center',
    marginHorizontal: 10,
    width: 80,
  },
  waterBottle: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 150,
    marginBottom: 8,
  },
  waterBottleOutline: {
    width: 50,
    height: '100%',
    borderWidth: 2,
    borderColor: '#40a4df',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f9ff',
  },
  waterFill: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  waterTargetLine: {
    position: 'absolute',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#fff',
    zIndex: 1,
  },
  waterBottleDate: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#666',
    marginBottom: 4,
  },
  waterBottleAmount: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#40a4df',
  },
  waterSummary: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  waterSummaryText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#333',
    marginVertical: 4,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginTop: 12,
  },
  historyButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#333',
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