// // components/ActivityRow.tsx
// import React, { useMemo } from 'react';
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   Image,
//   TextInput,
//   ActivityIndicator,
//   Linking,
// } from 'react-native';
// import RenderHTML from 'react-native-render-html';
// import type { HydratedActivity } from '../hooks/useActivityFeed';
// import LinkPreviewCard, { type LinkPreviewData } from './LinkPreviewCard';
// import { extractFirstLink } from '../utils/extractFirstLink';

// const PRIMARY = '#0077b6';
// const BORDER  = '#e5e7eb';
// const MUTED   = '#6b7280';
// const DANGER  = '#dc2626';

// /* ---------------------------
//    Youzify link preview helpers
// ----------------------------*/

// /** Extract a Youzify link preview block (title/desc/url/image) from BuddyPress HTML */
// function parseYouzifyPreview(html: string): LinkPreviewData | null {
//   const blockMatch = html.match(/<div\s+class=["']youzify-post-attachments["'][\s\S]*?<\/div>/i);
//   if (!blockMatch) return null;
//   const block = blockMatch[0];

//   const urlMatch   = block.match(/<a[^>]*href=(['"])(.*?)\1/i);
//   const imgMatch   = block.match(/<img[^>]*\s(?:src|data-src)=(['"])(.*?)\1/i);
//   const titleMatch = block.match(/<div[^>]*youzify-wall-link-title[^>]*>([\s\S]*?)<\/div>/i);
//   const descMatch  = block.match(/<div[^>]*youzify-wall-link-desc[^>]*>([\s\S]*?)<\/div>/i);
//   const domMatch   = block.match(/<div[^>]*youzify-wall-link-url[^>]*>([\s\S]*?)<\/div>/i);

//   const url = urlMatch?.[2] || extractFirstLink(html);
//   if (!url) return null;

//   const clean = (s?: string) =>
//     s?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || undefined;

//   return {
//     url,
//     imageUrl: imgMatch?.[2],
//     title: clean(titleMatch?.[1]),
//     description: clean(descMatch?.[1]),
//     domain: clean(domMatch?.[1]),
//   };
// }

// /** Remove the Youzify preview block from the HTML so we can render our own card */
// /** Normalize text for robust comparisons */

// /** Normalize text for robust comparisons */
// function norm(s?: string) {
//   return (s ?? '')
//     .replace(/&nbsp;/gi, ' ')
//     .replace(/\u00A0/g, ' ')
//     .replace(/[‘’]/g, "'")
//     .replace(/[“”]/g, '"')
//     .replace(/[–—]/g, '-')          // normalize dashes
//     .replace(/\s+/g, ' ')
//     .trim()
//     .toLowerCase();
// }

// /** Remove a standalone <p><a href="…">…</a></p> (exact block match) */
// function removeStandaloneLink(html: string, url?: string): string {
//   if (!url) return html;
//   const esc = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//   const rx = new RegExp(
//     `<p[^>]*>\\s*<a[^>]*href=["']${esc}["'][^>]*>[^<]*<\\/a>\\s*<\\/p>`,
//     'i'
//   );
//   return html.replace(rx, '');
// }

// /** Also remove any <p> whose inner text CONTAINS the URL/host */
// function removeUrlParas(html: string, url?: string): string {
//   if (!url) return html;

//   let host = '';
//   try { host = new URL(url).hostname; } catch {}

//   const hostBare = norm(host.replace(/^www\./, ''));
//   const variants = new Set([hostBare, `www.${hostBare}`]);

//   return html.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (m) => {
//     const text = norm(m.replace(/<[^>]+>/g, ''));
//     if (!text) return '';
//     if (text.includes(norm(url))) return '';          // full URL
//     for (const v of variants) {
//       if (text.includes(v)) return '';               // host variant
//     }
//     return m;
//   });
// }

