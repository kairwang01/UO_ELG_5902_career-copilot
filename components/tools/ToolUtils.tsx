import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bookmark, Check, ChevronDown, Copy, Download, FileText, Loader2, Lock, Printer, RefreshCw } from 'lucide-react';
import { Packer, Document, Paragraph, TextRun, HeadingLevel } from 'docx';

/**
 * Toolbar shown above a tool's result. For PAID users it confirms the result is
 * saved (so it'll be here free next time) and offers "Try next" to re-run (uses
 * credits). For FREE users it shows an upgrade nudge instead of a save badge.
 */
export const SavedResultBar: React.FC<{
  t: (key: string) => string;
  onTryNext: () => void;
  canSave: boolean;
  /** True when the result on screen is the cloud-cached one (vs. a fresh run). */
  isSaved: boolean;
  savedAt?: number | null;
  onUpgrade?: () => void;
}> = ({ t, onTryNext, canSave, isSaved, savedAt, onUpgrade }) => {
  const dateStr = savedAt ? new Date(savedAt).toLocaleDateString() : '';
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-center gap-2 text-sm">
        {canSave ? (
          <>
            <Bookmark className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {isSaved
                ? (dateStr ? t('tool_saved_on').replace('{date}', dateStr) : t('tool_saved_label'))
                : t('tool_saved_just_now')}
            </span>
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            <button
              type="button"
              onClick={onUpgrade}
              className={`font-medium text-blue-600 dark:text-blue-400 ${onUpgrade ? 'hover:underline' : 'cursor-default'}`}
            >
              {t('tool_saved_upgrade_hint')}
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onTryNext}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {t('tool_try_next')}
      </button>
    </div>
  );
};

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
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'career-copilot-export';

export const DownloadButtons: React.FC<{ textContent: string; baseFilename: string }> = ({ textContent, baseFilename }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDocxExporting, setIsDocxExporting] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const printTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeBaseFilename = sanitizeFilename(baseFilename);

  useEffect(() => () => {
    mountedRef.current = false;
    if (printTimerRef.current) clearTimeout(printTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const downloadTxt = () => {
    try {
      const cleanedText = textContent
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/^#+\s/gm, '')
        .replace(/(\r\n|\n|\r)/gm, "\r\n");
      const element = document.createElement("a");
      // Prepend BOM for UTF-8 compatibility, especially on Windows.
      const file = new Blob(['\uFEFF' + cleanedText], {type: 'text/plain;charset=utf-8'});
      const url = URL.createObjectURL(file);
      element.href = url;
      element.download = `${safeBaseFilename}.txt`;
      document.body.appendChild(element);
      element.click();
      element.remove();
      URL.revokeObjectURL(url);
      setStatus({ tone: 'success', message: 'TXT export started.' });
    } catch {
      setStatus({ tone: 'error', message: 'TXT export failed. Please try again.' });
    } finally {
      setIsMenuOpen(false);
    }
  };

  const downloadPdf = () => {
    const createHtmlFromText = (text: string): string => {
        const lines = text.split('\n');
        let html = '';
        let inList = false;

        const processLine = (line: string) =>
          escapeHtml(line).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

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
        setStatus({ tone: 'error', message: 'PDF export was blocked. Allow pop-ups for this site and try again.' });
        setIsMenuOpen(false);
        return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(safeBaseFilename)}</title>
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

    if (printTimerRef.current) clearTimeout(printTimerRef.current);
    printTimerRef.current = setTimeout(() => {
        try {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
            if (mountedRef.current) setStatus({ tone: 'success', message: 'PDF print dialog opened.' });
        } catch (e) {
            console.error("Printing failed:", e);
            if (mountedRef.current) setStatus({ tone: 'error', message: 'PDF export failed. Please try again.' });
            printWindow.close();
        }
    }, 250);

    setIsMenuOpen(false);
  };

  const downloadDocx = async () => {
    setIsDocxExporting(true);
    setIsMenuOpen(false);

    try {
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
          // Use Arial for better unicode support.
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
      if (!mountedRef.current) return;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeBaseFilename}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setStatus({ tone: 'success', message: 'DOCX export started.' });
    } catch {
      if (mountedRef.current) setStatus({ tone: 'error', message: 'DOCX export failed. Please try again.' });
    } finally {
      if (mountedRef.current) setIsDocxExporting(false);
    }
  };

  return (
    <div className="relative inline-flex flex-col items-end gap-2" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        disabled={!textContent.trim() || isDocxExporting}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
      >
        {isDocxExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download
        <ChevronDown className={`h-4 w-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
      </button>
      {isMenuOpen && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 animate-fade-scale dark:bg-slate-800 dark:ring-white/10">
          <button type="button" role="menuitem" onClick={downloadTxt} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-slate-700">
            <FileText className="h-4 w-4 text-gray-400" />
            Export as TXT
          </button>
          <button type="button" role="menuitem" onClick={downloadPdf} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-slate-700">
            <Printer className="h-4 w-4 text-gray-400" />
            Print as PDF
          </button>
          <button type="button" role="menuitem" onClick={downloadDocx} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-slate-700">
            <Download className="h-4 w-4 text-gray-400" />
            Export as DOCX
          </button>
        </div>
      )}
      {status && (
        <div
          role={status.tone === 'error' ? 'alert' : 'status'}
          className={`w-64 max-w-full rounded-lg border px-3 py-2 text-left text-xs shadow-sm animate-fade-scale ${
            status.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
          }`}
        >
          <span className="flex items-start gap-2">
            {status.tone === 'error' ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            <span>{status.message}</span>
          </span>
        </div>
      )}
    </div>
  );
};
