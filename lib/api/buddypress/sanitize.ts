export function sanitizeBuddyHtml(raw: string): string {
    return stripInvalidImgSrc(promoteDataSrcToSrc(decodeHtmlEntities(raw || '')));
  }
  
  function decodeHtmlEntities(input: string): string {
    return input
      .replace(/&nbsp;/g, ' ')
      .replace(/&#8211;/g, '–')
      .replace(/&#8217;/g, '’')
      .replace(/&#8220;/g, '“')
      .replace(/&#8221;/g, '”')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
  
  function promoteDataSrcToSrc(html: string): string {
    return html.replace(
      /<img\b([^>]*?)\sdata-src=(['"])(.*?)\2([^>]*)>/gi,
      (_m, pre, q, url, post) => `<img${pre} src=${q}${url}${q}${post}>`
    );
  }
  
  function stripInvalidImgSrc(html: string): string {
    return html
      .replace(/<img\b[^>]*\ssrc=(['"])\s*\1[^>]*>/gi, '')
      .replace(/<img\b[^>]*\ssrc=(['"])\s*about:[^'"]*\1[^>]*>/gi, '')
      .replace(/<img\b[^>]*\ssrc=(['"])\s*(?:javascript:[^'"]*|#)\1[^>]*>/gi, '');
  }