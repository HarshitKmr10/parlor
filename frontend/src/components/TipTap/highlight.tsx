'use client';

import React, { useEffect, useState } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import * as Diff from 'diff'; // Import the diff library
import { Flex, Heading, Text } from '@radix-ui/themes';
import RichTextEditor from 'components/TipTap/TipTap';

/**
 * STEP 1: Parse Markdown to AST
 */
function parseMarkdownToAst(markdown) {
  return unified().use(remarkParse).parse(markdown);
}

/**
 * STEP 2: AST Diffing
 *
 * We'll traverse both ASTs in parallel, comparing nodes one by one.
 * This is a *very simplified* approach:
 *   - If nodes differ in type (e.g., `heading` vs. `paragraph`), mark a style change.
 *   - If headings differ in depth (e.g., level 1 -> level 2), mark a style change.
 *   - If we have text changes, we do a text diff.
 */
function diffAst(oldAst, newAst, type) {
  // We assume both ASTs have a top-level "root" node with `type: 'root'`
  const diffedRoot = {
    type: 'root',
    children: diffChildren(oldAst.children || [], newAst.children || [], type),
  };
  return diffedRoot;
}

function diffChildren(oldChildren, newChildren, type) {
  const maxLength = Math.max(oldChildren.length, newChildren.length);
  const diffedChildren = [];

  for (let i = 0; i < maxLength; i++) {
    const oldNode = oldChildren[i];
    const newNode = newChildren[i];

    // If one of them is missing, we consider that fully added or fully removed
    if (!oldNode && newNode) {
      // Entire node is new
      if (type === 'added') diffedChildren.push(markNodeAdded(newNode));
    } else if (oldNode && !newNode) {
      // Entire node is removed
      if (type === 'removed') diffedChildren.push(markNodeRemoved(oldNode));
    } else {
      // Both exist; compare in detail
      diffedChildren.push(diffNodes(oldNode, newNode, type));
    }
  }

  return diffedChildren;
}

function diffNodes(oldNode, newNode, type) {
  // If the node types differ (e.g. heading vs paragraph), we mark them as changed
  if (oldNode.type !== newNode.type) {
    // We could keep the new node but highlight that it replaced the old node
    return markNodeReplaced(oldNode, newNode, type);
  }

  // If we have the same type, we handle it accordingly
  switch (oldNode.type) {
    case 'heading':
      return diffHeadingNodes(oldNode, newNode, type);
    case 'paragraph':
      return diffParagraphNodes(oldNode, newNode, type);
    case 'text':
      return diffTextNodes(oldNode, newNode, type);
    case 'list':
    case 'listItem':
    case 'blockquote':
      // For more node types, you might replicate a similar pattern or recursively diff children
      return diffContainerNodes(oldNode, newNode, type);

    default:
      // By default, we try to recursively diff children if they exist
      return diffContainerNodes(oldNode, newNode, type);
  }
}

/**
 * For heading nodes, compare the depth (level). If changed, mark as style change.
 * Then compare the children (which typically includes the text content).
 */
function diffHeadingNodes(oldNode, newNode, type) {
  const diffedNode = { ...newNode };

  // If heading level changed (# -> ##, i.e. depth 1 -> 2)
  if (oldNode.depth !== newNode.depth) {
    // We store some custom property to indicate the depth changed
    diffedNode.styleChanged = {
      oldDepth: oldNode.depth,
      newDepth: newNode.depth,
    };
  }

  // Now diff the children (the text inside the heading, if any)
  diffedNode.children = diffChildren(oldNode.children || [], newNode.children || [], type);
  return diffedNode;
}

/**
 * For paragraph nodes, just diff children (text).
 */
function diffParagraphNodes(oldNode, newNode, type) {
  const diffedNode = { ...newNode };
  diffedNode.children = diffChildren(oldNode.children || [], newNode.children || [], type);
  return diffedNode;
}

/**
 * For text nodes, we do a text-based diff using `diffWords`.
 * We replace the text node with one that has a "highlighted" value.
 */
function diffTextNodes(oldNode, newNode, type) {
  if (oldNode.value === newNode.value) {
    // No change
    return { ...newNode };
  }

  // Diff the text
  const changes = Diff.diffWords(oldNode.value, newNode.value);
  // Build a new string with Markdown highlighting
  let highlightedValue = '';
  changes.forEach((part) => {
    if (part.added && type === 'added') {
      highlightedValue += `<mark>${part.value}</mark>`;
    } else if (part.removed && type === 'removed') {
      highlightedValue += `<mark>~~${part.value}~~</mark>`;
    } else {
      highlightedValue += part.value;
    }
  });

  // Return a text node that includes the highlighting
  return {
    ...newNode,
    value: highlightedValue,
  };
}

