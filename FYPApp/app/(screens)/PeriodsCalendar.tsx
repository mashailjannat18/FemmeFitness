import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import { RefreshControl } from 'react-native';

interface CyclePhase {
  date: string;
  phase: string;
}

export default function PeriodsCalendar() {
  const { user } = useUserAuth();
  const [markedDates, setMarkedDates] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCyclePhases();
  }, [user?.id]);

  const fetchCyclePhases = async () => {
    if (!user?.id) return;

    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('MenstrualCyclePhases')
        .select('date, phase')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) {
        Alert.alert('Error', 'Failed to fetch cycle phases: ' + error.message);
        return;
      }

      const marks: { [key: string]: any } = {};
      data.forEach((phase: CyclePhase) => {
        let dotColor = '#333';
        let containerStyle: { backgroundColor?: string; borderWidth?: number; borderColor?: string; borderStyle?: string } = {};

        switch (phase.phase) {
          case 'Ovulation':
            dotColor = '#ff69b4';
            containerStyle = { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#ff69b4', borderStyle: 'dashed' };
            break;
          case 'Luteal':
            dotColor = '#ff69b4';
            containerStyle = { backgroundColor: '#6cb8fb' };
            break;
          case 'Menstruation':
            dotColor = 'red';
            containerStyle = { backgroundColor: 'red' };
            break;
          case 'Follicular':
            dotColor = 'magenta';
            containerStyle = { backgroundColor: 'magenta' };
            break;
          default:
            dotColor = '#333';
            containerStyle = { backgroundColor: '#333' };
        }

        marks[phase.date] = {
          customStyles: {
            container: {
              borderRadius: 10,
              width: 30,
              height: 30,
              justifyContent: 'center',
              alignItems: 'center',
              ...containerStyle,
            },
            text: {
              color: phase.phase === 'Ovulation' ? '#ff69b4' : 'white',
              fontWeight: 'bold',
            },
          },
          selected: true,
          selectedColor: dotColor,
        };
      });

      setMarkedDates(marks);
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred: ' + (error as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCyclePhases();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.background}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.push('../(tabs)/OvulationTracker')}>
          <MaterialIcons name="arrow-back" size={24} color="#FF69B4" />
        </TouchableOpacity>
        <Text style={styles.headerHeading}>Periods Calendar</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF69B4"
            colors={['#FF69B4']}
          />
        }
      >
        <View style={styles.container}>
          <View style={styles.calendarContainer}>
            <Calendar
              style={styles.calendar}
              current={new Date().toISOString().split('T')[0]}
              hideExtraDays={true}
              enableSwipeMonths={true}
              markedDates={markedDates}
              markingType={'custom'}
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                textSectionTitleColor: '#ff69b4',
                selectedDayBackgroundColor: '#ff69b4',
                selectedDayTextColor: '#ffffff',
                todayTextColor: '#ff69b4',
                dayTextColor: '#333333',
                textDisabledColor: '#d9d9d9',
                arrowColor: '#ff69b4',
                textMonthFontWeight: 'bold',
                textDayFontWeight: 'normal',
                monthTextColor: '#ff69b4',
              }}
            />
          </View>

          <View style={styles.symbolsContainer}>
            <Text style={styles.symbolsHeading}>Symbols</Text>

            <View style={styles.symbolContainer}>
              <View style={[styles.circle, styles.ovulationCircle]} />
              <Text style={styles.symbolText}>Ovulation</Text>
            </View>

            <View style={styles.symbolContainer}>
              <View style={[styles.circle, styles.lutealCircle]} />
              <Text style={styles.symbolText}>Luteal Phase</Text>
            </View>

            <View style={styles.symbolContainer}>
              <View style={[styles.circle, styles.menstrualCircle]} />
              <Text style={styles.symbolText}>Menstrual Phase</Text>
            </View>

            <View style={styles.symbolContainer}>
              <View style={[styles.circle, styles.follicularCircle]} />
              <Text style={styles.symbolText}>Follicular Phase</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerHeading: {
    fontSize: 23,
    fontWeight: '700',
    color: '#FF1493',
    textAlign: 'center',
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
    paddingRight: 20,
    paddingLeft: 20,
  },
  calendarContainer: {
    width: '100%',
    marginBottom: 30,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  calendar: {
    borderRadius: 10,
  },
  symbolsContainer: {
    width: '100%',
    backgroundColor: '#f8e3f5',
    borderRadius: 10,
    padding: 20,
    marginBottom: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  symbolsHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  symbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 15,
  },
  ovulationCircle: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ff69b4',
    borderStyle: 'dotted',
  },
  lutealCircle: {
    backgroundColor: '#6cb8fb',
  },
  menstrualCircle: {
    backgroundColor: 'red',
  },
  follicularCircle: {
    backgroundColor: 'magenta',
  },
  symbolText: {
    fontSize: 16,
    color: '#333',
  },
});