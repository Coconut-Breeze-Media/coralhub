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
    '.wpb-content-wrapper', 'main', '#main', '#content', '.content'
  ];
  var KILL_SELECTORS = [
    '#top-social',
    'ul.kleo-social-icons',
    'li.tabdrop',
    'header .kleo-social-icons',
    '.top-bar .kleo-social-icons'
  ];

  function log(msg, extra) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ tag: 'ARTICLES_DEBUG', msg, extra }));
    } catch (e) {}
  }

  function ensureViewportAndCSS() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement('meta'); m.name='viewport'; document.head.appendChild(m); }
    m.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1');

    if (!document.querySelector('style[data-from="app-clean"]')) {
      var s = document.createElement('style');
      s.setAttribute('data-from','app-clean');
      s.textContent = [
        'html,body{margin:0!important;padding:0!important}',
        'img,video{max-width:100%!important;height:auto!important}',
        '.vc_row{margin-left:0!important;margin-right:0!important}',
        /* nuclear CSS fallback */
        '#top-social, ul.kleo-social-icons, li.tabdrop,' +
        'header .kleo-social-icons, .top-bar .kleo-social-icons' +
        '{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}'
      ].join(';');
      document.head.appendChild(s);
      log('Injected CSS');
    }
  }

  function killChrome(why) {
    var removed = 0;
    KILL_SELECTORS.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(n){
        try { n.remove(); removed++; } catch(e){}
      });
    });
    var still = {
      top_social: document.querySelectorAll('#top-social').length,
      kleo_lists: document.querySelectorAll('ul.kleo-social-icons').length,
      tabdrop: document.querySelectorAll('li.tabdrop').length
    };
    log('killChrome(' + why + ')', { removed, still });
  }

  function keepOnly() {
    var keep = null, matchedSel = null;
    for (var i=0;i<KEEP_SELECTORS.length;i++) {
      keep = document.querySelector(KEEP_SELECTORS[i]);
      if (keep) { matchedSel = KEEP_SELECTORS[i]; break; }
    }
    if (!keep) { log('keepOnly: NO KEEP CONTAINER FOUND'); return false; }

    // If the "keep" contains the social list, we’ll still nuke it later.
    var clone = keep.cloneNode(true);
    document.body.innerHTML = '';
    document.body.appendChild(clone);
    try { window.scrollTo(0,0); } catch(e){}
    log('keepOnly: kept container', { matchedSel, childCount: clone.childElementCount });
    return true;
  }

  function run(phase) {
    ensureViewportAndCSS();
    killChrome('pre-' + phase);
    if (!keepOnly()) {
      setTimeout(function(){ run('retry'); }, 150);
    } else {
      // After we’ve replaced the body, run another kill in case the clone carried any social nodes
      killChrome('post-keepOnly');
    }
  }

  // First pass
  run('initial');

  // Re-enforce if the theme mutates the DOM later
  var obs = new MutationObserver(function(mutations){
    // If anything adds nodes that match, kill again
    var reAdd = false;
    for (var i=0;i<mutations.length;i++) {
      var m = mutations[i];
      if (m.addedNodes && m.addedNodes.length) { reAdd = true; break; }
    }
    if (reAdd) killChrome('mutation');
  });
  try {
    obs.observe(document.documentElement, { childList: true, subtree: true });
    log('Observer attached');
  } catch(e) {
    log('Observer failed', { error: String(e) });
  }

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
              injectedJavaScriptBeforeContentLoaded={STRIP_CHROME_JS}
              injectedJavaScript={STRIP_CHROME_JS}
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled={false}
              // @ts-ignore
              cacheMode="LOAD_NO_CACHE"
              onMessage={(e) => {
                try {
                  const payload = JSON.parse(e.nativeEvent.data);
                  if (payload?.tag === 'ARTICLES_DEBUG') {
                    console.log('[ArticlesWebView]', payload.msg, payload.extra ?? '');
                  }
                } catch {
                  console.log('[ArticlesWebView:raw]', e.nativeEvent.data);
                }
              }}
            />
          </>
        )}  
      </SafeAreaView>
    </>
  );
}