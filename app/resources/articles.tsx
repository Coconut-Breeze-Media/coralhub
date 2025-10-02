// app/resources/articles.tsx
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { WebView } from "react-native-webview";

const PAGE_URL = "https://www.thecoralreefresearchhub.com/articles/";

const STRIP_CHROME_JS = `
(function () {
  var KEEP_SELECTORS = [
    '.wpb-content-wrapper',      // your site uses WPBakery wrapper
    'main', '#main', '#content', '.content'
  ];

  function ensureViewportAndCSS() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement('meta'); m.name='viewport'; document.head.appendChild(m); }
    m.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1');

    var s = document.createElement('style');
    s.setAttribute('data-from','app-clean');
    s.textContent = [
      'html,body{margin:0!important;padding:0!important}',
      'img,video{max-width:100%!important;height:auto!important}',
      '.vc_row{margin-left:0!important;margin-right:0!important}'
    ].join(';');
    if (!document.querySelector('style[data-from="app-clean"]')) document.head.appendChild(s);
  }

  function keepOnly() {
    // find first existing content wrapper
    var keep = null;
    for (var i=0;i<KEEP_SELECTORS.length;i++) {
      keep = document.querySelector(KEEP_SELECTORS[i]);
      if (keep) break;
    }
    if (!keep) return false;

    // clone to detach from any hidden/positioned parents
    var clone = keep.cloneNode(true);

    // nuke body and replace with just the clone
    document.body.innerHTML = '';
    document.body.appendChild(clone);

    // small scroll reset
    try { window.scrollTo(0,0); } catch(e){}
    return true;
  }

  function run() {
    ensureViewportAndCSS();
    if (!keepOnly()) {
      // try again a few times if builder injects late
      setTimeout(run, 150);
    }
  }

  // first pass
  run();

  // as extra defense, if anything mutates, enforce again
  var obs = new MutationObserver(function(){ run(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  true;
})();
`;

export default function ArticlesWebViewScreen() {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onReload = useCallback(() => {
    setErr(null);
    webRef.current?.reload();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setErr(null);
    webRef.current?.reload();
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Articles" }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        {err ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
            <Text style={{ color: "#b91c1c", textAlign: "center", marginBottom: 12 }}>
              {err}
            </Text>
            <Text onPress={onReload} style={{ color: "#2563eb", fontWeight: "700" }}>
              Try again
            </Text>
          </View>
        ) : (
          <>
            {loading && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: "#e5e7eb", zIndex: 10 }}>
                <ActivityIndicator style={{ marginTop: 6 }} />
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
              startInLoadingState={false}
              pullToRefreshEnabled
              // Run early and after load
              injectedJavaScriptBeforeContentLoaded={STRIP_CHROME_JS}
              injectedJavaScript={STRIP_CHROME_JS}
              javaScriptEnabled
              domStorageEnabled
            // If cache keeps showing old header, disable it while testing
              cacheEnabled={false}
            // (Android only) avoid cached header
            // @ts-ignore
              cacheMode="LOAD_NO_CACHE"
            />
          </>
        )}
      </SafeAreaView>
    </>
  );
}