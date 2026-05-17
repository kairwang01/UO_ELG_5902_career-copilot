
import React, { useState, useEffect } from 'react';

interface ApiDocsViewerProps {
    onClose: () => void;
}

// A simple markdown to HTML converter for this component
const convertMarkdownToHtml = (markdown: string): string => {
    let html = markdown;
    // Headers
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-4 mt-6">$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mb-3 mt-5 border-b pb-2">$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mb-2 mt-4">$1</h3>');
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-slate-700 text-red-500 dark:text-red-400 px-1.5 py-0.5 rounded-md font-mono text-sm">$1</code>');
    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-800 text-white p-4 rounded-md overflow-x-auto my-4"><code class="language-$1">$2</code></pre>');
    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-6">$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>');
    // Paragraphs
    html = html.split('\n\n').map(p => {
        if (p.startsWith('<') || p.trim() === '') return p;
        return `<p class="mb-4">${p.replace(/\n/g, '<br/>')}</p>`;
    }).join('');

    return html;
};

const ApiDocsViewer: React.FC<ApiDocsViewerProps> = ({ onClose }) => {
    const [docContent, setDocContent] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDocs = async () => {
            try {
                const response = await fetch('/docs/api.md');
                if (!response.ok) {
                    throw new Error('Failed to load documentation file.');
                }
                const markdown = await response.text();
                const html = convertMarkdownToHtml(markdown);
                setDocContent(html);
            } catch (error) {
                setDocContent('<p class="text-red-500">Error loading documentation. Please try again later.</p>');
            } finally {
                setLoading(false);
            }
        };

        fetchDocs();
    }, []);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 animate-fade-in w-full max-w-4xl mx-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">API Documentation</h2>
                <button
                    onClick={onClose}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    &larr; Back to Account
                </button>
            </div>
            <div className="p-6 h-[75vh] overflow-y-auto">
                {loading ? (
                    <p>Loading documentation...</p>
                ) : (
                    <div
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: docContent }}
                    />
                )}
            </div>
        </div>
    );
};

export default ApiDocsViewer;
