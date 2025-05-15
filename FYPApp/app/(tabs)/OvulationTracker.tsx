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
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Define types for Supabase responses
type MenstrualCyclePhase = {
  cycle_day: number;
  phase: string;
};

type UserData = {
  bleeding_days: number | null;
  last_period_date: string | null;
  cycle_length: number;
  age: number;
  weight: number;
  height: number;
  goal: string;
  challenge_days: number;
  preferred_rest_days: string;
  activity_level: string;
};

export default function OvulationTracker() {
  const { user, refreshUser } = useUserAuth();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [currentCycleDay, setCurrentCycleDay] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>('Loading...');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRecalibrationDate, setLastRecalibrationDate] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bleedingDays, setBleedingDays] = useState('');
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const fetchTodayPhase = async () => {
    if (!user?.id) {
      setCurrentPhase('User not logged in');
      return;
    }

    try {
      const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      const { data, error, count } = await supabase
        .from('MenstrualCyclePhases')
        .select('cycle_day, phase', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('date', today)
        .single() as { data: MenstrualCyclePhase | null, error: any, count: number };

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

  const recalibrateCycle = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch('http://192.168.1.9:5000/api/recalibrate-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to recalibrate cycle:', errorText);
        return;
      }

      const result = await response.json();
      const recalibratedPhases = result.recalibrated_phases;

      if (!recalibratedPhases || !Array.isArray(recalibratedPhases)) {
        console.error('Invalid recalibrated phases structure:', recalibratedPhases);
        return;
      }

      const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      await supabase
        .from('MenstrualCyclePhases')
        .delete()
        .eq('user_id', user.id)
        .gte('date', today);

      const insertData = recalibratedPhases.map(phase => ({
        user_id: user.id,
        date: phase.date,
        cycle_day: phase.cycle_day,
        phase: phase.phase,
      }));

      const { error: insertError } = await supabase
        .from('MenstrualCyclePhases')
        .insert(insertData);

      if (insertError) {
        console.error('Failed to insert recalibrated phases:', insertError);
        return;
      }

      console.log('Successfully updated MenstrualCyclePhases with recalibrated data');
      const currentDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      await AsyncStorage.setItem('lastRecalibrationDate', currentDate);
      setLastRecalibrationDate(currentDate);

      await fetchTodayPhase();
    } catch (error) {
      console.error('Error in recalibrateCycle:', error);
    }
  };

  const checkAndRecalibrate = async () => {
    if (!user?.id) return;

    try {
      const storedDate = await AsyncStorage.getItem('lastRecalibrationDate');
      setLastRecalibrationDate(storedDate);

      if (!storedDate) {
        await recalibrateCycle();
        return;
      }

      const lastDate = new Date(storedDate);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff >= 5) {
        console.log('5 days have passed since last recalibration, recalibrating now...');
        await recalibrateCycle();
      }
    } catch (error) {
      console.error('Error in checkAndRecalibrate:', error);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await checkAndRecalibrate();
      await fetchTodayPhase();
      const { data, error } = await supabase
        .from('User')
        .select('bleeding_days, last_period_date')
        .eq('id', user?.id)
        .single() as { data: UserData | null, error: any };
      if (error || !data) {
        console.error('Failed to fetch initial user data:', error);
      } else {
        setBleedingDays(data.bleeding_days?.toString() || '');
        setLastPeriodDate(data.last_period_date || '');
      }
    };
    initialize();
  }, [user?.id]);

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
  }, [user?.id]);

  const formatDateToDDMMYYYY = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  const handleLogPeriod = async () => {
    if (!user?.id) return;

    setRefreshing(true);
    try {
      const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      const formattedToday = formatDateToDDMMYYYY(today);
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('cycle_length, bleeding_days, age, weight, height, goal, challenge_days, preferred_rest_days, activity_level')
        .eq('id', user.id)
        .single() as { data: UserData | null, error: any };

      if (userError || !userData) {
        throw new Error('Failed to fetch user data');
      }

      const response = await fetch('http://192.168.1.9:5000/api/predict-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastPeriodDate: formattedToday,
          cycleLength: userData.cycle_length,
          bleedingDays: userData.bleeding_days,
          age: userData.age,
          weight: userData.weight,
          height: userData.height,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to predict cycle: ${errorText}`);
      }

      const result = await response.json();
      const newCyclePhases = result.cycle_phases;

      const currentDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      const { data: currentPhaseData } = await supabase
        .from('MenstrualCyclePhases')
        .select('phase')
        .eq('user_id', user.id)
        .eq('date', currentDate)
        .single();

      const isBeforeLuteal = !currentPhaseData || currentPhaseData.phase !== 'Luteal';

      if (isBeforeLuteal) {
        await supabase
          .from('MenstrualCyclePhases')
          .delete()
          .eq('user_id', user.id);

        const insertData = newCyclePhases.map((phase: any) => ({
          user_id: user.id,
          date: phase.date,
          cycle_day: phase.cycle_day,
          phase: phase.phase,
        }));

        await supabase.from('MenstrualCyclePhases').insert(insertData);
        await supabase
          .from('User')
          .update({ last_period_date: today })
          .eq('id', user.id);
      } else {
        const insertData = newCyclePhases.map((phase: any) => ({
          user_id: user.id,
          date: phase.date,
          cycle_day: phase.cycle_day,
          phase: phase.phase,
        }));

        await supabase.from('MenstrualCyclePhases').insert(insertData);
      }

      await supabase
        .from('User')
        .update({ last_period_date: today })
        .eq('id', user.id);

      const { data: workoutPlanData, error: workoutError } = await supabase
        .from('WorkoutPlans')
        .select('id, start_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (workoutError || !workoutPlanData) {
        throw new Error('No active workout plan found');
      }

      const startDate = new Date(workoutPlanData.start_date);
      const currentDateObj = new Date();
      const daysElapsed = Math.floor((currentDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const payload = {
        age: userData.age,
        activityLevel: userData.activity_level,
        goal: userData.goal,
        weight: userData.weight,
        challengeDays: userData.challenge_days,
        preferredRestDay: userData.preferred_rest_days,
        height: userData.height,
        currentDay: daysElapsed,
        userId: user.id,
        workoutPlanId: workoutPlanData.id,
      };

      const planResponse = await fetch('http://192.168.1.9:5000/api/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!planResponse.ok) {
        throw new Error('Faed to update plans');
      }

      const planResult = await planResponse.json();
      await supabase.rpc('update_user_and_workout_plan', {
        p_user_id: user.id,
        p_weight: userData.weight,
        p_activity_level: userData.activity_level,
        p_challenge_days: userData.challenge_days,
        p_workout_plan: planResult.workout_plan,
        p_meal_plan: planResult.meal_plan,
        p_start_date: currentDateObj.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'),
        p_intensity: planResult.intensity,
        p_goal: userData.goal,
        p_last_period_date: today,
        p_cycle_length: userData.cycle_length,
        p_bleeding_days: userData.bleeding_days,
      });

      await refreshUser();
      Alert.alert('Success', 'Period logged and plans updated');
      await fetchTodayPhase();
    } catch (error) {
      console.error('Error in handleLogPeriod:', error);
      Alert.alert('Error', `Failed to log period: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!user?.id) return;

    const newBleedingDays = parseInt(bleedingDays);
    if (isNaN(newBleedingDays) || newBleedingDays < 2 || newBleedingDays > 7) {
      Alert.alert('Error', 'Bleeding days must be between 2 and 7');
      return;
    }

    setEditModalVisible(false);
    try {
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('cycle_length, age, weight, height, goal, activity_level, challenge_days, preferred_rest_days')
        .eq('id', user.id)
        .single() as { data: UserData | null, error: any };

      if (userError || !userData) {
        throw new Error('Failed to fetch user data');
      }

      const formattedLastPeriodDate = formatDateToDDMMYYYY(lastPeriodDate);

      const response = await fetch('http://192.168.1.9:5000/api/predict-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastPeriodDate: formattedLastPeriodDate,
          cycleLength: userData.cycle_length,
          bleedingDays: newBleedingDays,
          age: userData.age,
          weight: userData.weight,
          height: userData.height,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to predict cycle: ${errorText}`);
      }

      const result = await response.json();
      const newCyclePhases = result.cycle_phases;

      const currentDate = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      const { data: currentPhaseData } = await supabase
        .from('MenstrualCyclePhases')
        .select('phase')
        .eq('user_id', user.id)
        .eq('date', currentDate)
        .single();

      const isBeforeLuteal = !currentPhaseData || currentPhaseData.phase !== 'Luteal';

      if (isBeforeLuteal) {
        await supabase
          .from('MenstrualCyclePhases')
          .delete()
          .eq('user_id', user.id);

        const insertData = newCyclePhases.map((phase: any) => ({
          user_id: user.id,
          date: phase.date,
          cycle_day: phase.cycle_day,
          phase: phase.phase,
        }));

        await supabase.from('MenstrualCyclePhases').insert(insertData);
        await supabase
          .from('User')
          .update({ last_period_date: lastPeriodDate, bleeding_days: newBleedingDays })
          .eq('id', user.id);
      } else {
        const insertData = newCyclePhases.map((phase: any) => ({
          user_id: user.id,
          date: phase.date,
          cycle_day: phase.cycle_day,
          phase: phase.phase,
        }));

        await supabase.from('MenstrualCyclePhases').insert(insertData);
      }

      await supabase
        .from('User')
        .update({ last_period_date: lastPeriodDate })
        .eq('id', user.id);

      const { data: workoutPlanData, error: workoutError } = await supabase
        .from('WorkoutPlans')
        .select('id, start_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (workoutError || !workoutPlanData) {
        throw new Error('No active workout plan found');
      }

      const startDate = new Date(workoutPlanData.start_date);
      const currentDateObj = new Date();
      const daysElapsed = Math.floor((currentDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const payload = {
        age: userData.age,
        activityLevel: userData.activity_level,
        goal: userData.goal,
        weight: userData.weight,
        challengeDays: userData.challenge_days,
        preferredRestDay: userData.preferred_rest_days,
        height: userData.height,
        currentDay: daysElapsed,
        userId: user.id,
        workoutPlanId: workoutPlanData.id,
      };

      const planResponse = await fetch('http://192.168.1.9:5000/api/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!planResponse.ok) {
        throw new Error('Failed to update plans');
      }

      const planResult = await planResponse.json();
      await supabase.rpc('update_user_and_workout_plan', {
        p_user_id: user.id,
        p_weight: userData.weight,
        p_activity_level: userData.activity_level,
        p_challenge_days: userData.challenge_days,
        p_workout_plan: planResult.workout_plan,
        p_meal_plan: planResult.meal_plan,
        p_start_date: currentDateObj.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'),
        p_intensity: planResult.intensity,
        p_goal: userData.goal,
        p_last_period_date: lastPeriodDate,
        p_cycle_length: userData.cycle_length,
        p_bleeding_days: newBleedingDays,
      });

      await refreshUser();
      Alert.alert('Success', 'Cycle data updated and plans regenerated');
      await fetchTodayPhase();
    } catch (error) {
      console.error('Error in handleSaveEdit:', error);
      Alert.alert('Error', `Failed to update cycle data: ${error.message}`);
    }
  };

  const handleEditDataPress = () => {
    setEditModalVisible(true);
  };

  const handleHistoryPress = () => {
    router.push('/(screens)/PeriodsCalendar');
  };

  const onDayPress = (day: any) => {
    const selectedDate = day.dateString;
    setLastPeriodDate(selectedDate);
    setShowCalendar(false);
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
        style={styles.logo}
      />
      <Text style={styles.headerText}>Ovulation Tracker</Text>
      <Text style={styles.usernameText}>{user?.username || 'User'}</Text>
    </Animated.View>
  );

  const renderLogPeriodSection = () => (
    <View style={styles.logPeriodCard}>
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
        style={styles.primaryButton}
        onPress={handleLogPeriod}
      >
        <MaterialCommunityIcons 
          name="calendar-plus" 
          size={SCREEN_WIDTH * 0.05} 
          color="#fff" 
        />
        <Text style={styles.primaryButtonText}>Log Period Start</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPhaseSection = () => (
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
  );

  const renderActionsSection = () => (
    <View style={styles.actionsContainer}>
      <TouchableOpacity 
        style={styles.secondaryButton}
        onPress={handleEditDataPress}
      >
        <MaterialCommunityIcons 
          name="pencil" 
          size={SCREEN_WIDTH * 0.05} 
          color="#e45ea9" 
        />
        <Text style={styles.secondaryButtonText}>Edit Cycle Data</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.secondaryButton}
        onPress={handleHistoryPress}
      >
        <MaterialCommunityIcons 
          name="calendar-month" 
          size={SCREEN_WIDTH * 0.05} 
          color="#e45ea9" 
        />
        <Text style={styles.secondaryButtonText}>View History</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEditModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={editModalVisible}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Pressable 
                onPress={() => setEditModalVisible(false)}
                style={styles.modalBackButton}
              >
                <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />
              </Pressable>
              <Text style={styles.modalTitle}>Edit Cycle Data</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Last Period Date</Text>
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
                >
                  <MaterialIcons name="calendar-today" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Bleeding Days (2-7)</Text>
              <TextInput
                style={styles.input}
                value={bleedingDays}
                onChangeText={setBleedingDays}
                keyboardType="numeric"
                placeholder="Enter days"
              />
            </View>

            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSaveEdit}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>

      {showCalendar && (
        <View style={styles.calendarModal}>
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
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim },],
          marginTop: SCREEN_HEIGHT * 0.06,
        }}>
          {renderPhaseSection()}
          {renderLogPeriodSection()}
          {renderActionsSection()}
        </Animated.View>
      </ScrollView>

      {renderEditModal()}
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
  // Phase Section
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
  // Log Period Section
  logPeriodCard: {
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
  // Actions Section
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
  // Modal Styles
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
  // Calendar Modal
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
  closeCalendarText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});