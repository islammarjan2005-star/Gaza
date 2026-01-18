import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Colors, Shadows } from '../utils/colors';
import { api } from '../services/api';

interface CharitySummary {
  id: string;
  name: string;
  logoUrl?: string;
  totalDonated: number;
  allocationPercentage: number;
  lastDonation?: string;
}

interface DisbursementSummary {
  id: string;
  charityName: string;
  period: string;
  amount: number;
  status: string;
  receiptUrl?: string;
}

interface TransparencyData {
  totalDonated: number;
  totalSearches: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  charities: CharitySummary[];
  recentDisbursements: DisbursementSummary[];
}

export default function TransparencyScreen() {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.getTransparencyData();
      if (response.success) {
        setData(response.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load transparency data');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return Colors.success;
      case 'sent':
        return Colors.info;
      case 'approved':
        return Colors.warning;
      default:
        return Colors.gray;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading transparency data...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
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
      {/* Total Impact */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total Donated to Gaza</Text>
        <Text style={styles.heroAmount}>{formatCurrency(data.totalDonated)}</Text>
        <Text style={styles.heroSubtext}>
          From {formatNumber(data.totalSearches)} searches worldwide
        </Text>
      </View>

      {/* Revenue Breakdown */}
      <View style={styles.revenueSection}>
        <Text style={styles.sectionTitle}>Revenue Overview</Text>
        <View style={styles.revenueGrid}>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Today</Text>
            <Text style={styles.revenueAmount}>
              {formatCurrency(data.todayRevenue)}
            </Text>
          </View>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>This Week</Text>
            <Text style={styles.revenueAmount}>
              {formatCurrency(data.weekRevenue)}
            </Text>
          </View>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>This Month</Text>
            <Text style={styles.revenueAmount}>
              {formatCurrency(data.monthRevenue)}
            </Text>
          </View>
        </View>
      </View>

      {/* Charity Partners */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Charity Partners</Text>
        {data.charities.map((charity) => (
          <View key={charity.id} style={styles.charityCard}>
            <View style={styles.charityInfo}>
              <Text style={styles.charityName}>{charity.name}</Text>
              <Text style={styles.charityAllocation}>
                {charity.allocationPercentage}% allocation
              </Text>
            </View>
            <View style={styles.charityStats}>
              <Text style={styles.charityTotal}>
                {formatCurrency(charity.totalDonated)}
              </Text>
              <Text style={styles.charityLabel}>received</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Recent Disbursements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Disbursements</Text>
        {data.recentDisbursements.map((disbursement) => (
          <View key={disbursement.id} style={styles.disbursementCard}>
            <View style={styles.disbursementHeader}>
              <Text style={styles.disbursementCharity}>
                {disbursement.charityName}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(disbursement.status) },
                ]}
              >
                <Text style={styles.statusText}>{disbursement.status}</Text>
              </View>
            </View>
            <View style={styles.disbursementDetails}>
              <Text style={styles.disbursementAmount}>
                {formatCurrency(disbursement.amount)}
              </Text>
              <Text style={styles.disbursementPeriod}>
                {disbursement.period}
              </Text>
            </View>
            {disbursement.receiptUrl && (
              <TouchableOpacity
                style={styles.receiptLink}
                onPress={() => Linking.openURL(disbursement.receiptUrl!)}
              >
                <Text style={styles.receiptLinkText}>View Receipt</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Trust Statement */}
      <View style={styles.trustSection}>
        <Text style={styles.trustTitle}>Our Commitment</Text>
        <Text style={styles.trustText}>
          100% of ad revenue share goes directly to vetted humanitarian
          organizations providing aid in Gaza. We publish monthly transparency
          reports and upload donation receipts for complete accountability.
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.gray,
  },
  errorText: {
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  heroLabel: {
    color: Colors.white,
    fontSize: 14,
    opacity: 0.9,
  },
  heroAmount: {
    color: Colors.white,
    fontSize: 36,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  heroSubtext: {
    color: Colors.white,
    fontSize: 13,
    opacity: 0.8,
  },
  revenueSection: {
    backgroundColor: Colors.white,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    ...Shadows.small,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 15,
  },
  revenueGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  revenueItem: {
    alignItems: 'center',
    flex: 1,
  },
  revenueLabel: {
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 5,
  },
  revenueAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.donationGreen,
  },
  section: {
    marginBottom: 20,
  },
  charityCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadows.small,
  },
  charityInfo: {
    flex: 1,
  },
  charityName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  charityAllocation: {
    fontSize: 13,
    color: Colors.gray,
    marginTop: 2,
  },
  charityStats: {
    alignItems: 'flex-end',
  },
  charityTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.donationGreen,
  },
  charityLabel: {
    fontSize: 12,
    color: Colors.gray,
  },
  disbursementCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    ...Shadows.small,
  },
  disbursementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  disbursementCharity: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkGray,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  disbursementDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  disbursementAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.donationGreen,
  },
  disbursementPeriod: {
    fontSize: 14,
    color: Colors.gray,
  },
  receiptLink: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  receiptLinkText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  trustSection: {
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  trustTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 10,
  },
  trustText: {
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 22,
  },
});