// /** Remove <p>domain.com</p> (and simple host-only variants) */
// function removeDomainParas(html: string, url?: string, domain?: string): string {
//   let host = '';
//   try { host = new URL(url || '').hostname || ''; } catch {}
//   const base = norm(domain || host);
//   if (!base) return html;

//   const variants = new Set([base, base.replace(/^www\./, ''), `www.${base.replace(/^www\./, '')}`]);

//   return html.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (m) => {
//     const text = norm(m.replace(/<[^>]+>/g, ''));
//     return variants.has(text) ? '' : m;
//   });
// }

// /** Remove paragraphs that duplicate the OG description or title */
// function removeDescriptionParas(html: string, description?: string, title?: string): string {
//   const d = norm(description);
//   const t = norm(title);
//   if (!d && !t) return html;

//   return html.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (m) => {
//     const text = norm(m.replace(/<[^>]+>/g, ''));
//     if (!text) return m;
//     // exact match or substring match to OG description
//     if (d && (text === d || d.startsWith(text) || text.startsWith(d))) return '';
//     if (t && text === t) return '';
//     return m;
//   });
// }

// /** Remove empty spacer paragraphs */
// function removeEmptyParas(html: string): string {
//   return html.replace(/<p[^>]*>\s*(?:&nbsp;|\u00A0|\s)*<\/p>/gi, '');
// }

// /** Strip the Youzify preview block div */
// function stripYouzifyPreview(html: string): string {
//   return html.replace(/<div\s+class=["']youzify-post-attachments["'][\s\S]*?<\/div>/i, '');
// }

// /* ---------------------------
//    Small UI helper components
// ----------------------------*/

// function ActivityHeader({
//   avatar,
//   name,
//   dateISO,
// }: {
//   avatar?: string;
//   name: string;
//   dateISO: string;
// }) {
//   return (
//     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
//       {avatar ? (
//         <Image
//           source={{ uri: avatar }}
//           style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd' }}
//         />
//       ) : (
//         <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb' }} />
//       )}
//       <View style={{ flex: 1 }}>
//         <Text style={{ fontWeight: '700' }} numberOfLines={1}>{name}</Text>
//         <Text style={{ color: MUTED, fontSize: 12 }}>{new Date(dateISO).toLocaleString()}</Text>
//       </View>
//     </View>
//   );
// }

// function ActivityBody({
//   html,
//   contentWidth,
//   preview,
// }: {
//   html: string;
//   contentWidth: number;
//   preview?: LinkPreviewData | null;
// }) {
//   const body = html.replace(/<br\s*\/?>/gi, '\n');
//   return (
//     <>
//       {!!body.trim() && (
//         <RenderHTML
//         contentWidth={contentWidth}
//         source={{ html: body }}
//         tagsStyles={{ p: { marginTop: 0, marginBottom: 8 } }}
//         renderersProps={{ a: { onPress: (_e, href?: string) => href && Linking.openURL(href) } }}
//       />
//       )}
//       {!!preview && (
//         <View style={{ marginTop: 10 }}>
//           <LinkPreviewCard {...preview} />
//         </View>
//       )}
//     </>
//   );
// }

// function ActivityActions({
//   liked,
//   likeCount,
//   onLike,
//   onToggleComments,
//   commentCount,
//   commentsOpen,
//   repliesLen,
//   shareUrl,
// }: {
//   liked: boolean;
//   likeCount: number;
//   onLike: () => void;
//   onToggleComments: () => void;
//   commentCount: number;
//   commentsOpen: boolean;
//   repliesLen: number;
//   shareUrl?: string;
// }) {
//   return (
//     <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
//       <TouchableOpacity onPress={onLike}>
//         <Text style={{ color: PRIMARY }}>
//           {liked ? '♥ Liked' : '♡ Like'} {likeCount || ''}
//         </Text>
//       </TouchableOpacity>
//       <TouchableOpacity onPress={onToggleComments}>
//         <Text style={{ color: PRIMARY }}>
//           Comment {commentCount || (commentsOpen ? repliesLen || '' : '')}
//         </Text>
//       </TouchableOpacity>
//       <TouchableOpacity onPress={() => shareUrl && Linking.openURL(shareUrl)}>
//         <Text style={{ color: PRIMARY }}>Share</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// function CommentsSection({
//   open,
//   loading,
//   replies,
//   contentWidth,
//   draft,
//   setDraft,
//   submit,
//   errorMessage,
//   sending,
// }: {
//   open: boolean;
//   loading: boolean;
//   replies: any[];
//   contentWidth: number;
//   draft: string;
//   setDraft: (v: string) => void;
//   submit: () => void;
//   errorMessage?: string;
//   sending?: boolean;
// }) {
//   if (!open) return null;

