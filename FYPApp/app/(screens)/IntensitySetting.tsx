import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const IntensitySetting = () => {
  const intensities = [
    { level: 'Beginner', emoji: '🌸', color: '#F8BBD0' },
    { level: 'Mediocre', emoji: '🌷', color: '#F48FB1' },
    // { level: 'Intense', emoji: '🌺', color: '#EC407A' },
  ];

  const [intensity, setIntensity] = useState<string | null>(null);
  const [initialIntensity, setInitialIntensity] = useState<string | null>(null);
  const router = useRouter();
  const { user, refreshUser } = useUserAuth();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];
  const scaleAnimations = useState(intensities.map(() => new Animated.Value(1)))[0];

  const intensityMap: { [key: string]: string } = {
    low: 'Beginner',
    moderate: 'Mediocre',
    high: 'Intense',
  };

  useEffect(() => {
    console.log('DEBUG: Initializing animations at', new Date().toISOString());
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const fetchIntensity = async () => {
      if (!user?.id) {
        console.error('DEBUG: No user ID available to fetch intensity');
        setIntensity(null);
        return;
      }

      console.log('DEBUG: Fetching intensity for user_id:', user.id);
      try {
        const { data, error } = await supabase
          .from('User')
          .select('intensity')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('DEBUG: Error fetching intensity:', error.message);
          Alert.alert('Error', 'Failed to load your workout intensity.');
          return;
        }

        if (data && data.intensity) {
          const mappedIntensity = intensityMap[data.intensity.toLowerCase()] || 'Not selected';
          console.log('DEBUG: Fetched intensity:', data.intensity, 'Mapped to:', mappedIntensity);
          setIntensity(mappedIntensity);
          setInitialIntensity(mappedIntensity);
        } else {
          console.log('DEBUG: No intensity found, setting to Not selected');
          setIntensity('Not selected');
          setInitialIntensity('Not selected');
        }
      } catch (err: any) {
        console.error('DEBUG: Unexpected error fetching intensity:', err.message);
        Alert.alert('Error', 'Failed to load your workout intensity.');
      }
    };

    fetchIntensity();
  }, [user?.id]);

  const handlePress = (index: number, level: string) => {
    console.log('DEBUG: Selected intensity:', level, 'at index:', index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIntensity(level);

    Animated.sequence([
      Animated.timing(scaleAnimations[index], {
        toValue: 0.96,
        duration: 100,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimations[index], {
        toValue: 1,
        duration: 100,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSave = async () => {
    console.log('DEBUG: handleSave triggered at', new Date().toISOString());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user) {
      console.error('DEBUG: User not logged in');
      Alert.alert('Error', 'User not logged in.');
      return;
    }

    if (!intensity || intensity === 'Not selected') {
      console.error('DEBUG: No intensity selected');
      Alert.alert('Error', 'Please select an intensity before saving.');
      return;
    }

    if (intensity === initialIntensity) {
      console.log('DEBUG: No changes to intensity, current:', intensity);
      Alert.alert('Info', 'No changes made to your intensity.');
      return;
    }

    const reverseIntensityMap: { [key: string]: string } = {
      Beginner: 'low',
      Mediocre: 'moderate',
      // Intense: 'high',
    };

    const dbIntensity = reverseIntensityMap[intensity];
    console.log('DEBUG: Mapped intensity to database value:', dbIntensity);

    try {
      console.log('DEBUG: Fetching user data for user_id:', user.id);
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('id, age, weight, height, goal, activity_level, preferred_rest_days, challenge_days, last_period_date, cycle_length, bleeding_days')
        .eq('id', user.id)
        .single();

      if (userError || !userData) {
        console.error('DEBUG: Error fetching user data:', userError?.message || 'No user data');
        throw new Error('Failed to fetch user data.');
      }

      console.log('DEBUG: Fetched user data:', {
        id: userData.id,
        age: userData.age,
        weight: userData.weight,
        height: userData.height,
        goal: userData.goal,
        activity_level: userData.activity_level,
        preferred_rest_days: userData.preferred_rest_days,
        challenge_days: userData.challenge_days,
        last_period_date: userData.last_period_date,
        cycle_length: userData.cycle_length,
        bleeding_days: userData.bleeding_days
      });

      console.log('DEBUG: Fetching active workout plan for user_id:', user.id);
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
      const currentDate = new Date();
      const daysElapsed = Math.max(1, Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const remainingDays = Math.max(1, userData.challenge_days - (daysElapsed - 1));

      console.log('DEBUG: Calculated values:', {
        daysElapsed,
        remainingDays
      });

      if (remainingDays <= 0) {
        console.error('DEBUG: Challenge has ended, remainingDays:', remainingDays);
        Alert.alert('Info', 'Your current challenge has ended. Please start a new challenge.');
        return;
      }

      const payload = {
        age: userData.age,
        activityLevel: userData.activity_level,
        goal: userData.goal,
        weight: userData.weight,
        challengeDays: userData.challenge_days,
        remainingDays: remainingDays,
        startDate: workoutPlanData.start_date,
        preferredRestDay: userData.preferred_rest_days,
        height: userData.height,
        currentDay: daysElapsed,
        userId: userData.id,
        workoutPlanId: workoutPlanData.id,
        intensity: dbIntensity,
        lastPeriodDate: userData.last_period_date,
        cycleLength: userData.cycle_length,
        bleedingDays: userData.bleeding_days,
      };

      console.log('DEBUG: Payload being sent to /update-plan:', payload);

      const response = await fetch('http://10.135.64.168:5000/api/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DEBUG: /update-plan request failed:', errorText);
        throw new Error(`Failed to update plans: ${errorText}`);
      }

      const result = await response.json();
      console.log('DEBUG: Received success response from /update-plan');

      console.log('DEBUG: Updating User table with intensity:', dbIntensity);
      await supabase
        .from('User')
        .update({ intensity: dbIntensity })
        .eq('id', user.id);

      console.log('DEBUG: Intensity updated, refreshing user data');
      setInitialIntensity(intensity);
      await refreshUser();
      Alert.alert('Success', 'Your workout intensity has been updated, and your plans have been regenerated.');
    } catch (err: any) {
      console.error('DEBUG: Error updating intensity:', err.message);
      Alert.alert('Error', `Failed to update your workout intensity: ${err.message}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="chevron-back"
            size={SCREEN_WIDTH * 0.06}
            color="#fff"
          />
        </TouchableOpacity>
        <Text style={styles.headerText}>Workout Intensity</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View style={styles.currentContainer}>
            <Text style={styles.currentTitle}>Current Intensity</Text>
            <View style={styles.currentValueContainer}>
              <Text style={styles.currentValue}>
                {intensity || 'Not selected yet'}
              </Text>
            </View>
          </View>

          <Text style={styles.subTitle}>Select your workout intensity</Text>

          <View style={styles.cardsContainer}>
            {intensities.map((item, index) => (
              <TouchableOpacity
                key={item.level}
                style={[
                  styles.intensityCard,
                  intensity === item.level && styles.selectedIntensityCard,
                  { backgroundColor: item.color },
                ]}
                onPress={() => handlePress(index, item.level)}
                activeOpacity={0.85}
              >
                <View style={styles.intensityContent}>
                  <Text
                    style={[
                      styles.intensityEmoji,
                      intensity === item.level && styles.selectedIntensityEmoji,
                    ]}
                  >
                    {item.emoji}
                  </Text>
                  <Text
                    style={[
                      styles.intensityText,
                      intensity === item.level && styles.selectedIntensityText,
                    ]}
                  >
                    {item.level}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save Intensity</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
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
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_WIDTH * 0.04,
    paddingTop: SCREEN_WIDTH * 0.06,
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
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  scrollContainer: {
    paddingBottom: SCREEN_WIDTH * 0.1,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  currentContainer: {
    paddingTop: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_WIDTH * 0.06,
  },
  currentTitle: {
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_WIDTH * 0.02,
  },
  currentValueContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  currentValue: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#555',
  },
  subTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_WIDTH * 0.04,
  },
  // cardsContainer: {
  //   flexDirection: 'row',
  //   flexWrap: 'wrap',
  //   justifyContent: 'space-between',
  // },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  intensityCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.03,
    marginBottom: SCREEN_WIDTH * 0.04,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedIntensityCard: {
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  intensityContent: {
    alignItems: 'center',
  },
  intensityEmoji: {
    fontSize: SCREEN_WIDTH * 0.1,
    marginBottom: SCREEN_WIDTH * 0.02,
  },
  selectedIntensityEmoji: {
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  intensityText: {
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
    color: '#333',
  },
  selectedIntensityText: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  saveButton: {
    backgroundColor: '#e45ea9',
    padding: SCREEN_WIDTH * 0.04,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SCREEN_WIDTH * 0.04,
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});

export default IntensitySetting;