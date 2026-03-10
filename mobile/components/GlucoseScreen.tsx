import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-scale-rn'; 
// NOTE: Assuming standard React Native / Expo imports context.
// In actual Expo project: `import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';`
import { View as RNView, Text as RNText, StyleSheet as RNStyleSheet, TouchableOpacity as RNTouchableOpacity, ActivityIndicator as RNActivityIndicator, Alert as RNAlert } from 'react-native';

import Slider from '@react-native-community/slider';
import { logGlucoseReading, getRecentReadings, GlucoseReading } from '../services/glucoseService';

// ---------------------------------------------------------------------------
// Prop Types
// ---------------------------------------------------------------------------

export interface GlucoseScreenProps {
  /** The UUID of the currently authenticated user */
  userId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a friendly status message and theme color based on the glucose value.
 */
function getGlucoseStatus(value: number): { message: string; color: string } {
  if (value >= 180) {
    return { message: "🔴 High glucose — let's make a smart choice", color: '#FF3B30' };
  }
  if (value >= 126) {
    return { message: "🟠 Elevated — food choices matter right now", color: '#FF9500' };
  }
  if (value >= 100) {
    return { message: "🟡 Slightly elevated, let's be mindful", color: '#FFCC00' };
  }
  // 70 - 99
  return { message: "🟢 You're in a great range!", color: '#34C759' };
}

/**
 * Formats an ISO datetime string into a human-friendly relative time (e.g. "2 hours ago").
 * Extremely simple formatter for MVP purposes.
 */
function formatTimeAgo(isoString: string): string {
  const diffHours = Math.round((Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60));
  if (diffHours === 0) return 'Just now';
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${Math.floor(diffHours / 24)} days ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * GlucoseScreen: A friendly, supportive interface for patients to log their
 * current glucose reading. Features an interactive slider, dynamic coaching
 * messages based on range, and visual history of recent readings.
 * Handles loading/error states explicitly.
 */
export default function GlucoseScreen({ userId }: GlucoseScreenProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [value, setValue] = useState<number>(100);
  const [isLogging, setIsLogging] = useState<boolean>(false);
  
  // History list state
  const [history, setHistory] = useState<GlucoseReading[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ── Callbacks ──────────────────────────────────────────────────────────

  /**
   * Fetches the 3 most recent historical readings on mount.
   */
  useEffect(() => {
    let mounted = true;

    async function loadHistory() {
      setIsHistoryLoading(true);
      setHistoryError(null);
      const result = await getRecentReadings(userId, 3);
      if (mounted) {
        if (result.success) {
          setHistory(result.data);
        } else {
          setHistoryError("We couldn't load your past readings right now.");
        }
        setIsHistoryLoading(false);
      }
    }
    
    loadHistory();
    return () => { mounted = false; };
  }, [userId]);

  /**
   * Submits the chosen glucose value to the backend.
   * Handles UI loading spinner and alerts on both success and error.
   */
  async function handleLogReading() {
    setIsLogging(true);
    
    const result = await logGlucoseReading({
      userId,
      value,
      isSimulated: true, // Specific requirement from rules
      timestamp: new Date().toISOString(),
    });

    setIsLogging(false);

    if (result.success) {
      RNAlert.alert("Awesome!", "Your reading has been safely logged.");
      // Optimistically push to local history list instead of a full refetch
      const newEntry: GlucoseReading = {
        id: result.data.reading_id || String(Date.now()),
        value,
        timestamp: new Date().toISOString(),
      };
      setHistory(prev => [newEntry, ...prev].slice(0, 3));
    } else {
      RNAlert.alert("Oops!", `We couldn't log that reading. ${result.error}`);
    }
  }

  // ── Render Helpers ──────────────────────────────────────────────────────
  
  const status = getGlucoseStatus(value);

  // ── UI ──────────────────────────────────────────────────────────────────
  return (
    <RNView style={styles.container}>
      {/* Header */}
      <RNText style={styles.title}>How are you doing?</RNText>
      
      {/* Glucose Value Display */}
      <RNView style={styles.valueContainer}>
        <RNText style={[styles.largeNumber, { color: status.color }]}>
          {value}
        </RNText>
        <RNText style={styles.unitText}>mg/dL</RNText>
      </RNView>

      {/* Friendly Status Map */}
      <RNText style={[styles.statusMessage, { color: status.color }]}>
        {status.message}
      </RNText>

      {/* Slider */}
      <RNView style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={70}
          maximumValue={400}
          step={1}
          value={value}
          onValueChange={setValue}
          minimumTrackTintColor={status.color} // Dynamic coloring
          maximumTrackTintColor="#DDDDDD"
          thumbTintColor={status.color}
        />
        <RNView style={styles.sliderLabels}>
          <RNText style={styles.sliderLabelText}>70</RNText>
          <RNText style={styles.sliderLabelText}>400</RNText>
        </RNView>
      </RNView>

      {/* Action Button */}
      <RNTouchableOpacity 
        style={[styles.logButton, isLogging && styles.logButtonDisabled]}
        onPress={handleLogReading}
        disabled={isLogging}
        activeOpacity={0.8}
      >
        {isLogging ? (
          <RNActivityIndicator color="#fff" />
        ) : (
          <RNText style={styles.logButtonText}>Log Reading</RNText>
        )}
      </RNTouchableOpacity>

      {/* History Section */}
      <RNView style={styles.historyContainer}>
        <RNText style={styles.historyTitle}>Recent Readings</RNText>
        
        {isHistoryLoading && (
          <RNActivityIndicator size="small" color="#999" style={styles.historyLoader} />
        )}
        
        {!isHistoryLoading && historyError && (
          <RNText style={styles.historyError}>{historyError}</RNText>
        )}

        {!isHistoryLoading && !historyError && history.length === 0 && (
          <RNText style={styles.historyEmpty}>No recent readings. You're off to a fresh start!</RNText>
        )}

        {!isHistoryLoading && !historyError && history.map((reading) => (
          <RNView key={reading.id} style={styles.historyCard}>
            <RNView style={styles.historyValueBadge}>
              <RNText style={styles.historyCardValue}>{reading.value}</RNText>
              <RNText style={styles.historyCardUnit}>mg/dL</RNText>
            </RNView>
            <RNText style={styles.historyCardTime}>
              {formatTimeAgo(reading.timestamp)}
            </RNText>
          </RNView>
        ))}
      </RNView>
    </RNView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = RNStyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 32,
    textAlign: 'center',
    marginTop: 40,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 16,
  },
  largeNumber: {
    fontSize: 72,
    fontWeight: '800',
    letterSpacing: -2,
  },
  unitText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8e8e93',
    marginLeft: 8,
  },
  statusMessage: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 48,
    paddingHorizontal: 16,
  },
  sliderContainer: {
    marginBottom: 48,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  sliderLabelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A0A0A0',
  },
  logButton: {
    backgroundColor: '#007AFF', // Friendly reliable blue
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 40,
  },
  logButtonDisabled: {
    backgroundColor: '#A2CFFE',
    shadowOpacity: 0,
    elevation: 0,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  historyContainer: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  historyLoader: {
    marginTop: 20,
  },
  historyError: {
    fontSize: 15,
    color: '#FF3B30',
    fontStyle: 'italic',
  },
  historyEmpty: {
    fontSize: 15,
    color: '#8e8e93',
    fontStyle: 'italic',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  historyValueBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  historyCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  historyCardUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8e8e93',
    marginLeft: 4,
  },
  historyCardTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A0A0A0',
  },
});
