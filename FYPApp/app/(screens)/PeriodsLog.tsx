import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

function PeriodsLog() {
  const router = useRouter();

  const getPastMonths = () => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 5; i++) {
      const pastDate = new Date(currentDate);
      pastDate.setMonth(currentDate.getMonth() - i);
      const year = pastDate.getFullYear();
      const month = String(pastDate.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }
    return months;
  };

  const pastMonths = getPastMonths();

  // Example function to generate marked dates for each month
  const getMarkedDatesForMonth = (month: string) => {
    const markedDates: { [key: string]: any } = {};
    const [year, monthNum] = month.split('-').map(Number);
    
    // Example: Mark the 10th to 14th of each month as period days
    // Replace this with your actual period data logic
    for (let day = 10; day <= 14; day++) {
      const date = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      markedDates[date] = {
        selected: true,
        marked: true,
        dotColor: '#FF69B4',
        selectedColor: '#FF69B4',
      };
    }
    
    return markedDates;
  };

  return (
    <View style={styles.background}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.push('../(tabs)/OvulationTracker')}>
          <MaterialIcons name="arrow-back" size={24} color="#FF69B4" />
        </TouchableOpacity>
        <Text style={styles.headerHeading}>Periods Log</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.subHeading}>Track your cycle with ease</Text>
        </View>

        {pastMonths.map((month, index) => (
          <View key={index} style={styles.calendarContainer}>
            <Text style={styles.monthHeader}>
              {new Date(month).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
            <Calendar
              current={month}
              hideExtraDays={true}
              firstDay={1}
              disableMonthChange={true}
              enableSwipeMonths={false}
              hideArrows={true}
              markedDates={getMarkedDatesForMonth(month)}
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                monthTextColor: '#FF69B4',
                dayTextColor: '#333',
                textDayFontWeight: 'bold',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: 'bold',
                selectedDayBackgroundColor: '#FF69B4',
                selectedDayTextColor: '#fff',
                todayTextColor: '#FF69B4',
                arrowColor: '#FF69B4',
                textSectionTitleColor: '#FF69B4',
                textDisabledColor: '#d3d3d3',
                dotColor: '#FF69B4',
                selectedDotColor: '#fff',
              }}
              style={styles.calendar}
            />
          </View>
        ))}
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
  container: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF69B4',
  },
  subHeading: {
    fontSize: 14,
    color: '#FF69B4',
    marginTop: 4,
  },
  calendarContainer: {
    width: '90%',
    alignSelf: 'center',
    marginBottom: 30,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#FFB6C1',
  },
  monthHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF69B4',
    marginBottom: 10,
    textAlign: 'center',
  },
  calendar: {
    borderWidth: 1,
    borderColor: '#FFB6C1',
    borderRadius: 12,
    width: '100%',
  },
});

export default PeriodsLog;