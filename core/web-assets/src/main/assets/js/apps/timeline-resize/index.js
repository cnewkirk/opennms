/*
 * Licensed to The OpenNMS Group, Inc (TOG) under one or more
 * contributor license agreements.  See the LICENSE.md file
 * distributed with this work for additional information
 * regarding copyright ownership.
 *
 * TOG licenses this file to You under the GNU Affero General
 * Public License Version 3 (the "License") or (at your option)
 * any later version.  You may not use this file except in
 * compliance with the License.  You may obtain a copy of the
 * License at:
 *
 *      https://www.gnu.org/licenses/agpl-3.0.txt
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.  See the License for the specific
 * language governing permissions and limitations under the
 * License.
 */
const debounce = require('lodash.debounce');

const DEBOUNCE_RATE = 200; // ms
const RELATIVE_SIZE = 0.5;

const getSize = function(element) {
  // if we can get the offset width of the actual <td>, use it
  const td = element.closest('td')[0];

  if (td !== undefined) {
    // Use individual longhand properties — getComputedStyle().padding (shorthand)
    // returns '' in modern Chrome/Safari regardless of the CSS value, while
    // paddingLeft/paddingRight always return a computed pixel value.
    const style = getComputedStyle(td);
    const pl = parseFloat(style.paddingLeft) || 0;
    const pr = parseFloat(style.paddingRight) || 0;
    const w = Math.round(td.offsetWidth - pl - pr);
    if (w > 0) { return w; }
    // offsetWidth was 0 — layout not yet complete; fall through to container fallback
  }

  // Fall back to a portion of the nearest containing div's width.
  // This handles the case where the td hasn't been laid out yet.
  const container = element.closest('div');
  if (container && container.length > 0) {
    const cw = Math.round(container.innerWidth() * RELATIVE_SIZE);
    if (cw > 0) { return cw; }
  }

  return NaN;
}

const recalculateBox = debounce(() => {
  const e = $('#availability-box');
  // Update the timeline headers
  const imgs = e.find('img');
  for (let i=0; i < imgs.length; i++) {
    const img = $(imgs[i]);
    const w = getSize(img);
    if (w > 0) {
      const imgsrc = img.data('imgsrc') + w;
      img.attr('src', imgsrc);
    }
  }
  // Update the timeline html/images
  const spans = e.find('span');
  for (let i=0; i < spans.length; i++) {
    const span = $(spans[i]);
    const w = getSize(span);
    if (w > 0 && span.data('src')) {
      const htmlsrc = span.data('src') + w;
      span.load(String(htmlsrc));
    }
  }
}, DEBOUNCE_RATE);

// Fire on document ready (layout may still be pending for complex pages)
$(document).ready(recalculateBox);
// Fire again on window load (after all resources and layout are fully complete)
$(window).on('load', recalculateBox);
window.addEventListener('resize', recalculateBox);
