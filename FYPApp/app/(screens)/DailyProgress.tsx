import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';

interface Workout {
  exercise_name: string;
  difficulty: string;
  target_muscle: string;
  reps: string;
  sets: number;
}

interface ExerciseCompletion {
  time_spent_seconds: number;
  calories_burned: number;
  status: 'completed' | 'skipped';
  Workouts: Workout | null;
}

interface MarkedDate {
  [date: string]: { marked: boolean; dotColor: string; selected?: boolean };
}

const DailyProgress: React.FC = () => {
  const { user } = useUserAuth();
  const router = useRouter();
  const { selectedDate: initialDate } = useLocalSearchParams<{ selectedDate?: string }>();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || new Date().toISOString().split('T')[0]);
  const [exercises, setExercises] = useState<ExerciseCompletion[]>([]);
  const [markedDates, setMarkedDates] = useState<MarkedDate>({});

  useEffect(() => {
    const fetchExercises = async () => {
      if (!user?.id) {
        console.log('No user logged in, cannot fetch exercises');
        return;
      }

      try {
        // Fetch all completions to mark dates
        const { data: allCompletions, error: allError } = await supabase
          .from('ExerciseCompletions')
          .select('completion_date, status')
          .eq('user_id', user.id);

        if (allError) {
          console.error('Error fetching all completions:', allError);
          return;
        }

        const marked: MarkedDate = {};
        allCompletions.forEach((record) => {
          const date = new Date(record.completion_date).toISOString().split('T')[0];
          marked[date] = {
            marked: true,
            dotColor: record.status === 'completed' ? '#00FF00' : '#FF0000',
            selected: date === selectedDate,
          };
        });
        setMarkedDates(marked);

        // Fetch exercises for the selected date using a range query
        const startOfDay = `${selectedDate}T00:00:00.000Z`;
        const endOfDay = `${selectedDate}T23:59:59.999Z`;

        const { data, error } = await supabase
          .from('ExerciseCompletions')
          .select(`
            time_spent_seconds,
            calories_burned,
            status,
            Workouts!workout_id (
              exercise_name,
              difficulty,
              target_muscle,
              reps,
              sets
            )
          `)
          .eq('user_id', user.id)
          .gte('completion_date', startOfDay)
          .lte('completion_date', endOfDay);

        if (error) {
          console.error('Error fetching exercises for date:', selectedDate, error);
          return;
        }

        if (data) {
          const formattedExercises = data.map((item: any) => ({
            time_spent_seconds: item.time_spent_seconds || 0,
            calories_burned: item.calories_burned || 0,
            status: item.status,
            Workouts: item.Workouts || null, // Workouts should now contain the data
          })) as ExerciseCompletion[];
          setExercises(formattedExercises);
        }
      } catch (err) {
        console.error('Unexpected error fetching exercises:', err);
      }
    };

    fetchExercises();
  }, [user?.id, selectedDate]);

  const handleDayPress = (day: { dateString: string }) => {
    setSelectedDate(day.dateString);
  };

  const handleBackPress = () => {
    router.push('/Progress' as any);
  };

  const completedExercises = exercises.filter((exercise) => exercise.status === 'completed');
  const skippedExercises = exercises.filter((exercise) => exercise.status === 'skipped');

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Pressable onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Daily Progress - {selectedDate}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Calendar
          current={selectedDate}
          markedDates={markedDates}
          onDayPress={handleDayPress}
          theme={{
            calendarBackground: '#fff',
            textSectionTitleColor: '#333',
            selectedDayBackgroundColor: '#d63384',
            selectedDayTextColor: '#fff',
            todayTextColor: '#00adf5',
            dayTextColor: '#333',
            textDisabledColor: '#d9e1e8',
            dotColor: '#00FF00',
            selectedDotColor: '#fff',
            arrowColor: '#d63384',
            monthTextColor: '#333',
            textDayFontWeight: '400',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '600',
          }}
        />

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Done</Text>
          {completedExercises.length > 0 ? (
            completedExercises.map((exercise, index) => (
              <View key={index} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{exercise.Workouts?.exercise_name || 'Unknown'}</Text>
                <Text style={styles.exerciseDetail}>
                  Time Spent: {(exercise.time_spent_seconds / 60).toFixed(1)} minutes
                </Text>
                <Text style={styles.exerciseDetail}>
                  Difficulty: {exercise.Workouts?.difficulty || 'N/A'}
                </Text>
                <Text style={styles.exerciseDetail}>
                  Focus Area: {exercise.Workouts?.target_muscle || 'N/A'}
                </Text>
                <Text style={styles.exerciseDetail}>
                  Calories Burned: {exercise.calories_burned.toFixed(1)}
                </Text>
                <Text style={styles.exerciseDetail}>Reps: {exercise.Workouts?.reps || 'N/A'}</Text>
                <Text style={styles.exerciseDetail}>Sets: {exercise.Workouts?.sets || 0}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No exercises completed on this day.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Skipped</Text>
          {skippedExercises.length > 0 ? (
            skippedExercises.map((exercise, index) => (
              <View key={index} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{exercise.Workouts?.exercise_name || 'Unknown'}</Text>
                <Text style={styles.exerciseDetail}>
                  Time Spent: {(exercise.time_spent_seconds / 60).toFixed(1)} minutes
                </Text>
                <Text style={styles.exerciseDetail}>
                  Difficulty: {exercise.Workouts?.difficulty || 'N/A'}
                </Text>
                <Text style={styles.exerciseDetail}>
                  Focus Area: {exercise.Workouts?.target_muscle || 'N/A'}
                </Text>
                <Text style={styles.exerciseDetail}>
                  Calories Burned: {exercise.calories_burned.toFixed(1)}
                </Text>
                <Text style={styles.exerciseDetail}>Reps: {exercise.Workouts?.reps || 'N/A'}</Text>
                <Text style={styles.exerciseDetail}>Sets: {exercise.Workouts?.sets || 0}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No exercises skipped on this day.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#d63384',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginTop: 20,
    marginBottom: 20,
    width: '100%',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  exerciseDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default DailyProgress;