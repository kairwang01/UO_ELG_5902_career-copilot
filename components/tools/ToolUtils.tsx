import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Packer, Document, Paragraph, TextRun, HeadingLevel } from 'docx';

/** Shared error box so every tool surfaces failures with the same look. */
export const ToolError: React.FC<{ message: string; onRetry?: () => void; retryLabel?: string }> = ({ message, onRetry, retryLabel = 'Try again' }) => (
  <div role="alert" className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 animate-panel-expand">
    <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300 underline underline-offset-2 hover:text-red-900 dark:hover:text-red-200"
      >
        {retryLabel}
      </button>
    )}
  </div>
);

/** Copy-to-clipboard with inline "copied" confirmation. */
export const CopyButton: React.FC<{ text: string; label?: string; copiedLabel?: string; className?: string }> = ({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — leave the label as-is.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
        copied
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
          : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'
      } ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? copiedLabel : label}
    </button>
  );
};

export const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    const renderInlineFormatting = (line: string): React.ReactNode => {
        const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(
                <ul key={`ul-tool-${elements.length}`} className="list-disc list-outside ml-5 my-2 space-y-1">
                    {listItems.map((item, index) => (
                        <li key={index}>{renderInlineFormatting(item)}</li>
                    ))}
                </ul>
            );
            listItems = [];
        }
    };

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
            listItems.push(trimmedLine.substring(2));
        } else {
            flushList();
            if (line.match(/^#+\s/)) {
                const level = line.match(/^#+/)![0].length;
                const content = line.replace(/^#+\s/, '');
                const Tag = `h${Math.min(level + 2, 6)}` as React.ElementType;
                elements.push(<Tag key={index} className="font-bold my-4 text-xl">{renderInlineFormatting(content)}</Tag>);
            } else if (trimmedLine !== '') {
                elements.push(<p key={index} className="mb-2">{renderInlineFormatting(line)}</p>);
            }
        }
    });

    flushList();

    return elements;
};

export const DownloadButtons: React.FC<{ textContent: string; baseFilename: string }> = ({ textContent, baseFilename }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const downloadTxt = () => {
    const cleanedText = textContent
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/^#+\s/gm, '')
        .replace(/(\r\n|\n|\r)/gm, "\r\n");
    const element = document.createElement("a");
    // Prepend BOM for UTF-8 compatibility, especially on Windows
    const file = new Blob(['\uFEFF' + cleanedText], {type: 'text/plain;charset=utf-8'});
    element.href = URL.createObjectURL(file);
    element.download = `${baseFilename}.txt`;
    document.body.appendChild(element);
    element.click();
    element.remove();
    setIsMenuOpen(false);
  };

  const downloadPdf = () => {
    const createHtmlFromText = (text: string): string => {
        const lines = text.split('\n');
        let html = '';
        let inList = false;

        const processLine = (line: string) => line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                html += `<li>${processLine(trimmedLine.substring(2))}</li>`;
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                if (line.match(/^#+\s/)) {
                    const level = line.match(/^#+/)![0].length;
                    const content = line.replace(/^#+\s/, '');
                    html += `<h${Math.min(level + 1, 6)}>${processLine(content)}</h${Math.min(level + 1, 6)}>`;
                } else if (trimmedLine !== '') {
                    html += `<p>${processLine(line)}</p>`;
                } else {
                    html += '<br />';
                }
            }
        });
        if (inList) html += '</ul>';
        return html;
    };
    
    const htmlContent = createHtmlFromText(textContent);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Could not open print window. Please check your browser's pop-up blocker settings.");
        setIsMenuOpen(false);
        return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>${baseFilename}</title>
          <style>
            @media print {
              @page { size: A4; margin: 2cm; }
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
              font-size: 11pt; 
              line-height: 1.5;
            }
            h2, h3, h4, h5, h6 { margin: 1.5em 0 0.5em; font-weight: bold; }
            h2 { font-size: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 0.2em; }
            h3 { font-size: 14pt; }
            p { margin: 0 0 0.5em; }
            ul { margin: 0.5em 0; padding-left: 2em; }
            li { margin-bottom: 0.25em; }
            strong { font-weight: bold; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
        try {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        } catch (e) {
            console.error("Printing failed:", e);
            alert("An error occurred while trying to print. Please try again.");
            printWindow.close();
        }
    }, 250);

    setIsMenuOpen(false);
  };

  const downloadDocx = async () => {
    const paragraphs: Paragraph[] = textContent.split('\n').map(line => {
      if (line.startsWith('# ')) {
        return new Paragraph({ text: line.substring(2), heading: HeadingLevel.HEADING_1 });
      }
      if (line.startsWith('## ')) {
        return new Paragraph({ text: line.substring(3), heading: HeadingLevel.HEADING_2 });
      }
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return new Paragraph({ text: line.substring(2).trim(), bullet: { level: 0 } });
      }
      
      const children = line.split(/(\*\*.*?\*\*)/g).filter(Boolean).map(part => {
        const isBold = part.startsWith('**') && part.endsWith('**');
        const text = isBold ? part.slice(2, -2) : part;
        // Use Arial for better unicode support
        return new TextRun({ text, bold: isBold, font: "Arial", size: 22 });
      });

      return new Paragraph({ children, spacing: { after: 100 } });
    });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Arial",
              size: 22, // 11pt
            },
          },
        },
        paragraphStyles: [
          { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { font: "Arial", size: 28, bold: true }, paragraph: { spacing: { before: 240, after: 120 } } },
          { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { font: "Arial", size: 24, bold: true }, paragraph: { spacing: { before: 200, after: 100 } } },
        ],
      },
      sections: [{ children: paragraphs }]
    });
    
    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseFilename}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    setIsMenuOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-haspopup="menu" aria-expanded={isMenuOpen} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-md shadow-sm hover:bg-gray-800 transition-colors flex items-center gap-2">
        Download
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {isMenuOpen && (
        <div role="menu" className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black/5 dark:ring-white/10 z-20 animate-fade-scale">
          <button onClick={downloadTxt} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700">as TXT</button>
          <button onClick={downloadPdf} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700">as PDF</button>
          <button onClick={downloadDocx} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700">as DOCX</button>
        </div>
      )}
    </div>
  );
};