/**
 * For container nodes (like lists, blockquotes, etc.), we recursively diff their children.
 */
function diffContainerNodes(oldNode, newNode, type) {
  const diffedNode = { ...newNode };
  diffedNode.children = diffChildren(oldNode.children || [], newNode.children || [], type);
  return diffedNode;
}

/**
 * Mark a node as entirely added (if it exists in new doc but not old doc).
 * One approach: wrap all text inside the node with **bold** or another marker.
 */
function markNodeAdded(node) {
  const clone = { ...node };
  if (node.children && node.children.length > 0) {
    clone.children = node.children.map((child) => markNodeAdded(child));
  } else if (node.type === 'text') {
    clone.value = `<mark>${node.value}</mark>`;
  }
  return clone;
}

/**
 * Mark a node as entirely removed (if it exists in old doc but not new doc).
 * One approach: wrap all text inside the node with ~~strikethrough~~.
 */
function markNodeRemoved(node, noStrike = false) {
  const clone = { ...node };
  if (node.children && node.children.length > 0) {
    clone.children = node.children.map((child) => markNodeRemoved(child));
  } else if (node.type === 'text') {
    // Wrap text in strikethrough
    clone.value = noStrike ? `<mark>${node.value}</mark>` : `<mark>~~${node.value}~~</mark>`;
  }
  return clone;
}


function markNodeReplaced(oldNode, newNode, type) {
  const removed = markNodeRemoved(oldNode, true);
  const added = markNodeAdded(newNode);
  if (type === 'removed') {
    return {
      type: 'paragraph',
      children: [
        ...(removed.children && removed.children.length > 0 ? removed.children : [removed]),
        {
          type: 'text',
          value: ' ',
        },
      ],
    };
  }

  return {
    type: 'paragraph',
    children: [
      {
        type: 'text',
        value: ' ',
      },
      ...(added.children && added.children.length > 0 ? added.children : [added]),
    ],
  };
}

/**
 * STEP 3: Generate Markdown from the diffed AST
 *
 * We can use remark-stringify directly, but we need a small plugin or custom logic
 * to handle the additional properties we've added (like `styleChanged`).
 * For simplicity, we'll do minimal special handling for heading style changes.
 */
function generateMarkdownFromDiff(diffedAst) {
  const transformedAst = applyStyleChanges(diffedAst);
  // Convert to string and ensure it's a string type
  const file = String(unified().use(remarkStringify).stringify(transformedAst));
  // Use replace with global regex instead of replaceAll
  return file.replace(/\\</g, '<');
}

function applyStyleChanges(node) {
  // If this node has styleChanged (like heading depth changes), we can highlight that somehow
  if (node.styleChanged) {
    const oldDepth = node.styleChanged.oldDepth;
    const newDepth = node.styleChanged.newDepth;
    // We can insert a marker at the beginning of the node and at the end of the node to mark change in style
    node.children.unshift({
      type: 'text',
      value: '<mark>',
    });
    node.children.push({
      type: 'text',
      value: '</mark>',
    });
  }

  // If children exist, recurse
  if (Array.isArray(node.children)) {
    node.children = node.children.map((child) => applyStyleChanges(child));
  }
  return node;
}

// --------------------------------------------------------------
// Example usage
// --------------------------------------------------------------
const ADDED_HIGHLIGHT = 'background-color: #dcfce7; transition: background-color 0.5s ease';
const REMOVED_HIGHLIGHT = 'background-color: #fee2e2; transition: background-color 0.5s ease';

function escapeInlineCode(markdown: string): { masked: string; map: string[] } {
  const map: string[] = [];
  const masked = markdown.replace(/`([^`]+?)`/g, (_, code) => {
    const id = `[[CODE-${map.length}]]`;
    map.push(code);
    return id;
  });
  return { masked, map };
}

function unescapeInlineCode(text: string, map: string[]): string {
  return text.replace(/\[\[CODE-(\d+)]]/g, (_, i) => `\`${map[parseInt(i, 10)]}\``);
}

