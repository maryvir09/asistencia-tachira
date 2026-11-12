// Carnet: copia exacta de sistema/generar_carnets.py (render_card) para el navegador.
// 56 x 89 mm + 3 mm de sangrado por lado, 600 dpi -> 1465 x 2244 px.
var CARNET = (function () {
  var DPI = 600, MM = DPI / 25.4;
  var TRIM_W = 56.0, TRIM_H = 89.0, BLEED = 3.0;
  var FRANJA_W = 8.0, FRANJA_X = TRIM_W - FRANJA_W;
  var W = Math.round((TRIM_W + 2 * BLEED) * MM), H = Math.round((TRIM_H + 2 * BLEED) * MM);
  var FAM = { reg: 'CarnetReg', bold: 'CarnetBold', xbold: 'CarnetXBold' };
  var ASC = 1984 / 2048;                       // ascendente de Inter (como PIL: techo)
  var BLACK = 'rgb(20,20,20)';

  function px(mm) { return pyRound((mm + BLEED) * MM); }
  // round() de Python: al par en los .5 exactos
  function pyRound(x) { var r = Math.round(x); if (Math.abs(x % 1) === 0.5 && r % 2 !== 0) r -= 1; return r; }
  function size(em) { return Math.max(8, pyRound(em * MM)); }

  var meas = document.createElement('canvas').getContext('2d');
  function setFont(ctx, kind, s) { ctx.font = s + 'px ' + FAM[kind]; ctx.fontKerning = 'normal'; }
  function tlen(text, kind, s) { setFont(meas, kind, s); return meas.measureText(text).width; }
  function fitFont(text, kind, em, maxW) {
    var s = size(em);
    while (tlen(text, kind, s) > maxW * MM && em > 1) { em -= 0.1; s = size(em); }
    return s;
  }
  function drawText(ctx, text, kind, s, x, y, fill) {
    setFont(ctx, kind, s); ctx.fillStyle = fill || BLACK; ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y + Math.ceil(s * ASC));
  }
  function center(ctx, text, kind, s, cxmm, ymm, fill) {
    var w = tlen(text, kind, s);
    drawText(ctx, text, kind, s, px(cxmm) - w / 2, px(ymm), fill);
  }
  function wrap(text, kind, s, maxW) {
    var words = text.split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) {
      var t = (cur + ' ' + w).trim();
      if (tlen(t, kind, s) <= maxW * MM || !cur) cur = t; else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function grupo(tipo) {
    var t = (tipo || '').toUpperCase();
    if (t.indexOf('ADMINISTRATIV') >= 0) return 'ADMINISTRATIVO';
    if (t.indexOf('OBRER') >= 0) return 'OBRERO';
    return 'DOCENTE';
  }

  function placeholder(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgb(214,220,228)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgb(160,170,184)';
    ctx.beginPath(); ctx.ellipse(x + w * 0.5, y + h * 0.38, w * 0.2, h * 0.2, 0, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.5, y + h * 0.935, w * 0.38, h * 0.315, 0, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y + h * 0.86, w, h * 0.1);
    var s = Math.round(h * 0.06), t = 'FOTO PENDIENTE', tw = tlen(t, 'bold', s);
    drawText(ctx, t, 'bold', s, x + (w - tw) / 2, y + h * 0.875, 'rgb(120,120,120)');
  }

  // ImageOps.fit(..., centering=(0.5, 0.35))
  function drawPhoto(ctx, img, x, y, w, h) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var target = w / h, live = iw / ih, cw, ch;
    if (live > target) { ch = ih; cw = ih * target; } else { cw = iw; ch = iw / target; }
    var sx = (iw - cw) * 0.5, sy = (ih - ch) * 0.35;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, cw, ch, x, y, w, h);
  }

  function utf8(s) { return unescape(encodeURIComponent(s)); }
  function drawQR(ctx, text, x, y, sz) {
    var q = new QRLIB.QRCode(-1, QRLIB.ECL.M); q.addData(utf8(text)); q.make();
    var n = q.getModuleCount(), m = n + 2;           // borde de 1 módulo
    var c = document.createElement('canvas'); c.width = m; c.height = m;
    var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, m, m); cx.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) cx.fillRect(k + 1, r + 1, 1, 1);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(c, x, y, sz, sz); ctx.imageSmoothingEnabled = true;
  }

  function qrText(p, inst) {
    var nom = inst.oficial || inst.corto || '';
    return nom + '\n' + p.nombre + '\nC.I.: ' + p.ci;
  }

  // p: {nombres, apellidos, nombre, ci, tipo, cargo}; inst: {corto, oficial, periodo}
  function render(canvas, bgImg, p, inst, photoImg) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(bgImg, 0, 0, W, H);
    var CX = FRANJA_X / 2, MAXW = FRANJA_X - 3.0;

    var fw = 22.1, fh = 27.0, fx0 = CX - fw / 2, fy0 = 13.4;
    var nom = p.nombres || '', ape = p.apellidos || '';
    var dos = nom && ape && (nom.split(/\s+/).length > 1 || ape.split(/\s+/).length > 1);
    if (!dos) fy0 += 2.5;
    var b = 0.6;
    ctx.fillStyle = 'rgb(23,54,93)';
    ctx.fillRect(px(fx0 - b), px(fy0 - b), px(fx0 + fw + b) - px(fx0 - b) + 1, px(fy0 + fh + b) - px(fy0 - b) + 1);
    var phx = px(fx0), phy = px(fy0), phw = px(fx0 + fw) - px(fx0), phh = px(fy0 + fh) - px(fy0);
    if (photoImg) drawPhoto(ctx, photoImg, phx, phy, phw, phh); else placeholder(ctx, phx, phy, phw, phh);

    var QR_MM = 11.5, QR_BOTTOM = TRIM_H - 1.6, QR_GAP = 3.0, qrTop = QR_BOTTOM - QR_MM;
    var perFont = 2.6, perY2 = qrTop - QR_GAP - perFont, perY1 = perY2 - 3.1, instBottom = perY1 - 1.4;
    var tipoY = 53.5, instTop = tipoY + 2.8 + 1.6;

    // 1) Nombre + cédula
    var lines = dos ? [nom, ape] : [p.nombre];
    var em = 3.0;
    function maxw(e) { return Math.max.apply(null, lines.map(function (l) { return tlen(l, 'bold', size(e)); })); }
    while (em > 1.8 && maxw(em) > (MAXW - 2) * MM) em -= 0.1;
    var fname = size(em), ciY = tipoY - 1.6 - 2.8, y = ciY - 0.6 - 3.0 - 3.5 * (lines.length - 1);
    lines.forEach(function (ln) { center(ctx, ln, 'bold', fname, CX, y); y += 3.5; });
    center(ctx, 'C.I: ' + p.ci, 'reg', size(2.8), CX, ciY);

    // 2) Tipo de personal
    center(ctx, p.tipo, 'reg', fitFont(p.tipo, 'reg', 2.8, MAXW), CX, tipoY);

    // 3) Institución
    var school = (inst.corto || '').toUpperCase(), band = instBottom - instTop;
    var fs = fitFont(school, 'xbold', 4.6, MAXW);
    if (fs >= pyRound(3.9 * MM)) {
      center(ctx, school, 'xbold', fs, CX, instTop + (band - fs / MM) / 2);
    } else {
      var e2 = 3.1, ls, alto;
      while (true) {
        ls = wrap(school, 'xbold', size(e2), MAXW - 3);
        alto = e2 + e2 * 1.08 * (ls.length - 1);
        if ((ls.length <= 2 || (e2 <= 2.2 && ls.length <= 3)) && alto <= band) break;
        if (e2 <= 1.5) break;
        e2 -= 0.05;
      }
      var lh = e2 * 1.08, y0 = instTop + (band - (lh * (ls.length - 1) + e2)) / 2;
      ls.forEach(function (ln, i) { center(ctx, ln, 'xbold', fitFont(ln, 'xbold', e2, MAXW - 3), CX, y0 + i * lh); });
    }

    // 4) Período escolar
    center(ctx, 'PERIODO ESCOLAR', 'bold', size(perFont), CX, perY1);
    center(ctx, inst.periodo || '', 'bold', size(perFont), CX, perY2);

    // 5) QR
    drawQR(ctx, qrText(p, inst), px(CX - QR_MM / 2), px(qrTop), px(QR_MM) - px(0));

    // Cargo en la franja (rotado 90°)
    var cargo = (p.cargo || '').toUpperCase(), bandLen = TRIM_H - 9.6;
    var fc = fitFont(cargo, 'xbold', 6.4, bandLen), cl = [cargo];
    if (fc < pyRound(4.6 * MM) && cargo.indexOf(' ') >= 0) {
      var words = cargo.split(' '), best = null, s34 = size(3.4);
      for (var k = 1; k < words.length; k++) {
        var a = words.slice(0, k).join(' '), bb = words.slice(k).join(' ');
        var w = Math.max(tlen(a, 'xbold', s34), tlen(bb, 'xbold', s34));
        if (best === null || w < best[0]) best = [w, [a, bb]];
      }
      cl = best[1]; fc = s34;
      cl.forEach(function (ln) { fc = Math.min(fc, fitFont(ln, 'xbold', 3.4, bandLen)); });
    }
    var clh = fc * 1.08;
    var tw = Math.floor(Math.max.apply(null, cl.map(function (l) { return tlen(l, 'xbold', fc); }))) + 10;
    var th = Math.floor(clh * cl.length + fc * 0.25) + 10;
    var lay = document.createElement('canvas'); lay.width = tw; lay.height = th;
    var lc = lay.getContext('2d');
    cl.forEach(function (ln, i) { drawText(lc, ln, 'xbold', fc, (tw - tlen(ln, 'xbold', fc)) / 2, 2 + i * clh, '#fff'); });
    var bbx = inkBox(lc, tw, th);
    if (bbx) {
      var rw = bbx.h, rh = bbx.w;                  // tamaño después de girar
      var bx = px(FRANJA_X) + Math.floor((px(TRIM_W) - px(FRANJA_X) - rw) / 2);
      var by = px(TRIM_H / 2) - Math.floor(rh / 2);
      ctx.save(); ctx.translate(bx, by + rh); ctx.rotate(-Math.PI / 2);
      ctx.drawImage(lay, bbx.x, bbx.y, bbx.w, bbx.h, 0, 0, bbx.w, bbx.h);
      ctx.restore();
    }
    return canvas;
  }

  function inkBox(c, w, h) {
    var d = c.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  function loadFonts(urls) {   // urls: {reg, bold, xbold} (data: o http)
    var ps = Object.keys(FAM).map(function (k) {
      var f = new FontFace(FAM[k], 'url(' + urls[k] + ')'); document.fonts.add(f); return f.load();
    });
    return Promise.all(ps);
  }

  return { render: render, grupo: grupo, loadFonts: loadFonts, W: W, H: H, qrText: qrText };
})();
