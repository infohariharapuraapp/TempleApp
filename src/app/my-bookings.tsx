
import React from 'react';

import {
  Redirect,
} from 'expo-router';

// ========================================
// MY BOOKINGS
// Both room and pooja bookings use
// the temple website profile.
// ========================================

export default function MyBookingsScreen() {
  return (
    <Redirect href="/website-bookings" />
  );
}
