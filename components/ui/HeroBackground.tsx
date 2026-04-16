import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, View } from 'react-native';
import type { ReactNode } from 'react';

// ─── Bubble particles ──────────────────────────────────────────────────────────

interface BubbleConfig {
  id: number;
  xRatio: number;
  size: number;
  duration: number;
  delay: number;
  maxOpacity: number;
  sway: number;
  color: string;
}

const BUBBLES: BubbleConfig[] = [
  // tiny fast white bubbles
  { id: 0,  xRatio: 0.03, size: 2,  duration: 4000, delay: 0,    maxOpacity: 0.45, sway:  12, color: '#e8f4f8' },
  { id: 1,  xRatio: 0.08, size: 2,  duration: 4500, delay: 700,  maxOpacity: 0.40, sway: -10, color: '#d4f0fb' },
  { id: 2,  xRatio: 0.14, size: 3,  duration: 5000, delay: 1800, maxOpacity: 0.38, sway:  15, color: '#e8f4f8' },
  { id: 3,  xRatio: 0.20, size: 2,  duration: 4200, delay: 3300, maxOpacity: 0.44, sway:  -8, color: '#d4f0fb' },
  { id: 4,  xRatio: 0.27, size: 2,  duration: 4700, delay: 5500, maxOpacity: 0.36, sway:  11, color: '#e8f4f8' },
  { id: 5,  xRatio: 0.33, size: 3,  duration: 5200, delay: 900,  maxOpacity: 0.42, sway: -14, color: '#c2eaf5' },
  { id: 6,  xRatio: 0.40, size: 2,  duration: 4400, delay: 2600, maxOpacity: 0.40, sway:   9, color: '#e8f4f8' },
  { id: 7,  xRatio: 0.46, size: 2,  duration: 4800, delay: 4100, maxOpacity: 0.43, sway: -12, color: '#d4f0fb' },
  { id: 8,  xRatio: 0.52, size: 3,  duration: 5100, delay: 1400, maxOpacity: 0.37, sway:  16, color: '#e8f4f8' },
  { id: 9,  xRatio: 0.59, size: 2,  duration: 4300, delay: 6200, maxOpacity: 0.46, sway:  -9, color: '#c2eaf5' },
  { id: 10, xRatio: 0.65, size: 2,  duration: 4600, delay: 3000, maxOpacity: 0.39, sway:  13, color: '#e8f4f8' },
  { id: 11, xRatio: 0.71, size: 3,  duration: 5400, delay: 800,  maxOpacity: 0.35, sway: -17, color: '#d4f0fb' },
  { id: 12, xRatio: 0.77, size: 2,  duration: 4100, delay: 5000, maxOpacity: 0.42, sway:  10, color: '#e8f4f8' },
  { id: 13, xRatio: 0.83, size: 2,  duration: 4900, delay: 2100, maxOpacity: 0.38, sway: -11, color: '#d4f0fb' },
  { id: 14, xRatio: 0.89, size: 3,  duration: 5300, delay: 3700, maxOpacity: 0.41, sway:  14, color: '#e8f4f8' },
  { id: 15, xRatio: 0.95, size: 2,  duration: 4200, delay: 6800, maxOpacity: 0.44, sway:  -8, color: '#c2eaf5' },
  // medium cyan/teal bubbles
  { id: 16, xRatio: 0.06, size: 6,  duration: 7500,  delay: 1200, maxOpacity: 0.20, sway: -28, color: '#7ecbdf' },
  { id: 17, xRatio: 0.18, size: 5,  duration: 8200,  delay: 4000, maxOpacity: 0.22, sway:  24, color: '#a8dce8' },
  { id: 18, xRatio: 0.30, size: 7,  duration: 9000,  delay: 600,  maxOpacity: 0.17, sway: -22, color: '#7ecbdf' },
  { id: 19, xRatio: 0.44, size: 5,  duration: 7800,  delay: 5400, maxOpacity: 0.21, sway:  30, color: '#a8dce8' },
  { id: 20, xRatio: 0.57, size: 6,  duration: 8600,  delay: 2500, maxOpacity: 0.18, sway: -25, color: '#7ecbdf' },
  { id: 21, xRatio: 0.68, size: 7,  duration: 9300,  delay: 3600, maxOpacity: 0.16, sway:  20, color: '#b0f0d8' },
  { id: 22, xRatio: 0.79, size: 5,  duration: 8000,  delay: 900,  maxOpacity: 0.23, sway: -30, color: '#a8dce8' },
  { id: 23, xRatio: 0.91, size: 6,  duration: 7600,  delay: 7000, maxOpacity: 0.19, sway:  22, color: '#7ecbdf' },
  // large very slow bubbles
  { id: 24, xRatio: 0.12, size: 11, duration: 13000, delay: 5500, maxOpacity: 0.09, sway:  40, color: '#7ecbdf' },
  { id: 25, xRatio: 0.38, size: 13, duration: 15000, delay: 2000, maxOpacity: 0.07, sway: -35, color: '#a8dce8' },
  { id: 26, xRatio: 0.62, size: 10, duration: 12500, delay: 8500, maxOpacity: 0.10, sway:  32, color: '#7ecbdf' },
  { id: 27, xRatio: 0.85, size: 12, duration: 14000, delay: 1000, maxOpacity: 0.08, sway: -38, color: '#b0f0d8' },
  // bioluminescent green sparks
  { id: 28, xRatio: 0.10, size: 2,  duration: 5500, delay: 1100, maxOpacity: 0.55, sway:   7, color: '#80ffcc' },
  { id: 29, xRatio: 0.24, size: 2,  duration: 6200, delay: 3400, maxOpacity: 0.50, sway:  -9, color: '#64f0b8' },
  { id: 30, xRatio: 0.37, size: 2,  duration: 5000, delay: 200,  maxOpacity: 0.52, sway:  13, color: '#80ffcc' },
  { id: 31, xRatio: 0.50, size: 2,  duration: 6800, delay: 7200, maxOpacity: 0.48, sway:  -6, color: '#64f0b8' },
  { id: 32, xRatio: 0.63, size: 2,  duration: 5700, delay: 4800, maxOpacity: 0.54, sway:  11, color: '#80ffcc' },
  { id: 33, xRatio: 0.76, size: 2,  duration: 6000, delay: 1700, maxOpacity: 0.46, sway:  -8, color: '#64f0b8' },
  { id: 34, xRatio: 0.87, size: 2,  duration: 5300, delay: 5900, maxOpacity: 0.52, sway:  10, color: '#80ffcc' },
  { id: 35, xRatio: 0.96, size: 2,  duration: 6400, delay: 3100, maxOpacity: 0.49, sway:  -7, color: '#64f0b8' },
];

