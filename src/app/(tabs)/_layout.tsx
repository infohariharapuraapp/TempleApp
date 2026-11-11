
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import type { AppLanguage } from '@/localization/i18n';

// ========================================
// COLORS - EXISTING DESIGN
// ========================================

const COLORS = {
  background: '#FFFDF8',
  selectedBackground: '#F7EBD7',
  maroon: '#6B1720',
  maroonDark: '#541018',
  gold: '#C69A3A',
  goldSoft: '#D8B766',
  inactive: '#8E8175',
  border: '#E8DCCB',
};

// ========================================
// BOTTOM TAB TRANSLATIONS
// ========================================

const TAB_LABELS: Record<
  AppLanguage,
  {
    home: string;
    deities: string;
    pooja: string;
    activities: string;
    menu: string;
  }
> = {
  en: {
    home: 'Home',
    deities: 'Deities',
    pooja: 'Pooja',
    activities: 'Activities',
    menu: 'Menu',
  },

  te: {
    home: 'హోమ్',
    deities: 'దేవతలు',
    pooja: 'పూజ',
    activities: 'కార్యక్రమాలు',
    menu: 'మెనూ',
  },

  kn: {
    home: 'ಮುಖಪುಟ',
    deities: 'ದೇವತೆಗಳು',
    pooja: 'ಪೂಜೆ',
    activities: 'ಚಟುವಟಿಕೆಗಳು',
    menu: 'ಮೆನು',
  },

  hi: {
    home: 'होम',
    deities: 'देवता',
    pooja: 'पूजा',
    activities: 'गतिविधियाँ',
    menu: 'मेनू',
  },

  ta: {
    home: 'முகப்பு',
    deities: 'தெய்வங்கள்',
    pooja: 'பூஜை',
    activities: 'செயல்பாடுகள்',
    menu: 'மெனு',
  },
};

// ========================================
// NORMALIZE LANGUAGE
// ========================================

function getAppLanguage(language: string): AppLanguage {
  const code = language.toLowerCase().split('-')[0];

  if (
    code === 'en' ||
    code === 'te' ||
    code === 'kn' ||
    code === 'hi' ||
    code === 'ta'
  ) {
    return code;
  }

  return 'en';
}

// ========================================
// MAIN TAB NAVIGATION
// ========================================

export default function AppTabs() {
  const { i18n } = useTranslation();

  const language = getAppLanguage(
    i18n.resolvedLanguage ||
      i18n.language ||
      'en'
  );

  const labels = TAB_LABELS[language];

  return (
    <NativeTabs
      backgroundColor={COLORS.background}
      indicatorColor={COLORS.gold}
      iconColor={{
        default: COLORS.inactive,
        selected: COLORS.maroon,
      }}
      labelStyle={{
        default: {
          color: COLORS.inactive,
          fontSize: 11,
          fontWeight: '600',
        },
        selected: {
          color: COLORS.maroon,
          fontSize: 11,
          fontWeight: '800',
        },
      }}
      blurEffect="systemMaterialLight"
      disableTransparentOnScrollEdge
      minimizeBehavior="never"
    >
      {/* HOME */}

      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>
          {labels.home}
        </NativeTabs.Trigger.Label>

        <NativeTabs.Trigger.Icon
          sf={{
            default: 'house',
            selected: 'house.fill',
          }}
          md={{
            default: 'home',
            selected: 'home',
          }}
        />
      </NativeTabs.Trigger>

      {/* DEITIES */}

      <NativeTabs.Trigger name="deities">
        <NativeTabs.Trigger.Label>
          {labels.deities}
        </NativeTabs.Trigger.Label>

        <NativeTabs.Trigger.Icon
          sf={{
            default: 'building.columns',
            selected: 'building.columns.fill',
          }}
          md={{
            default: 'temple_hindu',
            selected: 'temple_hindu',
          }}
        />
      </NativeTabs.Trigger>

      {/* POOJA */}

      <NativeTabs.Trigger name="pooja">
        <NativeTabs.Trigger.Label>
          {labels.pooja}
        </NativeTabs.Trigger.Label>

        <NativeTabs.Trigger.Icon
          sf={{
            default: 'camera.macro',
            selected: 'camera.macro',
          }}
          md={{
            default: 'filter_vintage',
            selected: 'filter_vintage',
          }}
        />
      </NativeTabs.Trigger>

      {/* ACTIVITIES */}

      <NativeTabs.Trigger name="activities">
        <NativeTabs.Trigger.Label>
          {labels.activities}
        </NativeTabs.Trigger.Label>

        <NativeTabs.Trigger.Icon
          sf={{
            default: 'calendar',
            selected: 'calendar.circle.fill',
          }}
          md={{
            default: 'event',
            selected: 'event',
          }}
        />
      </NativeTabs.Trigger>

      {/* MENU */}

      <NativeTabs.Trigger name="menu">
        <NativeTabs.Trigger.Label>
          {labels.menu}
        </NativeTabs.Trigger.Label>

        <NativeTabs.Trigger.Icon
          sf={{
            default: 'square.grid.2x2',
            selected: 'square.grid.2x2.fill',
          }}
          md={{
            default: 'apps',
            selected: 'apps',
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
