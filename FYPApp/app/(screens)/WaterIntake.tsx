import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Easing,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Animated,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import Logo from '@/assets/images/Logo.png';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WaterRecord {
  date: string;
  amount: number; // in liters
}

const WaterIntake = () => {
  const router = useRouter();
  const { user } = useUserAuth();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const [loading, setLoading] = useState(true);
  const [waterRecords, setWaterRecords] = useState<WaterRecord[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()));
  const [averageWeeklyIntake, setAverageWeeklyIntake] = useState<number>(0);

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

  // Fetch water records from database
  const fetchWaterRecords = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('DailyWaterRecords')
        .select('water_date, water_liters')
        .eq('user_id', user.id)
        .order('water_date', { ascending: true });

      if (error) {
        console.error('Error fetching water records:', error);
        return;
      }

      if (data) {
        const formattedRecords: WaterRecord[] = data.map(record => ({
          date: record.water_date,
          amount: record.water_liters
        }));
        setWaterRecords(formattedRecords);
        
        // Calculate average weekly intake if we have data
        if (formattedRecords.length > 0) {
          const total = formattedRecords.reduce((sum, record) => sum + record.amount, 0);
          setAverageWeeklyIntake(total / formattedRecords.length);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching water records:', err);
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

  // Get water amount for a specific date
  const getWaterAmountForDate = (date: Date): number | null => {
    const dateStr = formatDate(date);
    const record = waterRecords.find(r => r.date === dateStr);
    return record ? record.amount : null;
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
    fetchWaterRecords();
  }, [user?.id]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('water-records-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'DailyWaterRecords',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchWaterRecords();
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

  return (
    <View style={styles.container}>
      <Video
        source={require('../../assets/videos/waterpour.mp4')}
        rate={1.0}
        volume={1.0}
        isMuted={true}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        style={StyleSheet.absoluteFill}
      />

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
        <Text style={styles.headerText}>Water Intake</Text>
      </Animated.View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#40a4df" />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
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
                <Ionicons name="chevron-back" size={24} color="#40a4df" />
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
                      : '#40a4df'
                  } 
                />
              </TouchableOpacity>
            </View>

            {/* Weekly Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Weekly Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Average Intake:</Text>
                <Text style={styles.summaryValue}>
                  {averageWeeklyIntake.toFixed(2)} L/day
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Days Tracked:</Text>
                <Text style={styles.summaryValue}>
                  {waterRecords.length} days
                </Text>
              </View>
            </View>

            {/* Daily Water Cards */}
            <View style={styles.daysContainer}>
              {weekDates.map((date, index) => {
                const dateStr = formatDate(date);
                const amount = getWaterAmountForDate(date);
                const isToday = dateStr === today;
                
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.dayCard,
                      isToday && styles.todayCard
                    ]}
                  >
                    <Text style={styles.dayTitle}>{formatDisplayDate(date)}</Text>
                    {amount !== null ? (
                      <>
                        <Text style={styles.dayAmount}>{amount.toFixed(2)} L</Text>
                        <View style={styles.progressBarBackground}>
                          <View 
                            style={[
                              styles.progressBarFill,
                              { 
                                width: `${Math.min((amount / 3) * 100, 100)}%`,
                                backgroundColor: isToday ? '#40a4df' : '#8bc9e8'
                              }
                            ]}
                          />
                        </View>
                        <Text style={styles.dayPercentage}>
                          {Math.round((amount / 3) * 100)}%
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.dayEmpty}>No data</Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Add Water Button */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(modals)/LogWater');
              }}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Add Water Intake</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
};

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
  logo: {
    width: SCREEN_WIDTH * 0.12,
    height: SCREEN_WIDTH * 0.12,
    borderRadius: SCREEN_WIDTH * 0.05,
    marginRight: SCREEN_WIDTH * 0.023,
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
  scrollContainer: {
    paddingBottom: SCREEN_HEIGHT * 0.1,
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
    marginHorizontal: SCREEN_WIDTH * 0.04,
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
    padding: SCREEN_WIDTH * 0.06,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.02,
    borderLeftWidth: 4,
    borderLeftColor: '#40a4df',
    paddingLeft: SCREEN_WIDTH * 0.03,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  summaryLabel: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
  },
  summaryValue: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    color: '#40a4df',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  dayCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  todayCard: {
    borderWidth: 2,
    borderColor: '#40a4df',
  },
  dayTitle: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  dayAmount: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: 'bold',
    color: '#0077be',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  dayEmpty: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#999',
    fontStyle: 'italic',
    marginVertical: SCREEN_HEIGHT * 0.01,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e0f7fa',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  progressBarFill: {
    height: '100%',
  },
  dayPercentage: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#0077be',
    textAlign: 'right',
  },
  addButton: {
    backgroundColor: '#40a4df',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.02,
    borderRadius: 12,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginTop: SCREEN_HEIGHT * 0.01,
    shadowColor: '#40a4df',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    marginLeft: SCREEN_WIDTH * 0.02,
  },
});

export default WaterIntake;