function Bubble({ config, w, h }: { config: BubbleConfig; w: number; h: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (w === 0 || h === 0) return;
    let stopped = false;

    const run = (initialDelay: number) => {
      if (stopped) return;
      anim.setValue(0);
      Animated.sequence([
        Animated.delay(initialDelay),
        Animated.timing(anim, { toValue: 1, duration: config.duration, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished && !stopped) run(0); });
    };

    run(config.delay);
    return () => { stopped = true; anim.stopAnimation(); };
  }, [w, h]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -(h + config.size + 20)] });
  const translateX = anim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, config.sway * 0.35, config.sway * 0.75, config.sway] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.08, 0.84, 1], outputRange: [0, config.maxOpacity, config.maxOpacity, 0] });

  return (
    <Animated.View style={{
      position: 'absolute',
      bottom: 0,
      left: config.xRatio * w,
      width: config.size,
      height: config.size,
      borderRadius: config.size / 2,
      backgroundColor: config.color,
      opacity,
      transform: [{ translateY }, { translateX }],
    }} />
  );
}

// ─── Seaweed blades ────────────────────────────────────────────────────────────

interface BladeConfig {
  id: number;
  xRatio: number;
  heightRatio: number;
  maxHeightPx: number;
  width: number;
  color: string;
  maxAngle: number;
  duration: number;
  delay: number;
  phase: number;
}

const BLADES: BladeConfig[] = [
  // far left
  { id: 0,  xRatio: 0.01, heightRatio: 0.28, maxHeightPx: 110, width: 7,  color: '#1a5c35', maxAngle: 12, duration: 2200, delay: 0,    phase:  0.0 },
  { id: 1,  xRatio: 0.04, heightRatio: 0.35, maxHeightPx: 130, width: 5,  color: '#2d8a4e', maxAngle: 16, duration: 2700, delay: 250,  phase:  0.6 },
  { id: 2,  xRatio: 0.08, heightRatio: 0.22, maxHeightPx:  90, width: 9,  color: '#0f4228', maxAngle: 10, duration: 1900, delay: 550,  phase: -0.4 },
  { id: 3,  xRatio: 0.12, heightRatio: 0.30, maxHeightPx: 115, width: 6,  color: '#3aad63', maxAngle: 14, duration: 2450, delay: 100,  phase:  0.3 },
  // center-left
  { id: 4,  xRatio: 0.26, heightRatio: 0.32, maxHeightPx: 120, width: 7,  color: '#236b3d', maxAngle: 13, duration: 2600, delay: 1100, phase: -0.5 },
  { id: 5,  xRatio: 0.30, heightRatio: 0.24, maxHeightPx:  95, width: 9,  color: '#1a5c35', maxAngle: 11, duration: 2050, delay: 400,  phase:  0.7 },
  { id: 6,  xRatio: 0.34, heightRatio: 0.38, maxHeightPx: 145, width: 5,  color: '#2d8a4e', maxAngle: 17, duration: 2900, delay: 750,  phase:  0.1 },
  { id: 7,  xRatio: 0.38, heightRatio: 0.26, maxHeightPx: 100, width: 8,  color: '#0f4228', maxAngle: 12, duration: 2300, delay: 600,  phase: -0.2 },
  // center
  { id: 8,  xRatio: 0.47, heightRatio: 0.25, maxHeightPx:  90, width: 6,  color: '#1a5c35', maxAngle: 11, duration: 2150, delay: 500,  phase: -0.3 },
  { id: 9,  xRatio: 0.53, heightRatio: 0.30, maxHeightPx: 110, width: 5,  color: '#2d8a4e', maxAngle: 14, duration: 2550, delay: 900,  phase:  0.5 },
  // center-right
  { id: 10, xRatio: 0.62, heightRatio: 0.29, maxHeightPx: 112, width: 7,  color: '#0f4228', maxAngle: 12, duration: 2200, delay: 200,  phase:  0.4 },
  { id: 11, xRatio: 0.66, heightRatio: 0.37, maxHeightPx: 140, width: 5,  color: '#3aad63', maxAngle: 16, duration: 2750, delay: 800,  phase: -0.6 },
  { id: 12, xRatio: 0.70, heightRatio: 0.23, maxHeightPx:  88, width: 9,  color: '#236b3d', maxAngle: 10, duration: 1950, delay: 350,  phase:  0.2 },
  { id: 13, xRatio: 0.74, heightRatio: 0.31, maxHeightPx: 118, width: 6,  color: '#2d8a4e', maxAngle: 13, duration: 2400, delay: 650,  phase: -0.1 },
  // far right
  { id: 14, xRatio: 0.84, heightRatio: 0.33, maxHeightPx: 125, width: 7,  color: '#1a5c35', maxAngle: 14, duration: 2500, delay: 600,  phase: -0.4 },
  { id: 15, xRatio: 0.88, heightRatio: 0.26, maxHeightPx:  98, width: 5,  color: '#236b3d', maxAngle: 11, duration: 1800, delay: 150,  phase:  0.6 },
  { id: 16, xRatio: 0.92, heightRatio: 0.36, maxHeightPx: 135, width: 6,  color: '#2d8a4e', maxAngle: 15, duration: 2650, delay: 450,  phase:  0.2 },
  { id: 17, xRatio: 0.97, heightRatio: 0.21, maxHeightPx:  80, width: 10, color: '#0f4228', maxAngle:  9, duration: 1700, delay: 750,  phase: -0.2 },
];

