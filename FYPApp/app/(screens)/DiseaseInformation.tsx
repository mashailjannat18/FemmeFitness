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
} from 'react-native';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DiseaseInformation = () => {
  const [userDiseases, setUserDiseases] = useState<string[]>([]); // Single source of truth
  const [temporarySelections, setTemporarySelections] = useState<string[]>([]);
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
  const [initialDiseases, setInitialDiseases] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
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
    const fetchUserDiseases = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('User')
          .select('diseases')
          .eq('id', user.id)
          .single();

        if (!error && data.diseases) {
          const diseasesArray = data.diseases.split(',');
          setUserDiseases(diseasesArray);
        }
      }
    };

    fetchUserDiseases();

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
  }, [user]);

  const handlePress = (index: number, disease: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (disease === 'Nothing') {
      setTemporarySelections([]);
      return;
    }

    setTemporarySelections(prev => {
      if (prev.includes(disease)) {
        return prev.filter(d => d !== disease);
      } else {
        return [...prev, disease];
      }
    });
  };

  //   Animated.sequence([
  //     Animated.timing(scaleAnimations[index], {
  //       toValue: 0.96,
  //       duration: 100,
  //       easing: Easing.ease,
  //       useNativeDriver: true,
  //     }),
  //     Animated.timing(scaleAnimations[index], {
  //       toValue: 1,
  //       duration: 100,
  //       easing: Easing.ease,
  //       useNativeDriver: true,
  //     }),
  //   ]).start();
  // };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user) {
        Alert.alert('Error', 'User not logged in.');
        return;
    }

    try {
        // Combine and dedupe diseases
        const allDiseases = [...new Set([...userDiseases, ...temporarySelections])];
        const diseasesToSave = temporarySelections.includes('Nothing') 
            ? null 
            : allDiseases.filter(d => d !== 'Nothing').join(',');

        // Update diseases in User table
        const { data, error } = await supabase
            .from('User')
            .update({ diseases: diseasesToSave })
            .eq('id', user.id)
            .select();

        if (error) {
            throw error;
        }

        // Update plans if diseases changed
        if (diseasesToSave !== userDiseases.join(',')) {
            const response = await fetch('http://10.135.64.168:5000/api/update-plans-for-diseases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    diseases: diseasesToSave ? diseasesToSave.split(',') : []
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update plans');
            }

            const result = await response.json();
            if (result.is_menopausal) {
                Alert.alert('Notice', 'Menopause detected. Your cycle tracking has been disabled.');
            }
        }
        
        // Update local state only after successful save
        setUserDiseases(diseasesToSave ? diseasesToSave.split(',') : []);
        setTemporarySelections([]);
        await refreshUser();
        
        Alert.alert('Success', 'Your health conditions have been updated.');
    } catch (err: any) {
        console.error('Error updating diseases:', err);
        Alert.alert('Error', err.message || 'Failed to update your conditions');
    }
  };

  const getDisplayText = () => {
    // Combine permanent diseases with temporary selections, removing duplicates
    const allDiseases = [...new Set([...userDiseases, ...temporarySelections])];
    
    if (allDiseases.length === 0) return 'No conditions selected';
    if (temporarySelections.includes('Nothing')) return 'No conditions selected';
    
    return allDiseases.filter(d => d !== 'Nothing').join(', ');
  };

  return (
    <View style={styles.container}>
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
                {getDisplayText()}
              </Text>
            </View>
          </View>

          <Text style={styles.subTitle}>Select your conditions</Text>

          <View style={styles.cardsContainer}>
            {diseases.map((disease, index) => {
              const isSelected = selectedDiseases.includes(disease.title) || 
                               (initialDiseases.includes(disease.title) && disease.title !== 'Nothing');
              const isDisabled = initialDiseases.includes(disease.title) && disease.title !== 'Nothing';

              return (
                <TouchableOpacity
                  key={disease.title}
                  style={[
                    styles.card,
                    isSelected && styles.selectedCard,
                    isDisabled && styles.disabledCard,
                  ]}
                  onPress={() => handlePress(index, disease.title)}
                  activeOpacity={0.85}
                  disabled={isDisabled}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardIcon}>
                      {React.cloneElement(disease.icon, {
                        color: isDisabled ? '#aaa' : 
                               isSelected ? '#e45ea9' : '#e45ea9'
                      })}
                    </View>
                    <Text style={[
                      styles.cardTitle,
                      isDisabled && styles.disabledText,
                      isSelected && styles.selectedText
                    ]}>
                      {disease.title}
                    </Text>
                    <Text style={[
                      styles.cardDescription,
                      isDisabled && styles.disabledText
                    ]}>
                      {disease.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
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
  disabledCard: {
    backgroundColor: '#f5f5f5',
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
  selectedText: {
    color: '#e45ea9',
  },
  disabledText: {
    color: '#aaa',
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