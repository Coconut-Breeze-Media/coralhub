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
import { siteUrl } from '../../lib/config';
import HeroBackground from '../../components/ui/HeroBackground';
import QuickLinksSection, { type QuickLinkData } from '../../components/ui/QuickLinksSection';

const MAGAZINE_IMAGE = siteUrl('/wp-content/uploads/2026/04/Issue-2-Cover-Image-212x300.png');
const MAGAZINE_PDF = siteUrl('/wp-content/uploads/2026/01/Issue-1-Coral-Matters-Magazine.pdf');
const MASTERCLASS_IMAGE = siteUrl('/wp-content/uploads/2024/04/Masterclass-Thumbnail_SG.jpg');

const OTHER_QUICK_LINKS: QuickLinkData[] = [
  {
    id: 'other-news-feed',
    label: 'NEWS FEED',
    description: 'Check out The Coral Reef Research Hubs news feed page. This page is like regular social media but without the algorithms and advertising! Post anything you want that is coral related to this page and get in front of all our members!',
  },
  {
    id: 'other-networking',
    label: 'NETWORKING',
    description: 'View our database of members and search member profiles, request connections and message each other. This is where your networking journey begins!',
  },
  {
    id: 'other-groups',
    label: 'VIEW GROUPS',
    description: 'View our database of member created groups. These groups work just like those on regular social media, and are great places to collaborate or search for those who have simialr niched research interests.',
  },
  {
    id: 'other-magazine',
    label: 'CORAL MATTERS MAGAZINE',
    description: 'Check out current and back issues of our quarterly magazine Coral Matters, that aims to bring you up-to-date coral related news, research, help and advice from around the world. It is also a place where we will be featuring members work, ideas and questions. Please do not hesitate to get in touch if you would like to contribute to future issues! Remember this is YOUR magazine, created by coral reef scientists for coral reef scientists!',
  },
  {
    id: 'other-merchandise',
    label: 'MERCHANDISE',
    description: 'Get some cool looking Coral Reef Research Hub merch! We are in the process of developing an official online store, so these are just sample products (which you can order by reaching out to us).',
  },
  {
    id: 'other-featured-products',
    label: 'FEATURED PRODUCTS',
    description: 'Coming soon! We are creating a list of featured products that we feel all coral reef scientists should not be without. Check back soon and take a look at what our recommendations are!',
  },
];

