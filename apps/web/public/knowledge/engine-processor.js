// AudioWorklet DSP ported from the user-supplied Engine Simulator 3D.html.
/* eslint-disable no-var -- Preserve the supplied DSP's function-scoped variables. */
function bpc(f0, Q, sr) {
  var w = (2 * Math.PI * Math.min(f0, sr * 0.45)) / sr,
    a = Math.sin(w) / (2 * Q),
    c = Math.cos(w),
    a0 = 1 + a;
  return [a / a0, 0, -a / a0, (-2 * c) / a0, (1 - a) / a0];
}
function bq(s, x, c) {
  var y = c[0] * x + c[1] * s[0] + c[2] * s[1] - c[3] * s[2] - c[4] * s[3];
  s[1] = s[0];
  s[0] = x;
  s[3] = s[2];
  s[2] = y;
  return y;
}

class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    var sr = sampleRate;
    this.sr = sr;
    this.M = 12;
    this.P = {
      rpm: 0,
      thr: 0,
      load: 0,
      on: 0,
      starter: 0,
      master: 0,
      vol: 1,
      n: 1,
      fire: [0],
      bank: [0],
      runner: [1],
      cylVar: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      pipe: 1.2,
      refl: 0.55,
      damp: 0.45,
      open: 0.35,
      evo: 130,
      bright: 0.5,
      mech: 0.35,
      punch: 1,
      turbo: 0,
      sc: 0,
      boost: 0,
      cut: 0,
      pop: 0,
    };
    this.ang = 0;
    this.rpmS = 0;
    this.mst = 0;
    this.eph = new Float32Array(this.M).fill(2);
    this.eam = new Float32Array(this.M);
    this.ein = new Float32Array(this.M).fill(1);
    this.pressure = new Float32Array(this.M);
    this.ring = new Float32Array(this.M);
    this.ringPhase = new Float32Array(this.M);
    this.iph = new Float32Array(this.M).fill(2);
    this.iam = new Float32Array(this.M);
    this.iin = new Float32Array(this.M).fill(1);
    this.vph = new Float32Array(this.M).fill(2);
    this.rd = [];
    this.ri = new Int32Array(this.M);
    this.rl = new Int32Array(this.M);
    for (var i = 0; i < this.M; i++) {
      this.rd.push(new Float32Array(1024));
      this.rl[i] = 60;
    }
    this.bd = [new Float32Array(8192), new Float32Array(8192)];
    this.bi = [0, 0];
    this.bl = [340, 352];
    this.blp = [0, 0];
    this.ap = [new Float32Array(2048), new Float32Array(2048)];
    this.api = [0, 0];
    this.apl = [311, 367];
    this.mlp = [0, 0];
    this.hx = [0, 0];
    this.hy = [0, 0];
    this.exLow = [0, 0];
    this.exTone = [0, 0];
    this.ib = [0, 0, 0, 0];
    this.ib2 = [0, 0, 0, 0];
    this.mb = [0, 0, 0, 0];
    this.cv = [
      new Float32Array(4096),
      new Float32Array(4096),
      new Float32Array(4096),
      new Float32Array(4096),
    ];
    this.cvi = 0;
    this.cvl = [1327, 1637, 1913, 2251];
    this.cvlp = [0, 0, 0, 0];
    this.tph = 0;
    this.tph2 = 0;
    this.bov = 0;
    this.bovLp = 0;
    this.scph = 0;
    this.stp = 0;
    this.wph = 0;
    this.keyTime = 0;
    this.starterGain = 0;
    this.starterTick = 0;
    this.port.onmessage = function (e) {
      var d = e.data,
        k;
      if (d.bov) {
        this.bov = 1;
        return;
      }
      if (d.keyEvent) this.keyTime = 0.18 * this.sr;
      for (k in d) this.P[k] = d[k];
      if (d.pipe !== undefined || d.runner !== undefined) this.recalc();
    }.bind(this);
    this.recalc();
  }
  recalc() {
    var P = this.P,
      sr = this.sr,
      c = 343,
      L = Math.max(0.35, P.pipe);
    this.bl[0] = Math.max(40, Math.min(8000, Math.round((sr * 2 * L) / c)));
    this.bl[1] = Math.max(
      40,
      Math.min(8000, Math.round((sr * 2 * L * 1.04) / c)),
    );
    for (var i = 0; i < P.n; i++) {
      var r = 0.42 * (P.runner[i] || 1);
      this.rl[i] = Math.max(3, Math.min(1000, Math.round((sr * r) / c)));
    }
  }
  process(_, outs) {
    var o = outs[0],
      L = o[0],
      R = o[1] || o[0],
      N = L.length,
      P = this.P,
      sr = this.sr;
    var n = P.n | 0;
    if (n < 1) n = 1;
    if (n > this.M) n = this.M;
    var dampC = 1 - Math.exp((-2 * Math.PI * (650 + 4600 * P.bright)) / sr);
    var mufC = 1 - Math.exp((-2 * Math.PI * (380 + 3000 * (1 - P.damp))) / sr);
    var cIn = bpc(62 + 70 * P.bright, 1.05, sr);
    var cIn2 = bpc(1200 + 2000 * P.thr, 0.75, sr);
    var cMe = bpc(2700, 1.5, sr);
    var open = P.open,
      refl = P.refl,
      norm = 1 / Math.sqrt(n);
    var evo = Math.max(60, P.evo);
    var lowC = 1 - Math.exp((-2 * Math.PI * (150 + P.rpm * 0.025)) / sr);
    var toneC = 1 - Math.exp((-2 * Math.PI * (850 + P.bright * 1800)) / sr);

    for (var i = 0; i < N; i++) {
      this.rpmS += (P.rpm - this.rpmS) * 0.0026;
      this.mst += (P.master - this.mst) * 0.0016;
      var rpm = this.rpmS,
        dps = (rpm * 6) / sr;
      var pressureDecay = Math.exp(-dps / (evo * 0.75));
      var ringDecay = Math.exp(-dps / (evo * 1.6));
      var prev = this.ang;
      this.ang += dps;
      if (this.ang >= 720) this.ang -= 720;
      var in0 = 0,
        in1 = 0,
        ix = 0,
        mx = 0;

      if (dps > 1e-7 && (P.on || P.starter)) {
        for (var c = 0; c < n; c++) {
          var fa = P.fire[c];
          var d = (fa + 140 - prev) % 720;
          if (d < 0) d += 720;
          if (d < dps) {
            var mis = Math.random() < P.cut;
            var A =
              (P.on ? 0.28 + 0.98 * P.load : 0.2) *
              P.punch *
              (P.cylVar[c] || 1);
            if (P.starter) A *= 0.55;
            if (mis) {
              A *= 0.05;
              var pk =
                (Math.random() * 2 - 1) * P.pop * (0.5 + Math.random() * 0.9);
              if ((P.bank[c] & 1) === 0) in0 += pk;
              else in1 += pk;
            }
            this.eph[c] = 0;
            this.eam[c] = A;
            this.ein[c] = dps / evo;
            this.vph[c] = 0;
            // Pressure wave and pipe ringing follow the actual firing event.
            this.pressure[c] = A;
            this.ring[c] = A;
            this.ringPhase[c] = 0;
          }
          var d2 = (fa + 350 - prev) % 720;
          if (d2 < 0) d2 += 720;
          if (d2 < dps) {
            this.iph[c] = 0;
            this.iam[c] = 0.22 + 1.0 * P.thr;
            this.iin[c] = dps / (evo * 1.7);
            this.vph[c] = 0;
          }
        }
      }

      for (var c2 = 0; c2 < n; c2++) {
        var v = 0;
        if (this.eph[c2] < 1) {
          var x = this.eph[c2];
          var env = x < 0.045 ? x / 0.045 : Math.exp(-(x - 0.045) * 5.5);
          var grain = Math.random() * 2 - 1;
          // A stable body plus turbulent exhaust: the crank pattern remains audible
          // even when the noisy part changes from cycle to cycle.
          v = this.eam[c2] * env * (0.7 + 0.3 * grain);
          this.eph[c2] += this.ein[c2];
        }
        var pressure = this.pressure[c2];
        this.pressure[c2] *= pressureDecay;
        this.ringPhase[c2] +=
          ((85 + rpm * 0.015 + P.bright * 65) * 6.283185307) / sr;
        if (this.ringPhase[c2] > 6.283185307) this.ringPhase[c2] -= 6.283185307;
        var ring = this.ring[c2] * Math.sin(this.ringPhase[c2]);
        this.ring[c2] *= ringDecay;
        v += pressure * 0.42 + ring * 0.28;
        var buf = this.rd[c2],
          idx = this.ri[c2],
          ln = this.rl[c2];
        buf[idx] = v;
        var rv = buf[(idx - ln + 1024) & 1023];
        this.ri[c2] = (idx + 1) & 1023;
        if ((P.bank[c2] & 1) === 0) in0 += rv;
        else in1 += rv;
        if (this.iph[c2] < 1) {
          var y = this.iph[c2];
          var ie = y < 0.08 ? y / 0.08 : Math.exp(-(y - 0.08) * 2.8);
          ix += this.iam[c2] * ie * (Math.random() * 2 - 1);
          this.iph[c2] += this.iin[c2];
        }
        if (this.vph[c2] < 1) {
          mx += (1 - this.vph[c2]) * (Math.random() * 2 - 1) * P.mech * 0.45;
          this.vph[c2] += 0.05;
        }
      }
      in0 *= norm;
      in1 *= norm;

      var out0 = 0,
        out1 = 0;
      for (var b = 0; b < 2; b++) {
        var bd = this.bd[b],
          bi = this.bi[b],
          bl = this.bl[b];
        var rdv = bd[(bi - bl + 8192) & 8191];
        this.blp[b] += (rdv - this.blp[b]) * dampC;
        bd[bi] = (b === 0 ? in0 : in1) - refl * this.blp[b];
        this.bi[b] = (bi + 1) & 8191;
        var g = 0.55,
          ab = this.ap[b],
          ai = this.api[b],
          al = this.apl[b];
        var az = ab[(ai - al + 2048) & 2047];
        var apo = -g * rdv + az;
        ab[ai] = rdv + g * apo;
        this.api[b] = (ai + 1) & 2047;
        this.mlp[b] += (apo - this.mlp[b]) * mufC;
        var mixv = this.mlp[b] * (1 - open) + rdv * open;
        // Slow exhaust body plus a second, RPM dependent pipe resonance.
        this.exLow[b] += (mixv - this.exLow[b]) * lowC;
        this.exTone[b] += (mixv - this.exTone[b]) * toneC;
        mixv =
          mixv * 0.6 +
          this.exLow[b] * 0.46 +
          (this.exTone[b] - this.exLow[b]) * 0.2;
        var hp = mixv - this.hx[b] + 0.995 * this.hy[b];
        this.hx[b] = mixv;
        this.hy[b] = hp;
        if (b === 0) out0 = hp;
        else out1 = hp;
      }

      var ik = bq(this.ib, ix, cIn) * 1.6 + bq(this.ib2, ix, cIn2) * 0.45;
      ik *= (0.2 + 0.9 * P.thr) * norm;

      var mk = bq(this.mb, mx, cMe) * 0.55 * (1 - 0.45 * P.load);
      this.wph += ((rpm / 60) * 11) / sr;
      if (this.wph > 1) this.wph -= 1;
      mk +=
        (Math.sin(6.283185307 * this.wph) +
          0.32 * Math.sin(12.566370614 * this.wph)) *
        P.mech *
        0.012 *
        Math.min(1, rpm / 4200);

      var tb = 0;
      if (P.turbo) {
        var sh = 260 + P.boost * 2200 + rpm * 0.42;
        this.tph += sh / sr;
        if (this.tph > 1) this.tph -= 1;
        this.tph2 += (sh * 2.37) / sr;
        if (this.tph2 > 1) this.tph2 -= 1;
        tb +=
          (Math.sin(6.2832 * this.tph) * 0.7 +
            Math.sin(6.2832 * this.tph2) * 0.3) *
          P.boost *
          0.15 *
          (0.22 + 0.78 * P.thr);
        tb += (Math.random() * 2 - 1) * P.boost * 0.028;
        if (this.bov > 0.002) {
          this.bovLp +=
            (Math.random() * 2 - 1 - this.bovLp) * (0.06 + 0.45 * this.bov);
          tb += this.bovLp * this.bov * 0.85;
          this.bov *= 0.99972;
        }
      }
      if (P.sc) {
        this.scph += ((rpm / 60) * 3 * 2.4) / sr;
        if (this.scph > 1) this.scph -= 1;
        var saw = this.scph * 2 - 1;
        tb +=
          (saw - saw * saw * saw * 0.35) *
          0.11 *
          (0.25 + 0.75 * P.thr) *
          Math.min(1, rpm / 2600);
      }
      // Ignition relay click, starter pinion engagement, then an accelerating
      // electric motor layered with crankshaft compression pulses.
      var st = 0;
      if (this.keyTime > 0) {
        var keyElapsed = 0.18 - this.keyTime / sr;
        if (keyElapsed < 0.012)
          st += (Math.random() * 2 - 1) * (1 - keyElapsed / 0.012) * 0.34;
        if (keyElapsed > 0.105 && keyElapsed < 0.117)
          st +=
            (Math.random() * 2 - 1) * (1 - (keyElapsed - 0.105) / 0.012) * 0.28;
        this.keyTime--;
      }
      this.starterGain += (P.starter - this.starterGain) * 0.0009;
      if (this.starterGain > 0.002) {
        var motor = 105 + rpm * 0.38;
        this.stp += motor / sr;
        if (this.stp >= 1) this.stp -= 1;
        this.starterTick += Math.max(35, (rpm / 60) * 11) / sr;
        if (this.starterTick >= 1) this.starterTick -= 1;
        var whine =
          Math.sin(6.283185307 * this.stp) * 0.2 +
          Math.sin(6.283185307 * this.stp * 2) * 0.055;
        var teeth =
          Math.pow(Math.max(0, 1 - this.starterTick * 14), 2) *
          (Math.random() * 2 - 1) *
          0.11;
        st +=
          (whine + teeth + (Math.random() * 2 - 1) * 0.026) * this.starterGain;
      }

      var dry0 = out0 * 0.98 + out1 * 0.34 + ik * 0.6 + mk + tb + st;
      var dry1 = out1 * 0.98 + out0 * 0.34 + ik * 0.6 + mk + tb + st;
      var mono = (dry0 + dry1) * 0.5,
        rvb = 0;
      for (var k = 0; k < 4; k++) {
        var cb = this.cv[k],
          ci = this.cvi,
          cl = this.cvl[k];
        var s = cb[(ci - cl + 4096) & 4095];
        this.cvlp[k] += (s - this.cvlp[k]) * 0.45;
        cb[ci] = mono * 0.22 + this.cvlp[k] * 0.6;
        rvb += k & 1 ? -s : s;
      }
      this.cvi = (this.cvi + 1) & 4095;
      rvb *= 0.22;

      var m = this.mst * P.vol,
        dr = 1.15 + P.load * 0.95;
      L[i] = Math.tanh((dry0 + rvb * 0.95) * m * dr) * 0.76;
      R[i] = Math.tanh((dry1 + rvb * 0.7) * m * dr) * 0.76;
    }
    return true;
  }
}
registerProcessor("engine-processor", EngineProcessor);
