import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

// ─── Data ──────────────────────────────────────────────────────────────────────

export const QUICK_LINKS = [
  {
    id: 'career',
    label: 'CAREER OPPORTUNITIES',
    description: "We do the searching so you don't have to! On this page we post all coral related career opportunities that we find on published channels, including jobs, internships, volunteer positions, workshops and more. All posts are searchable, archived in date order, and removed when application deadlines have passed.",
  },
  {
    id: 'courses',
    label: 'COURSES',
    description: "Check out our new resource library of learning materials. We are currently featuring the popular 'How To Become A Coral Reef Scientist' workbook based course, but more are coming soon! These will include a guide to coral reef field techniques and a video course detailing the use of 'R' in coral reef science.",
  },
  {
    id: 'mentorships',
    label: 'MENTORSHIPS',
    description: 'Here we are building a growing list of expert members who are willing to donate their time to mentoring other members. Subjects covered include career advice, grant writing, restoration work, artificial reef building, coral gardening, expedition advice, species ID, molecular biology, advanced analytics, machine learning and more!',
  },
  {
    id: 'discounts',
    label: 'PRODUCT PARTNER DISCOUNTS',
    description: 'We have been working to develop partnerships with organisations that relate to coral reefs and associated ecosystems. Some of our partners are kindly offering discounts to Premium Members — including dive gear, underwater photography hardware and scientific survey equipment.',
  },
  {
    id: 'documents',
    label: 'DOCUMENT LIBRARY',
    description: 'A repository of peer-reviewed publications and white papers. Members can publish their own work and share with members or their external network. Simply use the submit publication option and upload your work, which we will review and publish once approved.',
  },
  {
    id: 'articles',
    label: 'ESSAYS AND ARTICLES',
    description: 'Check out our library of non-peer reviewed essays and articles created by our members that give a great overview of various coral reef related topics, and provides a great jumping off point for those looking to take their learning to the next level.',
  },
  {
    id: 'masterclasses',
    label: 'MASTERCLASSES',
    description: 'Our knowledge sharing masterclass program is designed for members to share their coral expertise through video. We feature videos made by members that showcase their skills and research areas of interest. Each video is added to our growing collection as it becomes available.',
  },
  {
    id: 'archive',
    label: 'HISTORICAL ARCHIVE',
    description: 'We are building an archive of coral footage from around the world. This footage will serve as a growing record of coral reef locations that can be used by researchers, managers and other coral professionals as a non-systemised comparative baseline reference.',
  },
  {
    id: 'internships',
    label: 'INTERNSHIPS',
    description: "Looking for a remote internship position? Contact us if you are an aspiring coral reef content creator, presenter or digital artist. We are currently looking for interns to contribute to our social media pages, especially our YouTube channel. Apply today!",
  },
  {
    id: 'grants',
    label: 'SMALL RESEARCH GRANTS',
    description: 'Members with Annual Membership are eligible to apply for one of our small research grants. These grants are designed to fund a part of undergraduate or postgraduate coral related research projects. Check here for details relating to the next call for applications.',
  },
  {
    id: 'institutional',
    label: 'INSTITUTIONAL AREA',
    description: 'Available for Institutional (Group) Members, on this page you can gain access to specific content and services designed for you. These include targeted member searches, submission of opportunity posts and ability to promote your work. Up to five free monthly membership logins are also available on request.',
  },
  {
    id: 'contact',
    label: 'CONTACT US',
    description: 'Use this page to contact us with feedback, submit publications, or ask general questions to our admin team!',
  },
];

// ─── Particle burst config ─────────────────────────────────────────────────────

const BURST = [
  { tx: -52, ty: -22, size: 4, color: '#7ecbdf', mo: 0.90 },
  { tx:  48, ty: -30, size: 3, color: '#80ffcc', mo: 0.85 },
  { tx:  58, ty:  16, size: 4, color: '#a8dce8', mo: 0.80 },
  { tx: -44, ty:  34, size: 3, color: '#64f0b8', mo: 0.88 },
  { tx:  22, ty:  52, size: 5, color: '#7ecbdf', mo: 0.75 },
];

