import assert from 'node:assert/strict';
import { parseOpenGraph } from '../lib/linkPreview.ts';

const html = `
<html><head>
<title>Ignored when og:title exists</title>
<meta property="og:title" content="Coral connectivity">
<meta name="description" content="Plain description">
<meta property="og:description" content="How reef patches stay linked.">
<meta property="og:image" content="/photos/reef.jpg">
<meta property="og:site_name" content="The Kingfisher">
</head></html>
`;

const preview = parseOpenGraph(html, 'https://the-kingfisher.org/environment/oceans/global/coral_connectivity.html');
assert.equal(preview?.title, 'Coral connectivity');
assert.equal(preview?.description, 'How reef patches stay linked.');
assert.equal(preview?.image, 'https://the-kingfisher.org/photos/reef.jpg');
assert.equal(preview?.site_name, 'The Kingfisher');

const twitter = `
<meta name="twitter:title" content="Only twitter">
<meta name="twitter:image" content="https://cdn.example.com/card.png">
`;
const card = parseOpenGraph(twitter, 'https://example.com/post');
assert.equal(card?.title, 'Only twitter');
assert.equal(card?.image, 'https://cdn.example.com/card.png');

assert.equal(parseOpenGraph('<html></html>', 'https://example.com'), null);

console.log('ok - open graph parser');
