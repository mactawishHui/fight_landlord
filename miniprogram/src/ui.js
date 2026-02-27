/**
 * UI primitives for Canvas rendering.
 * All drawing is on the global `ctx` passed in.
 */

// ── Hit area registry ─────────────────────────────────────────────────────────

let _hitAreas = [];

export function clearHitAreas() { _hitAreas = []; }

export function registerHitArea(id, x, y, w, h, callback) {
  _hitAreas.push({ id, x, y, x2: x + w, y2: y + h, callback });
}

export function handleTouchAt(tx, ty) {
  for (const area of _hitAreas) {
    if (tx >= area.x && tx <= area.x2 && ty >= area.y && ty <= area.y2) {
      area.callback();
      return true;
    }
  }
  return false;
}

// ── Rounded rectangle ─────────────────────────────────────────────────────────

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Button ────────────────────────────────────────────────────────────────────

/**
 * Draw a labeled button and register its hit area.
 * @param {boolean} disabled - if true, draws greyed out and skips registration
 */
export function drawButton(ctx, id, x, y, w, h, label, color, textColor, disabled, onPress) {
  const bg = disabled ? 'rgba(120,120,120,0.5)' : color;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  if (!disabled) {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = disabled ? 'rgba(200,200,200,0.6)' : (textColor || '#fff');
  ctx.font = `bold ${Math.round(h * 0.42)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);

  if (!disabled && onPress) {
    registerHitArea(id, x, y, w, h, onPress);
  }
}

// ── Badge (pill label) ────────────────────────────────────────────────────────

export function drawBadge(ctx, x, y, w, h, label, bgColor, textColor) {
  ctx.fillStyle = bgColor;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = textColor || '#fff';
  ctx.font = `bold ${Math.round(h * 0.56)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

// ── Text helpers ──────────────────────────────────────────────────────────────

export function drawText(ctx, text, x, y, fontSize, color, align = 'left', baseline = 'top') {
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

export function drawBoldText(ctx, text, x, y, fontSize, color, align = 'left', baseline = 'top') {
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

// ── Progress bar ─────────────────────────────────────────────────────────────

export function drawProgressBar(ctx, x, y, w, h, pct, barColor, bgColor) {
  ctx.fillStyle = bgColor || 'rgba(255,255,255,0.2)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (pct > 0) {
    const fillW = Math.max(h, w * pct);
    ctx.fillStyle = barColor || '#4CAF50';
    roundRect(ctx, x, y, fillW, h, h / 2);
    ctx.fill();
  }
}

// ── Avatar circle ─────────────────────────────────────────────────────────────

export function drawAvatar(ctx, name, x, y, r, isCurrentTurn, isLandlord) {
  // Border ring
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = isCurrentTurn ? '#f1c40f' : 'rgba(255,255,255,0.25)';
  ctx.fill();

  // Circle background
  const hue = nameToHue(name);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${hue}, 60%, 40%)`;
  ctx.fill();

  // Initials
  const initials = name.slice(0, 1);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, x, y);

  // Landlord crown indicator
  if (isLandlord) {
    ctx.fillStyle = '#e74c3c';
    ctx.font = `${Math.round(r * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('👑', x, y - r - 4);
  }
}

function nameToHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
  return h % 360;
}

// ── Turn indicator arrow ───────────────────────────────────────────────────────

export function drawTurnArrow(ctx, x, y, direction = 'right') {
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  if (direction === 'right') {
    ctx.moveTo(x, y - 6); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 6);
  } else if (direction === 'left') {
    ctx.moveTo(x + 10, y - 6); ctx.lineTo(x, y); ctx.lineTo(x + 10, y + 6);
  } else {
    ctx.moveTo(x - 6, y + 10); ctx.lineTo(x, y); ctx.lineTo(x + 6, y + 10);
  }
  ctx.closePath();
  ctx.fill();
}
