// app/resources/grants.tsx
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, Text, View, Pressable, TouchableOpacity } from "react-native";
import { Stack } from "expo-router";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";

const PAGE_URL = "https://www.thecoralreefresearchhub.com/research-grants/";

const STRIP_CHROME_JS = `
(function () {
  var KEEP_SELECTORS = ['.wpb-content-wrapper','#main','#content','.content'];

  function reveal(note){
    requestAnimationFrame(function(){
      document.documentElement.style.visibility = '';
      document.documentElement.style.opacity = '';
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ tag:'GRANTS_DEBUG', msg:document.body.innerText })); } catch(e){}
    });
  }

  document.documentElement.style.visibility = 'hidden';
  document.documentElement.style.opacity = '0';

  setTimeout(function(){ reveal('done'); }, 1000);
})();
`;

export default function GrantsWebViewScreen() {
  const webRef = useRef<WebView>(null);
  const headerHeight = useHeaderHeight();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [membersOnly, setMembersOnly] = useState(false);

  const onReload = useCallback(() => {
    setErr(null);
    setMembersOnly(false);
    webRef.current?.reload();
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Research Grants",
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
        ) : membersOnly ? (
          // 🔒 Custom Members Only UI
          <View style={{ flex:1, justifyContent:"center", alignItems:"center", padding:20 }}>
            <View style={{
              width:"90%",
              backgroundColor:"#f9fafb",
              borderRadius:16,
              padding:20,
              shadowColor:"#000",
              shadowOpacity:0.1,
              shadowRadius:6,
              elevation:3,
              alignItems:"center"
            }}>
              <Text style={{ fontSize:18, fontWeight:"700", marginBottom:8 }}>Members Only</Text>
              <Text style={{ textAlign:"center", color:"#444", marginBottom:20 }}>
                This content is for Basic, Monthly, Annual, and Institutional members only.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor:"#2563eb",
                  paddingVertical:12,
                  borderRadius:8,
                  width:"100%",
                  marginBottom:12
                }}
                onPress={() => router.push("/(auth)/sign-in")}
              >
                <Text style={{ color:"#fff", textAlign:"center", fontWeight:"700" }}>Log In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  borderWidth:1,
                  borderColor:"#2563eb",
                  paddingVertical:12,
                  borderRadius:8,
                  width:"100%",
                  marginBottom:8
                }}
                onPress={() => router.push("/(auth)/sign-up")}
              >
                <Text style={{ color:"#2563eb", textAlign:"center", fontWeight:"700" }}>Upgrade Membership</Text>
              </TouchableOpacity>
              <Text style={{ color:"#666", fontSize:12 }}>Sorry for the inconvenience</Text>
            </View>
          </View>
        ) : (
          <>
            {/* Show spinner ONLY while truly loading */}
            {loading && (
              <View
                pointerEvents="none"
                style={{
                  position:"absolute",
                  top: headerHeight ?? 56,
                  left:0, right:0,
                  paddingVertical:8,
                  alignItems:"center",
                  justifyContent:"center",
                  zIndex:10,
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
              onError={(e) => { setLoading(false); setErr(`Failed to load page (${e.nativeEvent?.description || "network error"})`); }}
              injectedJavaScriptBeforeContentLoaded={STRIP_CHROME_JS}
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled={false}
              // @ts-ignore
              cacheMode="LOAD_NO_CACHE"
              onMessage={(e) => {
                const text = e.nativeEvent.data || "";
                if (typeof text === "string" && text.includes("This content is for Basic Membership")) {
                  setMembersOnly(true);
                }
              }}
            />
          </>
        )}
      </SafeAreaView>
    </>
  );
}