import { extractTextFromImage } from './geminiService';
export const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
export async function readUploadText(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error('请选择 2 MB 以内的文件。');
  if (!file.size) throw new Error('文件为空，请重新选择。');
  let text = '';
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
      const doc = await task.promise;
      if (doc.numPages > 15) throw new Error('PDF 超过 15 页，请保留与岗位有关的内容。');
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join(''));
      }
      text = pages.join('\n').trim();
      if (!text) throw new Error('此 PDF 无可提取的文字，请粘贴文字或上传页面截图。');
    } finally { await task.destroy(); }
  } else {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('支持 PDF、PNG、JPEG 和 WebP 文件。');
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('读取文件失败，请重试。'));
      reader.readAsDataURL(file);
    });
    const result = await extractTextFromImage({ mimeType: file.type, data });
    if (!result.success || !result.text.trim()) throw new Error('未能提取文字，请粘贴文字内容。');
    text = result.text.trim();
  }
  if (text.length > 20_000) throw new Error('提取的文字超过 20,000 字，请精简文件后重新上传。');
  return text;
}
