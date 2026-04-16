import { useCallback, useRef } from 'react';
import {
  Animated,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { ROUTES } from '../../constants/navigation';
import HeroBackground from '../../components/ui/HeroBackground';
import QuickLinksSection from '../../components/ui/QuickLinksSection';

const MAGAZINE_IMAGE = 'https://www.thecoralreefresearchhub.com/wp-content/uploads/2026/04/Issue-2-Cover-Image-212x300.png';
const MAGAZINE_PDF   = 'https://www.thecoralreefresearchhub.com/wp-content/uploads/2026/01/Issue-1-Coral-Matters-Magazine.pdf';

export default function ResourcesScreen() {
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const isWide  = width >= 768;
  const scrollY = useRef(new Animated.Value(0)).current;

  const handleOpenMagazine = useCallback(async () => {
    await Linking.openURL(MAGAZINE_PDF);
  }, []);

  const handleGoToNewsFeed = useCallback(() => {
    router.push(ROUTES.COMMUNITY);
  }, []);

  return (
    <Animated.ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true },
      )}
    >
      {/* ── Hero ─────────────────────────────────────────── */}
      <HeroBackground
        paddingVertical={isWide ? 80 : 32}
        paddingHorizontal={isWide ? 48 : 20}
      >
        <View style={[styles.heroInner, { maxWidth: isWide ? 760 : '100%' }]}>
          <Text style={[styles.heroTitle, {
            fontSize:   isWide ? 48 : 22,
            lineHeight: isWide ? 56 : 28,
          }]}>
            Premium Members{'\n'}Resource Dashboard
          </Text>

          <Text style={[styles.heroSubtitle, {
            marginTop:  isWide ? 16 : 10,
            fontSize:   isWide ? 18 : 14,
            lineHeight: isWide ? 26 : 20,
          }]}>
            You Are Logged In As: {profile?.user_display_name ?? 'coconutbreezemedia'}
          </Text>

          <Pressable
            onPress={() => router.push(ROUTES.WELCOME)}
            style={[styles.heroBtn, {
              marginTop:       isWide ? 28 : 16,
              paddingVertical: isWide ? 14 : 10,
              paddingHorizontal: isWide ? 32 : 22,
            }]}
          >
            <Text style={[styles.heroBtnText, { fontSize: isWide ? 16 : 14 }]}>
              View All Posts
            </Text>
          </Pressable>
        </View>
      </HeroBackground>

      {/* ── Magazine + News Feed ──────────────────────────── */}
      <View style={[styles.body, {
        paddingHorizontal: isWide ? 48 : 16,
        paddingTop:        isWide ? 56 : 24,
      }]}>

        {/* Magazine */}
        <View style={[styles.magazineRow, {
          flexDirection: isWide ? 'row' : 'column',
          gap:           isWide ? 40 : 0,
          alignItems:    isWide ? 'flex-start' : 'stretch',
        }]}>
          <View style={{ flex: isWide ? 1 : undefined }}>
            <Text style={[styles.magazineTitle, {
              fontSize:   isWide ? 40 : 24,
              lineHeight: isWide ? 48 : 30,
            }]}>
              Coral Matters Magazine Issue 2!
            </Text>

            <Text style={[styles.bodyText, {
              marginTop:  isWide ? 20 : 12,
              fontSize:   isWide ? 18 : 15,
              lineHeight: isWide ? 28 : 23,
            }]}>
              {"We are excited to announce issue 2 of our quarterly magazine 'Coral Matters', that aims to bring you up-to-date coral related news, research, help and advice from around the world. It is also a place where we will be featuring members work, ideas and questions. Remember this is YOUR magazine, created by coral reef scientists for coral reef scientists! Download your FREE copy now!"}
            </Text>

            <Pressable
              onPress={handleOpenMagazine}
              style={[styles.downloadBtn, {
                marginTop:        isWide ? 28 : 16,
                paddingVertical:  isWide ? 14 : 11,
                paddingHorizontal: isWide ? 28 : 18,
              }]}
            >
              <Text style={[styles.downloadBtnText, { fontSize: isWide ? 17 : 15 }]}>
                View & Download Now
              </Text>
            </Pressable>
          </View>

          <Image
            source={{ uri: MAGAZINE_IMAGE }}
            style={{
              width:     isWide ? 240 : '100%',
              height:    isWide ? 340 : 400,
              marginTop: isWide ? 0 : 24,
              borderRadius: 4,
              backgroundColor: '#dbeafe',
              flexShrink: 0,
            }}
            resizeMode="contain"
          />
        </View>

        {/* News Feed */}
        <View style={[styles.newsFeedSection, {
          marginTop:  isWide ? 72 : 36,
          paddingTop: isWide ? 56 : 28,
        }]}>
          <Text style={[styles.newsFeedTitle, {
            fontSize:   isWide ? 42 : 22,
            lineHeight: isWide ? 50 : 28,
          }]}>
            Post to CoRR Hub News Feed
          </Text>

          <Text style={[styles.bodyText, {
            marginTop:  isWide ? 20 : 12,
            fontSize:   isWide ? 18 : 15,
            lineHeight: isWide ? 28 : 23,
            textAlign:  'center',
            maxWidth:   900,
            alignSelf:  'center',
          }]}>
            Check out and read CoRR Hub news articles featuring research and other coral reef related information. You can also create your own posts and highlight news, your research or anything else coral related (questions, collaborations or whatever you like). Just please keep it good vibes only!!
          </Text>

          <Pressable
            onPress={handleGoToNewsFeed}
            style={[styles.feedBtn, {
              marginTop:        isWide ? 32 : 20,
              paddingVertical:  isWide ? 16 : 12,
              paddingHorizontal: isWide ? 40 : 24,
            }]}
          >
            <Text style={[styles.feedBtnText, { fontSize: isWide ? 18 : 15 }]}>
              VIEW HUB NEWS FEED
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Premium Quick Links with parallax + scroll reveal ── */}
      <QuickLinksSection scrollY={scrollY} />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: '#f2f3f5' },
  contentContainer: { paddingBottom: 0 },
  heroInner:        { width: '100%', alignSelf: 'center', alignItems: 'center' },
  heroTitle: {
    color: '#ffffff', fontWeight: '800',
    textTransform: 'uppercase', textAlign: 'center',
  },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  heroBtn: {
    borderRadius: 999, backgroundColor: '#ffffff',
  },
  heroBtnText: { color: '#1f2937', fontWeight: '800' },
  body: { maxWidth: 1180, width: '100%', alignSelf: 'center' },
  magazineRow:  { },
  magazineTitle: {
    color: '#1234a6', fontWeight: '800', textTransform: 'uppercase',
  },
  bodyText: { color: '#151515' },
  downloadBtn: {
    alignSelf: 'flex-start', borderRadius: 999,
    borderWidth: 2, borderColor: '#0f2f9b', backgroundColor: '#1b49d4',
  },
  downloadBtnText: { color: '#ffffff', fontWeight: '800' },
  newsFeedSection: {
    borderTopWidth: 1, borderTopColor: '#dbdde1',
  },
  newsFeedTitle: {
    color: '#0f0f0f', fontWeight: '800',
    textTransform: 'uppercase', textAlign: 'center',
  },
  feedBtn:     { alignSelf: 'center', borderRadius: 999, backgroundColor: '#1f8098' },
  feedBtnText: { color: '#ffffff', fontWeight: '800', letterSpacing: 0.5 },
});
