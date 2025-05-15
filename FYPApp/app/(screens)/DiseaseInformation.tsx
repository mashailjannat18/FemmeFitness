import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import Logo from '@/assets/images/Logo.png';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DiseaseInformation = () => {
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
  const [initialDiseases, setInitialDiseases] = useState<string[]>([]);
  const router = useRouter();
  const { user, refreshUser } = useUserAuth();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const diseases = [
    {
      title: 'Hypertension',
      description: 'High blood pressure condition',
      icon: <MaterialIcons name="favorite" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />,
    },
    {
      title: 'Diabetes Type 2',
      description: 'Chronic sugar metabolism issue',
      icon: <FontAwesome5 name="syringe" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />,
    },
    {
      title: 'Menopause',
      description: 'Natural aging transition',
      icon: <MaterialIcons name="female" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />,
    },
    {
      title: 'Nothing',
      description: 'No current conditions',
      icon: <MaterialIcons name="check-circle" size={SCREEN_WIDTH * 0.06} color="#e45ea9" />,
    },
  ];

  const scaleAnimations = diseases.map(() => new Animated.Value(1));

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
    const fetchUserDiseases = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('User')
        .select('diseases')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user diseases:', error);
        Alert.alert('Error', 'Failed to load your conditions.');
        return;
      }

      const userDiseases = data.diseases
        ? data.diseases.split(',').filter((d: string) => d.trim() !== '')
        : [];
      setSelectedDiseases(userDiseases.length > 0 ? userDiseases : ['Nothing']);
      setInitialDiseases(userDiseases.length > 0 ? userDiseases : ['Nothing']);
    };

    fetchUserDiseases();
  }, [user]);

  const handlePress = (index: number, disease: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (disease === 'Nothing') {
      setSelectedDiseases(['Nothing']);
    } else {
      setSelectedDiseases((prevState) => {
        if (prevState.includes('Nothing')) {
          return [disease];
        }
        if (prevState.includes(disease)) {
          const newSelection = prevState.filter((item) => item !== disease);
          return newSelection.length > 0 ? newSelection : ['Nothing'];
        } else {
          return [...prevState.filter((item) => item !== 'Nothing'), disease];
        }
      });
    }

    Animated.sequence([
      Animated.timing(scaleAnimations[index], {
        toValue: 0.96,
        duration: 100,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimations[index], {
        toValue: 1,
        duration: 100,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user) {
      Alert.alert('Error', 'User not logged in.');
      return;
    }

    if (JSON.stringify(selectedDiseases) === JSON.stringify(initialDiseases)) {
      Alert.alert('Info', 'No changes to save.');
      return;
    }

    const diseasesString = selectedDiseases.join(',');

    const { error } = await supabase
      .from('User')
      .update({ diseases: diseasesString })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating diseases:', error);
      Alert.alert('Error', 'Failed to update your conditions.');
      return;
    }

    setInitialDiseases(selectedDiseases);
    await refreshUser();
    Alert.alert('Success', 'Your conditions have been updated.');
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
          <Ionicons
            name="chevron-back"
            size={SCREEN_WIDTH * 0.06}
            color="#fff"
          />
        </TouchableOpacity>
        <Text style={styles.headerText}>Health Conditions</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View style={styles.currentContainer}>
            <Text style={styles.currentTitle}>Current Conditions</Text>
            <View style={styles.currentValueContainer}>
              <Text style={styles.currentValue}>
                {selectedDiseases.length > 0
                  ? selectedDiseases.join(', ')
                  : 'Not selected yet'}
              </Text>
            </View>
          </View>

          <Text style={styles.subTitle}>Select your conditions</Text>

          <View style={styles.cardsContainer}>
            {diseases.map((disease, index) => (
              <TouchableOpacity
                key={disease.title}
                style={[
                  styles.card,
                  selectedDiseases.includes(disease.title) && styles.selectedCard,
                ]}
                onPress={() => handlePress(index, disease.title)}
                activeOpacity={0.85}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardIcon}>{disease.icon}</View>
                  <Text style={styles.cardTitle}>{disease.title}</Text>
                  <Text style={styles.cardDescription}>{disease.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
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
  logo: {
    width: SCREEN_WIDTH * 0.1,
    height: SCREEN_WIDTH * 0.1,
    borderRadius: SCREEN_WIDTH * 0.05,
    marginRight: SCREEN_WIDTH * 0.02,
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
  currentContainer: {
    paddingTop: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_WIDTH * 0.06,
  },
  currentTitle: {
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_WIDTH * 0.02,
  },
  currentValueContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  currentValue: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#555',
  },
  subTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_WIDTH * 0.04,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_WIDTH * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#e45ea9',
    backgroundColor: '#FFF0F5',
  },
  cardContent: {
    alignItems: 'center',
  },
  cardIcon: {
    width: SCREEN_WIDTH * 0.12,
    height: SCREEN_WIDTH * 0.12,
    borderRadius: SCREEN_WIDTH * 0.06,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SCREEN_WIDTH * 0.03,
  },
  cardTitle: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: SCREEN_WIDTH * 0.01,
  },
  cardDescription: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#e45ea9',
    padding: SCREEN_WIDTH * 0.04,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SCREEN_WIDTH * 0.04,
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});

export default DiseaseInformation;