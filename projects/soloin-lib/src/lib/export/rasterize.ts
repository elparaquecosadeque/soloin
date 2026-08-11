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

function buildExportSvg(svgEl: SVGSVGElement, background: string): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const computed = getComputedStyle(svgEl);

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `:root { ${EXPORT_VARS.map((v) => `${v}: ${computed.getPropertyValue(v).trim()};`).join(' ')} }`;
  clone.insertBefore(style, clone.firstChild);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', background);
  clone.insertBefore(bg, clone.firstChild);

  return new XMLSerializer().serializeToString(clone);
}

function renderToDataUrl(svgEl: SVGSVGElement, background: string): Promise<string> {
  const svg = buildExportSvg(svgEl, background);
  const { width, height } = svgEl.viewBox.baseVal;
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

export async function downloadPng(svgEl: SVGSVGElement, filename: string): Promise<void> {
  const dataUrl = await renderToDataUrl(svgEl, '#ffffff');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function openPdfPreview(svgEl: SVGSVGElement, title: string): Promise<void> {
  const dataUrl = await renderToDataUrl(svgEl, '#ffffff');
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
