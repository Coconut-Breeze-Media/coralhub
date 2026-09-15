// app/profile/terms.tsx

import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../../components/BackButton';

const HUB_URL = 'https://www.thecoralreefresearchhub.com';
const GRAVATAR_PRIVACY_URL = 'https://automattic.com/privacy/';
const PRIMARY = '#2563eb';

const TERMS_SECTIONS = [
  {
    title: 'Who we are',
    body: `Our website address is: ${HUB_URL}\n\nWe are a good-vibe initiative and do not tolerate bad behaviour. Anyone abusing our services or posting inappropriate content will be removed from our community without warning, so please be nice to each other. In return, we do not post unwarranted adverts or use algorithms to choose what content you see. We also promise not to share your personal information, aside from the instances detailed below.`,
  },
  {
    title: 'Comments',
    body: 'When visitors leave comments on the site, we collect the data shown in the comments form, as well as the visitor’s IP address and browser user-agent string to help with spam detection.\n\nAn anonymised string created from your email address may be provided to the Gravatar service to check whether you use it. After approval of your comment, your profile picture is visible publicly in the context of your comment.',
  },
  {
    title: 'Media',
    body: 'If you upload images to the website, you should avoid uploading images with embedded location data (EXIF GPS). Visitors to the website can download and extract location data from images on the website.',
  },
  {
    title: 'Cookies',
    body: 'If you leave a comment, you may opt in to saving your name, email address and website in cookies for your convenience. These cookies last for one year.\n\nWhen you visit the login page, a temporary cookie checks whether your browser accepts cookies. It contains no personal data and is discarded when you close your browser.\n\nWhen you log in, cookies save your login information and screen-display choices. Login cookies last for two days and screen-option cookies last for a year. If you select “Remember Me”, your login persists for two weeks. Logging out removes login cookies.\n\nIf you edit or publish an article, an additional cookie records the post ID. It contains no personal data and expires after one day.',
  },
  {
    title: 'Embedded content from other websites',
    body: 'Articles may include embedded content, such as videos, images or articles. Embedded content from other websites behaves exactly as if you had visited those websites directly. Those websites may collect data about you, use cookies, embed additional third-party tracking, and monitor your interaction with that embedded content.',
  },
  {
    title: 'Who we share your data with',
    body: 'No one. If you request a password reset, your IP address will be included in the reset email.',
  },
  {
    title: 'How long we retain your data',
    body: 'Comments and their metadata are retained indefinitely so follow-up comments can be recognised and approved automatically.\n\nFor users registered on our website, we store the personal information provided in their user profile. Users can see, edit or delete their personal information at any time, except for their username. Website administrators can also see and edit that information.',
  },
  {
    title: 'What rights you have over your data',
    body: 'If you have an account or have left comments, you may request an exported file of the personal data we hold about you. You may also request that we erase personal data we hold about you, except data we must retain for administrative, legal or security purposes.',
  },
  {
    title: 'Where we send your data',
    body: 'Visitor comments may be checked through an automated spam-detection service.',
  },
  {
    title: 'Disclaimer and tolerance',
    body: 'The Coral Reef Research Hub shares news, research updates and employment opportunities sourced from publicly available online platforms for the benefit of members and followers. While we make reasonable efforts to ensure accuracy, The Coral Reef Research Hub does not accept liability for errors, omissions or inaccuracies. Publishing external material does not imply endorsement and does not necessarily reflect the views or positions of The Coral Reef Research Hub.\n\nThe Coral Reef Research Hub is not responsible for content created or shared by members in the activity feed, messaging service, Facebook group or other community platforms. We reserve the right to remove content deemed inappropriate, offensive, misleading or unrelated to coral reef science and conservation. Members are encouraged to report offensive or inappropriate content.\n\nWe are committed to a respectful, professional and inclusive community. Under our one-strike policy, members who post offensive material, spam or content unrelated to coral reefs or associated ecosystems may be removed and blocked from our platforms and social channels without further notice.',
  },
  {
    title: 'Learning materials',
    body: 'The Coral Reef Research Hub makes every reasonable effort to ensure that information in courses and knowledge-sharing masterclasses is accurate and up to date when published. However, the Hub accepts no liability for errors, omissions or inaccuracies, or for information that becomes outdated because of scientific developments or changes in best practice.',
  },
  {
    title: 'Refunds and cancellations',
    body: 'Once you confirm payment, refunds are not available unless you request one by email for a valid reason. You may cancel membership at any time; once cancelled, you will lose access to the site and your profile information.',
  },
] as const;

export default function TermsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View
        style={{
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          paddingHorizontal: 16,
          paddingTop: 60,
          paddingBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1 }}>
            Terms and Conditions
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Ionicons name="document-text-outline" size={24} color={PRIMARY} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937' }}>
              Privacy Policy and Terms
            </Text>
          </View>
          <Text style={{ fontSize: 15, color: '#4b5563', lineHeight: 22, marginBottom: 16 }}>
            Please read our privacy policy, community standards, disclaimer and cancellation terms.
          </Text>

          {TERMS_SECTIONS.map((section, index) => (
            <View key={section.title} style={{ marginTop: index === 0 ? 0 : 18 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 6 }}>
                {section.title}
              </Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 21 }}>{section.body}</Text>
            </View>
          ))}

          <Pressable
            onPress={() => Linking.openURL(GRAVATAR_PRIVACY_URL)}
            accessibilityRole="link"
            accessibilityLabel="Open the Gravatar Privacy Policy"
            style={({ pressed }) => ({
              marginTop: 18,
              height: 50,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#d1d5db',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="open-outline" size={20} color={PRIMARY} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: PRIMARY }}>Gravatar Privacy Policy</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>
          © {new Date().getFullYear()} Coconut Breeze Media / CoRR Hub
        </Text>
      </ScrollView>
    </View>
  );
}
