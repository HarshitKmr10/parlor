import React from 'react';
import { marked } from 'marked';

interface TemplateMarkDownTextProps {
  value: string;
}

const TemplateMarkDownText: React.FC<TemplateMarkDownTextProps> = ({ value }) => {
  // Configure marked options to match TipTap styling
  const markdownToHtml = (markdown: string) => {
    // Configure marked with custom renderer
    const renderer = new marked.Renderer();
    
    // Custom heading renderer to match TipTap CustomHeading styles
    renderer.heading = (text, level) => {
      const levelStyles = {
        1: 'font-size: 1.25rem; font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.5rem; color: #3C587F; font-family: Arial, sans-serif;',
        2: 'font-size: 1.125rem; font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.5rem; color: #3C587F; font-family: Arial, sans-serif;',
        3: 'font-size: 1rem; font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.5rem; color: #3C587F; font-family: Arial, sans-serif;',
      };
      const style = levelStyles[level as keyof typeof levelStyles] || 'font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.5rem; color: #3C587F; font-family: Arial, sans-serif;';
      return `<h${level} style="${style}">${text}</h${level}>`;
    };

    // Custom paragraph renderer to match TipTap CustomParagraph
    renderer.paragraph = (text) => {
      return `<p style="font-size: 0.875rem; margin-bottom: 0.5rem; margin-top: 0; line-height: 1.625; font-family: Arial, sans-serif;">${text}</p>`;
    };

    // Custom code renderer to match TipTap CustomCode
    renderer.codespan = (code) => {
      return `<code style="background-color: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; color: #374151; font-family: Arial, sans-serif;">${code}</code>`;
    };

    // Custom code block renderer to match TipTap CustomCodeBlock
    renderer.code = (code, language) => {
      return `<pre style="display: block; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.75rem; font-size: 0.875rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word; border: 1px solid #3C587F; background-color: #f9fafb; color: #374151; font-family: Arial, sans-serif;"><code>${code}</code></pre>`;
    };

    // Custom list renderer to match TipTap list styles
    renderer.list = (body, ordered) => {
      const tag = ordered ? 'ol' : 'ul';
      const listStyle = ordered 
        ? 'list-style-type: decimal; margin-left: 1.25rem; font-size: 0.875rem; margin-bottom: 0.5rem; font-family: Arial, sans-serif;'
        : 'list-style-type: disc; margin-left: 1.25rem; font-size: 0.875rem; margin-bottom: 0.5rem; font-family: Arial, sans-serif;';
      return `<${tag} style="${listStyle}">${body}</${tag}>`;
    };

    // Custom list item renderer
    renderer.listitem = (text) => {
      return `<li style="font-family: Arial, sans-serif; font-size: 0.875rem;">${text}</li>`;
    };

    // Custom table renderer to match TipTap CustomTable
    renderer.table = (header, body) => {
      return `<table style="min-width: 100%; border-collapse: collapse; border-spacing: 0; border: 1px solid #3C587F; font-family: Arial, sans-serif; font-size: 10pt;">
        <thead>${header}</thead>
        <tbody>${body}</tbody>
      </table>`;
    };

    // Custom table header renderer
    renderer.tablecell = (content, flags) => {
      const tag = flags.header ? 'th' : 'td';
      const style = flags.header 
        ? 'border: 1px solid #3C587F; background-color: #f9fafb; padding: 0.5rem; text-align: left; font-weight: bold; color: #3C587F; font-family: Arial, sans-serif; font-size: 10pt;'
        : 'border: 1px solid #3C587F; padding: 0.5rem; font-family: Arial, sans-serif; font-size: 10pt;';
      return `<${tag} style="${style}">${content}</${tag}>`;
    };

    // Custom link renderer to match TipTap Hyperlink
    renderer.link = (href, title, text) => {
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr} style="color: #2563eb; text-decoration: underline; font-family: Arial, sans-serif;">${text}</a>`;
    };

    // Custom strong renderer
    renderer.strong = (text) => {
      return `<strong style="font-weight: bold; font-family: Arial, sans-serif;">${text}</strong>`;
    };

    // Custom em renderer
    renderer.em = (text) => {
      return `<em style="font-style: italic; font-family: Arial, sans-serif;">${text}</em>`;
    };

    marked.setOptions({
      renderer,
      gfm: true,
      breaks: true,
    });

    return marked(markdown);
  };

  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: '0.875rem',
        lineHeight: '1.625',
        maxWidth: 'none',
      }}
      dangerouslySetInnerHTML={{
        __html: markdownToHtml(value),
      }}
    />
  );
};

export default TemplateMarkDownText;