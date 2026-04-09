/**
 * Patches flot-legend's CanvasLegend.drawText to use a theme-aware text color
 * instead of hardcoded black, enabling dark mode support.
 *
 * Run automatically via the postinstall npm/pnpm script.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'flot-legend', 'jquery.flot.legend.js');

if (!fs.existsSync(target)) {
  console.log('patch-flot-legend: file not found, skipping');
  process.exit(0);
}

const original = '    this.ctx.fillStyle = "black";';
const patched =
  '    this.ctx.fillStyle = (this.opts.legend.style && this.opts.legend.style.color) ||\n' +
  "        (document.body.classList.contains('open-dark') ? '#c8d4e8' : 'black');";

const src = fs.readFileSync(target, 'utf8');

if (src.includes(patched)) {
  console.log('patch-flot-legend: already applied, skipping');
  process.exit(0);
}

if (!src.includes(original)) {
  console.warn('patch-flot-legend: expected string not found — flot-legend may have been updated. Patch skipped.');
  process.exit(0);
}

fs.writeFileSync(target, src.replace(original, patched), 'utf8');
console.log('patch-flot-legend: applied successfully');
