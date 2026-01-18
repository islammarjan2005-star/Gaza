import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Colors, Shadows } from '../utils/colors';
import { api } from '../services/api';
import { useSessionStore } from '../store/sessionStore';

interface ImpactData {
  estimatedContribution: number;
  mealsProvided: number;
  waterLiters: number;
  medicalKits: number;
}

export default function ImpactScreen() {
  const { searchCount } = useSessionStore();
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchImpact = useCallback(async () => {
    try {
      const response = await api.calculateImpact(searchCount);
      if (response.success) {
        setImpact(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch impact:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchCount]);

  useEffect(() => {
    fetchImpact();
  }, [fetchImpact]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchImpact();
  }, [fetchImpact]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[Colors.primary]}
        />
      }
    >
      {/* Search Count Hero */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Your Total Searches</Text>
        <Text style={styles.heroNumber}>{searchCount}</Text>
        <Text style={styles.heroSubtext}>Thank you for making a difference!</Text>
      </View>

      {/* Your Contribution */}
      <View style={styles.contributionCard}>
        <Text style={styles.cardTitle}>Your Estimated Contribution</Text>
        <Text style={styles.contributionAmount}>
          {formatCurrency(impact?.estimatedContribution || 0)}
        </Text>
        <Text style={styles.contributionNote}>
          Based on average revenue per search
        </Text>
      </View>

      {/* Impact Visualization */}
      <View style={styles.impactSection}>
        <Text style={styles.sectionTitle}>What Your Searches Help Provide</Text>

        <View style={styles.impactCard}>
          <View style={styles.impactIcon}>
            <Text style={styles.impactEmoji}>🍽️</Text>
          </View>
          <View style={styles.impactInfo}>
            <Text style={styles.impactNumber}>{impact?.mealsProvided || 0}</Text>
            <Text style={styles.impactLabel}>Meals for families</Text>
          </View>
        </View>

        <View style={styles.impactCard}>
          <View style={styles.impactIcon}>
            <Text style={styles.impactEmoji}>💧</Text>
          </View>
          <View style={styles.impactInfo}>
            <Text style={styles.impactNumber}>{impact?.waterLiters || 0}</Text>
            <Text style={styles.impactLabel}>Liters of clean water</Text>
          </View>
        </View>

        <View style={styles.impactCard}>
          <View style={styles.impactIcon}>
            <Text style={styles.impactEmoji}>🏥</Text>
          </View>
          <View style={styles.impactInfo}>
            <Text style={styles.impactNumber}>{impact?.medicalKits || 0}</Text>
            <Text style={styles.impactLabel}>Medical supply kits</Text>
          </View>
        </View>
      </View>

      {/* Milestones */}
      <View style={styles.milestonesSection}>
        <Text style={styles.sectionTitle}>Your Milestones</Text>

        <View style={styles.milestoneItem}>
          <View
            style={[
              styles.milestoneCheck,
              searchCount >= 1 && styles.milestoneCheckActive,
            ]}
          >
            {searchCount >= 1 && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneTitle}>First Search</Text>
            <Text style={styles.milestoneDesc}>Welcome to the community!</Text>
          </View>
        </View>

        <View style={styles.milestoneItem}>
          <View
            style={[
              styles.milestoneCheck,
              searchCount >= 10 && styles.milestoneCheckActive,
            ]}
          >
            {searchCount >= 10 && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneTitle}>Getting Started</Text>
            <Text style={styles.milestoneDesc}>10 searches completed</Text>
          </View>
        </View>

        <View style={styles.milestoneItem}>
          <View
            style={[
              styles.milestoneCheck,
              searchCount >= 50 && styles.milestoneCheckActive,
            ]}
          >
            {searchCount >= 50 && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneTitle}>Making an Impact</Text>
            <Text style={styles.milestoneDesc}>50 searches completed</Text>
          </View>
        </View>

        <View style={styles.milestoneItem}>
          <View
            style={[
              styles.milestoneCheck,
              searchCount >= 100 && styles.milestoneCheckActive,
            ]}
          >
            {searchCount >= 100 && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneTitle}>Humanitarian Hero</Text>
            <Text style={styles.milestoneDesc}>100 searches completed</Text>
          </View>
        </View>

        <View style={styles.milestoneItem}>
          <View
            style={[
              styles.milestoneCheck,
              searchCount >= 500 && styles.milestoneCheckActive,
            ]}
          >
            {searchCount >= 500 && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneTitle}>Champion of Gaza</Text>
            <Text style={styles.milestoneDesc}>500 searches completed</Text>
          </View>
        </View>
      </View>

      {/* Call to Action */}
      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>Keep Searching, Keep Helping</Text>
        <Text style={styles.ctaText}>
          Every search you make generates ad revenue that goes directly to
          humanitarian organizations providing critical aid in Gaza.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 15,
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  heroLabel: {
    color: Colors.white,
    fontSize: 14,
    opacity: 0.9,
  },
  heroNumber: {
    color: Colors.white,
    fontSize: 64,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  heroSubtext: {
    color: Colors.white,
    fontSize: 14,
    opacity: 0.8,
  },
  contributionCard: {
    backgroundColor: Colors.white,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    ...Shadows.small,
  },
  cardTitle: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 10,
  },
  contributionAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.donationGreen,
  },
  contributionNote: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 5,
  },
  impactSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 15,
  },
  impactCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...Shadows.small,
  },
  impactIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  impactEmoji: {
    fontSize: 24,
  },
  impactInfo: {
    flex: 1,
  },
  impactNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  impactLabel: {
    fontSize: 14,
    color: Colors.gray,
  },
  milestonesSection: {
    marginBottom: 20,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    ...Shadows.small,
  },
  milestoneCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  milestoneCheckActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  milestoneDesc: {
    fontSize: 13,
    color: Colors.gray,
    marginTop: 2,
  },
  ctaCard: {
    backgroundColor: Colors.secondary + '15',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.secondary + '30',
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 10,
  },
  ctaText: {
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 22,
  },
});
