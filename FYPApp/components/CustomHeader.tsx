import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';

type CustomHeaderProps = {
  heading: string;
  icon?: string; // URL or path to the icon image, optional
  username: string;
  showBackButton: boolean;
  onBackPress?: () => void; // Custom back press handler
};

const CustomHeader: React.FC<CustomHeaderProps> = ({ heading, icon, username, showBackButton, onBackPress }) => {
  const router = useRouter();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back(); // Fallback to default back behavior
    }
  };

  return (
    <View style={styles.headerContainer}>
      {showBackButton && (
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      <View style={styles.titleContainer}>
        <Text style={styles.heading}>{heading}</Text>
        {icon ? (
          <Image source={{ uri: icon }} style={styles.icon} />
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
      <Text style={styles.username}>{username || 'Guest'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#d63384',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 8,
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
  },
  username: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});

export default CustomHeader;