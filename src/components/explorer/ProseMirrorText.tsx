// ─────────────────────────────────────────────────────────────────────────────
// ProseMirrorText — read-only renderer for the portal editor's document format.
//
// Documents an agency shares with a client are authored in the portal's TipTap
// editor and stored as ProseMirror JSON. TipTap is a DOM library and doesn't run
// in React Native, so instead of embedding an editor this walks the node tree
// and draws each block with plain RN primitives.
//
// Supported nodes cover what the editor can actually produce (see the portal's
// `buildEditorExtensions`): paragraphs, headings, bullet/ordered lists,
// blockquotes, horizontal rules, hard breaks, and text with bold / italic /
// underline / strike / link marks. Anything unrecognised falls through to its
// children, so an unknown wrapper degrades to its text rather than vanishing.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Linking, Text, View } from 'react-native';
import { EX } from './theme';
import type { ProseMirrorDoc } from '@/types/documents.type';

// A ProseMirror node, typed loosely — the backend stores this verbatim and we
// must not assume a particular editor schema version.
interface PMNode {
  type?: string;
  text?: string;
  content?: unknown[];
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
}

/** Narrow an unknown array entry to a node-shaped object. */
function asNode(value: unknown): PMNode | null {
  return value && typeof value === 'object' ? (value as PMNode) : null;
}

/** Child nodes of a node, always an array. */
function childrenOf(node: PMNode): PMNode[] {
  return (node.content ?? [])
    .map(asNode)
    .filter((n): n is PMNode => n !== null);
}

// Heading sizes by level. Level 4+ collapses onto the level-3 treatment — the
// editor offers three, and anything deeper isn't worth a distinct size on a
// phone screen.
const HEADING_SIZE: Record<number, number> = { 1: 21, 2: 18, 3: 16 };

/**
 * Render an inline text node with its marks applied.
 *
 * Link marks become pressable: `onPress` on a nested `<Text>` is the RN idiom
 * for an inline link (there is no anchor element).
 */
function InlineText({ node, keyId }: { node: PMNode; keyId: string }) {
  const marks = node.marks ?? [];
  const has = (type: string) => marks.some((m) => m?.type === type);

  const link = marks.find((m) => m?.type === 'link');
  const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : null;

  return (
    <Text
      key={keyId}
      onPress={href ? () => void Linking.openURL(href) : undefined}
      style={{
        fontWeight: has('bold') ? '700' : '400',
        fontStyle: has('italic') ? 'italic' : 'normal',
        textDecorationLine: has('strike')
          ? 'line-through'
          : has('underline') || href
            ? 'underline'
            : 'none',
        color: href ? EX.color.primary : undefined,
      }}
    >
      {node.text ?? ''}
    </Text>
  );
}

/**
 * Render a node's inline children (text + hard breaks) into one `<Text>` run.
 * Anything that isn't a text/hardBreak node contributes its own inline children,
 * which is how nested inline wrappers degrade gracefully.
 */
function renderInline(node: PMNode, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  childrenOf(node).forEach((child, i) => {
    const key = `${keyPrefix}-${i}`;
    if (child.type === 'text') {
      out.push(<InlineText key={key} node={child} keyId={key} />);
    } else if (child.type === 'hardBreak') {
      out.push(<Text key={key}>{'\n'}</Text>);
    } else {
      out.push(...renderInline(child, key));
    }
  });
  return out;
}

/** Render one block-level node. */
function Block({ node, keyPrefix }: { node: PMNode; keyPrefix: string }) {
  switch (node.type) {
    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      return (
        <Text
          style={{
            fontSize: HEADING_SIZE[level] ?? HEADING_SIZE[3],
            fontWeight: '700',
            color: EX.color.ink,
            marginTop: 16,
            marginBottom: 6,
            lineHeight: (HEADING_SIZE[level] ?? HEADING_SIZE[3]) * 1.35,
          }}
        >
          {renderInline(node, keyPrefix)}
        </Text>
      );
    }

    case 'bulletList':
    case 'orderedList': {
      const ordered = node.type === 'orderedList';
      // `start` lets the editor resume numbering part-way through a document.
      const start = Number(node.attrs?.start ?? 1);
      return (
        <View style={{ marginBottom: 10, gap: 4 }}>
          {childrenOf(node).map((item, i) => (
            <View
              key={`${keyPrefix}-li-${i}`}
              style={{ flexDirection: 'row', gap: 8 }}
            >
              <Text
                style={{
                  fontSize: 14.5,
                  lineHeight: 21,
                  color: EX.color.muted,
                  minWidth: ordered ? 18 : 10,
                }}
              >
                {ordered ? `${start + i}.` : '•'}
              </Text>
              {/* A list item wraps its own paragraphs, so recurse rather than
                  assuming a single inline run. */}
              <View style={{ flex: 1, minWidth: 0 }}>
                {childrenOf(item).map((child, j) => (
                  <Block
                    key={`${keyPrefix}-li-${i}-${j}`}
                    node={child}
                    keyPrefix={`${keyPrefix}-li-${i}-${j}`}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    }

    case 'blockquote':
      return (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: EX.color.line12,
            paddingLeft: 12,
            marginBottom: 10,
          }}
        >
          {childrenOf(node).map((child, i) => (
            <Block
              key={`${keyPrefix}-q-${i}`}
              node={child}
              keyPrefix={`${keyPrefix}-q-${i}`}
            />
          ))}
        </View>
      );

    case 'horizontalRule':
      return (
        <View
          style={{
            height: 1,
            backgroundColor: EX.color.line08,
            marginVertical: 14,
          }}
        />
      );

    case 'paragraph': {
      const inline = renderInline(node, keyPrefix);
      // An empty paragraph is deliberate spacing in the editor — preserve it
      // rather than collapsing the author's intended gap.
      if (inline.length === 0) return <View style={{ height: 10 }} />;
      return (
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 22,
            color: EX.color.ink,
            marginBottom: 10,
          }}
        >
          {inline}
        </Text>
      );
    }

    default:
      // Unknown wrapper: render whatever is inside it so no content is lost.
      return (
        <>
          {childrenOf(node).map((child, i) => (
            <Block
              key={`${keyPrefix}-x-${i}`}
              node={child}
              keyPrefix={`${keyPrefix}-x-${i}`}
            />
          ))}
        </>
      );
  }
}

/**
 * Read-only view of a ProseMirror document. Renders nothing (a short empty-state
 * line) when the document has no content.
 */
export function ProseMirrorText({
  content,
}: {
  content: ProseMirrorDoc | null | undefined;
}) {
  const blocks = content ? childrenOf(content as PMNode) : [];

  if (blocks.length === 0) {
    return (
      <Text style={{ fontSize: 14, color: EX.color.muted }}>
        This document is empty.
      </Text>
    );
  }

  return (
    <View>
      {blocks.map((node, i) => (
        <Block key={`b-${i}`} node={node} keyPrefix={`b-${i}`} />
      ))}
    </View>
  );
}
