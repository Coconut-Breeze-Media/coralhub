// app/resources/fundamentals-course.tsx
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, Text, View, Pressable } from "react-native";
import { Stack } from "expo-router";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";

const PAGE_URL = "https://www.thecoralreefresearchhub.com/fundamentals/";

const STRIP_CHROME_JS = `
(function () {
  // 1) Identify the content container we want to KEEP
  var KEEP_SELECTORS = ['.wpb-content-wrapper','#main','#content','.content'];

  // 2) Potential header/menu/search/social bits to hide
  var KILL_SELECTORS = [
    'header[role="banner"]','#header','#masthead','.site-header','.kleo-main-header',
    '.main-header','.top-bar','.navbar',
    '.site-branding','.logo','.header-logo',
    '.nav-toggle','.menu-toggle','.responsive-menu-toggle','.mobile-menu-toggle',
    '.header-search','.search-toggle','.search-button','.search-icon','.toggle-search',
    '#top-social','ul.kleo-social-icons','li.tabdrop','header .kleo-social-icons','.top-bar .kleo-social-icons'
  ];

  // Avoid flash while we prepare
  document.documentElement.style.visibility = 'hidden';
  document.documentElement.style.opacity = '0';

  function reveal(note){
    requestAnimationFrame(function(){
      document.documentElement.style.visibility = '';
      document.documentElement.style.opacity = '';
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ tag:'FUNDAMENTALS_DEBUG', msg:'READY', extra:{via:note} })); } catch(e){}
    });
  }

  function findKeepNode(){
    for (var i=0;i<KEEP_SELECTORS.length;i++){
      var n = document.querySelector(KEEP_SELECTORS[i]);
      if (n) return { node:n, sel: KEEP_SELECTORS[i] };
    }
    return null;
  }

  function ancestorSet(el){
    var s = new Set();
    var cur = el;
    while (cur && cur.nodeType === 1) { s.add(cur); cur = cur.parentElement; }
    return s;
  }

  function safeHideHeaders(keep){
    var keepNode = keep.node;
    var keepAnc = ancestorSet(keepNode);

    KILL_SELECTORS.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(n){
        if (n === keepNode || keepAnc.has(n) || n.contains(keepNode)) return;
        n.style.setProperty('display','none','important');
        n.style.setProperty('visibility','hidden','important');
        n.style.setProperty('height','0','important');
        n.style.setProperty('overflow','hidden','important');
      });
    });
  }

  var attempts = 0, maxAttempts = 60; // ~3.6s
  (function tick(){
    var keep = findKeepNode();
    if (keep){
      safeHideHeaders(keep);
      reveal('kept:' + keep.sel);
      var obs = new MutationObserver(function(m){
        for (var i=0;i<m.length;i++){
          if (m[i].addedNodes && m[i].addedNodes.length){ safeHideHeaders(keep); break; }
        }
      });
      try { obs.observe(document.body || document.documentElement, { childList:true, subtree:true }); } catch(e){}
      return;
    }
    if (++attempts >= maxAttempts){
      reveal('fallback');
      return;
    }
    setTimeout(tick, 60);
  })();
})();
`;

export default function FundamentalsCourseWebViewScreen() {
  const webRef = useRef<WebView>(null);
  const headerHeight = useHeaderHeight();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const onReload = useCallback(() => {
    setErr(null);
    webRef.current?.reload();
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Fundamentals",
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
              hitSlop={12}
              style={{ paddingHorizontal: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        {err ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
            <Text style={{ color: "#b91c1c", marginBottom: 12 }}>{err}</Text>
            <Text onPress={onReload} style={{ color: "#2563eb", fontWeight: "700" }}>Try again</Text>
          </View>
        ) : (
          <>
            {loading && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: headerHeight ?? 56,
                  left: 0,
                  right: 0,
                  paddingVertical: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                }}
              >
                <ActivityIndicator />
              </View>
            )}
            <WebView
              ref={webRef}
              source={{ uri: PAGE_URL }}
              onLoadStart={() => { setLoading(true); setErr(null); }}
              onLoadEnd={() => setLoading(false)}
              onError={(e) => {
                setLoading(false);
                setErr(`Failed to load page (${e.nativeEvent?.description || "network error"})`);
              }}
              injectedJavaScriptBeforeContentLoaded={STRIP_CHROME_JS}
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled={false}
              // @ts-ignore
              cacheMode="LOAD_NO_CACHE"
              onMessage={(e) => console.log("[FundamentalsWebView]", e.nativeEvent.data)}
            />
          </>
        )}
      </SafeAreaView>
    </>
  );
}