const BUTTON_H = 44;

// ─── Single animated item ──────────────────────────────────────────────────────

interface ItemProps {
  item: (typeof QUICK_LINKS)[0];
  scrollY: Animated.Value;
  viewportH: number;
  isWide: boolean;
  /** Y of the items-grid View within scroll content (sectionY + gridOffsetInSection) */
  gridAbsoluteY: number;
}

function QuickLinkItem({ item, scrollY, viewportH, isWide, gridAbsoluteY }: ItemProps) {
  // Start very far down so the item is invisible before measurement
  const absoluteYAnim = useRef(new Animated.Value(999999)).current;
  const localYRef     = useRef<number | null>(null);

  // Update absoluteYAnim whenever we have both measurements
  const syncPosition = useCallback((localY: number, baseY: number) => {
    if (baseY <= 0) return; // section not measured yet
    absoluteYAnim.setValue(baseY + localY);
  }, []);

  // Re-sync when the grid base Y changes (e.g. after section layout fires)
  useEffect(() => {
    if (localYRef.current !== null) {
      syncPosition(localYRef.current, gridAbsoluteY);
    }
  }, [gridAbsoluteY, syncPosition]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const localY = e.nativeEvent.layout.y;
    localYRef.current = localY;
    syncPosition(localY, gridAbsoluteY);
  }, [gridAbsoluteY, syncPosition]);

  // ── scrollRelative = scrollY − absoluteYAnim ──────────────────────────────
  const rel = useRef(Animated.subtract(scrollY, absoluteYAnim)).current;

  const VH = viewportH;

  // item below screen → rel < −VH*0.88 → hidden
  // item entering     → rel ~ −VH*0.22 → fully visible
  // item exiting top  → rel > 80       → fading
  const opacity    = rel.interpolate({ inputRange: [-VH * 0.88, -VH * 0.22,  60, 300], outputRange: [0, 1, 1, 0.08], extrapolate: 'clamp' });
  const translateY = rel.interpolate({ inputRange: [-VH * 0.88, -VH * 0.22,  60, 300], outputRange: [65, 0, 0, -20], extrapolate: 'clamp' });
  const scale      = rel.interpolate({ inputRange: [-VH * 0.88, -VH * 0.22], outputRange: [0.86, 1], extrapolate: 'clamp' });

  // Per-particle scroll-driven scatter
  const particles = BURST.map((p) => ({
    opacity: rel.interpolate({ inputRange: [-VH * 0.82, -VH * 0.60, -VH * 0.30, -VH * 0.10], outputRange: [0, p.mo, p.mo * 0.4, 0], extrapolate: 'clamp' }),
    x:       rel.interpolate({ inputRange: [-VH * 0.82, -VH * 0.30], outputRange: [0, p.tx], extrapolate: 'clamp' }),
    y:       rel.interpolate({ inputRange: [-VH * 0.82, -VH * 0.30], outputRange: [0, p.ty], extrapolate: 'clamp' }),
  }));

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.item,
        { marginBottom: isWide ? 40 : 32 },
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      {/* Particle burst anchored at button vertical center */}
      <View style={[styles.particleAnchor, { top: BUTTON_H / 2 }]} pointerEvents="none">
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={{
              position:        'absolute',
              width:           BURST[i].size,
              height:          BURST[i].size,
              borderRadius:    BURST[i].size / 2,
              backgroundColor: BURST[i].color,
              marginLeft:      -BURST[i].size / 2,
              marginTop:       -BURST[i].size / 2,
              opacity:         p.opacity,
              transform:       [{ translateX: p.x }, { translateY: p.y }],
            }}
          />
        ))}
      </View>

      {/* Button */}
      <Pressable style={({ pressed }) => [
        styles.button,
        { paddingVertical: isWide ? 14 : 11, paddingHorizontal: isWide ? 36 : 28 },
        pressed && styles.buttonPressed,
      ]}>
        <Text style={[styles.buttonText, { fontSize: isWide ? 15 : 13 }]}>
          {item.label}
        </Text>
      </Pressable>

      {/* Description */}
      <Text style={[styles.description, {
        fontSize:  isWide ? 15 : 13,
        lineHeight: isWide ? 24 : 21,
        marginTop: isWide ? 14 : 10,
        maxWidth:  680,
      }]}>
        {item.description}
      </Text>
    </Animated.View>
  );
}

