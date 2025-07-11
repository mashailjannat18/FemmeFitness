import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Dimensions, 
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { FontAwesome5, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SleepRecord {
  date: string;
  sleepHours: number;
}

export default function SleepTrack() {
  const { user } = useUserAuth();
  const router = useRouter();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const [loading, setLoading] = useState(true);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()));
  const [averageSleep, setAverageSleep] = useState<number>(0);

  // Function to get start of week (Sunday)
  function getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  // Function to get dates for the current week
  function getWeekDates(startDate: Date): Date[] {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }

  // Fetch sleep records from database
  const fetchSleepRecords = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('DailySleepRecords')
        .select('sleep_date, sleep_hours')
        .eq('user_id', user.id)
        .order('sleep_date', { ascending: true });

      if (error) {
        console.error('Error fetching sleep records:', error);
        return;
      }

      if (data) {
        const formattedRecords: SleepRecord[] = data.map(record => ({
          date: record.sleep_date,
          sleepHours: record.sleep_hours
        }));
        setSleepRecords(formattedRecords);
        
        // Calculate average sleep if we have data
        if (formattedRecords.length > 0) {
          const total = formattedRecords.reduce((sum, record) => sum + record.sleepHours, 0);
          setAverageSleep(total / formattedRecords.length);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching sleep records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle week navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = new Date(currentWeekStart);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentWeekStart(newDate);
  };

  // Format date to YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Get sleep hours for a specific date
  const getSleepHoursForDate = (date: Date): number | null => {
    const dateStr = formatDate(date);
    const record = sleepRecords.find(r => r.date === dateStr);
    return record ? record.sleepHours : null;
  };

  // Format date for display (e.g., "Mon 15")
  const formatDisplayDate = (date: Date): string => {
    const day = date.toLocaleString('en-US', { weekday: 'short' });
    const dateNum = date.getDate();
    return `${day} ${dateNum}`;
  };

  // Handle back press
  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // Fetch data on component mount and when user changes
  useEffect(() => {
    fetchSleepRecords();
  }, [user?.id]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('sleep-records-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'DailySleepRecords',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchSleepRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id]);

  // Animation on load
  useEffect(() => {
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
  }, []);

  // Get dates for current week
  const weekDates = getWeekDates(currentWeekStart);
  const today = new Date().toISOString().split('T')[0];

  // Prepare data for chart
  const chartData = weekDates.map(date => {
    const dateStr = formatDate(date);
    const record = sleepRecords.find(r => r.date === dateStr);
    return {
      day: date.toLocaleString('en-US', { weekday: 'short' }),
      duration: record ? record.sleepHours : 0,
      hasData: record !== undefined
    };
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Pressable 
          onPress={handleBackPress} 
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Sleep Track</Text>
      </Animated.View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}>
            {/* Week Navigation */}
            <View style={styles.weekNavigation}>
              <TouchableOpacity 
                onPress={() => navigateWeek('prev')}
                style={styles.navButton}
              >
                <Ionicons name="chevron-back" size={24} color="#FFD700" />
              </TouchableOpacity>
              
              <Text style={styles.weekTitle}>
                {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
              
              <TouchableOpacity 
                onPress={() => navigateWeek('next')}
                style={styles.navButton}
                disabled={new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000) > new Date()}
              >
                <Ionicons 
                  name="chevron-forward" 
                  size={24} 
                  color={
                    new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000) > new Date() 
                      ? '#ccc' 
                      : '#FFD700'
                  } 
                />
              </TouchableOpacity>
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <MaterialCommunityIcons name="sleep" size={24} color="#FFD700" />
                <Text style={styles.summaryTitle}>Weekly Sleep Average</Text>
              </View>
              <Text style={styles.summaryValue}>{averageSleep.toFixed(1)} hours</Text>
              <Text style={styles.summarySubtitle}>
                {sleepRecords.length > 0 
                  ? `Based on ${sleepRecords.length} days of data` 
                  : 'No sleep data available'}
              </Text>
            </View>

            {/* Chart */}
            <View style={styles.chartContainer}>
              <LineChart
                data={{
                  labels: chartData.map((d) => d.day),
                  datasets: [{
                    data: chartData.map((d) => d.duration),
                    color: (opacity = 1) => `rgba(255, 219, 88, ${opacity})`,
                    strokeWidth: 3,
                  }],
                }}
                width={SCREEN_WIDTH - 40}
                height={220}
                yAxisSuffix="h"
                yAxisInterval={1}
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(255, 219, 88, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  propsForDots: {
                    r: "5",
                    strokeWidth: "2",
                    stroke: "#fff",
                  },
                  propsForBackgroundLines: {
                    strokeWidth: 0.5,
                    stroke: '#e0e0e0',
                  },
                }}
                style={styles.chart}
                bezier
              />
            </View>

            {/* Daily Sleep List */}
            <View style={styles.dailySleepContainer}>
              <Text style={styles.sectionTitle}>Daily Sleep Records</Text>
              
              {weekDates.map((date, index) => {
                const dateStr = formatDate(date);
                const hours = getSleepHoursForDate(date);
                const isToday = dateStr === today;
                
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.sleepRecord,
                      isToday && styles.todayRecord
                    ]}
                  >
                    <View style={styles.sleepRecordHeader}>
                      <FontAwesome5 
                        name="bed" 
                        size={18} 
                        color={isToday ? '#FFD700' : '#e45ea9'} 
                      />
                      <Text style={styles.dayText}>
                        {formatDisplayDate(date)}
                        {isToday && ' (Today)'}
                      </Text>
                    </View>
                    {hours !== null ? (
                      <Text style={styles.durationText}>{hours.toFixed(1)} hours</Text>
                    ) : (
                      <Text style={styles.noDataText}>--</Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Add Sleep Button */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(modals)/LogSleep');
              }}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Add Sleep Record</Text>
            </TouchableOpacity>

            {/* Footer */}
            <Text style={styles.footerText}>
              Maintain consistent sleep patterns for better health and performance
            </Text>
          </Animated.View>
        </ScrollView>
      )}
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
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_HEIGHT * 0.02,
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
    textAlign: 'center',
    marginRight: 20,
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contentContainer: {
    paddingBottom: SCREEN_HEIGHT * 0.04,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingTop: SCREEN_HEIGHT * 0.02,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  navButton: {
    padding: 10,
  },
  weekTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#333',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SCREEN_WIDTH * 0.05,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  summaryTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#FFD700',
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  summaryValue: {
    fontSize: SCREEN_WIDTH * 0.08,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: SCREEN_HEIGHT * 0.01,
  },
  summarySubtitle: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#888',
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chart: {
    borderRadius: 12,
  },
  dailySleepContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.02,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
    paddingLeft: SCREEN_WIDTH * 0.03,
  },
  sleepRecord: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  todayRecord: {
    backgroundColor: 'rgba(255, 219, 88, 0.1)',
    borderRadius: 8,
  },
  sleepRecordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#555',
    marginLeft: SCREEN_WIDTH * 0.03,
  },
  durationText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#FFD700',
  },
  noDataText: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#999',
    fontStyle: 'italic',
  },
  addButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.02,
    borderRadius: 12,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#333',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  footerText: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#888',
    textAlign: 'center',
  },
});