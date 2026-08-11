import { FRETBOARD_FONT } from '../components/soloin-fretboard/soloin-fretboard';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TITLE_H = 40;

// Live fretboard SVG colors come from `var(--_chords-*)` custom properties.
// An isolated `<img src="blob:...">`-loaded SVG document can't resolve custom
// properties inherited from the host page, so export clones the SVG and
// inlines a <style> block with each token's *resolved* value (via
// getComputedStyle) before serializing — then the same
// Blob -> Image -> <canvas> -> toDataURL pipeline bass-notes uses applies unchanged.
const EXPORT_VARS = [
  '--_chords-nut',
  '--_chords-string',
  '--_chords-fret',
  '--_chords-marker',
  '--_chords-text',
  '--_chords-muted',
  '--_chords-on-primary',
  '--_chords-scale-note',
  '--_chords-chord-color-1',
  '--_chords-chord-color-2',
  '--_chords-chord-color-3',
  '--_chords-chord-color-4',
  '--_chords-chord-color-5',
  '--_chords-chord-color-6',
] as const;

interface ExportSvg {
  svg: string;
  width: number;
  height: number;
}

// The exported document has no access to this component's scoped stylesheet
// (class selectors like .dot-label{fill:...} don't travel with a cloned,
// detached SVG), so text color/size/weight/font must already be inline
// presentation attributes in the live template — this function only adds the
// CSS-variable resolution and the title band, it doesn't re-style anything.
function buildExportSvg(svgEl: SVGSVGElement, background: string, title: string): ExportSvg {
  const { width, height } = svgEl.viewBox.baseVal;
  const totalHeight = height + TITLE_H;

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('viewBox', `0 0 ${width} ${totalHeight}`);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(totalHeight));

  const computed = getComputedStyle(svgEl);
  const resolved = Object.fromEntries(EXPORT_VARS.map((v) => [v, computed.getPropertyValue(v).trim()]));

  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = `:root { ${EXPORT_VARS.map((v) => `${v}: ${resolved[v]};`).join(' ')} }`;
  clone.insertBefore(style, clone.firstChild);

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', background);
  clone.insertBefore(bg, style.nextSibling);

  // Shift the original fretboard content down to make room for the title band.
  const board = document.createElementNS(SVG_NS, 'g');
  board.setAttribute('transform', `translate(0, ${TITLE_H})`);
  for (const node of Array.from(clone.childNodes)) {
    if (node === style || node === bg) continue;
    board.appendChild(node);
  }
  clone.appendChild(board);

  const titleEl = document.createElementNS(SVG_NS, 'text');
  titleEl.setAttribute('x', '16');
  titleEl.setAttribute('y', String(TITLE_H / 2));
  titleEl.setAttribute('dominant-baseline', 'central');
  titleEl.setAttribute('font-family', FRETBOARD_FONT);
  titleEl.setAttribute('font-size', '16');
  titleEl.setAttribute('font-weight', '700');
  titleEl.setAttribute('fill', resolved['--_chords-text'] || '#1e293b');
  titleEl.textContent = title;
  clone.appendChild(titleEl);

  return { svg: new XMLSerializer().serializeToString(clone), width, height: totalHeight };
}

function renderToDataUrl(svgEl: SVGSVGElement, background: string, title: string): Promise<string> {
  const { svg, width, height } = buildExportSvg(svgEl, background, title);
  const scale = 2; // 2x for retina sharpness

  return new Promise<string>((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG render failed'));
    };
    img.src = url;
  });
}

export async function downloadPng(svgEl: SVGSVGElement, filename: string, title: string): Promise<void> {
  const dataUrl = await renderToDataUrl(svgEl, '#ffffff', title);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function openPdfPreview(svgEl: SVGSVGElement, title: string): Promise<void> {
  const dataUrl = await renderToDataUrl(svgEl, '#ffffff', title);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(
    `<!DOCTYPE html><html><head><title>${title}</title>` +
      `<style>@page{size:auto;margin:8mm}body{margin:0;background:#fff}img{width:100%;display:block}</style></head>` +
      `<body><img src="${dataUrl}"/></body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
