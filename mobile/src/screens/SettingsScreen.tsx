import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { Colors, Shadows } from '../utils/colors';
import { api } from '../services/api';
import { useSessionStore } from '../store/sessionStore';

export default function SettingsScreen() {
  const [safeSearch, setSafeSearch] = useState<'moderate' | 'strict'>('moderate');
  const [notifications, setNotifications] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const { searchCount } = useSessionStore();

  const handleSafeSearchChange = useCallback((value: boolean) => {
    setSafeSearch(value ? 'strict' : 'moderate');
  }, []);

  const handleExportData = useCallback(async () => {
    setExportLoading(true);
    try {
      const response = await api.exportUserData();
      if (response.success) {
        Alert.alert(
          'Data Export',
          'Your data has been exported. Since we don\'t store personal information, the export only contains anonymized search statistics.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }, []);

  const handleDeleteData = useCallback(() => {
    Alert.alert(
      'Delete Your Data',
      'This will delete all your search history and reset your impact counter. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteUserData();
              Alert.alert('Success', 'Your data has been deleted.');
            } catch {
              Alert.alert('Error', 'Failed to delete data. Please try again.');
            }
          },
        },
      ]
    );
  }, []);

  const openLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Search Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search Settings</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Strict SafeSearch</Text>
            <Text style={styles.settingDesc}>
              Filter explicit content from results
            </Text>
          </View>
          <Switch
            value={safeSearch === 'strict'}
            onValueChange={handleSafeSearchChange}
            trackColor={{ false: Colors.lightGray, true: Colors.primaryLight }}
            thumbColor={safeSearch === 'strict' ? Colors.primary : Colors.gray}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Impact Notifications</Text>
            <Text style={styles.settingDesc}>
              Get notified about your donation milestones
            </Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: Colors.lightGray, true: Colors.primaryLight }}
            thumbColor={notifications ? Colors.primary : Colors.gray}
          />
        </View>
      </View>

      {/* Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>

        <View style={styles.privacyNote}>
          <Text style={styles.privacyNoteTitle}>Your Privacy Matters</Text>
          <Text style={styles.privacyNoteText}>
            We do not track you personally. We don't store your actual search
            queries - only anonymized statistics to calculate donation amounts.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleExportData}
          disabled={exportLoading}
        >
          <Text style={styles.actionLabel}>
            {exportLoading ? 'Exporting...' : 'Export Your Data'}
          </Text>
          <Text style={styles.actionIcon}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionItem, styles.destructiveItem]}
          onPress={handleDeleteData}
        >
          <Text style={styles.destructiveLabel}>Delete Your Data</Text>
          <Text style={styles.actionIcon}>→</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => openLink('https://ecosia-for-gaza.org/about')}
        >
          <Text style={styles.actionLabel}>About Ecosia for Gaza</Text>
          <Text style={styles.actionIcon}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => openLink('https://ecosia-for-gaza.org/charities')}
        >
          <Text style={styles.actionLabel}>Our Charity Partners</Text>
          <Text style={styles.actionIcon}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => openLink('https://ecosia-for-gaza.org/privacy')}
        >
          <Text style={styles.actionLabel}>Privacy Policy</Text>
          <Text style={styles.actionIcon}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => openLink('https://ecosia-for-gaza.org/terms')}
        >
          <Text style={styles.actionLabel}>Terms of Service</Text>
          <Text style={styles.actionIcon}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.statsTitle}>Your Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statsItem}>
            <Text style={styles.statsNumber}>{searchCount}</Text>
            <Text style={styles.statsLabel}>Total Searches</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsNumber}>
              ${(searchCount * 0.003).toFixed(2)}
            </Text>
            <Text style={styles.statsLabel}>Est. Contribution</Text>
          </View>
        </View>
      </View>

      {/* Version Info */}
      <View style={styles.versionSection}>
        <Text style={styles.versionText}>Ecosia for Gaza v1.0.0</Text>
        <Text style={styles.copyrightText}>
          Made with ❤️ for humanitarian aid
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
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    ...Shadows.small,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.darkGray,
  },
  settingDesc: {
    fontSize: 13,
    color: Colors.gray,
    marginTop: 2,
  },
  privacyNote: {
    backgroundColor: Colors.primaryLight + '15',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  privacyNoteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
  },
  privacyNoteText: {
    fontSize: 13,
    color: Colors.darkGray,
    lineHeight: 20,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    ...Shadows.small,
  },
  actionLabel: {
    fontSize: 16,
    color: Colors.primary,
  },
  actionIcon: {
    fontSize: 18,
    color: Colors.gray,
  },
  destructiveItem: {
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  destructiveLabel: {
    fontSize: 16,
    color: Colors.error,
  },
  statsSection: {
    backgroundColor: Colors.white,
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    ...Shadows.small,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
    marginBottom: 15,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statsItem: {
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statsLabel: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 4,
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 14,
    color: Colors.gray,
  },
  copyrightText: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 4,
  },
});
