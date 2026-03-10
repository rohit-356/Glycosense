/**
 * mobile/components/ConfidenceFallback.tsx
 * -----------------------------------------
 * Rendered in place of the meal scan result when the API returns
 * { status: "low_confidence" }. Presents a friendly text input so
 * the user can manually name the food instead of facing a dead end.
 *
 * Usage:
 *   import ConfidenceFallback from '../components/ConfidenceFallback';
 *
 *   // In your scan screen, after receiving the API response:
 *   if (apiResponse.status === 'low_confidence') {
 *     return (
 *       <ConfidenceFallback
 *         onSubmit={(foodName) => handleManualFood(foodName)}
 *       />
 *     );
 *   }
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

// ---------------------------------------------------------------------------
// Prop Types
// ---------------------------------------------------------------------------

export interface ConfidenceFallbackProps {
  /**
   * Called when the user submits a manual food name.
   * The trimmed, non-empty string is passed as the argument.
   */
  onSubmit: (foodName: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ConfidenceFallback — shown when meal scan returns low_confidence.
 * Provides a warm, friendly text input so the user can manually
 * identify the food and keep the logging flow uninterrupted.
 */
export default function ConfidenceFallback({ onSubmit }: ConfidenceFallbackProps) {
  const [foodName, setFoodName] = useState('');

  function handleSubmit() {
    const trimmed = foodName.trim();
    if (!trimmed) return;   // Don't submit empty input
    onSubmit(trimmed);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Friendly prompt */}
      <Text style={styles.emoji}>🍽️</Text>
      <Text style={styles.heading}>
        We couldn't quite make that out!
      </Text>
      <Text style={styles.subheading}>
        What food is this?
      </Text>

      {/* Manual text input */}
      <TextInput
        style={styles.input}
        value={foodName}
        onChangeText={setFoodName}
        placeholder="e.g. Brown rice, Grilled salmon…"
        placeholderTextColor="#AEAEB2"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        autoFocus
        autoCapitalize="words"
        autoCorrect
      />

      {/* Submit button — disabled until user types something */}
      <TouchableOpacity
        style={[styles.button, !foodName.trim() && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!foodName.trim()}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>That's this food →</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FAFAFA',
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 17,
    fontWeight: '500',
    color: '#636366',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#D1D1D6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 17,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  button: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#A2CFFE',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
