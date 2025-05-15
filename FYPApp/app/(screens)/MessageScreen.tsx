import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
} from 'react-native';
import { Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const MessageScreen: React.FC = () => {
  return (
    <ImageBackground
      source={require('../../assets/images/3.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.overlay}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => {}}>
            <Link href="/">
              <MaterialIcons name="arrow-back" size={24} color="#FF69B4" />
            </Link>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.mainText}>You're on the Right Track!</Text>

          <Text style={styles.motivationalText}>
            "Small steps every day lead to big results."
          </Text>

          <Text style={styles.subText}>
            Every step you take brings you closer to your fitness goals. Stay motivated, and let's keep going!
          </Text>

          <Link href="/EntryScreen" asChild>
            <TouchableOpacity style={styles.nextButton}>
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.3)', // light overlay for readability
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    paddingTop: 30,
  },
  header: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FF1493',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  mainText: {
    color: '#d6336c',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  motivationalText: {
    color: '#ff69b4',
    fontSize: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  subText: {
    color: '#7d4c5e',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 50,
    paddingHorizontal: 10,
  },
  nextButton: {
    backgroundColor: '#d63384',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    marginTop: 20,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default MessageScreen;