// ─── Parallax section ──────────────────────────────────────────────────────────

const PARALLAX_OFFSET = 70;

interface SectionProps {
  scrollY: Animated.Value;
}

export default function QuickLinksSection({ scrollY }: SectionProps) {
  const { height: viewportH, width } = useWindowDimensions();
  const isWide = width >= 768;

  // We need THREE y values to correctly place each item in scroll-content coords:
  //   sectionY  — QuickLinksSection root relative to scroll content
  //   gridY     — items-grid View relative to QuickLinksSection root
  //   item.localY — item relative to items-grid
  // → absoluteItemY = sectionY + gridY + item.localY
  const [sectionY, setSectionY] = useState(0);
  const [gridY,    setGridY]    = useState(0);

  const gridAbsoluteY = sectionY + gridY; // passed to each item

  // Parallax: drive image translateY from scroll relative to section top
  const sectionTopAnim = useRef(new Animated.Value(0)).current;
  const relSection     = useRef(Animated.subtract(scrollY, sectionTopAnim)).current;

  const imageShift = relSection.interpolate({
    inputRange : [-viewportH, 1400],
    outputRange: [PARALLAX_OFFSET, -PARALLAX_OFFSET],
    extrapolate: 'clamp',
  });

  const onSectionLayout = useCallback((e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setSectionY(y);
    sectionTopAnim.setValue(y);
  }, []);

  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    setGridY(e.nativeEvent.layout.y);
  }, []);

  return (
    <View onLayout={onSectionLayout} style={{ overflow: 'hidden' }}>

      {/* Parallax background */}
      <Animated.View style={[
        StyleSheet.absoluteFill,
        { top: -PARALLAX_OFFSET, bottom: -PARALLAX_OFFSET },
        { transform: [{ translateY: imageShift }] },
      ]}>
        <Image
          source={require('../../assets/sea1.png')}
          style={{ flex: 1, width: '100%' }}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Dark overlay */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      {/* Content */}
      <View style={[
        styles.content,
        { paddingVertical: isWide ? 64 : 40, paddingHorizontal: isWide ? 48 : 20 },
      ]}>
        <Text style={[styles.sectionTitle, { fontSize: isWide ? 36 : 22 }]}>
          Premium Resources Quick Links
        </Text>

        {/* Grid — onLayout gives Y relative to content View (= section root since content starts at y=0) */}
        <View
          onLayout={onGridLayout}
          style={[styles.grid, { maxWidth: isWide ? 820 : '100%' }]}
        >
          {QUICK_LINKS.map((item) => (
            <QuickLinkItem
              key={item.id}
              item={item}
              scrollY={scrollY}
              viewportH={viewportH}
              isWide={isWide}
              gridAbsoluteY={gridAbsoluteY}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay:      { backgroundColor: 'rgba(0, 12, 25, 0.62)' },
  content:      { position: 'relative' },
  sectionTitle: {
    color: '#ffffff', fontWeight: '900',
    textTransform: 'uppercase', textAlign: 'center',
    letterSpacing: 0.5, marginBottom: 36,
  },
  grid:         { alignSelf: 'center', width: '100%' },
  item:         { alignItems: 'center', position: 'relative' },
  particleAnchor: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 5,
  },
  button:       { backgroundColor: '#237893', borderRadius: 6, borderWidth: 1.5, borderColor: '#ffffff' },
  buttonPressed:{ backgroundColor: '#1a6070' },
  buttonText:   { color: '#ffffff', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  description:  { color: 'rgba(255,255,255,0.88)', textAlign: 'center' },
});
