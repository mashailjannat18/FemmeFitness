import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Easing
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(true);
  const [isPasswordValid, setIsPasswordValid] = useState(true);
  const [showEmailError, setShowEmailError] = useState(false);
  const [showPasswordError, setShowPasswordError] = useState(false);
  const [showLoginError, setShowLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useUserAuth();
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
    setShowLoginError(null);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setIsPasswordValid(text.length >= 6 || text === '');
    setShowPasswordError(text.length > 0 && text.length < 6);
    setShowLoginError(null);
  };

  const handleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Validate inputs
    if (!email || !password || !isEmailValid || !isPasswordValid) {
      setShowEmailError(!isEmailValid && email !== '');
      setShowPasswordError(!isPasswordValid && password !== '');
      return;
    }

    console.log('Login attempt with email:', email, 'and password:', password); // Log raw input

    setLoading(true);
    try {
      const result = await login(email, password);
      
      console.log('Login result:', result); // Log the result from login function
      
      if (result.success) {
        router.push('/(tabs)');
      } else {
        setShowLoginError(result.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Unexpected error during login:', error);
      setShowLoginError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(screens)/EntryScreen');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e45ea9" />
        <Text style={styles.loadingText}>Signing you in...</Text>
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
        <Text style={styles.headerText}>Welcome Back</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      {/* Content */}
      <Animated.View style={[styles.contentContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons 
            name="login" 
            size={SCREEN_WIDTH * 0.15} 
            color="#e45ea9" 
          />
        </View>

        {showLoginError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={SCREEN_WIDTH * 0.05} color="#fff" />
            <Text style={styles.errorBannerText}>{showLoginError}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={[styles.inputWrapper, (!isEmailValid || showLoginError) && styles.invalidInput]}>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              keyboardType="email-address"
              value={email}
              onChangeText={handleEmailChange}
              autoCapitalize="none"
            />
          </View>
          {showEmailError && <Text style={styles.errorText}>Please enter a valid email address</Text>}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={[styles.inputWrapper, (!isPasswordValid || showLoginError) && styles.invalidInput]}>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
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

        <TouchableOpacity 
          style={styles.forgotPassword}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({
              pathname: '/(screens)/ForgotPassword',
              params: { fromAccountInformation: 'false' },
            });
          }}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              email && password && isEmailValid && isPasswordValid ? null : styles.disabledButton
            ]}
            onPress={handleLogin}
            disabled={!email || !password || !isEmailValid || !isPasswordValid}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(screens)/Question1');
            }}
          >
            <Text style={styles.signupLink}>Sign up</Text>
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
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contentContainer: {
    flex: 1,
    padding: SCREEN_WIDTH * 0.05,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.03,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  forgotPasswordText: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#e45ea9',
    fontWeight: '500',
  },
  buttonContainer: {
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  button: {
    backgroundColor: '#e45ea9',
    padding: SCREEN_HEIGHT * 0.02,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
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
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SCREEN_HEIGHT * 0.02,
  },
  signupText: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
  },
  signupLink: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#e45ea9',
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

export default Login;