export default function ResourcesScreen() {
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const isWide  = width >= 768;
  const scrollY = useRef(new Animated.Value(0)).current;

  const handleOpenMagazine = useCallback(async () => {
    await Linking.openURL(MAGAZINE_PDF);
  }, []);

  const handleGoToNewsFeed = useCallback(() => {
    router.push(`${ROUTES.COMMUNITY}?tab=feed`);
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
        paddingBottom:     isWide ? 56 : 32,
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

      <View style={[styles.body, {
        paddingHorizontal: isWide ? 48 : 16,
        paddingTop:        isWide ? 56 : 32,
        paddingBottom:     isWide ? 72 : 44,
      }]}> 
        <View style={styles.workshopsSection}>
          <Text style={[styles.newsFeedTitle, {
            fontSize:   isWide ? 42 : 22,
            lineHeight: isWide ? 50 : 28,
          }]}> 
            Workshops and Webinars
          </Text>

          <Text style={[styles.bodyText, {
            marginTop:  isWide ? 20 : 12,
            fontSize:   isWide ? 18 : 15,
            lineHeight: isWide ? 28 : 23,
            textAlign:  'center',
            maxWidth:   900,
            alignSelf:  'center',
          }]}> 
            As part of our commitment to sharing expertise and ongoing professional development we are currently planning regular workshops and webinars for our members to partake and interact with. These live events will be recorded and archived on our site so that even if you miss them you will still be able to view and learn. Watch our social feed for more updates on this. If you would like to get involved and present either a workshop or webinar please get in touch and let us know what subject you would like to showcase and teach others about. We can help with the planning, hosting, and will publicise these events across our legacy social media feeds to ensure you have a receptive audience!
          </Text>

          <Pressable
            style={[styles.feedBtn, {
              marginTop:        isWide ? 32 : 20,
              paddingVertical:  isWide ? 16 : 12,
              paddingHorizontal: isWide ? 40 : 24,
            }]}
          >
            <Text style={[styles.feedBtnText, { fontSize: isWide ? 18 : 15 }]}> 
              GET IN TOUCH
            </Text>
          </Pressable>
        </View>
      </View>

      <QuickLinksSection
        scrollY={scrollY}
        title="Other Quick Links"
        items={OTHER_QUICK_LINKS}
        backgroundImage={require('../../assets/sea2.png')}
      />

      <View style={[styles.body, {
        paddingHorizontal: isWide ? 48 : 16,
        paddingTop:        isWide ? 56 : 32,
        paddingBottom:     isWide ? 72 : 44,
      }]}> 
        <View style={styles.fundamentalsSection}>
          <Text style={[styles.fundamentalsHeading, {
            fontSize:   isWide ? 56 : 28,
            lineHeight: isWide ? 64 : 34,
          }]}> 
            Fundamentals Course!
          </Text>

          <Text style={[styles.fundamentalsSubheading, {
            fontSize:   isWide ? 46 : 24,
            lineHeight: isWide ? 54 : 30,
            marginTop:  isWide ? 28 : 16,
          }]}> 
            How to Become a Coral Reef Scientist
          </Text>

          <Text style={[styles.bodyText, {
            marginTop:  isWide ? 26 : 16,
            fontSize:   isWide ? 18 : 15,
            lineHeight: isWide ? 40 : 28,
            textAlign:  'center',
            maxWidth:   980,
            alignSelf:  'center',
          }]}> 
            After a number of member requests we created this fundamentals course to help guide you on your career journey (whichever stage you are at) from deciding you love coral reefs and want to work with them, to charting your professional career. This series of workbooks have been designed to make you think through every step of the coral reef scientists career journey, and ask you many important questions along the way, the answers to which are crucial to help you make those all important decisions. Remember, everyone’s journey is different!
          </Text>

          <Pressable
            style={[styles.feedBtn, {
              marginTop:        isWide ? 36 : 24,
              paddingVertical:  isWide ? 16 : 12,
              paddingHorizontal: isWide ? 40 : 24,
            }]}
          >
            <Text style={[styles.feedBtnText, { fontSize: isWide ? 18 : 15 }]}> 
              VIEW COURSE
            </Text>
          </Pressable>
        </View>
      </View>

      <QuickLinksSection
        scrollY={scrollY}
        title="Latest Knowledge Sharing Masterclass"
        backgroundImage={require('../../assets/sea3.png')}
        hideItems
        heroImageSource={{ uri: MASTERCLASS_IMAGE }}
      />

      <View style={[styles.body, {
        paddingHorizontal: isWide ? 48 : 16,
        paddingTop:        isWide ? 56 : 32,
        paddingBottom:     isWide ? 72 : 44,
      }]}> 
        <View style={styles.fundamentalsSection}>
          <Text style={[styles.newsFeedTitle, {
            fontSize:   isWide ? 52 : 22,
            lineHeight: isWide ? 60 : 30,
          }]}> 
            Coral Reef Historical Archive
          </Text>

          <Text style={[styles.bodyText, {
            marginTop:  isWide ? 24 : 14,
            fontSize:   isWide ? 18 : 15,
            lineHeight: isWide ? 40 : 28,
            textAlign:  'center',
            maxWidth:   1020,
            alignSelf:  'center',
          }]}> 
            We are building a non-systematic archive of videos from coral reefs around the world. There are tens of thousands of hours of video footage shot by underwater enthusiasts that simply get lost because no-one sees their value as they do not have precise geographical or temporal reference. However, in years to come it will be extremely useful for researchers to be able to see what these areas looked like in the past, even if their location is slightly generic and the date only categorised by year. For example, imagine how useful it would be to watch a video from Jamaica in the 1970’s. Things have changed a lot since then, and shifting baselines are a known problem when new researchers enter the field. It is our goal to build an archive of this non-systematic footage to help stop shifting baselines and give early career scientists (and other researchers) a snap shot from the past. If you have any footage you would like to contribute to our archive please <Text style={styles.archiveLink}>get in touch</Text>.
          </Text>

          <Pressable
            style={[styles.feedBtn, {
              marginTop:        isWide ? 36 : 24,
              paddingVertical:  isWide ? 16 : 12,
              paddingHorizontal: isWide ? 40 : 24,
            }]}
          >
            <Text style={[styles.feedBtnText, { fontSize: isWide ? 18 : 15 }]}> 
              VIEW ARCHIVE
            </Text>
          </Pressable>
        </View>
      </View>

      <HeroBackground
        paddingVertical={isWide ? 64 : 36}
        paddingHorizontal={isWide ? 48 : 16}
        backgroundImage={require('../../assets/sea1.png')}
      >
        <View style={[styles.upgradeSection, { maxWidth: 1180 }]}> 
          <Text style={[styles.upgradeTitle, {
            fontSize:   isWide ? 78 : 44,
            lineHeight: isWide ? 88 : 52,
          }]}> 
            Upgrade Your{"\n"}Membership
          </Text>

          <Text style={[styles.upgradeText, {
            marginTop:  isWide ? 28 : 18,
            fontSize:   isWide ? 20 : 15,
            lineHeight: isWide ? 38 : 29,
            maxWidth:   1040,
          }]}> 
            Did you know that different membership levels provide different benefits? Did you also know that with the launch of our app on the horizon, increases in both services we provide and out-going expenses mean that we will soon have to put our prices up to cover our costs? This means there has never been a better time to upgrade your membership level and lock in the price you pay forever!!
          </Text>

          <Text style={[styles.upgradeText, {
            marginTop:  isWide ? 24 : 16,
            fontSize:   isWide ? 20 : 15,
            lineHeight: isWide ? 38 : 29,
            maxWidth:   1040,
          }]}> 
            Also, as part of this restructuring we will soon be changing the benefits you get from each membership tier. In line with this, our mentorship program will soon only be available for annual and institutional members. This decision has been made to deter hit-and-run sign ups, where a monthly member joins us, heavily uses our resources, and then leaves, never to be seen again!
          </Text>

          <Pressable
            style={[styles.upgradeBtn, {
              marginTop:        isWide ? 38 : 24,
              paddingVertical:  isWide ? 16 : 12,
              paddingHorizontal: isWide ? 46 : 28,
            }]}
          >
            <Text style={[styles.upgradeBtnText, { fontSize: isWide ? 18 : 15 }]}> 
              VIEW MEMBERSHIP LEVELS
            </Text>
          </Pressable>
        </View>
      </HeroBackground>

      <View style={[styles.body, {
        paddingHorizontal: isWide ? 48 : 16,
        paddingTop:        isWide ? 56 : 36,
        paddingBottom:     isWide ? 80 : 52,
      }]}> 
        <View style={styles.finalSection}>
          <Text style={[styles.bodyText, {
            fontSize:   isWide ? 48 : 20,
            lineHeight: isWide ? 72 : 44,
            textAlign:  'center',
            maxWidth:   1040,
            alignSelf:  'center',
          }]}> 
            If you have any <Text style={styles.archiveLink}>feedback</Text> on the current resources or have suggestions for the future we would love to hear from you! Also, if you would like any of your own content featured on our resource pages please <Text style={styles.archiveLink}>get in touch</Text>.
          </Text>

          <Pressable
            onPress={handleGoToNewsFeed}
            style={[styles.finalFeedBtn, {
              marginTop:        isWide ? 56 : 28,
              paddingVertical:  isWide ? 16 : 12,
              paddingHorizontal: isWide ? 44 : 30,
            }]}
          >
            <Text style={[styles.finalFeedBtnText, { fontSize: isWide ? 18 : 15 }]}> 
              VIEW ACTIVITY FEED
            </Text>
          </Pressable>
        </View>
      </View>
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
  workshopsSection: {
    borderTopWidth: 1,
    borderTopColor: '#dbdde1',
    alignItems: 'center',
  },
  fundamentalsSection: {
    borderTopWidth: 1,
    borderTopColor: '#dbdde1',
    alignItems: 'center',
  },
  fundamentalsHeading: {
    color: '#2f6eb3',
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  fundamentalsSubheading: {
    color: '#2f6eb3',
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  archiveLink: {
    color: '#2f6eb3',
  },
  upgradeSection: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  upgradeTitle: {
    color: '#ffffff',
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  upgradeText: {
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
    alignSelf: 'center',
  },
  upgradeBtn: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#000000',
    borderWidth: 8,
    borderColor: '#ffffff',
  },
  upgradeBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  finalSection: {
    borderTopWidth: 1,
    borderTopColor: '#dbdde1',
    alignItems: 'center',
  },
  finalFeedBtn: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#000000',
    borderWidth: 6,
    borderColor: '#efefef',
  },
  finalFeedBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
