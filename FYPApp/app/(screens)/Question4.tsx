import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { setUserData, getUserData } from '../../datafiles/userData';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Dimensions } from 'react-native';
import { UserData } from '../../datafiles/userData'; // Import UserData type

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Question4: React.FC = () => {
  const router = useRouter();
  const [lastPeriodDate, setLastPeriodDate] = useState<Date | null>(getUserData().lastPeriodDate);
  const [cycleLength, setCycleLength] = useState<string>(getUserData().cycleLength.toString());
  const [bleedingDays, setBleedingDays] = useState<string>(getUserData().bleedingDays.toString());
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    // Sync initial state with userData
    setLastPeriodDate(getUserData().lastPeriodDate);
    setCycleLength(getUserData().cycleLength.toString());
    setBleedingDays(getUserData().bleedingDays.toString());
  }, []);

  const formattedDate = lastPeriodDate ? lastPeriodDate.toISOString().split('T')[0] : '';

  const cycleLengthNum = parseInt(cycleLength, 10);
  const isCycleLengthValid = !isNaN(cycleLengthNum) && cycleLengthNum >= 21 && cycleLengthNum <= 35;
  const cycleLengthError = cycleLength.trim() !== '' && !isCycleLengthValid
    ? 'Your entered cycle length is not in the typical (21-35) days range. Predictions may be inaccurate for irregular cycles.'
    : '';

  const bleedingDaysNum = parseInt(bleedingDays, 10);
  const isBleedingDaysValid = !isNaN(bleedingDaysNum) && bleedingDaysNum >= 2 && bleedingDaysNum <= 7;
  const bleedingDaysError = bleedingDays.trim() !== '' && !isBleedingDaysValid
    ? 'Your entered bleeding days is not in the typical (2-7) days range. Predictions may be inaccurate for irregular cycles.'
    : '';

  const isFormComplete = lastPeriodDate !== null && cycleLength.trim() !== '' && isCycleLengthValid && bleedingDays.trim() !== '' && isBleedingDaysValid;

  const handleDateChange = (text: string) => {
    const date = new Date(text);
    if (!isNaN(date.getTime())) {
      setLastPeriodDate(date);
      setUserData('lastPeriodDate' as keyof UserData, date);
    }
  };

  const handleCycleLengthChange = (text: string) => {
    setCycleLength(text);
    if (/^\d*$/.test(text)) {
      const num = parseInt(text, 10);
      if (!isNaN(num)) {
        setUserData('cycleLength' as keyof UserData, num);
      }
    }
  };

  const handleBleedingDaysChange = (text: string) => {
    setBleedingDays(text);
    if (/^\d*$/.test(text)) {
      const num = parseInt(text, 10);
      if (!isNaN(num)) {
        setUserData('bleedingDays' as keyof UserData, num);
      }
    }
  };

  const handleNext = () => {
    if (isFormComplete) {
      setUserData('lastPeriodDate' as keyof UserData, lastPeriodDate!);
      setUserData('cycleLength' as keyof UserData, parseInt(cycleLength, 10));
      setUserData('bleedingDays' as keyof UserData, parseInt(bleedingDays, 10));
      router.push('/(screens)/Question5');
    }
  };

  const onDayPress = (day: any) => {
    const selectedDate = new Date(day.dateString);
    setLastPeriodDate(selectedDate);
    setUserData('lastPeriodDate' as keyof UserData, selectedDate);
    setShowCalendar(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Pressable 
          onPress={() => router.push('/(screens)/Question3')} 
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Menstrual Cycle</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.label}>
            <MaterialCommunityIcons name="calendar" size={SCREEN_WIDTH * 0.05} color="#e45ea9" /> Last Period Date
          </Text>
          <View style={styles.dateInputContainer}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={formattedDate}
              onChangeText={handleDateChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
            <TouchableOpacity 
              onPress={() => setShowCalendar(true)} 
              style={styles.calendarButton}
            >
              <MaterialCommunityIcons name="calendar-month" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>
            <MaterialCommunityIcons name="calendar-range" size={SCREEN_WIDTH * 0.05} color="#e45ea9" /> Cycle Length (days)
          </Text>
          <TextInput
            style={styles.input}
            value={cycleLength}
            onChangeText={handleCycleLengthChange}
            placeholder="e.g., 28"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          {cycleLengthError ? <Text style={styles.errorText}>{cycleLengthError}</Text> : null}

          <Text style={styles.label}>
            <MaterialCommunityIcons name="water" size={SCREEN_WIDTH * 0.05} color="#e45ea9" /> Bleeding Days
          </Text>
          <TextInput
            style={styles.input}
            value={bleedingDays}
            onChangeText={handleBleedingDaysChange}
            placeholder="e.g., 5"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          {bleedingDaysError ? <Text style={styles.errorText}>{bleedingDaysError}</Text> : null}
        </View>

        {showCalendar && (
          <View style={styles.calendarModal}>
            <Calendar
              onDayPress={onDayPress}
              markedDates={{
                [formattedDate]: { selected: true, marked: true, selectedColor: '#e45ea9' },
              }}
              theme={{
                selectedDayBackgroundColor: '#e45ea9',
                todayTextColor: '#e45ea9',
                arrowColor: '#e45ea9',
              }}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCalendar(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {isFormComplete ? (
            <Link href="/(screens)/Question5" style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>Next</Text>
            </Link>
          ) : (
            <TouchableOpacity style={[styles.button, styles.disabledButton]} disabled={true}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    paddingVertical: SCREEN_HEIGHT * 0.02,
    paddingTop: SCREEN_HEIGHT * 0.03,
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
    flex: 1,
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contentContainer: {
    flex: 1,
    padding: SCREEN_WIDTH * 0.04,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.05,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
    marginTop: SCREEN_HEIGHT * 0.02,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.07,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: SCREEN_WIDTH * 0.04,
    fontSize: SCREEN_WIDTH * 0.04,
    borderWidth: 1,
    borderColor: '#e45ea9',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  dateInput: {
    flex: 1,
  },
  calendarButton: {
    padding: SCREEN_WIDTH * 0.02,
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  errorText: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#e45ea9',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SCREEN_HEIGHT * 0.02,
  },
  button: {
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.06,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#a9a9a9',
  },
  buttonText: {
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  closeButton: {
    backgroundColor: '#e45ea9',
    padding: SCREEN_WIDTH * 0.04,
    borderRadius: 25,
    marginTop: SCREEN_HEIGHT * 0.02,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});

export default Question4;