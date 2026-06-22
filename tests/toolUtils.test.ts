import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderFormattedText } from '../components/tools/ToolUtils';

const renderFormattedMarkup = (text: string) => (
  renderToStaticMarkup(React.createElement(React.Fragment, null, renderFormattedText(text)))
);

describe('renderFormattedText', () => {
  it('renders markdown headings with scan-friendly hierarchy', () => {
    const markup = renderFormattedMarkup('# Summary\n## Evidence\n### Detail\nBuilt hiring workflows.');

    expect(markup).toContain('<h3');
    expect(markup).toContain('text-base');
    expect(markup).toContain('<h4');
    expect(markup).toContain('uppercase');
    expect(markup).toContain('<h5');
    expect(markup).toContain('Built hiring workflows.');
  });

  it('keeps bullets and inline bold formatting readable', () => {
    const markup = renderFormattedMarkup('- Led **workflow** rollout\n- Reduced review time');

    expect(markup).toContain('<ul');
    expect(markup).toContain('text-sm');
    expect(markup).toContain('<strong>workflow</strong>');
    expect(markup).toContain('Reduced review time');
  });
});
