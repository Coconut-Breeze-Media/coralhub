import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, View } from 'react-native';
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
      {w > 0 && BUBBLES.map(b => <Bubble key={b.id} config={b} w={w} h={h} />)}

      <View style={{ position: 'relative', zIndex: 10 }}>
        {children}
      </View>
    </View>
  );
}
