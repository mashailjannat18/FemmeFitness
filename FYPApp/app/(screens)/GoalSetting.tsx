import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';

type GoalOption = {
  label: string;
  description: string;
  backendValue: string;
};

const GoalSetting = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [currentGoal, setCurrentGoal] = useState<string>('');
  const spinValue = new Animated.Value(0);
  const router = useRouter();
  const { user, refreshUser } = useUserAuth();

  const goalOptions: GoalOption[] = [
    {
      label: 'Lose weight',
      description: 'Focus on shedding extra pounds with a calorie-deficit plan.',
      backendValue: 'weight_loss',
    },
    {
      label: 'Gain weight',
      description: 'Build mass with a calorie-surplus plan and strength training.',
      backendValue: 'gain_weight',
    },
    {
      label: 'Muscle build',
      description: 'Prioritize muscle growth with targeted workouts.',
      backendValue: 'build_muscle',
    },
    {
      label: 'Stay fit',
      description: 'Maintain fitness with balanced workouts and meals.',
      backendValue: 'stay_fit',
    },
  ];

  useEffect(() => {
    const fetchUserGoal = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('User')
        .select('goal')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user goal:', error);
        Alert.alert('Error', 'Failed to load your goal.');
        return;
      }

      setCurrentGoal(data.goal);
    };

    fetchUserGoal();
  }, [user]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const toggleSection = () => {
    if (expandedSection === 'goal') {
      setExpandedSection(null);
    } else {
      setExpandedSection('goal');
      spinValue.setValue(0);
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleGoalSelect = async (newGoal: string, backendValue: string) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('id, age, weight, height, goal, activity_level, preferred_rest_days, challenge_days, last_period_date, cycle_length, bleeding_days')
        .eq('id', user?.id)
        .single();

      if (userError || !userData) {
        throw new Error('Failed to fetch user data.');
      }

      const { data: workoutPlanData, error: workoutError } = await supabase
        .from('WorkoutPlans')
        .select('id, start_date')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .single();

      if (workoutError || !workoutPlanData) {
        throw new Error('No active workout plan found.');
      }

      const startDate = new Date(workoutPlanData.start_date);
      const currentDate = new Date(); // Updated to 11:46 AM PKT, May 15, 2025
      const daysElapsed = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (daysElapsed >= userData.challenge_days) {
        Alert.alert('Info', 'Your current challenge has ended. Please start a new challenge.');
        return;
      }

      // Generate cycle phases if menstrual data is available
      let cyclePhases = [];
      if (userData.last_period_date && userData.cycle_length > 0 && userData.bleeding_days > 0) {
        const cyclePayload = {
          lastPeriodDate: userData.last_period_date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'),
          cycleLength: userData.cycle_length,
          bleedingDays: userData.bleeding_days,
          challengeDays: userData.challenge_days, // Pass full challenge days to get full cycle
          age: userData.age,
          weight: userData.weight,
          height: userData.height,
        };

        const cycleResponse = await fetch('http://10.135.64.168:5000/api/generate-cycle-phases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cyclePayload),
        });

        if (cycleResponse.ok) {
          cyclePhases = await cycleResponse.json();
          // Filter cycle phases to match remaining days
          const remainingDays = userData.challenge_days - (daysElapsed - 1);
          cyclePhases = cyclePhases.slice(daysElapsed - 1, daysElapsed - 1 + remainingDays).map((phase: any, index: number) => ({
            ...phase,
            cycle_day: index + daysElapsed,
            date: new Date(startDate.getTime() + (index + daysElapsed - 1) * 86400000).toISOString().split('T')[0],
          }));
        } else {
          console.error('Failed to fetch cycle phases:', await cycleResponse.text());
          // Proceed without cycle phases if fetch fails
        }
      }

      // Prepare payload for the update-plan API
      const payload = {
        age: userData.age,
        activityLevel: userData.activity_level,
        goal: backendValue, // Use the backend-compatible goal value
        weight: userData.weight,
        challengeDays: userData.challenge_days,
        preferredRestDay: userData.preferred_rest_days,
        height: userData.height,
        startDate: currentDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'),
        currentDay: daysElapsed,
        userId: userData.id,
        workoutPlanId: workoutPlanData.id,
        cyclePhases: cyclePhases.length > 0 ? cyclePhases : undefined,
      };

      const response = await fetch('http://10.135.64.168:5000/api/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update plans: ${errorText}`);
      }

      const result = await response.json();

      if (!result.intensity || !['low', 'moderate', 'high'].includes(result.intensity)) {
        throw new Error('Updated intensity must be one of "low", "moderate", or "high"');
      }

      // Update the user and plans in Supabase
      const { data, error: rpcError } = await supabase.rpc('update_user_and_workout_plan', {
        p_user_id: userData.id,
        p_weight: userData.weight,
        p_activity_level: userData.activity_level,
        p_challenge_days: userData.challenge_days,
        p_workout_plan: result.workout_plan,
        p_meal_plan: result.meal_plan,
        p_start_date: currentDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'),
        p_intensity: result.intensity,
        p_last_period_date: userData.last_period_date,
        p_cycle_length: userData.cycle_length,
        p_bleeding_days: userData.bleeding_days,
        p_cycle_phases: cyclePhases.length > 0 ? result.cyclePhases : null,
      });

      if (rpcError) {
        console.error('Supabase RPC error:', rpcError);
        throw new Error(`Failed to update user and workout plan: ${rpcError.message}`);
      }

      setCurrentGoal(newGoal);
      await refreshUser();
      Alert.alert('Success', 'Your goal has been updated, and your plans have been regenerated.');
    } catch (err: any) {
      console.error('Error updating goal and plans:', err.message);
      Alert.alert('Error', 'Failed to update your goal and plans.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.push('../(tabs)/Profile')}>
          <MaterialIcons name="arrow-back" size={24} color="#FF69B4" />
        </TouchableOpacity>
        <Text style={styles.header}>Set Your Goal</Text>
      </View>

      <TouchableOpacity onPress={toggleSection} activeOpacity={0.9}>
        <View style={[styles.card, expandedSection === 'goal' && styles.expandedCard]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="flag" size={22} color="#FF69B4" style={styles.icon} />
            <Text style={styles.subHeader}>Your Goal</Text>
            <Animated.View style={{ transform: [{ rotate: expandedSection === 'goal' ? spin : '0deg' }] }}>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#FF69B4" />
            </Animated.View>
          </View>

          {expandedSection === 'goal' && (
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>Current Goal: {currentGoal}</Text>
              <Text style={styles.guideText}>Select a new goal:</Text>
              {goalOptions.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={styles.optionButton}
                  onPress={() => handleGoalSelect(option.label, option.backendValue)}
                >
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 30,
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  header: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FF1493',
    textAlign: 'center',
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  expandedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF69B4',
    backgroundColor: '#FFF0F3',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    marginRight: 10,
  },
  subHeader: {
    fontSize: 17,
    fontWeight: '600',
    color: 'black',
    flex: 1,
  },
  infoContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F9DDE2',
  },
  infoText: {
    fontSize: 16,
    color: '#444',
    marginBottom: 10,
  },
  guideText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: '#F9DDE2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C94C7C',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default GoalSetting;