import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  Pressable,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar } from 'react-native-calendars';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Define types for Supabase responses
type MenstrualCyclePhase = {
  cycle_day: number;
  phase: string;
};

type UserData = {
  bleeding_days: number | null;
  last_period_date: string | null;
  cycle_length: number | null;
  age: number;
  weight: number;
  height: number;
  goal: string;
  challenge_days: number;
  preferred_rest_days: string;
  activity_level: string;
  diseases: string | null;
};

export default function OvulationTracker() {
  const { user, refreshUser } = useUserAuth();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [currentCycleDay, setCurrentCycleDay] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>('Loading...');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [initialDataModalVisible, setInitialDataModalVisible] = useState(false);
  const [bleedingDays, setBleedingDays] = useState('');
  const [cycleLength, setCycleLength] = useState('');
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [isMenopausal, setIsMenopausal] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    const checkMenopausalStatusAndData = async () => {
      if (!user?.id) {
        setIsMenopausal(false);
        setInitialDataModalVisible(false);
        return;
      }
      const { data, error } = await supabase
        .from('User')
        .select('diseases, bleeding_days, cycle_length, last_period_date')
        .eq('id', user.id)
        .single() as { data: UserData | null, error: any };
      
      if (error || !data) {
        console.error('Failed to fetch user data:', error);
        setIsMenopausal(false);
        setInitialDataModalVisible(false);
      } else {
        const menopausal = data.diseases?.includes('Menopause') || false;
        setIsMenopausal(menopausal);
        if (!menopausal) {
          if (!data.bleeding_days || !data.cycle_length || !data.last_period_date) {
            setInitialDataModalVisible(true);
          } else {
            setBleedingDays(data.bleeding_days.toString() || '');
            setCycleLength(data.cycle_length.toString() || '');
            setLastPeriodDate(data.last_period_date || '');
          }
        }
      }
    };
    checkMenopausalStatusAndData();
  }, [user?.id]);

  const fetchTodayPhase = async () => {
    if (!user?.id || isMenopausal) {
      setCurrentPhase(isMenopausal ? 'Disabled' : 'User not logged in');
      setCurrentCycleDay(null);
      return;
    }

    try {
      const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      const { data, error, count } = await supabase
        .from('MenstrualCyclePhases')
        .select('cycle_day, phase', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error || count === 0) {
        console.log('No data or error:', error?.message);
        const { data: allPhases, error: allPhasesError } = await supabase
          .from('MenstrualCyclePhases')
          .select('date', { count: 'exact' })
          .eq('user_id', user.id);

        if (allPhasesError || allPhases.length === 0) {
          setCurrentPhase('Late for period logging');
          setCurrentCycleDay(null);
        } else {
          setCurrentPhase('Phase data not available');
          setCurrentCycleDay(null);
        }
        return;
      }

      setCurrentCycleDay(data.cycle_day);
      setCurrentPhase(data.phase || 'Unknown Phase');
    } catch (error) {
      console.error('Error in fetchTodayPhase:', error);
      setCurrentPhase('Error fetching phase');
      setCurrentCycleDay(null);
    }
  };

  useEffect(() => {
    if (!initialDataModalVisible) {
      fetchTodayPhase();
    }
  }, [user?.id, isMenopausal, initialDataModalVisible]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('Refresh started');
    try {
      await fetchTodayPhase();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
      console.log('Refresh completed');
    }
  }, [user?.id, isMenopausal]);

  const handleLogPeriod = async () => {
    if (!user?.id || isMenopausal) return;

    setRefreshing(true);

    try {
      // Get current date in YYYY-MM-DD format
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

      // First update the User table with the new last_period_date
      const { error: updateError } = await supabase
        .from('User')
        .update({ last_period_date: formattedDate })
        .eq('id', user.id);

      if (updateError) {
        throw new Error(`Failed to update last period date: ${updateError.message}`);
      }

      // Then fetch the updated user data
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('cycle_length, bleeding_days, age, weight, height, goal, challenge_days, preferred_rest_days, activity_level')
        .eq('id', user.id)
        .single();

      if (userError || !userData) {
        throw new Error('Failed to fetch updated user data');
      }

      // Rest of your existing code for generating cycle phases and updating plans...
      const { data: workoutPlanData, error: workoutError } = await supabase
        .from('WorkoutPlans')
        .select('id, start_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (workoutError || !workoutPlanData) {
        throw new Error('No active workout plan found.');
      }

      // Calculate days elapsed and remaining
      const startDate = new Date(workoutPlanData.start_date);
      const daysElapsed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const remainingDays = Math.max(1, userData.challenge_days - daysElapsed);

      // Generate new cycle phases (your existing code)
      const response = await fetch('http://10.135.64.168:5000/api/generate-cycle-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastPeriodDate: formattedDate,
          cycleLength: userData.cycle_length,
          bleedingDays: userData.bleeding_days,
          challengeDays: userData.challenge_days,
          age: userData.age,
          weight: userData.weight,
          height: userData.height,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to predict cycle: ${errorText}`);
      }

      const newCyclePhases = await response.json();

      // Update cycle and plans (your existing code)
      const planResponse = await fetch('http://10.135.64.168:5000/api/update-cycle-and-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          weight: userData.weight,
          activity_level: userData.activity_level,
          challenge_days: userData.challenge_days,
          remaining_days: remainingDays,
          start_date: workoutPlanData.start_date,
          last_period_date: formattedDate,  // Use the same formatted date
          cycle_length: userData.cycle_length,
          bleeding_days: userData.bleeding_days,
          cycle_phases: newCyclePhases,
          age: userData.age,
          goal: userData.goal,
          preferred_rest_days: userData.preferred_rest_days,
          height: userData.height,
        }),
      });

      if (!planResponse.ok) {
        const errorText = await planResponse.text();
        throw new Error(`Failed to update plans: ${errorText}`);
      }

      await refreshUser();
      Alert.alert('Success', 'Period logged and plans updated');
      await fetchTodayPhase();
    } catch (error: any) {
      console.error('Error in handleLogPeriod:', error);
      Alert.alert('Error', `Failed to log period: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveCycleData = async (isInitial: boolean) => {
    if (!user?.id || isMenopausal) return;

    const newBleedingDays = parseInt(bleedingDays);
    const newCycleLength = parseInt(cycleLength);
    if (isNaN(newBleedingDays) || newBleedingDays < 2 || newBleedingDays > 7) {
      Alert.alert('Error', 'Bleeding days must be between 2 and 7');
      return;
    }
    if (isNaN(newCycleLength) || newCycleLength < 21 || newCycleLength > 35) {
      Alert.alert('Error', 'Cycle length must be between 21 and 35 days');
      return;
    }
    if (!lastPeriodDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Error', 'Last period date must be in YYYY-MM-DD format');
      return;
    }

    if (isInitial) {
      setInitialDataModalVisible(false);
    } else {
      setEditModalVisible(false);
    }

    try {
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('age, weight, height, goal, activity_level, challenge_days, preferred_rest_days')
        .eq('id', user.id)
        .single() as { data: UserData | null, error: any };

      if (userError || !userData) {
        throw new Error('Failed to fetch user data');
      }

      if (!userData.challenge_days || !userData.age || !userData.weight || !userData.height) {
        throw new Error('Missing required user data for cycle and plan update');
      }

      const { data: workoutPlanData, error: workoutError } = await supabase
        .from('WorkoutPlans')
        .select('id, start_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (workoutError || !workoutPlanData) {
        console.error('DEBUG: Error fetching workout plan:', workoutError?.message || 'No workout plan');
        throw new Error('No active workout plan found.');
      }

      console.log('DEBUG: Fetched workout plan:', {
        id: workoutPlanData.id,
        start_date: workoutPlanData.start_date
      });

      const startDate = new Date(workoutPlanData.start_date);
      const currentDateObj = new Date();
      const daysElapsed = Math.floor((currentDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const remainingDays = Math.max(1, userData.challenge_days - daysElapsed);

      const response = await fetch('http://10.135.64.168:5000/api/generate-cycle-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastPeriodDate: lastPeriodDate,
          cycleLength: newCycleLength,
          bleedingDays: newBleedingDays,
          challengeDays: userData.challenge_days,
          age: userData.age,
          weight: userData.weight,
          height: userData.height,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to predict cycle: ${errorText}`);
      }

      const newCyclePhases = await response.json();
      console.log('Cycle phases generated:', newCyclePhases);

      if (!Array.isArray(newCyclePhases)) {
        console.error('newCyclePhases is not an array:', newCyclePhases);
        throw new Error('Invalid cycle phases data received from server');
      }

      const planPayload = {
        user_id: user.id,
        weight: userData.weight,
        activity_level: userData.activity_level,
        challenge_days: userData.challenge_days,
        remaining_days: remainingDays,
        start_date: workoutPlanData.start_date,
        last_period_date: lastPeriodDate,
        cycle_length: newCycleLength,
        bleeding_days: newBleedingDays,
        cycle_phases: newCyclePhases,
        age: userData.age,
        goal: userData.goal,
        preferred_rest_days: userData.preferred_rest_days,
        height: userData.height,
      };

      console.log('Payload sent to /api/update-cycle-and-plans:', planPayload);

      const planResponse = await fetch('http://10.135.64.168:5000/api/update-cycle-and-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planPayload),
      });

      if (!planResponse.ok) {
        const errorText = await planResponse.text();
        throw new Error(`Failed to update plans: ${errorText}`);
      }

      const planResult = await planResponse.json();
      console.log('Update cycle and plans response:', planResult);

      await refreshUser();
      Alert.alert('Success', 'Cycle data saved and plans updated');
      await fetchTodayPhase();
    } catch (error: any) {
      console.error('Error in handleSaveCycleData:', error);
      Alert.alert('Error', `Failed to save cycle data: ${error.message}`);
    }
  };

  const handleEditDataPress = async () => {
    if (isMenopausal) {
      Alert.alert('Info', 'This feature is not available for menopausal users');
      return;
    }
    
    // Fetch current data before showing modal
    await fetchCycleData();
    setEditModalVisible(true);
  };

  const handleHistoryPress = () => {
    if (isMenopausal) {
      Alert.alert('Info', 'This feature is not available for menopausal users');
      return;
    }
    router.push('/(screens)/PeriodsCalendar');
  };

  const onDayPress = (day: any) => {
    if (!isMenopausal) {
      const selectedDate = day.dateString;
      setLastPeriodDate(selectedDate);
      setShowCalendar(false);
    }
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/Home');
  };

  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }]
    }]}>
      <Image
        source={require('../../assets/images/Logo.png')}
        style={styles.logoImage}
      />
      <Text style={styles.headerText}>Ovulation Tracker</Text>
      <Text style={styles.usernameText}>{user?.username || 'User'}</Text>
    </Animated.View>
  );

  const renderContent = () => {
    if (isMenopausal) {
      return (
        <View style={styles.disabledContainer}>
          <MaterialCommunityIcons 
            name="account-cancel" 
            size={SCREEN_WIDTH * 0.15} 
            color="#e45ea9" 
          />
          <Text style={styles.disabledText}>
            This feature is not available for menopausal users
          </Text>
        </View>
      );
    }

    return (
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}>
        <View style={styles.phaseContainer}>
          <View style={styles.phaseHeader}>
            <MaterialCommunityIcons 
              name="calendar-heart" 
              size={SCREEN_WIDTH * 0.08} 
              color="#e45ea9" 
            />
            <Text style={styles.phaseDate}>
              {new Date().toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </Text>
          </View>
          
          <View style={styles.phaseContent}>
            <Text style={styles.phaseTitle}>
              {currentPhase === 'Phase data not available' && currentCycleDay === null
                ? 'Cycle Tracking'
                : currentPhase === 'Loading...' || currentPhase === 'Error fetching phase'
                ? currentPhase
                : `${currentPhase} Phase`}
            </Text>
            {currentCycleDay !== null && (
              <Text style={styles.cycleDayText}>Day {currentCycleDay} of cycle</Text>
            )}
          </View>
        </View>

        <View style={styles.logPeriodContainer}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons 
              name="water" 
              size={SCREEN_WIDTH * 0.06} 
              color="#e45ea9" 
            />
            <Text style={styles.sectionTitle}>Period Tracking</Text>
          </View>
          
          <Text style={styles.infoDescription}>
            Mark today as the start of your menstruation to update your cycle dates and plans.
          </Text>
          
          <TouchableOpacity 
            style={[styles.primaryButton, isMenopausal && styles.disabledButton]}
            onPress={isMenopausal ? undefined : handleLogPeriod}
            disabled={isMenopausal}
          >
            <MaterialCommunityIcons 
              name="calendar-plus" 
              size={SCREEN_WIDTH * 0.05} 
              color="#fff" 
            />
            <Text style={styles.primaryButtonText}>Log Period Start</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.secondaryButton, isMenopausal && styles.disabledButton]}
            onPress={isMenopausal ? undefined : handleEditDataPress}
            disabled={isMenopausal}
          >
            <MaterialCommunityIcons 
              name="pencil" 
              size={SCREEN_WIDTH * 0.05} 
              color={isMenopausal ? '#999' : '#e45ea9'} 
            />
            <Text style={[styles.secondaryButtonText, isMenopausal && { color: '#999' }]}>
              Edit Cycle Data
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.secondaryButton, isMenopausal && styles.disabledButton]}
            onPress={isMenopausal ? undefined : handleHistoryPress}
            disabled={isMenopausal}
          >
            <MaterialCommunityIcons 
              name="calendar-month" 
              size={SCREEN_WIDTH * 0.05} 
              color={isMenopausal ? '#999' : '#e45ea9'} 
            />
            <Text style={[styles.secondaryButtonText, isMenopausal && { color: '#999' }]}>
              View History
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderCycleDataModal = (isInitial: boolean) => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isInitial ? initialDataModalVisible : editModalVisible}
      onRequestClose={() => {
        if (isInitial) {
          setInitialDataModalVisible(false);
          router.back();
        } else {
          setEditModalVisible(false);
        }
      }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Pressable 
                onPress={() => {
                  if (isInitial) {
                    setInitialDataModalVisible(false);
                    router.back();
                  } else {
                    setEditModalVisible(false);
                  }
                }}
                style={styles.modalBackButton}
              >
                <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />
              </Pressable>
              <Text style={styles.modalTitle}>
                {isInitial ? 'Enter Cycle Data' : 'Edit Cycle Data'}
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Last Period Date (YYYY-MM-DD)</Text>
              <View style={styles.dateInputContainer}>
                <TextInput
                  style={styles.dateInput}
                  value={lastPeriodDate}
                  onChangeText={setLastPeriodDate}
                  placeholder="YYYY-MM-DD"
                  editable={false}
                />
                <Pressable 
                  onPress={() => setShowCalendar(true)}
                  style={styles.calendarButton}
                  disabled={isMenopausal}
                >
                  <MaterialIcons 
                    name="calendar-today" 
                    size={SCREEN_WIDTH * 0.06} 
                    color={isMenopausal ? '#999' : '#e45ea9'} 
                  />
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Cycle Length (21-35 days)</Text>
              <TextInput
                style={styles.input}
                value={cycleLength}
                onChangeText={setCycleLength}
                keyboardType="numeric"
                placeholder="Enter cycle length"
                editable={!isMenopausal}
              />

              <Text style={styles.inputLabel}>Bleeding Days (2-7 days)</Text>
              <TextInput
                style={styles.input}
                value={bleedingDays}
                onChangeText={setBleedingDays}
                keyboardType="numeric"
                placeholder="Enter bleeding days"
                editable={!isMenopausal}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, isMenopausal && styles.disabledButton]}
              onPress={() => handleSaveCycleData(isInitial)}
              disabled={isMenopausal}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>

      {showCalendar && (
        <View style={styles.calendarModal}>
          <Pressable 
            style={styles.calendarCloseButton}
            onPress={() => setShowCalendar(false)}
          >
            <Ionicons name="close" size={24} color="#e45ea9" />
          </Pressable>
          
          <Calendar
            onDayPress={onDayPress}
            markedDates={{
              [lastPeriodDate]: { selected: true, marked: true, selectedColor: '#e45ea9' },
            }}
            theme={{
              selectedDayBackgroundColor: '#e45ea9',
              todayTextColor: '#e45ea9',
              arrowColor: '#e45ea9',
            }}
          />
          
          <TouchableOpacity
            style={styles.closeCalendarButton}
            onPress={() => setShowCalendar(false)}
          >
            <Text style={styles.closeCalendarText}>Select Date</Text>
          </TouchableOpacity>
        </View>
      )}
    </Modal>
  );

  const fetchCycleData = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('User')
        .select('last_period_date, cycle_length, bleeding_days')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setLastPeriodDate(data.last_period_date || '');
        setCycleLength(data.cycle_length?.toString() || '');
        setBleedingDays(data.bleeding_days?.toString() || '');
      }
    } catch (error) {
      console.error('Error fetching cycle data:', error);
    }
  };

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
    ]).start(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingAnimation, { transform: [{ rotate: fadeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg']
        }) }] }]}>
          <FontAwesome5 name="calendar-alt" size={SCREEN_WIDTH * 0.1} color="#e45ea9" />
        </Animated.View>
        <Text style={styles.loadingText}>Loading tracker...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e45ea9"
            colors={['#e45ea9']}
          />
        }
      >
        {renderContent()}
      </ScrollView>

      {renderCycleDataModal(false)}
      {renderCycleDataModal(true)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  contentContainer: {
    padding: SCREEN_WIDTH * 0.05,
    paddingBottom: SCREEN_HEIGHT * 0.1,
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
  logoImage: {
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
  phaseContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingTop: SCREEN_WIDTH * 0.05,
    paddingRight: SCREEN_WIDTH * 0.05,
    paddingLeft: SCREEN_WIDTH * 0.05,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  phaseDate: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#666',
    marginLeft: SCREEN_WIDTH * 0.03,
    fontFamily: 'Inter-Medium',
  },
  phaseContent: {
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  phaseTitle: {
    fontSize: SCREEN_WIDTH * 0.06,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
    fontFamily: 'Inter-Bold',
  },
  cycleDayText: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#e45ea9',
    fontWeight: '600',
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  logPeriodContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SCREEN_WIDTH * 0.05,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '600',
    color: '#333',
    marginLeft: SCREEN_WIDTH * 0.03,
    fontFamily: 'Inter-SemiBold',
  },
  infoDescription: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    lineHeight: SCREEN_WIDTH * 0.055,
    marginBottom: SCREEN_HEIGHT * 0.025,
    fontFamily: 'Inter-Regular',
  },
  primaryButton: {
    backgroundColor: '#e45ea9',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.018,
    borderRadius: 14,
    marginTop: SCREEN_HEIGHT * 0.01,
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    marginLeft: SCREEN_WIDTH * 0.02,
    fontFamily: 'Inter-SemiBold',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.018,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e45ea9',
    flex: 1,
    marginHorizontal: SCREEN_WIDTH * 0.01,
  },
  secondaryButtonText: {
    color: '#e45ea9',
    fontSize: SCREEN_WIDTH * 0.036,
    fontWeight: '600',
    marginLeft: SCREEN_WIDTH * 0.02,
    fontFamily: 'Inter-SemiBold',
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.05,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  modalBackButton: {
    padding: SCREEN_WIDTH * 0.02,
  },
  modalTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: SCREEN_WIDTH * 0.06,
  },
  inputContainer: {
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  inputLabel: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  dateInput: {
    flex: 1,
    padding: SCREEN_HEIGHT * 0.015,
    fontSize: SCREEN_WIDTH * 0.04,
  },
  calendarButton: {
    padding: SCREEN_HEIGHT * 0.015,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: SCREEN_HEIGHT * 0.015,
    fontSize: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  saveButton: {
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  calendarModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    padding: SCREEN_WIDTH * 0.05,
  },
  closeCalendarButton: {
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    borderRadius: 25,
    marginTop: SCREEN_HEIGHT * 0.02,
    alignItems: 'center',
  },
  calendarCloseButton: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.05,
    right: SCREEN_WIDTH * 0.05,
    zIndex: 100,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    padding: 10,
  },
  closeCalendarText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.05,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    lineHeight: SCREEN_WIDTH * 0.06,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#ccc',
    borderColor: '#999',
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
});