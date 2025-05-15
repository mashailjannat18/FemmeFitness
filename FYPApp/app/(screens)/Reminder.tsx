import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const Reminder = () => {
  const [isReminderOn, setIsReminderOn] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState('8');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedAmPm, setSelectedAmPm] = useState('PM');
  const [currentTime, setCurrentTime] = useState('');
  const router = useRouter();

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const amPmOptions = ['AM', 'PM'];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    setIsReminderOn(prev => !prev);
  };

  const handleSaveTime = () => {
    setShowTimePicker(false);
  };

  const formattedTime = `${selectedHour}:${selectedMinute} ${selectedAmPm}`;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.push('../(tabs)/Profile')}>
          <MaterialIcons name="arrow-back" size={24} color="#FF69B4" />
        </TouchableOpacity>
        <Text style={styles.header}>Daily Reminder</Text>
      </View>

      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{currentTime}</Text>
        <Text style={styles.timeLabel}>Current Time</Text>
      </View>

      <View style={styles.switchContainer}>
        <TouchableOpacity 
          onPress={handleToggle}
          activeOpacity={0.8}
          style={styles.toggleButton}
        >
          <View style={styles.labelContainer}>
            <Text style={[styles.label, !isReminderOn && styles.activeLabel]}>OFF</Text>
            <Text style={[styles.label, isReminderOn && styles.activeLabel]}>ON</Text>
          </View>

          <View style={[styles.switchTrack, isReminderOn && styles.switchTrackActive]}>
            <View style={[
              styles.switchThumb,
              isReminderOn && styles.switchThumbActive
            ]} />
          </View>
        </TouchableOpacity>
      </View>

      {isReminderOn && (
        <View style={styles.notificationBox}>
          <Text style={styles.notificationText}>
            Reminder set for {formattedTime} daily
          </Text>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.editButtonText}>Edit Time</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showTimePicker} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Reminder Time</Text>

            <View style={styles.pickerContainer}>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedHour}
                  onValueChange={(itemValue: string) => setSelectedHour(itemValue)}
                  style={styles.picker}
                >
                  {hours.map(hour => (
                    <Picker.Item key={hour} label={hour} value={hour} />
                  ))}
                </Picker>
                <Text style={styles.pickerLabel}>Hour</Text>
              </View>

              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedMinute}
                  onValueChange={(itemValue: string) => setSelectedMinute(itemValue)}
                  style={styles.picker}
                >
                  {minutes.map(minute => (
                    <Picker.Item key={minute} label={minute} value={minute} />
                  ))}
                </Picker>
                <Text style={styles.pickerLabel}>Minute</Text>
              </View>

              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedAmPm}
                  onValueChange={(itemValue: string) => setSelectedAmPm(itemValue)}
                  style={styles.picker}
                >
                  {amPmOptions.map(ampm => (
                    <Picker.Item key={ampm} label={ampm} value={ampm} />
                  ))}
                </Picker>
                <Text style={styles.pickerLabel}>AM/PM</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  header: {
    fontSize: 23,
    fontWeight: '700',
    color: '#FF1493',
    textAlign: 'center',
    flex: 1,
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  timeText: {
    fontSize: 22,
    color: 'brown',
  },
  timeLabel: {
    fontSize: 14,
    color: 'black',
  },
  switchContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    flexDirection: 'row',
    marginRight: 10,
  },
  label: {
    fontSize: 18,
    color: '#aaa',
    marginHorizontal: 5,
  },
  activeLabel: {
    color: '#FF69B4',
  },
  switchTrack: {
    width: 60,
    height: 30,
    borderRadius: 30,
    backgroundColor: '#ddd',
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#FF69B4',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  switchThumbActive: {
    transform: [{ translateX: 30 }],
  },
  notificationBox: {
    padding: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    fontSize: 18,
    color: 'black',
  },
  editButton: {
    width: 100,
    height: 50,
    borderRadius: 30,
    backgroundColor: '#FF69B4',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  editButtonText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: 300,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FF69B4',
    marginBottom: 20,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerWrapper: {
    width: '30%',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  pickerLabel: {
    fontSize: 14,
    color: '#FF69B4',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    padding: 10,
    width: 120,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#FF69B4',
  },
  modalButtonText: {
    fontSize: 16,
    color: '#fff',
  },
});

export default Reminder;