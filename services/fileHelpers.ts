import mammoth from 'mammoth';
import { getDocument, GlobalWorkerOptions, PageViewport } from 'pdfjs-dist';
import type { ResumeImage } from '../types';

// Set the worker source for pdf.js
GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

export interface ParsedFile {
    text: string;
    images?: ResumeImage[];
}

export const parseFile = async (file: File): Promise<ParsedFile> => {
    try {
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await getDocument(arrayBuffer).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map((item: any) => 'str' in item ? item.str : '').join(' ') + '\n';
            }

            if (fullText.trim().length < 250) {
                // Fallback to image extraction if text is too sparse (scanned PDF)
                const images: ResumeImage[] = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport: PageViewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    if (!context) continue;

                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    await page.render({ canvasContext: context, viewport: viewport, canvas: canvas } as any).promise;

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                    const base64Data = dataUrl.split(',')[1];
                    if (base64Data) {
                        images.push({ mimeType: 'image/jpeg', data: base64Data });
                    }
                }
                if (images.length > 0) {
                    return { text: '', images };
                }
                throw new Error("Could not extract text or images from PDF.");
            }
            return { text: fullText };

        } else if (file.type === 'text/plain') {
            const text = await file.text();
            return { text };

        } else if (file.type.startsWith('image/')) {
            const base64String = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
            const base64Data = base64String.split(',')[1];
            if (base64Data) {
                return { text: '', images: [{ mimeType: file.type, data: base64Data }] };
            }
            throw new Error('Could not read the image file.');

        } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const arrayBuffer = await file.arrayBuffer();
            const { value } = await mammoth.extractRawText({ arrayBuffer });
            return { text: value };
        } else {
            throw new Error('Unsupported file type. Please upload a .txt, .png, .jpg, .pdf, or .docx file.');
        }
    } catch (error) {
        console.error("Error parsing file:", error);
        throw error;
    }
};
