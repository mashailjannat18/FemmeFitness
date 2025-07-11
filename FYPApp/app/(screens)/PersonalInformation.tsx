import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type UserData = {
  weight: string;
  height: string;
  challengeDays: string;
};

type Section = {
  key: keyof UserData;
  icon: React.ReactNode;
  label: string;
  editable?: boolean;
  unit?: string;
};

const PersonalInformation = () => {
  const [expandedSection, setExpandedSection] = useState<keyof UserData | null>(null);
  const [userData, setUserData] = useState<UserData>({
    weight: '',
    height: '',
    challengeDays: '',
  });
  const [editMode, setEditMode] = useState<keyof UserData | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];
  const router = useRouter();
  const { user, refreshUser } = useUserAuth();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('User')
        .select('weight, height, challenge_days')
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
        weight: `${data.weight} kg`,
        height: `${heightInCm.toFixed(0)} cm (${feet}'${inches}")`,
        challengeDays: `${data.challenge_days}-day challenge`,
      });
    };

    fetchUserData();
  }, [user]);

  const sections: Section[] = [
    { 
      key: 'weight', 
      icon: <FontAwesome5 name="weight" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />,
      label: 'Weight', 
      editable: true,
      unit: 'kg'
    },
    { 
      key: 'height', 
      icon: <FontAwesome5 name="ruler-vertical" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />,
      label: 'Height', 
      editable: false 
    },
    { 
      key: 'challengeDays', 
      icon: <MaterialIcons name="stars" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />,
      label: 'Current Challenge', 
      editable: false 
    },
  ];

  const toggleSection = (key: keyof UserData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expandedSection === key) {
      setExpandedSection(null);
      setEditMode(null);
    } else {
      setExpandedSection(key);
      setEditMode(null);
    }
  };

  const handleEdit = (key: keyof UserData, currentValue: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditMode(key);
    const numericValue = currentValue.replace(/[^0-9.]/g, '');
    setEditValue(numericValue);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditMode(null);
    setEditValue('');
  };

  const handleSave = async (key: keyof UserData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const numericValue = parseFloat(editValue);
    if (isNaN(numericValue)) {
      Alert.alert('Error', 'Please enter a valid number.');
      return;
    }

    try {
      if (key === 'weight') {
        if (numericValue < 25 || numericValue > 200) {
          Alert.alert('Error', 'Weight must be between 25 and 200 kg.');
          return;
        }

        // Fetch current weight to store as previous_weight
        const { data: currentUser, error: fetchError } = await supabase
          .from('User')
          .select('weight')
          .eq('id', user?.id)
          .single();

        if (fetchError) throw new Error(fetchError.message);

        // Update User table
        const { error: userError } = await supabase
          .from('User')
          .update({ weight: numericValue })
          .eq('id', user?.id);

        if (userError) throw new Error(userError.message);

        // Insert into WeightHistory
        const { error: historyError } = await supabase
          .from('WeightHistory')
          .insert({
            user_id: user?.id,
            weight_now: numericValue,
            recorded_at: new Date().toISOString(),
            previous_weight: currentUser?.weight || null,
          });

        if (historyError) throw new Error(historyError.message);

        setUserData(prev => ({ ...prev, weight: `${numericValue} kg` }));
      }

      setEditMode(null);
      setEditValue('');
      await refreshUser();
      Alert.alert('Success', 'Information updated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update information.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Personal Information</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {sections.map((section) => (
            <View key={section.key} style={styles.card}>
              <TouchableOpacity
                onPress={() => toggleSection(section.key)}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.iconContainer}>
                    {section.icon}
                  </View>
                  <Text style={styles.cardTitle}>{section.label}</Text>
                  <Ionicons
                    name={expandedSection === section.key ? 'chevron-up' : 'chevron-down'}
                    size={SCREEN_WIDTH * 0.06}
                    color="#e45ea9"
                  />
                </View>
              </TouchableOpacity>

              {expandedSection === section.key && (
                <View style={styles.cardContent}>
                  {section.editable && editMode === section.key ? (
                    <View style={styles.editContainer}>
                      <TextInput
                        style={styles.input}
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="decimal-pad"
                        placeholder={`Enter ${section.label.toLowerCase()}`}
                        autoFocus
                      />
                      {section.unit && (
                        <Text style={styles.unitText}>{section.unit}</Text>
                      )}
                      <View style={styles.buttonContainer}>
                        <TouchableOpacity
                          style={[styles.button, styles.cancelButton]}
                          onPress={handleCancel}
                        >
                          <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.button, styles.saveButton]}
                          onPress={() => handleSave(section.key)}
                        >
                          <Text style={styles.buttonText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.infoContainer}>
                      <Text style={styles.infoText}>{userData[section.key]}</Text>
                      {section.editable && (
                        <TouchableOpacity
                          onPress={() => handleEdit(section.key, userData[section.key])}
                          style={styles.editButton}
                        >
                          <MaterialIcons
                            name="edit"
                            size={SCREEN_WIDTH * 0.05}
                            color="#e45ea9"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
        </Animated.View>
      </ScrollView>
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
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  scrollContainer: {
    paddingBottom: SCREEN_WIDTH * 0.1,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.05,
    marginBottom: SCREEN_WIDTH * 0.04,
    marginTop: SCREEN_WIDTH * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: SCREEN_WIDTH * 0.1,
    height: SCREEN_WIDTH * 0.1,
    borderRadius: SCREEN_WIDTH * 0.05,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SCREEN_WIDTH * 0.03,
  },
  cardTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  cardContent: {
    marginTop: SCREEN_WIDTH * 0.04,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#555',
    flex: 1,
  },
  editButton: {
    padding: SCREEN_WIDTH * 0.02,
  },
  editContainer: {
    marginTop: SCREEN_WIDTH * 0.02,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: SCREEN_WIDTH * 0.04,
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
    marginBottom: SCREEN_WIDTH * 0.04,
  },
  unitText: {
    position: 'absolute',
    right: SCREEN_WIDTH * 0.04,
    top: SCREEN_WIDTH * 0.04,
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: SCREEN_WIDTH * 0.03,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#e45ea9',
  },
  buttonText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
  },
});

export default PersonalInformation;