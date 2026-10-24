import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Image,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import styles from './about.styles';

export default function AboutScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* =====================================================
            HERO
        ====================================================== */}

        <View style={styles.heroSection}>

          <Text style={styles.smallLabel}>
            {t('aboutDetails.text001')}
          </Text>

          <Text style={styles.mainTitle}>
            {t('aboutDetails.text002')}
          </Text>

          <Text style={styles.highlightTitle}>
            {t('aboutDetails.text003')}
          </Text>

          <Text style={styles.heroDescription}>
            {t('aboutDetails.text004')}
          </Text>

        </View>


        {/* =====================================================
            HERO IMAGE
        ====================================================== */}

        <Image
          source={{
            uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/others/11.jpg',
          }}
          style={styles.heroImage}
        />


        {/* =====================================================
            INTRODUCTION
        ====================================================== */}

        <View style={styles.introductionCard}>

          <Text style={styles.om}>
            ॐ
          </Text>

          <Text style={styles.cardTitle}>
            {t('aboutDetails.text006')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text007')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text008')}
          </Text>

        </View>


        {/* =====================================================
            SECTION 1
        ====================================================== */}

        <SectionHeading
          number="01"
          title={t('aboutDetails.section1Title')}
          subtitle={t('aboutDetails.section1Subtitle')}
        />

        {/* YAGA BHOOMI */}

        <View style={styles.sectionCard}>

          <Text style={styles.sectionIcon}>
            🔥
          </Text>

          <Text style={styles.subTitle}>
            {t('aboutDetails.text010')}
          </Text>

          <Text style={styles.subHeading}>
            {t('aboutDetails.text011')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text012')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text013')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text014')}
          </Text>

          <Image
            source={{
              uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/about/yagabhumi.png',
            }}
            style={[styles.sectionImage, { width: '100%', height: 220, alignSelf: 'center' }]}
            resizeMode="contain"
          />

        </View>


        {/* TAPO BHOOMI */}

        <View style={styles.sectionCard}>

          <Text style={styles.sectionIcon}>
            🧘
          </Text>

          <Text style={styles.subTitle}>
            {t('aboutDetails.text016')}
          </Text>

          <Text style={styles.subHeading}>
            {t('aboutDetails.text017')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text018')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text019')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text020')}
          </Text>

          <Image
            source={{
              uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/about/tapobhumi.png',
            }}
            style={styles.sectionImage}
          />

        </View>


        {/* JNANA BHOOMI */}

        <View style={styles.sectionCard}>

          <Text style={styles.sectionIcon}>
            📖
          </Text>

          <Text style={styles.subTitle}>
            {t('aboutDetails.text022')}
          </Text>

          <Text style={styles.subHeading}>
            {t('aboutDetails.text023')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text024')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text025')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text026')}
          </Text>

          <Image
            source={{
              uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/about/jnanabhumi-1.png',
            }}
            style={[styles.sectionImage, { width: '100%', height: 220, alignSelf: 'center' }]}
            resizeMode="contain"
          />

        </View>


        {/* =====================================================
            SECTION 2
        ====================================================== */}

        <SectionHeading
          number="02"
          title={t('aboutDetails.section2Title')}
          subtitle={t('aboutDetails.section2Subtitle')}
        />

        <View style={styles.sectionCard}>

          <Text style={styles.subTitle}>
            {t('aboutDetails.text027')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text028')}
          </Text>

        </View>


        {/* ROYAL PATRONAGE */}

        <View style={styles.sectionCard}>

          <Text style={styles.subTitle}>
            {t('aboutDetails.text029')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text030')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text031')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text032')}
          </Text>

        </View>


        {/* PEETAM TODAY */}

        <View style={styles.sectionCard}>

          <Text style={styles.subTitle}>
            {t('aboutDetails.text033')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text034')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text035')}
          </Text>

        </View>


        {/* =====================================================
            GURU PARAMPARA
        ====================================================== */}

        <View style={styles.guruCard}>

          <Text style={styles.guruLabel}>
            {t('aboutDetails.text036')}
          </Text>

          <Text style={styles.sanskrit}>
            सदाशिवसमारम्भां शङ्कराचार्यमध्यमाम् ।
          </Text>

          <Text style={styles.sanskrit}>
            अस्मदाचार्यपर्यन्तां वन्दे गुरुपरम्पराम् ॥
          </Text>

          <Image
            source={{
              uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/guru-parampara/guru-parampara-1920.jpg',
            }}
            style={styles.guruImage}
          />

          <GuruItem
            name="Sri Swayamprakasha Krishna Yogeendra Saraswathi MahaSwamiji"
            image="https://www.divyakshetrahariharapura.com/web/assets/img/guru-parampara/g1.jpg"
          />

          <GuruItem
            name="Sri Swayamprakasha Abhinava Ramananda Saraswathi MahaSwamiji"
            image="https://www.divyakshetrahariharapura.com/web/assets/img/guru-parampara/g2.jpg"
          />

          <GuruItem
            name="Sri Swayamprakasha Ramananda Saraswathi MahaSwamiji – III"
            image="https://www.divyakshetrahariharapura.com/web/assets/img/guru-parampara/g3.jpg"
          />

        </View>


        {/* =====================================================
            PRESENT JAGADGURU
        ====================================================== */}

        <SectionHeading
          number="03"
          title={t('aboutDetails.section3Title')}
          subtitle={t('aboutDetails.section3Subtitle')}
        />

        <View style={styles.sectionCard}>

          <Image
            source={{
              uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/about/swamiji.jpg',
            }}
            style={styles.swamijiImage}
          />

          <Text style={styles.subTitle}>
            Parama Poojya Sri Sri Swayamprakasha
            Sachidananda Saraswati Mahaswamiji
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text040')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text041')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text042')}
          </Text>

        </View>


        {/* =====================================================
            SECTION 4
        ====================================================== */}

        <SectionHeading
          number="04"
          title={t('aboutDetails.section4Title')}
          subtitle={t('aboutDetails.section4Subtitle')}
        />


        {/* TUNGA */}

        <View style={styles.featureCard}>

          <Text style={styles.featureIcon}>
            🌊
          </Text>

          <Text style={styles.featureTitle}>
            {t('aboutDetails.text044')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text045')}
          </Text>

        </View>


        {/* VAJRASTHAMBHA */}

        <View style={styles.featureCard}>

          <Text style={styles.featureIcon}>
            🛕
          </Text>

          <Text style={styles.featureTitle}>
            {t('aboutDetails.text047')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text048')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text049')}
          </Text>

        </View>


        {/* DUAL SANCTUMS */}

        <View style={styles.featureCard}>

          <Text style={styles.featureIcon}>
            🪔
          </Text>

          <Text style={styles.featureTitle}>
            {t('aboutDetails.text051')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text052')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text053')}
          </Text>

        </View>


        {/* =====================================================
            SECTION 5
        ====================================================== */}

        <SectionHeading
          number="05"
          title={t('aboutDetails.section5Title')}
          subtitle={t('aboutDetails.section5Subtitle')}
        />

        <View style={styles.locationCard}>

          <Text style={styles.featureIcon}>
            📍
          </Text>

          <Text style={styles.featureTitle}>
            {t('aboutDetails.text055')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text056')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text057')}
          </Text>

        </View>


        {/* DAILY RITUALS */}

        <View style={styles.sectionCard}>

          <Text style={styles.subTitle}>
            {t('aboutDetails.text058')}
          </Text>

          <ServiceRow
            icon="🪔"
            title={t('aboutDetails.seva1Title')}
            description={t('aboutDetails.seva1Description')}
          />

          <ServiceRow
            icon="🔥"
            title={t('aboutDetails.seva2Title')}
            description={t('aboutDetails.seva2Description')}
          />

          <ServiceRow
            icon="🍚"
            title={t('aboutDetails.seva3Title')}
            description={t('aboutDetails.seva3Description')}
          />

          <ServiceRow
            icon="🐄"
            title={t('aboutDetails.seva4Title')}
            description={t('aboutDetails.seva4Description')}
          />

        </View>


        {/* PILGRIMAGE */}

        <View style={styles.sectionCard}>

          <Text style={styles.subTitle}>
            {t('aboutDetails.text059')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text060')}
          </Text>

          <Text style={styles.bodyText}>
            {t('aboutDetails.text061')}
          </Text>

        </View>


        {/* =====================================================
            CLOSING
        ====================================================== */}

        <View style={styles.bottomCard}>

          <Text style={styles.bottomOm}>
            ॐ
          </Text>

          <Text style={styles.bottomTitle}>
            {t('aboutDetails.text003')}
          </Text>

          <Text style={styles.bottomText}>
            {t('aboutDetails.text062')}
          </Text>

          <Text style={styles.bottomPrayer}>
            🙏 Om Tat Sat 🙏
          </Text>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}


/* ============================================================
   SECTION HEADING
============================================================ */

function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeading}>

      <Text style={styles.sectionNumber}>
        {number}
      </Text>

      <View style={styles.sectionHeadingText}>

        <Text style={styles.sectionTitle}>
          {title}
        </Text>

        <Text style={styles.sectionSubtitle}>
          {subtitle}
        </Text>

      </View>

    </View>
  );
}


/* ============================================================
   SERVICE ROW
============================================================ */

function ServiceRow({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.serviceRow}>

      <View style={styles.serviceIconContainer}>
        <Text style={styles.serviceIcon}>
          {icon}
        </Text>
      </View>

      <View style={styles.serviceContent}>

        <Text style={styles.serviceTitle}>
          {title}
        </Text>

        <Text style={styles.serviceDescription}>
          {description}
        </Text>

      </View>

    </View>
  );
}


/* ============================================================
   GURU ITEM
============================================================ */

function GuruItem({
  name,
  image,
}: {
  name: string;
  image: string;
}) {
  return (
    <View style={styles.guruItem}>

      <Image
        source={{ uri: image }}
        style={styles.guruPortrait}
      />

      <Text style={styles.guruName}>
        {name}
      </Text>

    </View>
  );
}