import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { initializeSignup } from '@/datafiles/userData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const EntryScreen: React.FC = () => {
  const router = useRouter();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignUpPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    initializeSignup();
    router.push('/(screens)/Question1');
  };

  const handleLoginPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(screens)/Login');
  };

  return (
    <ImageBackground
      source={require('../../assets/images/1.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={SCREEN_WIDTH * 0.2}
              color="#e45ea9"
            />
          </View> */}

          <Text style={styles.mainText}>Welcome to FemmeFitness</Text>
          <Text style={styles.subText}>
            Your Path to a Happier, Healthier You!
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignUpPress}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Let's Get Started</Text>
          </TouchableOpacity>

          <Text style={styles.loginText}>
            Already have an account?{' '}
            <TouchableOpacity
              onPress={handleLoginPress}
            >
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </Text>
          
            
         
        </Animated.View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  mainText: {
    fontSize: SCREEN_WIDTH * 0.1,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
    marginTop: SCREEN_HEIGHT * 0.25,
  },
  subText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#fff',
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.04,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  button: {
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.1,
    borderRadius: 25,
    marginTop: SCREEN_HEIGHT * 0.17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  loginContainer: {
    marginTop: SCREEN_HEIGHT * 0.02,
  },
  loginText: {
    marginTop: 20,
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#fff',
    textAlign: 'center',
  },
  loginLink: {
    color: '#e45ea9',
    fontWeight: '600',
    textDecorationLine: 'underline',
    textDecorationColor: '#e45ea9',
    marginBottom: -5,
  },
});

export default EntryScreen;