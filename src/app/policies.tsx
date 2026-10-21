
import React, { useState } from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

type PolicyItem = {
  title: string;
  content: string;
};

type Policy = {
  title: string;
  subtitle: string;
  sections: PolicyItem[];
};

const policies: Policy[] = [
  {
    title: 'Privacy Policy',
    subtitle: 'How we collect, use and protect your information',
    sections: [
      {
        title: '2.1 Introduction',
        content: `We at Sreemath Hariharapura ("we", "us", "our") respect your privacy and are committed to protecting your personal information.

This Privacy Policy explains how we collect, use, disclose and safeguard the information you provide when you visit the website, use this application or engage our services, including seva booking and guest-house reservations.`,
      },
      {
        title: '2.2 Information We Collect',
        content: `We may collect the following categories of information:

• Personal Information: Name, contact number, email address, postal address, identity proof (for bookings), and payment details processed through third-party payment providers.

• Booking Information: Service or seva selected, date and time, number of persons, and accommodation details.

• Usage Information: IP address, browser type and version, device identifier, pages visited, duration and clickstream data.

• Other Information: Information required to provide services, verify identity or comply with legal obligations.`,
      },
      {
        title: '2.3 How We Use the Information',
        content: `We may use your information for the following purposes:

• To process bookings and payments and deliver booked services.

• To communicate booking confirmations, updates and reminders.

• To improve our website, application, services and user experience.

• To comply with legal, regulatory and governmental requirements.

• To send promotional or informational messages only when you have opted in.`,
      },
      {
        title: '2.4 Disclosure of Information',
        content: `We may disclose your information to:

• Service providers, payment processors and booking platform partners.

• Government or regulatory authorities when required by law.

• Other parties whom you explicitly authorise.

We do not sell or rent your personal information to third parties for their own marketing purposes.`,
      },
      {
        title: '2.5 Data Retention',
        content: `We retain personal information for as long as required for fulfilling bookings, legal compliance, dispute resolution and other purposes described in this policy.

Information may be deleted upon request, to the extent permissible by applicable law.`,
      },
      {
        title: '2.6 Security',
        content: `We implement reasonable security measures, including SSL and access controls, to protect your information.

However, no online transmission or storage system is completely secure, and absolute security cannot be guaranteed.`,
      },
      {
        title: '2.7 Your Rights',
        content: `Depending on applicable law, you may have the right to:

• Request access to your personal data.

• Request correction or deletion of your data.

• Withdraw consent where processing relies on consent.

• Lodge a complaint with an appropriate supervisory authority.`,
      },
      {
        title: "2.8 Children's Information",
        content: `Our services are not directed at persons under 18 years of age.

If you are under 18, please do not submit personal information without the consent of a parent or guardian.`,
      },
      {
        title: '2.9 Changes to Privacy Policy',
        content: `We may update this Privacy Policy from time to time.

The updated version will be published with a revised Effective Date.

Your continued use of the services after such changes constitutes acceptance of the revised policy.`,
      },
      {
        title: '2.10 Contact Us',
        content: `Sreemath Hariharapura

Hariharapura,
Chikmagalur District,
Karnataka – 577120

Phone: +91 90199 77466`,
      },
    ],
  },

  {
    title: 'Terms & Conditions',
    subtitle: 'Rules governing the use of temple services',
    sections: [
      {
        title: '1.1 Acceptance of Terms',
        content: `By accessing and using www.hariharapura.in, this application or associated services, you agree to be bound by these Terms & Conditions.

If you do not agree with any part of these Terms, please do not use the services.`,
      },
      {
        title: '1.2 Use of the Site',
        content: `The services are operated by Sreemath Hariharapura.

You may use the services only for lawful purposes.

You agree not to:

• Violate any applicable law or regulation.

• Use the services for harmful, fraudulent or unlawful purposes.

• Attempt to interfere with or damage the operation of the website or application.

We may modify, suspend or discontinue any part of the services at any time without notice.`,
      },
      {
        title: '1.3 Intellectual Property',
        content: `All content, including text, graphics, images, logos, videos and audio, is owned by or licensed to Sreemath Hariharapura and is protected by applicable intellectual property laws.

You may view and download information for personal, non-commercial use only.

Reproduction, modification, distribution or republication requires prior written consent.`,
      },
      {
        title: '1.4 Guest-House / Seva / Accommodation Bookings',
        content: `All bookings are subject to availability and applicable service-specific terms.

• You must provide accurate, current and complete information.

• The temple reserves the right to cancel or modify bookings due to unforeseen circumstances, administrative errors or force-majeure events.

• Devotees must arrive on time and comply with temple and accommodation rules.

• Booking confirmation and identification may be required when accessing booked facilities.`,
      },
      {
        title: '1.5 Limitation of Liability',
        content: `To the maximum extent permitted by law, Sreemath Hariharapura shall not be liable for indirect, incidental, special or consequential damages, loss of profits, loss of data or business interruption arising from use of the services.

Our liability in relation to a booking shall be limited to the amount paid for that booking, or a nominal amount where no payment was made, subject to applicable law.`,
      },
      {
        title: '1.6 Governing Law & Dispute Resolution',
        content: `These Terms shall be governed by the laws of India and the State of Karnataka.

Disputes arising from these Terms or the services shall be subject to the jurisdiction of the competent courts serving Hariharapura, Chikmagalur District, subject to applicable law.`,
      },
      {
        title: '1.7 Changes to Terms',
        content: `We reserve the right to revise these Terms from time to time.

Updated Terms will be published with a revised Effective Date.

Continued use of the services after changes constitutes acceptance of the revised Terms.`,
      },
      {
        title: '1.8 Severability',
        content: `If any provision of these Terms is held invalid or unenforceable by a competent authority, the remaining provisions shall continue in full force and effect.`,
      },
    ],
  },

  {
    title: 'Cancellation / Refund Policy',
    subtitle: 'Important rules for room and seva bookings',
    sections: [
      {
        title: '1. Scope',
        content: `This policy applies to bookings made through www.hariharapura.in and associated booking services for seva, accommodation, guest-house facilities and other applicable services.`,
      },
      {
        title: '2. Room / Accommodation Booking',
        content: `STRICTLY NO CANCELLATION AND NO REFUND

All room and guest-house bookings are non-cancellable, non-modifiable and non-refundable, subject to applicable law.

Once a booking is confirmed and payment is completed, refunds will not be issued for:

• Change of travel plans.

• Personal reasons.

• Mistaken bookings.

• Late arrival or early departure.

• Failure to arrive on the booking date.

Devotees are requested to carefully verify booking dates, room type and number of guests before making payment.`,
      },
      {
        title: '3. Seva / Other Bookings',
        content: `All seva and associated bookings are non-cancellable and non-refundable, subject to applicable law.

Devotees should verify the seva name, booking date, personal details and payment amount before confirming a booking.`,
      },
      {
        title: '4. No-Show Policy',
        content: `If a guest does not arrive on the scheduled check-in date, the booking will be treated as a no-show.

No refund will be provided for a no-show, subject to applicable law.`,
      },
    ],
  },
];

