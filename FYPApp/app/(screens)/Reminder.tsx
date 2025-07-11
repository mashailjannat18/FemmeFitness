import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Animated,
  Easing,
  Alert,
  ScrollView
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';

const Reminder = () => {
  const { user } = useUserAuth();
  const [isReminderOn, setIsReminderOn] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [currentTime, setCurrentTime] = useState('');
  const [hasSetInitialTime, setHasSetInitialTime] = useState(false);
  const router = useRouter();

  const [hours, setHours] = useState(12);
  const [minutes, setMinutes] = useState(0);
  const [isAM, setIsAM] = useState(true);

  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

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

    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);

    loadUserReminderSettings();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadUserReminderSettings();
    }
  }, [user?.id]);

  useEffect(() => {
    if (showTimePicker) {
      // When time picker opens, set the hours/minutes/AMPM from selectedTime
      const hours12 = selectedTime.getHours() % 12 || 12;
      const mins = selectedTime.getMinutes();
      const isAm = selectedTime.getHours() < 12;
      
      setHours(hours12);
      setMinutes(mins);
      setIsAM(isAm);
    }
  }, [showTimePicker]);

  const loadUserReminderSettings = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('UserNotifications')
        .select('reminder_enabled, reminder_time')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading reminder settings:', error);
        return;
      }

      if (data) {
        setIsReminderOn(data.reminder_enabled);
        if (data.reminder_time) {
          const [time, period] = data.reminder_time.split(' ');
          let [hour, minute] = time.split(':').map(Number);
          if (period === 'PM' && hour !== 12) hour += 12;
          if (period === 'AM' && hour === 12) hour = 0;
          const date = new Date();
          date.setHours(hour, minute, 0, 0);
          setSelectedTime(date);
          setHasSetInitialTime(true);
        }
      }
    } catch (error) {
      console.error('Error in loadUserReminderSettings:', error);
    }
  };

  const saveReminderSettings = async (enabled: boolean, time: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('UserNotifications')
        .upsert({
          user_id: user.id,
          reminder_enabled: enabled,
          reminder_time: time,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      await supabase.from('NotificationLogs').insert({
        user_id: user.id,
        notification_type: enabled ? 'reminder_enabled' : 'reminder_disabled',
        was_triggered: false,
      });

    } catch (error) {
      console.error('Error saving reminder settings:', error);
      Alert.alert('Error', 'Failed to save reminder settings. Please try again.');
    }
  };

  const handleToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!isReminderOn && !hasSetInitialTime) {
      setShowTimePicker(true);
      return;
    }

    const newState = !isReminderOn;
    setIsReminderOn(newState);

    const formattedTime = selectedTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(/^0/, '');
    await saveReminderSettings(newState, newState ? formattedTime : '');
  };

  const handleSaveTime = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Convert 12-hour format to 24-hour for the Date object
    let hour24 = isAM ? hours : hours + 12;
    if (hours === 12) hour24 = isAM ? 0 : 12;
    
    const newTime = new Date();
    newTime.setHours(hour24, minutes, 0, 0);
    setSelectedTime(newTime);

    const formattedTime = newTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(/^0/, '');

    setShowTimePicker(false);
    setHasSetInitialTime(true);
    setIsReminderOn(true);
    await saveReminderSettings(true, formattedTime);
  };

  const formattedTime = selectedTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).replace(/^0/, '');

  const renderNumberPicker = (items: number[], selected: number, setSelected: (value: number) => void) => {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pickerColumn}
        snapToInterval={40}
        decelerationRate="fast"
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.pickerItem,
              selected === item && styles.pickerItemSelected
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelected(item);
            }}
          >
            <Text style={[
              styles.pickerItemText,
              selected === item && styles.pickerItemTextSelected
            ]}>
              {item.toString().padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const hourItems = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteItems = Array.from({ length: 60 }, (_, i) => i);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.header}>Daily Reminder</Text>
        <View style={{ width: 24 }} />
      </View>

      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.timeContainer}>
          <MaterialCommunityIcons name="clock-outline" size={32} color="#e45ea9" />
          <Text style={styles.timeText}>{currentTime}</Text>
          <Text style={styles.timeLabel}>Current Time</Text>
        </View>

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Reminder Status</Text>
          <TouchableOpacity onPress={handleToggle} activeOpacity={0.8} style={styles.toggleButton}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, !isReminderOn && styles.activeLabel]}>OFF</Text>
              <Text style={[styles.label, isReminderOn && styles.activeLabel]}>ON</Text>
            </View>
            <View style={[styles.switchTrack, isReminderOn && styles.switchTrackActive]}>
              <View style={[styles.switchThumb, isReminderOn && styles.switchThumbActive]} />
            </View>
          </TouchableOpacity>
        </View>

        {isReminderOn && (
          <View style={styles.notificationBox}>
            <MaterialCommunityIcons name="bell-outline" size={28} color="#e45ea9" style={styles.notificationIcon} />
            <Text style={styles.notificationText}>
              Daily reminder set for {'\n'}
              <Text style={styles.notificationTime}>{formattedTime}</Text>
            </Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowTimePicker(true);
              }}
            >
              <Text style={styles.editButtonText}>Change Time</Text>
              <MaterialIcons name="edit" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      <Modal visible={showTimePicker} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="clock-edit-outline" size={28} color="#e45ea9" />
              <Text style={styles.modalTitle}>Set Reminder Time</Text>
            </View>

            <View style={styles.timePickerContainer}>
              <View style={styles.pickerWrapper}>
                {renderNumberPicker(hourItems, hours, setHours)}
              </View>
              
              <Text style={styles.timeSeparator}>:</Text>
              
              <View style={styles.pickerWrapper}>
                {renderNumberPicker(minuteItems, minutes, setMinutes)}
              </View>
              
              <View style={styles.ampmContainer}>
                <TouchableOpacity
                  style={[styles.ampmButton, isAM && styles.ampmButtonActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsAM(true);
                  }}
                >
                  <Text style={[styles.ampmText, isAM && styles.ampmTextActive]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ampmButton, !isAM && styles.ampmButtonActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsAM(false);
                  }}
                >
                  <Text style={[styles.ampmText, !isAM && styles.ampmTextActive]}>PM</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveTime}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    backgroundColor: '#e45ea9',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 8,
    zIndex: 10,
  },
  header: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center', flex: 1 },
  backButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  contentContainer: { flex: 1, padding: 20 },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 30,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
  },
  timeText: { fontSize: 32, fontWeight: 'bold', color: '#e45ea9', marginVertical: 8 },
  timeLabel: { fontSize: 16, color: '#666' },
  switchContainer: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
  },
  switchLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  toggleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  labelContainer: { flexDirection: 'row', marginRight: 10 },
  label: { fontSize: 16, color: '#aaa', marginHorizontal: 5, fontWeight: '600' },
  activeLabel: { color: '#e45ea9' },
  switchTrack: {
    width: 60,
    height: 30,
    borderRadius: 30,
    backgroundColor: '#ddd',
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchTrackActive: { backgroundColor: '#e45ea9' },
  switchThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  switchThumbActive: { transform: [{ translateX: 30 }] },
  notificationBox: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  notificationIcon: { marginBottom: 12 },
  notificationText: { fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 12 },
  notificationTime: { fontSize: 20, fontWeight: 'bold', color: '#e45ea9' },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: '#e45ea9',
    marginTop: 8,
  },
  editButtonText: { fontSize: 16, color: '#fff', fontWeight: '600', marginRight: 8 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    width: '90%',
    maxWidth: 350,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#e45ea9', marginLeft: 12 },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    height: 200,
  },
  pickerWrapper: {
    height: 160,
    width: 80,
    overflow: 'hidden',
  },
  pickerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  pickerItem: {
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginVertical: 2,
  },
  pickerItemSelected: {
    backgroundColor: '#e45ea9',
  },
  pickerItemText: {
    fontSize: 20,
    color: '#666',
  },
  pickerItemTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 5,
  },
  ampmContainer: {
    marginLeft: 15,
  },
  ampmButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginVertical: 5,
    backgroundColor: '#f0f0f0',
  },
  ampmButtonActive: {
    backgroundColor: '#e45ea9',
  },
  ampmText: {
    fontSize: 16,
    color: '#666',
  },
  ampmTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: { backgroundColor: '#F3F4F6' },
  saveButton: { backgroundColor: '#e45ea9' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
  modalButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});

export default Reminder;