//   return (
//     <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: BORDER, gap: 10 }}>
//       {loading ? (
//         <ActivityIndicator />
//       ) : replies.length === 0 ? (
//         <Text style={{ color: MUTED }}>No comments yet.</Text>
//       ) : (
//         replies.map((r) => (
//           <View key={r.id} style={{ paddingVertical: 6 }}>
//             {!!r.content && (
//               <RenderHTML
//                 contentWidth={contentWidth}
//                 source={{ html: typeof r.content === 'string' ? r.content : (r.content?.rendered ?? '') }}
//                 renderersProps={{
//                   a: { onPress: (_e: any, href?: string) => href && Linking.openURL(href) },
//                 }}
//               />
//             )}
//             <Text style={{ color: MUTED, fontSize: 12 }}>{new Date(r.date).toLocaleString()}</Text>
//           </View>
//         ))
//       )}

//       {/* composer */}
//       <View style={{ gap: 8 }}>
//         <TextInput
//           value={draft}
//           onChangeText={setDraft}
//           placeholder="Write a comment…"
//           multiline
//           style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10, minHeight: 44 }}
//         />
//         {!!errorMessage && <Text style={{ color: DANGER, fontSize: 12 }}>{errorMessage}</Text>}
//         <TouchableOpacity
//           onPress={submit}
//           disabled={sending || !draft.trim()}
//           style={{
//             alignSelf: 'flex-end',
//             backgroundColor: !draft.trim() || sending ? '#93c5fd' : PRIMARY,
//             paddingHorizontal: 14,
//             paddingVertical: 10,
//             borderRadius: 10,
//             opacity: sending ? 0.8 : 1,
//           }}
//         >
//           {sending ? <ActivityIndicator /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>}
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// }

// /* ---------------------------
//    Main row component
// ----------------------------*/

// export default function ActivityRow({
//   item,
//   contentWidth,
//   onLike,
//   onToggleComments,
//   commentsOpen,
//   replies,
//   repliesLoading,
//   replyValue,
//   onChangeReply,
//   onSubmitReply,
//   errorMessage,
//   sending = false,
// }: {
//   item: HydratedActivity;
//   contentWidth: number;
//   onLike: (id: number, liked: boolean) => void;
//   onToggleComments: () => void;

//   commentsOpen: boolean;
//   replies: any[];
//   repliesLoading: boolean;

//   replyValue: string;
//   onChangeReply: (v: string) => void;
//   onSubmitReply: () => void;

//   errorMessage?: string;
//   sending?: boolean;
// }) {
//   const avatar = item.member?.avatar_urls?.thumb || item.member?.avatar_urls?.full;
//   const name = item.member?.name || 'Member';


//   const { preview, htmlBody, shareUrl } = useMemo(() => {
//     const rawHtml   = item.html || '';
//     const preview_  = parseYouzifyPreview(rawHtml);
  
//     let body = stripYouzifyPreview(rawHtml);                        // 1. remove Youzify card
//     body = removeStandaloneLink(body, preview_?.url);               // 2. exact <p><a href=…/></p>
//     body = removeUrlParas(body, preview_?.url);                     // 3. any <p> containing full URL/host
//     body = removeDomainParas(body, preview_?.url, preview_?.domain);// 4. pure domain line variants
//     body = removeDescriptionParas(body, preview_?.description,      // 5. OG description/title dupes
//                                   preview_?.title);
//     body = removeEmptyParas(body);                                  // 6. tidy up empties
  