function SeaweedBlade({ config, w, h }: { config: BladeConfig; w: number; h: number }) {
  const sway   = useRef(new Animated.Value(config.phase)).current;
  const bladeH = Math.min(h * config.heightRatio, config.maxHeightPx);
  const half   = bladeH / 2;

  useEffect(() => {
    if (w === 0 || h === 0) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue:  1, duration: config.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: config.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    return () => sway.stopAnimation();
  }, [w, h]);

  const rotate = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: [`-${config.maxAngle}deg`, `${config.maxAngle}deg`],
  });

  return (
    <Animated.View style={{
      position: 'absolute',
      bottom: 0,
      left: config.xRatio * w,
      width: config.width,
      height: bladeH,
      borderTopLeftRadius:     config.width / 2,
      borderTopRightRadius:    config.width / 2,
      borderBottomLeftRadius:  2,
      borderBottomRightRadius: 2,
      backgroundColor: config.color,
      opacity: 0.80,
      transform: [{ translateY: half }, { rotate }, { translateY: -half }],
    }} />
  );
}

// ─── Ambient light rays ────────────────────────────────────────────────────────

interface RayConfig { id: number; xRatio: number; duration: number; delay: number; }

const RAYS: RayConfig[] = [
  { id: 0, xRatio: 0.18, duration: 6000, delay: 0    },
  { id: 1, xRatio: 0.48, duration: 7500, delay: 2500 },
  { id: 2, xRatio: 0.75, duration: 5500, delay: 1200 },
];

function LightRay({ config, w, h }: { config: RayConfig; w: number; h: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (w === 0 || h === 0) return;

    Animated.loop(
      Animated.sequence([
        Animated.delay(config.delay),
        Animated.timing(anim, { toValue: 1, duration: config.duration / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: config.duration / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    return () => anim.stopAnimation();
  }, [w, h]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] });

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 0,
      left: config.xRatio * w - 20,
      width: 40,
      height: h,
      backgroundColor: '#a8f0ff',
      opacity,
      transform: [{ skewX: '8deg' }],
    }} />
  );
}

// ─── Container ─────────────────────────────────────────────────────────────────

interface HeroBackgroundProps {
  children: ReactNode;
  paddingVertical?: number;
  paddingHorizontal?: number;
}

export default function HeroBackground({
  children,
  paddingVertical  = 32,
  paddingHorizontal = 20,
}: HeroBackgroundProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const { w, h } = size;

  return (
    <View
      onLayout={onLayout}
      style={{ backgroundColor: '#071e2a', paddingVertical, paddingHorizontal, overflow: 'hidden' }}
    >
      {w > 0 && RAYS.map(r    => <LightRay     key={r.id} config={r} w={w} h={h} />)}
      {w > 0 && BUBBLES.map(b => <Bubble       key={b.id} config={b} w={w} h={h} />)}
      {w > 0 && BLADES.map(b  => <SeaweedBlade key={b.id} config={b} w={w} h={h} />)}

      <View style={{ position: 'relative', zIndex: 10 }}>
        {children}
      </View>
    </View>
  );
}
