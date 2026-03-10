/**
 * mobile/components/DisclaimerBadge.tsx
 * ---------------------------------------
 * Reusable disclaimer badge rendered at the bottom of every recommendation
 * screen. Intentionally low-profile — small grey text, non-intrusive.
 *
 * Usage:
 *   import DisclaimerBadge from '../components/DisclaimerBadge';
 *   // Inside your screen's return, at the very bottom:
 *   <DisclaimerBadge />
 */

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';

/**
 * DisclaimerBadge — a small, quiet footer note reminding users that
 * recommendations are AI-generated and not a substitute for medical advice.
 * Intentionally unobtrusive: rendered in muted grey, small font size.
 */
export default function DisclaimerBadge() {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.text}>
        AI-generated from recent research. Not medical advice.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 11,
    color: '#AEAEB2',          // iOS system grey-3 — readable but unobtrusive
    textAlign: 'center',
    lineHeight: 16,
    letterSpacing: 0.1,
  },
});
