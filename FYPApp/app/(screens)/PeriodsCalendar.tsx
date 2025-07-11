import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  Image,
  Dimensions,
  RefreshControl
} from 'react-native';
import { router } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { 
  MaterialIcons, 
  MaterialCommunityIcons,
  FontAwesome5 
} from '@expo/vector-icons';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CyclePhase {
  date: string;
  phase: string;
}

export default function PeriodsCalendar() {
  const { user } = useUserAuth();
  const [markedDates, setMarkedDates] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState('');

  useEffect(() => {
    fetchCyclePhases();
    const today = new Date();
    setCurrentMonth(today.toLocaleString('default', { month: 'long', year: 'numeric' }));
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
        let dotColor = '#e45ea9';
        let containerStyle = {};
        let textColor = 'white';

        switch (phase.phase) {
          case 'Ovulation':
            dotColor = '#FF69B4';
            containerStyle = { 
              backgroundColor: 'transparent', 
              borderWidth: 2, 
              borderColor: '#FF69B4',
              borderStyle: 'solid'
            };
            textColor = '#FF69B4';
            break;
          case 'Luteal':
            dotColor = '#9C64FE';
            containerStyle = { backgroundColor: '#9C64FE' };
            break;
          case 'Menstruation':
            dotColor = '#FF1493';
            containerStyle = { backgroundColor: '#FF1493' };
            break;
          case 'Follicular':
            dotColor = '#FF8FE3';
            containerStyle = { backgroundColor: '#FF8FE3' };
            break;
          default:
            dotColor = '#e45ea9';
            containerStyle = { backgroundColor: '#e45ea9' };
        }

        marks[phase.date] = {
          customStyles: {
            container: {
              borderRadius: 15,
              width: 30,
              height: 30,
              justifyContent: 'center',
              alignItems: 'center',
              ...containerStyle,
            },
            text: {
              color: textColor,
              fontWeight: '600',
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

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'Ovulation':
        return <MaterialCommunityIcons name="egg" size={SCREEN_WIDTH * 0.06} color="#FF69B4" />;
      case 'Luteal':
        return <MaterialCommunityIcons name="flower" size={SCREEN_WIDTH * 0.06} color="#9C64FE" />;
      case 'Menstruation':
        return <FontAwesome5 name="tint" size={SCREEN_WIDTH * 0.06} color="#FF1493" />;
      case 'Follicular':
        return <MaterialCommunityIcons name="leaf" size={SCREEN_WIDTH * 0.06} color="#FF8FE3" />;
      default:
        return <MaterialCommunityIcons name="calendar" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Period Calendar</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e45ea9"
            colors={['#e45ea9']}
          />
        }
      >
        {/* Calendar Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{currentMonth}</Text>
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
                textSectionTitleColor: '#e45ea9',
                selectedDayBackgroundColor: '#e45ea9',
                selectedDayTextColor: '#ffffff',
                todayTextColor: '#e45ea9',
                dayTextColor: '#333333',
                textDisabledColor: '#d9d9d9',
                arrowColor: '#e45ea9',
                textMonthFontWeight: 'bold',
                textDayFontWeight: '600',
                monthTextColor: '#e45ea9',
                textDayFontSize: 14,
                textMonthFontSize: 16,
                'stylesheet.calendar.header': {
                  week: {
                    marginTop: 5,
                    flexDirection: 'row',
                    justifyContent: 'space-around'
                  }
                }
              }}
            />
          </View>
        </View>

        {/* Legend Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cycle Phase Legend</Text>
          <View style={styles.legendGrid}>
            <View style={styles.legendItem}>
              {getPhaseIcon('Menstruation')}
              <Text style={styles.legendText}>Menstruation</Text>
            </View>
            <View style={styles.legendItem}>
              {getPhaseIcon('Follicular')}
              <Text style={styles.legendText}>Follicular</Text>
            </View>
            <View style={styles.legendItem}>
              {getPhaseIcon('Ovulation')}
              <Text style={styles.legendText}>Ovulation</Text>
            </View>
            <View style={styles.legendItem}>
              {getPhaseIcon('Luteal')}
              <Text style={styles.legendText}>Luteal</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons 
                name="calendar-heart" 
                size={SCREEN_WIDTH * 0.08} 
                color="#e45ea9" 
              />
              <Text style={styles.statNumber}>28</Text>
              <Text style={styles.statLabel}>Cycle Days</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons 
                name="clock" 
                size={SCREEN_WIDTH * 0.08} 
                color="#9C64FE" 
              />
              <Text style={styles.statNumber}>5</Text>
              <Text style={styles.statLabel}>Period Days</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

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
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  logo: {
    width: SCREEN_WIDTH * 0.12,
    height: SCREEN_WIDTH * 0.12,
    borderRadius: SCREEN_WIDTH * 0.05,
    marginRight: SCREEN_WIDTH * 0.02,
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
  scrollContainer: {
    paddingBottom: SCREEN_WIDTH * 0.1,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  section: {
    marginBottom: SCREEN_WIDTH * 0.06,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
    paddingLeft: SCREEN_WIDTH * 0.03,
    marginBottom: SCREEN_WIDTH * 0.04,
    marginTop: SCREEN_WIDTH * 0.06,
  },
  calendarContainer: {
    width: '100%',
    marginBottom: SCREEN_WIDTH * 0.04,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  calendar: {
    borderRadius: 12,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  legendItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_WIDTH * 0.04,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  legendText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
    fontWeight: '500',
    marginLeft: SCREEN_WIDTH * 0.03,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.05,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  statNumber: {
    fontSize: SCREEN_WIDTH * 0.08,
    fontWeight: '700',
    color: '#333',
    marginVertical: SCREEN_WIDTH * 0.02,
  },
  statLabel: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
});