//     const share = preview_?.url || extractFirstLink(rawHtml) || undefined;
//     return { preview: preview_, htmlBody: body, shareUrl: share };
//   }, [item.html]);

// const { liked, likeCount, commentCount } = useMemo(() => {
//   return {
//     liked: !!item.favorited,
//     likeCount: item.favorite_count ?? 0,
//     commentCount: item.comment_count ?? 0,
//   };
// }, [item.favorited, item.favorite_count, item.comment_count]);

//   return (
//     <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: BORDER }}>
//       <ActivityHeader avatar={avatar} name={name} dateISO={item.date} />

//       <ActivityBody html={htmlBody} contentWidth={contentWidth} preview={preview} />

//       <ActivityActions
//         liked={liked}
//         likeCount={likeCount}
//         onLike={() => onLike(item.id, liked)}
//         onToggleComments={onToggleComments}
//         commentCount={commentCount}
//         commentsOpen={commentsOpen}
//         repliesLen={replies.length}
//         shareUrl={shareUrl}
//       />

//       <CommentsSection
//         open={commentsOpen}
//         loading={repliesLoading}
//         replies={replies}
//         contentWidth={contentWidth}
//         draft={replyValue}
//         setDraft={onChangeReply}
//         submit={onSubmitReply}
//         errorMessage={errorMessage}
//         sending={sending}
//       />
//     </View>
//   );
// }


// components/ActivityRow.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import RenderHTML from 'react-native-render-html';
import type { HydratedActivity } from '../hooks/useActivityFeed';
import LinkPreviewCard, { type LinkPreviewData } from './LinkPreviewCard';
import { extractFirstLink } from '../utils/extractFirstLink';

const PRIMARY = '#0077b6';
const BORDER  = '#e5e7eb';
const MUTED   = '#6b7280';
const DANGER  = '#dc2626';

/* ──────────────────────────────────
   DEBUG INSPECTORS (toggleable)
────────────────────────────────── */
const DEBUG = false; // ← set to false when done

function splitParas(html: string) {
  const matches = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  return matches.map((raw, idx) => ({
    idx,
    raw,
    text: raw
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;|\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  }));
}

