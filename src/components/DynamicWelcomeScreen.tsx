
import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { apiRequest } from '@/services/api';

type WelcomeSettings = {
  title: string;
  image_url: string;
  is_enabled: boolean;
  display_duration: number;
};

type Props = {
  onFinish: () => void;
};

export default function DynamicWelcomeScreen({
  onFinish,
}: Props) {
  const [settings, setSettings] =
    useState<WelcomeSettings | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadWelcomeScreen = async () => {
      try {
        // Prevent a slow API from blocking app startup.
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Welcome API timeout')),
            5000
          );
        });

        const response = await Promise.race([
          apiRequest('/welcome-screen'),
          timeout,
        ]) as {
          success: boolean;
          data: WelcomeSettings | null;
        };

        if (!active) return;

        if (
          !response.success ||
          !response.data?.is_enabled ||
          !response.data.image_url
        ) {
          onFinish();
          return;
        }

        const welcome = response.data;

        setSettings(welcome);
        setLoading(false);

        if (timer) clearTimeout(timer);

        timer = setTimeout(
          () => {
            if (active) onFinish();
          },
          Math.max(
            2,
            Math.min(10, welcome.display_duration || 3)
          ) * 1000
        );
      } catch (error) {
        console.log(
          'Welcome screen unavailable:',
          error
        );

        if (active) onFinish();
      }
    };

    void loadWelcomeScreen();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="#FFFDF8"
        barStyle="dark-content"
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#6B1720"
        />
      ) : (
        <>
          {settings?.image_url && (
            <Image
              source={{ uri: settings.image_url }}
              style={styles.image}
              resizeMode="contain"
            />
          )}

          {Boolean(settings?.title) && (
            <Text style={styles.title}>
              {settings?.title}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 30,
  },

  image: {
    width: '100%',
    height: '75%',
  },

  title: {
    color: '#6B1720',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 32,
  },
});
