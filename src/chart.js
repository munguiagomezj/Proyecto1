/**
 * Gráficos ligeros dibujados con Canvas 2D, sin dependencias externas.
 */
export const PALETTE = ['#4f7cff', '#2bb673', '#f5a623', '#e5484d', '#8e6cef', '#14b8c4', '#f06aa7', '#8a94a6'];

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Gráfico de dona. `data` = [{ label, value }]. */
export function drawDonut(canvas, data, centerLabel = '') {
  const { ctx, width, height } = setupCanvas(canvas);
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 8;
  const thickness = radius * 0.38;

  if (total === 0) {
    ctx.strokeStyle = cssVar('--border');
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - thickness / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    let angle = -Math.PI / 2;
    data.forEach((d, i) => {
      const slice = (d.value / total) * Math.PI * 2;
      ctx.strokeStyle = PALETTE[i % PALETTE.length];
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - thickness / 2, angle, angle + slice - (data.length > 1 ? 0.02 : 0));
      ctx.stroke();
      angle += slice;
    });
  }

  ctx.fillStyle = cssVar('--text');
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(centerLabel, cx, cy);
}

/** Gráfico de barras agrupadas. `series` = [{ label, a, b }]. */
export function drawBars(canvas, series, colors = ['#2bb673', '#e5484d']) {
  const { ctx, width, height } = setupCanvas(canvas);
  const pad = { top: 12, right: 8, bottom: 26, left: 8 };
  const chartH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...series.flatMap((s) => [s.a, s.b]));
  const groupW = (width - pad.left - pad.right) / series.length;
  const barW = Math.min(22, groupW / 3);

  ctx.strokeStyle = cssVar('--border');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + chartH + 0.5);
  ctx.lineTo(width - pad.right, pad.top + chartH + 0.5);
  ctx.stroke();

  series.forEach((s, i) => {
    const x = pad.left + groupW * i + groupW / 2;
    [s.a, s.b].forEach((value, j) => {
      const h = (value / max) * chartH;
      ctx.fillStyle = colors[j];
      const bx = j === 0 ? x - barW - 2 : x + 2;
      ctx.beginPath();
      ctx.roundRect(bx, pad.top + chartH - h, barW, h, [4, 4, 0, 0]);
      ctx.fill();
    });
    ctx.fillStyle = cssVar('--muted');
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(s.label, x, pad.top + chartH + 8);
  });
}