function DebugBlock({
  stage,
  html,
  preview,
}: {
  stage: string;
  html: string;
  preview?: LinkPreviewData | null;
}) {
  const paras = splitParas(html);
  return (
    <View
      style={{
        padding: 8,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 6,
        backgroundColor: '#f9fafb',
      }}
    >
      <Text style={{ fontWeight: '700', marginBottom: 6 }}>DEBUG: {stage}</Text>
      {!!preview && (
        <View style={{ marginBottom: 8 }}>
          <Text selectable>preview.url: {preview.url || '—'}</Text>
          <Text selectable>preview.title: {preview.title || '—'}</Text>
          <Text selectable>preview.domain: {preview.domain || '—'}</Text>
          <Text selectable numberOfLines={3}>
            preview.description: {preview.description || '—'}
          </Text>
        </View>
      )}
      <Text style={{ fontWeight: '700', marginBottom: 4 }}>
        Paragraphs ({paras.length})
      </Text>
      {paras.map((p) => (
        <View key={p.idx} style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>#{p.idx} text:</Text>
          <Text
            selectable
            style={{
              fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
            }}
          >
            {p.text || '∅'}
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>raw HTML:</Text>
          <Text
            selectable
            style={{
              fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
            }}
          >
            {p.raw}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ──────────────────────────────────
   Youzify link preview helpers
────────────────────────────────── */

function parseYouzifyPreview(html: string): LinkPreviewData | null {
  const blockMatch = html.match(
    /<div\s+class=["']youzify-post-attachments["'][\s\S]*?<\/div>/i
  );
  if (!blockMatch) return null;
  const block = blockMatch[0];

  const urlMatch   = block.match(/<a[^>]*href=(['"])(.*?)\1/i);
  const imgMatch   = block.match(/<img[^>]*\s(?:src|data-src)=(['"])(.*?)\1/i);
  const titleMatch = block.match(/<div[^>]*youzify-wall-link-title[^>]*>([\s\S]*?)<\/div>/i);
  const descMatch  = block.match(/<div[^>]*youzify-wall-link-desc[^>]*>([\s\S]*?)<\/div>/i);
  const domMatch   = block.match(/<div[^>]*youzify-wall-link-url[^>]*>([\s\S]*?)<\/div>/i);

  const url = urlMatch?.[2] || extractFirstLink(html);
  if (!url) return null;

  const clean = (s?: string) =>
    s?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || undefined;

  return {
    url,
    imageUrl: imgMatch?.[2],
    title: clean(titleMatch?.[1]),
    description: clean(descMatch?.[1]),
    domain: clean(domMatch?.[1]),
  };
}

function norm(s?: string) {
  return (s ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripYouzifyPreview(html: string): string {
  return html.replace(
    /<div\s+class=["']youzify-post-attachments["'][\s\S]*?<\/div>/i,
    ''
  );
}

function removeStandaloneLink(html: string, url?: string): string {
  if (!url) return html;
  const esc = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(
    `<p[^>]*>\\s*<a[^>]*href=["']${esc}["'][^>]*>[^<]*<\\/a>\\s*<\\/p>`,
    'i'
  );
  return html.replace(rx, '');
}

function removeUrlParas(html: string, url?: string): string {
  if (!url) return html;

  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {}

  const hostBare = norm(host.replace(/^www\./, ''));
  const variants = new Set([hostBare, `www.${hostBare}`]);

  return html.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (m) => {
    const text = norm(m.replace(/<[^>]+>/g, ''));
    if (!text) return '';
    if (text.includes(norm(url))) return ''; // full URL present
    for (const v of variants) {
      if (text.includes(v)) return ''; // host variant present
    }
    return m;
  });
}

function removeDomainParas(html: string, url?: string, domain?: string): string {
  let host = '';
  try {
    host = new URL(url || '').hostname || '';
  } catch {}
  const base = norm(domain || host);
  if (!base) return html;

  const variants = new Set([
    base,
    base.replace(/^www\./, ''),
    `www.${base.replace(/^www\./, '')}`,
  ]);

  return html.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (m) => {
    const text = norm(m.replace(/<[^>]+>/g, ''));
    return variants.has(text) ? '' : m;
  });
}

function removeDescriptionParas(
  html: string,
  description?: string,
  title?: string
): string {
  const d = norm(description);
  const t = norm(title);
  if (!d && !t) return html;

  const head = d ? d.slice(0, 90) : ''; // fuzzy startsWith head

  return html.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (m) => {
    const text = norm(m.replace(/<[^>]+>/g, ''));
    if (!text) return m;
    if (head && (text.startsWith(head) || head.startsWith(text))) return '';
    if (t && text === t) return '';
    return m;
  });
}

function removeEmptyParas(html: string): string {
  return html.replace(/<p[^>]*>\s*(?:&nbsp;|\u00A0|\s)*<\/p>/gi, '');
}
/** Keep only the first <p>…</p> block; discard anything after it */
function keepOnlyFirstParagraph(html: string): string {
  const m = html.match(/<p\b[\s\S]*?<\/p>/i);
  if (m) return m[0];
  // Fallback: no <p> tags, keep up to the first line break
  const idx = html.indexOf('\n');
  return idx >= 0 ? html.slice(0, idx) : html;
}
/* ──────────────────────────────────
   Small UI pieces
────────────────────────────────── */

function ActivityHeader({
  avatar,
  name,
  dateISO,
}: {
  avatar?: string;
  name: string;
  dateISO: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      {avatar ? (
        <Image
          source={{ uri: avatar }}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd' }}
        />
      ) : (
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb' }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700' }} numberOfLines={1}>{name}</Text>
        <Text style={{ color: MUTED, fontSize: 12 }}>{new Date(dateISO).toLocaleString()}</Text>
      </View>
    </View>
  );
}

function ActivityBody({
  html,
  contentWidth,
  preview,
}: {
  html: string;
  contentWidth: number;
  preview?: LinkPreviewData | null;
}) {
  const body = html.replace(/<br\s*\/?>/gi, '\n');
  return (
    <>
      {!!body.trim() && (
        <RenderHTML
          contentWidth={contentWidth}
          source={{ html: body }}
          tagsStyles={{ p: { marginTop: 0, marginBottom: 8 } }}
          renderersProps={{
            a: { onPress: (_e: any, href?: string) => href && Linking.openURL(href) },
          }}
        />
      )}
      {!!preview && (
        <View style={{ marginTop: 10 }}>
          <LinkPreviewCard {...preview} />
        </View>
      )}
    </>
  );
}

function ActivityActions({
  liked,
  likeCount,
  onLike,
  onToggleComments,
  commentCount,
  commentsOpen,
  repliesLen,
  shareUrl,
}: {
  liked: boolean;
  likeCount: number;
  onLike: () => void;
  onToggleComments: () => void;
  commentCount: number;
  commentsOpen: boolean;
  repliesLen: number;
  shareUrl?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
      <TouchableOpacity onPress={onLike}>
        <Text style={{ color: PRIMARY }}>
          {liked ? '♥ Liked' : '♡ Like'} {likeCount || ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggleComments}>
        <Text style={{ color: PRIMARY }}>
          Comment {commentCount || (commentsOpen ? repliesLen || '' : '')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => shareUrl && Linking.openURL(shareUrl)}>
        <Text style={{ color: PRIMARY }}>Share</Text>
      </TouchableOpacity>
    </View>
  );
}

function CommentsSection({
  open,
  loading,
  replies,
  contentWidth,
  draft,
  setDraft,
  submit,
  errorMessage,
  sending,
}: {
  open: boolean;
  loading: boolean;
  replies: any[];
  contentWidth: number;
  draft: string;
  setDraft: (v: string) => void;
  submit: () => void;
  errorMessage?: string;
  sending?: boolean;
}) {
  if (!open) return null;

  return (
    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: BORDER, gap: 10 }}>
      {loading ? (
        <ActivityIndicator />
      ) : replies.length === 0 ? (
        <Text style={{ color: MUTED }}>No comments yet.</Text>
      ) : (
        replies.map((r) => (
          <View key={r.id} style={{ paddingVertical: 6 }}>
            {!!r.content && (
              <RenderHTML
                contentWidth={contentWidth}
                source={{ html: typeof r.content === 'string' ? r.content : (r.content?.rendered ?? '') }}
                renderersProps={{
                  a: { onPress: (_e: any, href?: string) => href && Linking.openURL(href) },
                }}
              />
            )}
            <Text style={{ color: MUTED, fontSize: 12 }}>{new Date(r.date).toLocaleString()}</Text>
          </View>
        ))
      )}

      {/* composer */}
      <View style={{ gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a comment…"
          multiline
          style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10, minHeight: 44 }}
        />
        {!!errorMessage && <Text style={{ color: DANGER, fontSize: 12 }}>{errorMessage}</Text>}
        <TouchableOpacity
          onPress={submit}
          disabled={sending || !draft.trim()}
          style={{
            alignSelf: 'flex-end',
            backgroundColor: !draft.trim() || sending ? '#93c5fd' : PRIMARY,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            opacity: sending ? 0.8 : 1,
          }}
        >
          {sending ? <ActivityIndicator /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ──────────────────────────────────
   Main row component
────────────────────────────────── */

export default function ActivityRow({
  item,
  contentWidth,
  onLike,
  onToggleComments,
  commentsOpen,
  replies,
  repliesLoading,
  replyValue,
  onChangeReply,
  onSubmitReply,
  errorMessage,
  sending = false,
}: {
  item: HydratedActivity;
  contentWidth: number;
  onLike: (id: number, liked: boolean) => void;
  onToggleComments: () => void;

  commentsOpen: boolean;
  replies: any[];
  repliesLoading: boolean;

  replyValue: string;
  onChangeReply: (v: string) => void;
  onSubmitReply: () => void;

  errorMessage?: string;
  sending?: boolean;
}) {
  const avatar = item.member?.avatar_urls?.thumb || item.member?.avatar_urls?.full;
  const name = item.member?.name || 'Member';

  // Derive sanitized HTML + preview + share
  
// inside ActivityRow, after `const name = ...`
const {
  preview,
  rawHtml,
  afterStrip,
  afterStandalone,
  afterUrlParas,
  afterDomainParas,
  afterDesc,
  afterEmpty,
  htmlBody,          // <- keep this name; ActivityBody uses it
  shareUrl,
} = useMemo(() => {
  const raw = item.html || '';
  const p   = parseYouzifyPreview(raw);

  const s0 = raw;
  const s1 = stripYouzifyPreview(s0);
  const s2 = removeStandaloneLink(s1, p?.url);
  const s3 = removeUrlParas(s2, p?.url);
  const s4 = removeDomainParas(s3, p?.url, p?.domain);
  const s5 = removeDescriptionParas(s4, p?.description, p?.title);
  const s6 = removeEmptyParas(s5);

  // 👇 NEW: if there’s a preview, only keep the first paragraph like the website
  const finalBody = p ? keepOnlyFirstParagraph(s6) : s6;

  return {
    preview: p,
    rawHtml: s0,
    afterStrip: s1,
    afterStandalone: s2,
    afterUrlParas: s3,
    afterDomainParas: s4,
    afterDesc: s5,
    afterEmpty: s6,
    htmlBody: finalBody,                        // 👈 use the trimmed body
    shareUrl: p?.url || extractFirstLink(raw) || undefined,
  };
}, [item.html]);


  // Like / counts
  const { liked, likeCount, commentCount } = useMemo(() => {
    return {
      liked: !!(item as any).favorited,
      likeCount: (item as any).favorite_count ?? 0,
      commentCount: (item as any).comment_count ?? 0,
    };
  }, [item]);

  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: BORDER }}>
      <ActivityHeader avatar={avatar} name={name} dateISO={item.date} />

      {/* DEBUG STAGES */}
      {DEBUG && (
        <>
          <DebugBlock stage="RAW" html={rawHtml} preview={preview} />
          <DebugBlock stage="AFTER stripYouzifyPreview" html={afterStrip} />
          <DebugBlock stage="AFTER removeStandaloneLink" html={afterStandalone} />
          <DebugBlock stage="AFTER removeUrlParas" html={afterUrlParas} />
          <DebugBlock stage="AFTER removeDomainParas" html={afterDomainParas} />
          <DebugBlock stage="AFTER removeDescriptionParas" html={afterDesc} />
          <DebugBlock stage="AFTER removeEmptyParas (FINAL)" html={afterEmpty} />
        </>
      )}

      <ActivityBody html={htmlBody} contentWidth={contentWidth} preview={preview} />

      <ActivityActions
        liked={liked}
        likeCount={likeCount}
        onLike={() => onLike(item.id, liked)}
        onToggleComments={onToggleComments}
        commentCount={commentCount}
        commentsOpen={commentsOpen}
        repliesLen={replies.length}
        shareUrl={shareUrl}
      />

      <CommentsSection
        open={commentsOpen}
        loading={repliesLoading}
        replies={replies}
        contentWidth={contentWidth}
        draft={replyValue}
        setDraft={onChangeReply}
        submit={onSubmitReply}
        errorMessage={errorMessage}
        sending={sending}
      />
    </View>
  );
}