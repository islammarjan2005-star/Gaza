import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Shadows } from '../utils/colors';
import { useSearchStore } from '../store/searchStore';
import { useSessionStore } from '../store/sessionStore';

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const [inputValue, setInputValue] = useState('');
  const { search, searchHistory, clearResults } = useSearchStore();
  const { searchCount } = useSessionStore();
  const incrementSearchCount = useSessionStore((state) => state.incrementSearchCount);

  const handleSearch = useCallback(async () => {
    if (!inputValue.trim()) return;

    Keyboard.dismiss();
    await search(inputValue.trim());
    incrementSearchCount();
    navigation.navigate('Results', { query: inputValue.trim() });
  }, [inputValue, search, incrementSearchCount, navigation]);

  const handleHistoryPress = useCallback((query: string) => {
    setInputValue(query);
    search(query);
    incrementSearchCount();
    navigation.navigate('Results', { query });
  }, [search, incrementSearchCount, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo and Mission */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Search</Text>
            <Text style={styles.logoSubtext}>for Gaza</Text>
          </View>
          <Text style={styles.mission}>
            Every search helps provide humanitarian aid
          </Text>
        </View>

        {/* Search Box */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search the web..."
              placeholderTextColor={Colors.gray}
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              activeOpacity={0.7}
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Counter */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{searchCount}</Text>
            <Text style={styles.statLabel}>Your searches</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>$0.003</Text>
            <Text style={styles.statLabel}>Avg. per search</Text>
          </View>
        </View>

        {/* Recent Searches */}
        {searchHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Recent Searches</Text>
            <View style={styles.historyList}>
              {searchHistory.slice(0, 5).map((query, index) => (
                <TouchableOpacity
                  key={`${query}-${index}`}
                  style={styles.historyItem}
                  onPress={() => handleHistoryPress(query)}
                >
                  <Text style={styles.historyIcon}>🔍</Text>
                  <Text style={styles.historyText} numberOfLines={1}>
                    {query}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howItWorksTitle}>How it works</Text>
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>You search the web</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>We show relevant ads</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>100% goes to Gaza relief</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  logoSubtext: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.secondary,
    marginTop: -5,
  },
  mission: {
    fontSize: 16,
    color: Colors.gray,
    marginTop: 15,
    textAlign: 'center',
  },
  searchContainer: {
    marginBottom: 25,
  },
  searchBox: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 30,
    ...Shadows.medium,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 15,
    color: Colors.black,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    ...Shadows.small,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.lightGray,
    marginHorizontal: 15,
  },
  historyContainer: {
    marginBottom: 25,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
    marginBottom: 10,
  },
  historyList: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    ...Shadows.small,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  historyIcon: {
    marginRight: 10,
  },
  historyText: {
    flex: 1,
    fontSize: 15,
    color: Colors.darkGray,
  },
  howItWorks: {
    backgroundColor: Colors.white,
    borderRadius: 15,
    padding: 20,
    ...Shadows.small,
  },
  howItWorksTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 15,
    textAlign: 'center',
  },
  stepContainer: {
    gap: 15,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 30,
    marginRight: 12,
  },
  stepText: {
    fontSize: 15,
    color: Colors.darkGray,
    flex: 1,
  },
});
