// // app/tabs/index.tsx
// import { useState, useEffect } from 'react';
// import { SafeAreaView, Text, TouchableOpacity, TextInput, FlatList, View } from 'react-native';
// import { getPosts, type WPPost } from '../../lib/api';

// export default function TestScreen() {

//   const [posts, setPosts] = useState<WPPost[]>([]);
//   const [loading, setLoading] = useState(false);

//   // fetch some posts (public) once ready
//   useEffect(() => {

//     setLoading(true);
//     getPosts(1)
//       .then((list) => {
//         console.log('[screen] posts len:', list.length);
//         setPosts(list);
//       })
//       .catch((e: unknown) => {
//         if (e instanceof Error) console.warn('[screen] getPosts failed:', e.message);
//         else console.warn('[screen] getPosts failed:', e);
//       })
//       .finally(() => setLoading(false));
//   }, []);


//   return (
//     <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
//       <Text style={{ fontSize: 22, fontWeight: '700' }}>Test Screen</Text>

//       <View style={{ flex: 1, marginTop: 16 }}>
//         <Text style={{ fontWeight: '600', marginBottom: 8 }}>Latest posts:</Text>
//         {loading ? (
//           <Text>Loading posts...</Text>
//         ) : (
//           <FlatList
//             data={posts}
//             keyExtractor={(p) => String(p.id)}
//             renderItem={({ item }) => (
//               <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
//                 <Text style={{ fontWeight: '700' }}>{item.title.rendered}</Text>
//               </View>
//             )}
//           />
//         )}
//       </View>
//     </SafeAreaView>
//   );
// }


// app/tabs/index.tsx
import { Text, View } from 'react-native';

export default function PlaceholderScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>News Feed (placeholder)</Text>
    </View>
  );
}