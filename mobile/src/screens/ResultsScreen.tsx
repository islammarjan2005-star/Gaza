import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Colors, Shadows } from '../utils/colors';
import { useSearchStore, SearchResult, Ad } from '../store/searchStore';
import { api } from '../services/api';

interface RouteParams {
  query: string;
}

export default function ResultsScreen() {
  const route = useRoute();
  const { query } = route.params as RouteParams;
  const {
    results,
    ads,
    relatedSearches,
    isLoading,
    error,
    totalResults,
    search,
    loadMore,
  } = useSearchStore();

  useEffect(() => {
    if (results.length === 0 && query) {
      search(query);
    }
  }, [query]);

  const handleResultPress = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  }, []);

  const handleAdPress = useCallback(async (ad: Ad) => {
    try {
      // Track impression view time
      api.reportImpression(ad.impressionId, Date.now());

      // Open click tracking URL (redirects to destination)
      await Linking.openURL(ad.clickUrl);
    } catch (error) {
      console.error('Failed to open ad:', error);
    }
  }, []);

  const handleRelatedSearch = useCallback((relatedQuery: string) => {
    search(relatedQuery);
  }, [search]);

  const renderAd = useCallback(({ item }: { item: Ad }) => (
    <TouchableOpacity
      style={styles.adCard}
      onPress={() => handleAdPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>Ad</Text>
      </View>
      <Text style={styles.adTitle}>{item.title}</Text>
      <Text style={styles.adUrl}>{item.displayUrl}</Text>
      <Text style={styles.adDescription} numberOfLines={2}>
        {item.description}
      </Text>
    </TouchableOpacity>
  ), [handleAdPress]);

  const renderResult = useCallback(({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => handleResultPress(item.url)}
      activeOpacity={0.7}
    >
      <Text style={styles.resultUrl}>{item.displayUrl}</Text>
      <Text style={styles.resultTitle}>{item.name}</Text>
      <Text style={styles.resultSnippet} numberOfLines={3}>
        {item.snippet.replace(/<[^>]*>/g, '')}
      </Text>
    </TouchableOpacity>
  ), [handleResultPress]);

  const renderHeader = useCallback(() => (
    <View>
      {/* Ads section */}
      {ads.length > 0 && (
        <View style={styles.adsSection}>
          {ads.map((ad) => renderAd({ item: ad }))}
          <Text style={styles.adDisclaimer}>
            100% of ad revenue goes to Gaza humanitarian aid
          </Text>
        </View>
      )}

      {/* Results count */}
      <Text style={styles.resultsCount}>
        About {totalResults.toLocaleString()} results
      </Text>
    </View>
  ), [ads, totalResults, renderAd]);

  const renderFooter = useCallback(() => {
    if (!isLoading) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }, [isLoading]);

  const renderRelatedSearches = useCallback(() => {
    if (relatedSearches.length === 0) return null;

    return (
      <View style={styles.relatedSection}>
        <Text style={styles.relatedTitle}>Related searches</Text>
        <View style={styles.relatedList}>
          {relatedSearches.slice(0, 6).map((related, index) => (
            <TouchableOpacity
              key={index}
              style={styles.relatedItem}
              onPress={() => handleRelatedSearch(related)}
            >
              <Text style={styles.relatedText}>{related}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }, [relatedSearches, handleRelatedSearch]);

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => search(query)}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && results.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Searching...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={results}
        renderItem={renderResult}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No results found</Text>
          </View>
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && results.length > 0}
            onRefresh={() => search(query)}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
      />
      {renderRelatedSearches()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
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
    fontSize: 16,
    color: Colors.gray,
  },
  errorText: {
    fontSize: 16,
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
  adsSection: {
    marginBottom: 15,
  },
  adCard: {
    backgroundColor: Colors.adBackground,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.adBorder,
  },
  adLabel: {
    backgroundColor: Colors.secondary,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  adLabelText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  adTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  adUrl: {
    fontSize: 12,
    color: Colors.success,
    marginBottom: 6,
  },
  adDescription: {
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 20,
  },
  adDisclaimer: {
    fontSize: 11,
    color: Colors.donationGreen,
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
  },
  resultsCount: {
    fontSize: 13,
    color: Colors.gray,
    marginBottom: 15,
  },
  resultCard: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    ...Shadows.small,
  },
  resultUrl: {
    fontSize: 12,
    color: Colors.success,
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 6,
  },
  resultSnippet: {
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 20,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray,
  },
  relatedSection: {
    backgroundColor: Colors.white,
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  relatedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
    marginBottom: 10,
  },
  relatedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relatedItem: {
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  relatedText: {
    fontSize: 13,
    color: Colors.primary,
  },
});
