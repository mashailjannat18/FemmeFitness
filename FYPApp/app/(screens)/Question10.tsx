import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Animated,
  Pressable,
  Dimensions,
  Easing
} from 'react-native';
import { useRouter } from 'expo-router';
import { getUserData } from '@/datafiles/userData';
import { useUserAuth } from '@/context/UserAuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Question10: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(true);
  const [showEmailError, setShowEmailError] = useState(false);
  const [showPasswordError, setShowPasswordError] = useState(false);
  const [showUsernameError, setShowUsernameError] = useState(false);
  const [showSignupError, setShowSignupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { signUp } = useUserAuth();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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

  const handleEmailChange = (text: string) => {
    const trimmedText = text.trim();
    setEmail(trimmedText);
    setIsEmailValid(emailRegex.test(trimmedText) || trimmedText === '');
    setShowEmailError(trimmedText !== '' && !emailRegex.test(trimmedText));
    setShowSignupError(null);
  };

  const handleUsernameChange = (text: string) => {
    const trimmedText = text.trim();
    setUsername(trimmedText);
    setShowUsernameError(trimmedText.length > 0 && trimmedText.length < 3);
    setShowSignupError(null);
  };

  const handlePasswordChange = (text: string) => {
    const trimmedText = text.trim();
    setPassword(trimmedText);
    setShowPasswordError(trimmedText.length > 0 && trimmedText.length < 6);
    setShowSignupError(null);
  };

  const handleSignUp = async () => {
    try {
      setLoading(true);
      setShowSignupError(null);

      if (!email || !password || !username || !isEmailValid || password.length < 6 || username.length < 3) {
        setShowEmailError(!isEmailValid && email !== '');
        setShowPasswordError(password.length < 6 && password !== '');
        setShowUsernameError(username.length < 3 && username !== '');
        throw new Error('Please fill all fields with valid data.');
      }

      const userData = getUserData();
      const challengeDays = userData.challengeDays;

      if (!challengeDays || challengeDays <= 0) {
        throw new Error('Challenge days must be selected and greater than 0.');
      }

      await signUp(email, password, username, challengeDays);

      router.push({
        pathname: '/(screens)/ConfirmCode',
        params: { email: email.trim() },
      });
    } catch (err: any) {
      console.error('Signup error:', err.message);
      if (err.message === 'This email has already been signed up with') {
        setShowSignupError('This email is already registered.');
      } else if (err.message === 'This username is taken') {
        setShowSignupError('This username is already taken.');
      } else {
        setShowSignupError(err.message || 'An error occurred during signup.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(screens)/Question8');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e45ea9" />
        <Text style={styles.loadingText}>Creating your account...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Pressable 
          onPress={handleBack} 
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Create Account</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      {/* Content */}
      <Animated.View style={[styles.contentContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons 
            name="account-plus" 
            size={SCREEN_WIDTH * 0.2} 
            color="#e45ea9" 
          />
        </View>

        {showSignupError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={SCREEN_WIDTH * 0.05} color="#fff" />
            <Text style={styles.errorBannerText}>{showSignupError}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={[styles.inputWrapper, !isEmailValid && styles.invalidInput]}>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              keyboardType="email-address"
              value={email}
              onChangeText={handleEmailChange}
              autoCapitalize="none"
            />
          </View>
          {showEmailError && <Text style={styles.errorText}>Please enter a valid email</Text>}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Username</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Choose a username"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
            />
          </View>
          {showUsernameError && <Text style={styles.errorText}>Username must be at least 3 characters</Text>}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={[styles.inputWrapper, showPasswordError && styles.invalidInput]}>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={handlePasswordChange}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPassword(!showPassword);
              }}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={SCREEN_WIDTH * 0.05}
                color="#666"
              />
            </TouchableOpacity>
          </View>
          {showPasswordError && <Text style={styles.errorText}>Password must be at least 6 characters</Text>}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              email && password && username && isEmailValid && password.length >= 6 && username.length >= 3
                ? null
                : styles.disabledButton
            ]}
            onPress={handleSignUp}
            disabled={!email || !password || !username || !isEmailValid || password.length < 6 || username.length < 3}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
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
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contentContainer: {
    flex: 1,
    padding: SCREEN_WIDTH * 0.05,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.03,
    paddingTop: SCREEN_HEIGHT * 0.02,
  },
  errorBanner: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.03,
    borderRadius: 8,
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  errorBannerText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.035,
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  inputContainer: {
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  inputLabel: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
    marginLeft: SCREEN_WIDTH * 0.01,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    height: SCREEN_HEIGHT * 0.07,
    fontSize: SCREEN_WIDTH * 0.04,
  },
  invalidInput: {
    borderColor: '#F44336',
  },
  eyeIcon: {
    padding: SCREEN_WIDTH * 0.02,
  },
  errorText: {
    color: '#F44336',
    fontSize: SCREEN_WIDTH * 0.035,
    marginTop: SCREEN_HEIGHT * 0.005,
    marginLeft: SCREEN_WIDTH * 0.01,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: SCREEN_HEIGHT * 0.04,
  },
  button: {
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: SCREEN_WIDTH * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#a9a9a9',
    shadowColor: '#000',
  },
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  loadingText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    marginTop: SCREEN_HEIGHT * 0.02,
  },
});

export default Question10;