export default function PoliciesScreen() {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.label}>SREEMATH HARIHARAPURA</Text>

          <Text style={styles.title}>Temple Policies</Text>

          <Text style={styles.subtitle}>
            Please review our policies before using temple
            bookings, accommodation and other services.
          </Text>
        </View>

        {policies.map((policy, index) => {
          const isExpanded = expanded === index;

          return (
            <View key={policy.title} style={styles.policyCard}>
              <TouchableOpacity
                style={styles.policyHeader}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                onPress={() =>
                  setExpanded(isExpanded ? null : index)
                }
              >
                <View style={styles.policyHeaderText}>
                  <Text style={styles.policyTitle}>
                    {policy.title}
                  </Text>

                  <Text style={styles.policySubtitle}>
                    {policy.subtitle}
                  </Text>
                </View>

                <Text style={styles.arrow}>
                  {isExpanded ? '−' : '+'}
                </Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.policyBody}>
                  {policy.sections.map((section) => (
                    <View
                      key={section.title}
                      style={styles.section}
                    >
                      <Text style={styles.sectionTitle}>
                        {section.title}
                      </Text>

                      <Text style={styles.sectionText}>
                        {section.content}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>
            Important Booking Notice
          </Text>

          <Text style={styles.noticeText}>
            Room and guest-house bookings are strictly
            non-cancellable and non-refundable, subject
            to applicable law. Please verify all details
            before making payment.
          </Text>
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>
            Need Assistance?
          </Text>

          <Text style={styles.contactDescription}>
            For questions regarding privacy, bookings,
            refunds or temple services, please contact
            Sreemath Hariharapura.
          </Text>

          <Text style={styles.phone}>
            +91 90199 77466
          </Text>
        </View>

        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => router.push('/contact')}
        >
          <Text style={styles.contactButtonText}>
            Contact Temple
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.homeButtonText}>
            Back to Home
          </Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          © Sreemath Hariharapura
          {'\n'}
          Hariharapura, Karnataka – 577120
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF8',
  },

  content: {
    padding: 18,
    paddingBottom: 45,
  },

  header: {
    marginBottom: 22,
  },

  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#C69A3A',
    marginBottom: 7,
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#6B1720',
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: '#786F65',
    marginTop: 8,
  },

  policyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: '#E8DCCB',
    overflow: 'hidden',
    elevation: 2,
  },

  policyHeader: {
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  policyHeaderText: {
    flex: 1,
    paddingRight: 10,
  },

  policyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B1720',
  },

  policySubtitle: {
    fontSize: 11,
    lineHeight: 17,
    color: '#8E8175',
    marginTop: 5,
  },

  arrow: {
    fontSize: 25,
    fontWeight: '400',
    color: '#C69A3A',
  },

  policyBody: {
    borderTopWidth: 1,
    borderTopColor: '#F0E7DC',
    paddingHorizontal: 17,
    paddingTop: 15,
    paddingBottom: 5,
  },

  section: {
    marginBottom: 21,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 9,
  },

  sectionText: {
    fontSize: 12.5,
    lineHeight: 21,
    color: '#5F5A54',
  },

  noticeCard: {
    backgroundColor: '#FFF1E8',
    borderRadius: 15,
    padding: 17,
    marginTop: 8,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: '#F2D7C2',
  },

  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9B3324',
    marginBottom: 8,
  },

  noticeText: {
    fontSize: 12,
    lineHeight: 20,
    color: '#79584C',
  },

  contactCard: {
    backgroundColor: '#F7EBD7',
    borderRadius: 15,
    padding: 18,
    marginBottom: 15,
  },

  contactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 7,
  },

  contactDescription: {
    fontSize: 12,
    lineHeight: 19,
    color: '#786F65',
  },

  phone: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B1720',
    marginTop: 10,
  },

  contactButton: {
    height: 50,
    backgroundColor: '#6B1720',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },

  contactButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  homeButton: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCCB',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  homeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B1720',
  },

  footer: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 17,
    color: '#9C9185',
    marginTop: 22,
  },
});