export function diffMarkdownStrings(
  oldMarkdown: string,
  newMarkdown: string,
  type: 'added' | 'removed'
): string {
  const { masked: oldMasked } = escapeInlineCode(oldMarkdown);
  const { masked: newMasked, map: newCodeMap } = escapeInlineCode(newMarkdown);

  const oldFormatted = unified().use(remarkParse).use(remarkStringify).processSync(oldMasked).toString();
  const newFormatted = unified().use(remarkParse).use(remarkStringify).processSync(newMasked).toString();

  const changes = Diff.diffWords(oldFormatted, newFormatted);
  const hasDiffs = changes.some(part => part.added || part.removed);
  if (!hasDiffs) return newFormatted;

  let result = '';

  for (const part of changes) {
    const value = part.value;

    // Headings
    const headingMatch = value.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      if (type === 'added' && part.added)
        result += `<h${level}><mark style="${ADDED_HIGHLIGHT}">${headingText}</mark></h${level}>\n`;
      else if (type === 'removed' && part.removed)
        result += `<h${level}><mark style="${REMOVED_HIGHLIGHT}">~~${headingText}~~</mark></h${level}>\n`;
      else
        result += `<h${level}>${headingText}</h${level}>\n`;
      continue;
    }

    // Diff highlight logic
    if (type === 'added') {
      if (part.added) {
        result += `<mark style="${ADDED_HIGHLIGHT}">${value}</mark>`;
      } else if (!part.removed) {
        result += value;
      }
    } else {
      if (part.removed) {
        result += `<mark style="${REMOVED_HIGHLIGHT}">~~${value}~~</mark>`;
      } else if (!part.added) {
        result += value;
      }
    }
  }

  // 🟢 Final Fix: restore code blocks here
  return unescapeInlineCode(result, newCodeMap);
}

// Example usage within the same file (for testing):
const doc1 = `# My Title

Here's a numbered list:

  * this one
  * that one
  * the other sadasd
`;

// const doc2 = `### My Title

// This is the paragraph with some extra text.
// - itm1
// - itm3

// > Email-style angle brackets
 
// ---

// Ready to start writing?  Either start changing stuff on the left or
// `;

const doc2 = `
## My Title

Paragraphs are separated by a blank line.

  * this one
  * that one
  * the other one

Note that --- not considering the asterisk --- the actual text
content starts at 4-columns in.

> Block quotes are
> written like so.
>
> They can span multiple paragraphs,
> if you like.

Use 3 dashes for an em-dash. Use 2 dashes for ranges (ex., "it's all
in chapters 12--14"). Three dots ... will be converted to an ellipsis.
Unicode is supported. ☺



An h2 header
------------

Here's a numbered list:

 1. first item
 2. second item
 3. third item

Note again how the actual text starts at 4 columns in (4 characters
from the left side). Here's a code sample:

    # Let me re-iterate ...
    for i in 1 .. 10 { do-something(i) }

As you probably guessed, indented 4 spaces. By the way, instead of
indenting the block, you can use delimited blocks, if you like:

~~~
define foobar() {
    print "Welcome to flavor country!";
}
~~~

(which makes copying & pasting easier). You can optionally mark the
delimited block for Pandoc to syntax highlight it:

~~~python
import time
# Quick, count to ten!
for i in range(10):
    # (but not *too* quick)
    time.sleep(0.5)
    print i
~~~
`;

// playground
function Playground() {
  const [contentOld, setContentOld] = useState('');
  const [contentNew, setContentNew] = useState('');

  useEffect(() => {
    const finalDiff1 = diffMarkdownStrings(doc1, doc2, 'removed');
    const finalDiff2 = diffMarkdownStrings(doc1, doc2, 'added');
    setContentOld(finalDiff1);
    setContentNew(finalDiff2);
  }, []);

  return (
    <Flex direction="column" gap="4" p="4">
      <Heading>Playground</Heading>
      <Flex gap="4" p="4">
        <Flex direction="column" gap="2" p="2" className="flex-1 border-1 max-h-[300px] overflow-y-auto" align="center">
          <RichTextEditor content={doc1} onChange={console.log} disabled={true} />
        </Flex>
        <Flex direction="column" gap="2" p="2" className="flex-1 border-1 max-h-[300px] overflow-y-auto" align="center">
          <RichTextEditor content={doc2} onChange={console.log} disabled={true} />
        </Flex>
      </Flex>
      <Flex gap="4" p="4">
        <Flex direction="column" gap="2" p="2" className="flex-1 border-1 max-h-[300px] overflow-y-auto" align="center">
          <Text weight="bold">Original Document</Text>
          {!!contentOld && (
            <RichTextEditor content={contentOld} onChange={console.log} disabled={true} />
          )}
        </Flex>
        <Flex direction="column" gap="2" p="2" className="flex-1 border-1 max-h-[300px] overflow-y-auto" align="center">
          <Text weight="bold">Recommended Document</Text>
          {!!contentNew && (
            <RichTextEditor
              content={contentNew}
              highlightClass="bg-green-200"
              onChange={console.log}
              disabled={true}
            />
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}

export default Playground;
