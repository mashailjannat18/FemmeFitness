import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';

export default function EditCycleData() {
  const { user, refreshUser } = useUserAuth();
  const [bleedingDays, setBleedingDays] = useState('');
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [modalVisible, setModalVisible] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('User')
        .select('bleeding_days, last_period_date')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Failed to fetch user data');
        return;
      }

      setBleedingDays(data.bleeding_days?.toString() || '');
      setLastPeriodDate(data.last_period_date || '');
    };
    fetchUserData();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;

    const newBleedingDays = parseInt(bleedingDays);
    const newLastPeriodDate = lastPeriodDate;

    if (isNaN(newBleedingDays) || newBleedingDays < 2 || newBleedingDays > 7) {
      Alert.alert('Error', 'Bleeding days must be between 2 and 7');
      return;
    }

    setModalVisible(false);
    try {
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('cycle_length, age, weight, height')
        .eq('id', user.id)
        .single();

      if (userError || !userData) {
        throw new Error('Failed to fetch user data');
      }

      const response = await fetch('http://10.135.48.158:5000/api/predict-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastPeriodDate: newLastPeriodDate,
          cycleLength: userData.cycle_length,
          bleedingDays: newBleedingDays,
          age: userData.age,
          weight: userData.weight,
          height: userData.height,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to predict cycle');
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
          .update({ last_period_date: newLastPeriodDate, bleeding_days: newBleedingDays })
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
        activityLevel: 50, // Placeholder
        goal: 'stay_fit', // Placeholder
        weight: userData.weight,
        challengeDays: 30, // Placeholder
        preferredRestDay: 'Sunday', // Placeholder
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
        p_activity_level: 50, // Placeholder
        p_challenge_days: 30, // Placeholder
        p_workout_plan: planResult.workout_plan,
        p_meal_plan: planResult.meal_plan,
        p_start_date: currentDateObj.toISOString().split('T')[0],
        p_intensity: planResult.intensity,
        p_goal: 'stay_fit', // Placeholder
        p_last_period_date: newLastPeriodDate,
        p_cycle_length: userData.cycle_length,
        p_bleeding_days: newBleedingDays,
      });

      await refreshUser();
      Alert.alert('Success', 'Cycle data updated and plans regenerated');
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Failed to update cycle data');
    }
  };

  const handleClose = () => {
    setModalVisible(false);
    router.back();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={handleClose}>
              <MaterialIcons name="arrow-back" size={24} color="#FF69B4" />
            </TouchableOpacity>
            <Text style={styles.header}>Edit Cycle Data</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Last Period Date</Text>
            <TextInput
              style={styles.input}
              value={lastPeriodDate}
              onChangeText={setLastPeriodDate}
              placeholder="DD-MM-YYYY"
            />
            <Text style={styles.label}>Bleeding Days</Text>
            <TextInput
              style={styles.input}
              value={bleedingDays}
              onChangeText={setBleedingDays}
              keyboardType="numeric"
              placeholder="2-7"
            />
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF1493',
    textAlign: 'center',
    flex: 1,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#FF69B4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});