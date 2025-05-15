import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';

type UserData = {
  weight: string;
  height: string;
  challengeDays: string;
  activityLevel: string;
};

type Section = {
  key: keyof UserData;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  editable?: boolean;
};

const PersonalInformation = () => {
  const [expandedSection, setExpandedSection] = useState<keyof UserData | null>(null);
  const [userData, setUserData] = useState<UserData>({
    weight: '',
    height: '',
    challengeDays: '',
    activityLevel: '',
  });
  const [editMode, setEditMode] = useState<keyof UserData | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const spinValue = new Animated.Value(0);
  const router = useRouter();
  const { user, refreshUser } = useUserAuth();

  const challengeDaysOptions = [15, 30, 45, 90];

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('User')
        .select('weight, height, challenge_days, activity_level')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Failed to load user data.');
        return;
      }

      const heightInCm = data.height * 30.48;
      const heightInFeet = data.height;
      const feet = Math.floor(heightInFeet);
      const inches = Math.round((heightInFeet - feet) * 12);

      setUserData({
        weight: data.weight.toString() + ' kg',
        height: `${heightInCm.toFixed(0)} cm (${feet}'${inches}")`,
        challengeDays: data.challenge_days.toString() + '-day challenge',
        activityLevel: data.activity_level.toString() + '%',
      });
    };

    fetchUserData();
  }, [user]);

  const sections: Section[] = [
    { key: 'weight', icon: 'fitness-center', label: 'Weight', editable: true },
    { key: 'height', icon: 'height', label: 'Height', editable: false },
    { key: 'challengeDays', icon: 'stars', label: 'Current Challenge', editable: true },
    { key: 'activityLevel', icon: 'directions-run', label: 'Activity Level', editable: true },
  ];

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const toggleSection = (key: keyof UserData) => {
    if (expandedSection === key) {
      setExpandedSection(null);
      setEditMode(null);
    } else {
      setExpandedSection(key);
      spinValue.setValue(0);
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleEdit = (key: keyof UserData, currentValue: string) => {
    setEditMode(key);
    if (key === 'weight' || key === 'activityLevel') {
      setEditValue(currentValue.replace(/[^0-9.]/g, ''));
    }
  };

  const handleChallengeDaysSelect = async (value: number) => {
    const numericValue = value;
    await updateUserAndPlan({ challengeDays: numericValue });
  };

  const handleSave = async (key: keyof UserData) => {
    const numericValue = parseFloat(editValue);
    if (isNaN(numericValue)) {
      Alert.alert('Error', 'Please enter a valid number.');
      return;
    }

    let updatePayload: any = {};

    if (key === 'weight') {
      if (numericValue < 25) {
        Alert.alert('Error', 'Weight must be at least 25 kg.');
        return;
      }
      if (numericValue > 200) {
        Alert.alert('Error', 'Weight must be between 25 and 200 kg.');
        return;
      }
      updatePayload.weight = numericValue;
    } else if (key === 'activityLevel') {
      if (numericValue < 0 || numericValue > 100) {
        Alert.alert('Error', 'Activity level must be a value between 0 and 100.');
        return;
      }
      updatePayload.activityLevel = numericValue;
    } else if (key === 'challengeDays') {
      updatePayload.challengeDays = numericValue;
    }

    await updateUserAndPlan(updatePayload);
  };

  const updateUserAndPlan = async (updatePayload: { weight?: number; activityLevel?: number; challengeDays?: number }) => {
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
          lastPeriodDate: userData.last_period_date,
          cycleLength: userData.cycle_length,
          bleedingDays: userData.bleeding_days,
          challengeDays: userData.challenge_days, // Pass full challenge days to get full cycle
          age: userData.age,
          weight: userData.weight,
          height: userData.height,
        };

        const cycleResponse = await fetch('http://192.168.1.9:5000/api/generate-cycle-phases', {
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
            date: new Date(startDate.getTime() + (index + daysElapsed - 1) * 86400000).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'),
          }));
        } else {
          console.error('Failed to fetch cycle phases:', await cycleResponse.text());
          // Proceed without cycle phases if fetch fails
        }
      }

      // Map user-facing goals to backend values
      const goalMap: { [key: string]: string } = {
        'Lose weight': 'weight_loss',
        'Gain weight': 'gain_weight',
        'Muscle build': 'build_muscle',
        'Stay fit': 'stay_fit',
      };
      const mappedGoal = goalMap[userData.goal] || userData.goal;

      const payload = {
        age: userData.age,
        activityLevel: updatePayload.activityLevel ?? userData.activity_level,
        goal: mappedGoal,
        weight: updatePayload.weight ?? userData.weight,
        challengeDays: updatePayload.challengeDays ?? userData.challenge_days,
        preferredRestDay: userData.preferred_rest_days,
        height: userData.height,
        currentDay: daysElapsed,
        userId: userData.id,
        workoutPlanId: workoutPlanData.id,
        cyclePhases: cyclePhases.length > 0 ? cyclePhases : undefined,
      };

      const response = await fetch('http://192.168.1.9:5000/api/update-plan', {
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

      const { data, error: rpcError } = await supabase.rpc('update_user_and_workout_plan', {
        p_user_id: userData.id,
        p_weight: updatePayload.weight ?? userData.weight,
        p_activity_level: updatePayload.activityLevel ?? userData.activity_level,
        p_challenge_days: updatePayload.challengeDays ?? userData.challenge_days,
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

      setUserData((prev) => ({
        ...prev,
        weight: `${updatePayload.weight ?? userData.weight} kg`,
        activityLevel: `${updatePayload.activityLevel ?? userData.activity_level}%`,
        challengeDays: `${updatePayload.challengeDays ?? userData.challenge_days}-day challenge`,
      }));
      setEditMode(null);
      setEditValue('');
      await refreshUser();
      Alert.alert('Success', 'Your information has been updated, and your plans have been regenerated.');
    } catch (err: any) {
      console.error('Error updating user and plans:', err.message);
      Alert.alert('Error', 'Failed to update your information and plans.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.push('../(tabs)/Profile')}>
          <MaterialIcons name="arrow-back" size={24} color="#FF69B4" />
        </TouchableOpacity>
        <Text style={styles.header}>My Profile</Text>
      </View>

      {sections.map((section) => (
        <TouchableOpacity
          key={section.key}
          onPress={() => toggleSection(section.key)}
          activeOpacity={0.9}
        >
          <View
            style={[styles.card, expandedSection === section.key && styles.expandedCard]}
          >
            <View style={styles.cardHeader}>
              <MaterialIcons
                name={section.icon}
                size={22}
                color="#FF69B4"
                style={styles.icon}
              />
              <Text style={styles.subHeader}>{section.label}</Text>
              <Animated.View
                style={{
                  transform: [{ rotate: expandedSection === section.key ? spin : '0deg' }],
                }}
              >
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={24}
                  color="#FF69B4"
                />
              </Animated.View>
            </View>

            {expandedSection === section.key && (
              <View style={styles.infoContainer}>
                {section.editable && editMode === section.key ? (
                  <View style={styles.editContainer}>
                    {section.key === 'challengeDays' ? (
                      <View style={styles.optionsContainer}>
                        <Text style={styles.guideText}>Select challenge duration:</Text>
                        <View style={styles.optionsRow}>
                          {challengeDaysOptions.map((option) => (
                            <TouchableOpacity
                              key={option}
                              style={styles.optionButton}
                              onPress={() => handleChallengeDaysSelect(option)}
                            >
                              <Text style={styles.optionText}>{option} days</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <>
                        {section.key === 'activityLevel' && (
                          <Text style={styles.guideText}>
                            Enter a value between 0 and 100:
                          </Text>
                        )}
                        <TextInput
                          style={styles.input}
                          value={editValue}
                          onChangeText={setEditValue}
                          keyboardType={section.key === 'weight' ? 'decimal-pad' : 'numeric'}
                          placeholder={`Enter ${section.label.toLowerCase()}`}
                        />
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={() => handleSave(section.key)}
                        >
                          <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoText}>{userData[section.key]}</Text>
                    {section.editable && (
                      <TouchableOpacity
                        onPress={() => handleEdit(section.key, userData[section.key])}
                      >
                        <MaterialIcons name="edit" size={20} color="#FF69B4" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  editContainer: {
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginRight: 10,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#FF69B4',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  guideText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  optionButton: {
    backgroundColor: '#F9DDE2',
    padding: 10,
    borderRadius: 6,
    margin: 5,
  },
  optionText: {
    color: '#C94C7C',
    fontWeight: '600',
  },
});

export default PersonalInformation;