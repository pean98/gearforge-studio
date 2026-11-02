(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('gearCanvas');
  const ctx = canvas.getContext('2d');
  const state = {
    gearType: 'spur',
    teeth: 24,
    module: 2,
    pressure: 20,
    bore: 8,
    boreAllowance: 0.2,
    boreType: 'circle',
    keyWidth: 3,
    keyDepth: 1.8,
    ringRim: 6,
    ringPinionTeeth: 18,
    rackBase: 6,
    rackPinionTeeth: 20,
    typeTeeth: {spur:24, ring:60, rack:24},
    thickness: 8,
    backlash: 0.12,
    teeth2: 48,
    pair: true,
    beltMode: 'center',
    frcPreset: 'custom',
    flangeMode: 'double',
    beltProfile: 'GT2',
    beltPitch: 2,
    pulley1: 20,
    pulley2: 40,
    beltCenter: 80,
    beltLength: 300,
    targetD1: 13,
    targetD2: 26,
    beltWidth: 6,
    view: '2d',
    playing: true,
    rpm: 24,
    angle: 0,
    viewYaw: -.55,
    viewPitch: .83,
    zoom: 1,
    selectedExport: 'svg',
    exportTarget: 'driver',
    lastTime: performance.now()
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rad = (deg) => deg * Math.PI / 180;
  const inv = (a) => Math.tan(a) - a;
  const polar = (r, a) => ({ x: r * Math.cos(a), y: r * Math.sin(a), a });
  const fmt = (v, n = 2) => Number(v).toFixed(n);
  const canvasFont = 'ui-sans-serif, system-ui, sans-serif';
  const quality = { preview:20, export:28, mesh:16 };
  const frcPresets = {
    'andymark-am4960': {
      label:'AndyMark am-4960', profile:'HTD-5M', pitch:5, teeth:14,
      boreType:'hex', bore:9.525, beltWidth:9, bodyWidth:10.2,
      flangeDiameter:23.876, flangeThickness:1.25, totalWidth:12.7, flangeMode:'double',
      sourceTitle:'AndyMark 제품 사양', sourceUrl:'https://andymark.com/products/14-tooth-0-375-in-hex-bore-htd-pulley'
    },
    'andymark-am3403': {
      label:'AndyMark am-3403', profile:'HTD-5M', pitch:5, teeth:24,
      boreType:'hex', bore:12.7, beltWidth:9, bodyWidth:9,
      flangeDiameter:42, flangeThickness:2.5, totalWidth:14, flangeMode:'double',
      sourceTitle:'AndyMark 제품 사양', sourceUrl:'https://andymark.com/products/24t-plastic-htd-pulleys?variant=44493442384044'
    },
    'andymark-am4626': {
      label:'AndyMark am-4626', profile:'HTD-5M', pitch:5, teeth:24,
      boreType:'hex', bore:12.7, beltWidth:15, bodyWidth:18,
      flangeDiameter:41.402, flangeThickness:1.16, totalWidth:20.32, flangeMode:'double',
      sourceTitle:'AndyMark 제품 사양', sourceUrl:'https://andymark.com/products/24-tooth-0-5-in-hex-bore-5-mm-htd-18-mm-wide-aluminum-pulley'
    },
    'rev-41-1668': {
      label:'REV-41-1668', profile:'GT3-3M', pitch:3, teeth:12,
      boreType:'hex', bore:5, beltWidth:9, bodyWidth:15,
      flangeDiameter:null, flangeThickness:0, totalWidth:15, flangeMode:'none',
      sourceTitle:'REV 공식 도면', sourceUrl:'https://www.revrobotics.com/content/docs/REV-41-1668-DR.pdf'
    },
    'rev-45-1823': {
      label:'REV-45-1823 / REV-41-1669', profile:'GT3-3M', pitch:3, teeth:24,
      boreType:'hex', bore:5, beltWidth:9, bodyWidth:10.6,
      flangeDiameter:26.9, flangeThickness:2.2, totalWidth:15, flangeMode:'double',
      sourceTitle:'REV 공식 도면', sourceUrl:'https://www.revrobotics.com/content/docs/GT2-Timing-Belt-Pulley-DR.pdf'
    }
  };
  const flangeModeNames={double:'양면 플랜지',single:'단면 플랜지',none:'플랜지 없음'};

  function params(teeth = state.teeth) {
    const m = state.module;
    const alpha = rad(state.pressure);
    const rp = m * teeth / 2;
    const rb = rp * Math.cos(alpha);
    const ra = rp + m;
    const rf = Math.max(m * .35, rp - 1.25 * m);
    const halfTooth = Math.PI / (2 * teeth) - state.backlash / Math.max(4 * rp, .001);
    return { teeth, m, alpha, rp, rb, ra, rf, halfTooth };
  }

  function gearPolygon(teeth = state.teeth, rotation = 0, flankSteps = quality.export) {
    const p = params(teeth);
    const pitchInv = inv(p.alpha);
    const atRadius = (r) => {
      const a = Math.acos(clamp(p.rb / Math.max(r, p.rb), -1, 1));
      return Math.max(.001, p.halfTooth + pitchInv - inv(a));
    };
    const baseHalf = atRadius(p.rb);
    const tipHalf = atRadius(p.ra);
    const points = [];
    const pitch = Math.PI * 2 / teeth;

    for (let t = 0; t < teeth; t++) {
      const c = rotation + t * pitch;
      points.push(polar(p.rf, c - baseHalf));
      if (p.rf < p.rb) points.push(polar(p.rb, c - baseHalf));
      for (let i = 1; i <= flankSteps; i++) {
        const r = p.rb + (p.ra - p.rb) * i / flankSteps;
        points.push(polar(r, c - atRadius(r)));
      }
      const tipArcSteps = Math.max(4,Math.round(flankSteps/3));
      for (let i = 1; i <= tipArcSteps; i++) {
        points.push(polar(p.ra, c - tipHalf + (2 * tipHalf * i / tipArcSteps)));
      }
      for (let i = flankSteps - 1; i >= 0; i--) {
        const r = p.rb + (p.ra - p.rb) * i / flankSteps;
        points.push(polar(r, c + atRadius(r)));
      }
      if (p.rf < p.rb) points.push(polar(p.rf, c + baseHalf));
      const nextStart = c + pitch - baseHalf;
      const rootSteps = Math.max(4,Math.round(flankSteps/3));
      for (let i = 1; i <= rootSteps; i++) {
        points.push(polar(p.rf, c + baseHalf + (nextStart - (c + baseHalf)) * i / rootSteps));
      }
    }
    return points;
  }

  function circlePolygon(radius, steps = 160, rotation = 0) {
    return Array.from({length: steps}, (_, i) => polar(radius, rotation + i / steps * Math.PI * 2));
  }

  function internalGearHole(teeth = state.teeth, rotation = 0, flankQuality = quality.export) {
    const m = state.module;
    const rp = m * teeth / 2;
    const rootR = rp + 1.25 * m;
    const tipR = Math.max(m, rp - m);
    const pitch = Math.PI * 2 / teeth;
    const halfTip = Math.max(pitch * .12, Math.PI / (2 * teeth) - state.backlash / Math.max(4 * rp, .001));
    const points = [];
    for (let i = 0; i < teeth; i++) {
      const c = rotation + i * pitch;
      const shoulder=halfTip*1.35;
      const rootArcSteps=Math.max(5,Math.round(flankQuality/4));
      const flankSteps=Math.max(8,Math.round(flankQuality/2));
      const tipArcSteps=Math.max(5,Math.round(flankQuality/4));
      for(let j=0;j<=rootArcSteps;j++) points.push(polar(rootR,c-pitch/2+(pitch/2-shoulder)*j/rootArcSteps));
      for(let j=1;j<=flankSteps;j++){
        const t=j/flankSteps, eased=t*t*(3-2*t);
        points.push(polar(rootR+(tipR-rootR)*eased,c-shoulder+(shoulder-halfTip)*t));
      }
      for(let j=1;j<=tipArcSteps;j++) points.push(polar(tipR,c-halfTip+2*halfTip*j/tipArcSteps));
      for(let j=1;j<=flankSteps;j++){
        const t=j/flankSteps, eased=t*t*(3-2*t);
        points.push(polar(tipR+(rootR-tipR)*eased,c+halfTip+(shoulder-halfTip)*t));
      }
      for(let j=1;j<=rootArcSteps;j++) points.push(polar(rootR,c+shoulder+(pitch/2-shoulder)*j/rootArcSteps));
    }
    return points;
  }

  function rackPolygon() {
    const z = state.teeth;
    const m = state.module;
    const pitch = Math.PI * m;
    const alpha = rad(state.pressure);
    const add = m, ded = 1.25 * m;
    const tooth = Math.max(pitch * .18, pitch / 2 - state.backlash / 2);
    const tipHalf = Math.max(pitch * .08, tooth / 2 - add * Math.tan(alpha));
    const rootHalf = Math.min(pitch * .46, tooth / 2 + ded * Math.tan(alpha));
    const xMin = -z * pitch / 2, xMax = z * pitch / 2;
    const bottom = -ded - state.rackBase;
    const points = [{x:xMin,y:bottom,a:0},{x:xMax,y:bottom,a:0},{x:xMax,y:-ded,a:0}];
    for (let i = z - 1; i >= 0; i--) {
      const c = xMin + (i + .5) * pitch;
      points.push({x:c + rootHalf,y:-ded,a:0});
      points.push({x:c + tipHalf,y:add,a:0});
      points.push({x:c - tipHalf,y:add,a:0});
      points.push({x:c - rootHalf,y:-ded,a:0});
    }
    points.push({x:xMin,y:-ded,a:0});
    return points;
  }

  function pulleyPolygon(teeth, pitch = state.beltPitch, rotation = 0) {
    const rp = teeth * pitch / (Math.PI * 2);
    // The belt tooth profile must not grow with the bore. Invalid bore/profile
    // combinations are prevented by pulleyMinimumSpec() before geometry is built.
    const rootR = Math.max(pitch * .55, rp - pitch * .30);
    const tipR = Math.max(rootR + pitch * .12, rp - pitch * .05);
    const toothPitch = Math.PI * 2 / teeth;
    const half = toothPitch * .22;
    const rootArcSteps = 5, tipArcSteps = 4;
    const points = [];
    for (let i = 0; i < teeth; i++) {
      const c = rotation + i * toothPitch;
      const rootStart=c-toothPitch/2, rootEnd=c-half*1.2;
      for(let j=0;j<=rootArcSteps;j++) points.push(polar(rootR,rootStart+(rootEnd-rootStart)*j/rootArcSteps));
      points.push(polar(tipR, c - half));
      for(let j=1;j<=tipArcSteps;j++) points.push(polar(tipR,c-half+2*half*j/tipArcSteps));
      points.push(polar(rootR, c + half * 1.2));
      const nextRoot=c+toothPitch/2;
      for(let j=1;j<=rootArcSteps;j++) points.push(polar(rootR,c+half*1.2+(nextRoot-(c+half*1.2))*j/rootArcSteps));
    }
    return points;
  }

  function boreEnvelopeRadius() {
    const radius=effectiveBoreDiameter()/2;
    return state.boreType==='keyway' ? radius+Math.max(.1,state.keyDepth) : radius;
  }

  function effectiveBoreDiameter() {
    return Math.max(0,state.bore+state.boreAllowance);
  }

  function pulleyMinimumSpec(pitch=state.beltPitch) {
    const boreRadius=boreEnvelopeRadius();
    const wall=Math.max(1.2,pitch*.45);
    const profileAllowance=pitch*.30;
    const minTeeth=Math.max(10,Math.ceil((boreRadius+wall+profileAllowance)*Math.PI*2/pitch));
    return {
      minTeeth,
      minPitchDiameter:minTeeth*pitch/Math.PI,
      boreRadius,
      wall,
      rootRadius:minTeeth*pitch/(Math.PI*2)-profileAllowance
    };
  }

  function beltTeethAtCenter(z1, z2, center, pitch) {
    const delta = Math.abs(z2 - z1);
    const term = clamp(delta * pitch / (2 * Math.PI * Math.max(center, .001)), -1, 1);
    const root = Math.max(0, Math.pow(2 * center / pitch, 2) - Math.pow(delta / Math.PI, 2));
    return (z1 + z2) / 2 + delta / Math.PI * Math.asin(term) + Math.sqrt(root);
  }

  function solveCenter(z1, z2, beltTeeth, pitch) {
    const d1 = z1 * pitch / Math.PI, d2 = z2 * pitch / Math.PI;
    let low = (d1 + d2) / 2 + .01;
    if (beltTeethAtCenter(z1, z2, low, pitch) > beltTeeth) return NaN;
    let high = Math.max(low * 1.5, beltTeeth * pitch / 2);
    while (beltTeethAtCenter(z1, z2, high, pitch) < beltTeeth && high < 100000) high *= 1.5;
    for (let i = 0; i < 70; i++) {
      const mid = (low + high) / 2;
      if (beltTeethAtCenter(z1, z2, mid, pitch) < beltTeeth) low = mid; else high = mid;
    }
    return (low + high) / 2;
  }

  function pulleyPairMinimumSpec(z1,z2,pitch=state.beltPitch) {
    const flange1=pulleyFlangeSpec(z1,pitch),flange2=pulleyFlangeSpec(z2,pitch);
    const minCenter=flange1.flangeRadius+flange2.flangeRadius+Math.max(.5,pitch*.25);
    const minBeltTeeth=Math.ceil(beltTeethAtCenter(z1,z2,minCenter,pitch));
    return {minCenter,minBeltTeeth,minBeltLength:minBeltTeeth*pitch};
  }

  function beltCalc() {
    const pitch = state.beltPitch;
    const limit = pulleyMinimumSpec(pitch);
    let z1, z2, requestedCenter, rawTeeth, beltTeeth;
    if (state.beltMode === 'center') {
      z1 = Math.max(limit.minTeeth,state.pulley1);
      z2 = Math.max(limit.minTeeth,state.pulley2);
      const pairLimit=pulleyPairMinimumSpec(z1,z2,pitch);
      requestedCenter = Math.max(state.beltCenter,pairLimit.minCenter);
      rawTeeth = beltTeethAtCenter(z1, z2, requestedCenter, pitch);
      beltTeeth = Math.max(Math.max(z1,z2)+6, Math.round(rawTeeth));
    } else {
      z1 = Math.max(limit.minTeeth, Math.round(Math.PI * state.targetD1 / pitch));
      z2 = Math.max(limit.minTeeth, Math.round(Math.PI * state.targetD2 / pitch));
      const pairLimit=pulleyPairMinimumSpec(z1,z2,pitch);
      beltTeeth = Math.max(pairLimit.minBeltTeeth, Math.round(state.beltLength / pitch));
      rawTeeth = state.beltLength / pitch;
    }
    const d1 = z1 * pitch / Math.PI, d2 = z2 * pitch / Math.PI;
    const center = solveCenter(z1, z2, beltTeeth, pitch);
    const smallZ = Math.min(z1,z2);
    const wrap = Number.isFinite(center) ? Math.PI - 2 * Math.asin(clamp(Math.abs(d2-d1)/(2*center),0,1)) : 0;
    const teethInMesh = smallZ * wrap / (Math.PI * 2);
    return { pitch, z1, z2, d1, d2, center, requestedCenter, rawTeeth, beltTeeth, length: beltTeeth * pitch, ratio: z2/z1, teethInMesh };
  }

  function spurGeometry(teeth = state.teeth, rotation = 0, flankSteps = quality.export) {
    return {
      outer: gearPolygon(teeth, rotation, flankSteps),
      hole: rotateShape(holePolygon(160), rotation),
      pitchRadius: params(teeth).rp
    };
  }

  function ringGeometry(rotation = 0, flankSteps = quality.export) {
    const rootR = state.module * state.teeth / 2 + 1.25 * state.module;
    return {
      outer: circlePolygon(rootR + state.ringRim, Math.max(240,state.teeth*12)),
      hole: internalGearHole(state.teeth, rotation, flankSteps),
      pitchRadius: state.module * state.teeth / 2
    };
  }

  function rackGeometry(offset = 0) {
    return {outer:movePoints(rackPolygon(),offset,0), hole:[], pitchRadius:0, concaveCap:true};
  }

  function pulleyGeometry(teeth, pitch, rotation = 0) {
    return {outer:pulleyPolygon(teeth,pitch,rotation), hole:rotateShape(holePolygon(160),rotation), pitchRadius:teeth*pitch/(Math.PI*2)};
  }

  function pulleyFlangeSpec(teeth, pitch) {
    const pitchRadius=teeth*pitch/(Math.PI*2);
    const toothRootRadius=Math.max(pitch*.55,pitchRadius-pitch*.30);
    const toothTipRadius=Math.max(toothRootRadius+pitch*.12,pitchRadius-pitch*.05);
    let flangeMargin=Math.max(.6,pitch*.20);
    let flangeRadius=toothTipRadius+flangeMargin;
    let flangeThickness=Math.max(.8,pitch*.25);
    const reference=matchingFrcPreset(teeth,pitch);
    if(reference){
      flangeRadius=reference.flangeDiameter ? reference.flangeDiameter/2 : toothTipRadius;
      flangeMargin=flangeRadius-toothTipRadius;
      flangeThickness=reference.flangeThickness;
    }
    const mode=reference?.flangeMode||state.flangeMode;
    const flangeCount=mode==='double'?2:mode==='single'?1:0;
    if(mode==='none'){
      flangeRadius=toothTipRadius;
      flangeMargin=0;
      flangeThickness=0;
    }
    return {
      flangeRadius,
      flangeHeight:flangeMargin,
      flangeMargin,
      flangeThickness,
      totalWidth:reference?reference.totalWidth:state.thickness+flangeThickness*flangeCount,
      reference:reference?.label||null,
      mode,
      flangeCount
    };
  }

  function matchingFrcPreset(teeth,pitch) {
    const preset=frcPresets[state.frcPreset];
    if(!preset) return null;
    const same=(a,b,t=.051)=>Math.abs(a-b)<t;
    return teeth===preset.teeth && state.beltProfile===preset.profile && same(pitch,preset.pitch,.001) &&
      state.boreType===preset.boreType && same(state.bore,preset.bore) && same(state.beltWidth,preset.beltWidth) &&
      same(state.thickness,preset.bodyWidth) && state.flangeMode===preset.flangeMode ? preset : null;
  }

  function applyFrcPreset(key) {
    state.frcPreset=key;
    const preset=frcPresets[key];
    if(!preset){ readInputs(); return; }
    $('beltProfile').value=preset.profile;
    $('pulley1').value=preset.teeth; $('pulley2').value=preset.teeth;
    $('bore').value=preset.bore; state.boreType=preset.boreType;
    $('beltWidth').value=preset.beltWidth; $('thickness').value=preset.bodyWidth;
    state.flangeMode=preset.flangeMode;
    readInputs();
  }

  function currentGeometry() {
    if (state.gearType === 'ring') return ringGeometry(0);
    if (state.gearType === 'rack') return rackGeometry(0);
    if (state.gearType === 'pulley') {
      const b = beltCalc();
      return pulleyGeometry(b.z1,b.pitch,0);
    }
    return spurGeometry(state.teeth, 0);
  }

  function holePolygon(steps = 120) {
    const r = effectiveBoreDiameter()/2;
    if (r < .001) return [];
    if (state.boreType === 'hex') {
      return Array.from({length: 6}, (_, i) => polar(r, Math.PI / 6 + i * Math.PI / 3));
    }
    if (state.boreType === 'keyway') {
      const halfW = clamp(state.keyWidth / 2, .05, r * .96);
      const y0 = Math.sqrt(Math.max(0, r * r - halfW * halfW));
      const rightAngle = Math.atan2(y0, halfW);
      const leftAngle = Math.PI - rightAngle;
      const top = r + Math.max(.1, state.keyDepth);
      const points = [];
      const arcSteps = Math.max(12, Math.round(steps * (rightAngle + Math.PI * 2 - leftAngle) / (Math.PI * 2)));
      const firstSteps = Math.max(5, Math.round(arcSteps * rightAngle / (rightAngle + Math.PI * 2 - leftAngle)));
      for (let i = 0; i <= firstSteps; i++) points.push(polar(r, rightAngle * i / firstSteps));
      points.push({x: halfW, y: top, a: Math.atan2(top, halfW)});
      points.push({x: -halfW, y: top, a: Math.atan2(top, -halfW)});
      const remaining = Math.max(8, arcSteps - firstSteps);
      for (let i = 0; i < remaining; i++) {
        const a = leftAngle + (Math.PI * 2 - leftAngle) * i / remaining;
        points.push(polar(r, a));
      }
      return points;
    }
    return Array.from({length: steps}, (_, i) => polar(r, i / steps * Math.PI * 2));
  }

  function rayToPolygon(points, angle) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const sx = b.x - a.x, sy = b.y - a.y;
      const den = dx * sy - dy * sx;
      if (Math.abs(den) < 1e-9) continue;
      const t = (a.x * sy - a.y * sx) / den;
      const u = (a.x * dy - a.y * dx) / den;
      if (t >= 0 && u >= -1e-8 && u <= 1 + 1e-8) best = Math.min(best, t);
    }
    const radius = Number.isFinite(best) ? best : state.bore / 2;
    return { x: dx * radius, y: dy * radius, a: angle };
  }

  function triangulatePolygon(points) {
    const area=points.reduce((sum,p,i)=>{
      const q=points[(i+1)%points.length];
      return sum+p.x*q.y-q.x*p.y;
    },0)/2;
    const order=Array.from({length:points.length},(_,i)=>i);
    if(area<0) order.reverse();
    const triangles=[];
    const inside=(p,a,b,c)=>{
      const cross=(u,v,w)=>(v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x);
      const ab=cross(a,b,p),bc=cross(b,c,p),ca=cross(c,a,p);
      return ab>=-1e-9&&bc>=-1e-9&&ca>=-1e-9;
    };
    let guard=order.length*order.length;
    while(order.length>3&&guard-->0){
      let clipped=false;
      for(let k=0;k<order.length;k++){
        const ia=order[(k-1+order.length)%order.length],ib=order[k],ic=order[(k+1)%order.length];
        const a=points[ia],b=points[ib],c=points[ic];
        const turn=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
        if(turn<=1e-10) continue;
        if(order.some(index=>index!==ia&&index!==ib&&index!==ic&&inside(points[index],a,b,c))) continue;
        triangles.push([ia,ib,ic]);
        order.splice(k,1);
        clipped=true;
        break;
      }
      if(!clipped) break;
    }
    if(order.length===3) triangles.push([order[0],order[1],order[2]]);
    return triangles;
  }

  function buildMesh(geometry = currentGeometry(), thickness = state.thickness) {
    const outer = geometry.outer;
    const hole = geometry.hole;
    const h = thickness / 2;
    const n = outer.length;
    const vertices = [];
    const triangles = [];
    for (const v of outer) vertices.push([v.x, v.y, -h]);
    for (const v of outer) vertices.push([v.x, v.y, h]);
    if (!hole.length) {
      if(geometry.concaveCap){
        for(const tri of triangulatePolygon(outer)){
          triangles.push([n+tri[0],n+tri[1],n+tri[2]],[tri[2],tri[1],tri[0]]);
        }
      } else {
        const cb = vertices.push([0, 0, -h]) - 1;
        const ct = vertices.push([0, 0, h]) - 1;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          triangles.push([ct, n + i, n + j], [cb, j, i]);
        }
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        triangles.push([i, j, n + j], [i, n + j, n + i]);
      }
      return { vertices, triangles };
    }
    const inner = outer.map(v => rayToPolygon(hole, v.a));
    for (const v of inner) vertices.push([v.x, v.y, -h]);
    for (const v of inner) vertices.push([v.x, v.y, h]);
    const ob = 0, ot = n, ib = n * 2, it = n * 3;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      triangles.push([ot + i, ot + j, it + j], [ot + i, it + j, it + i]);
      triangles.push([ob + i, ib + j, ob + j], [ob + i, ib + i, ib + j]);
      triangles.push([ob + i, ob + j, ot + j], [ob + i, ot + j, ot + i]);
      triangles.push([ib + i, it + j, ib + j], [ib + i, it + i, it + j]);
    }
    return { vertices, triangles };
  }

  function mergeMeshes(parts) {
    const vertices=[],triangles=[];
    for(const part of parts){
      const offset=vertices.length;
      vertices.push(...part.vertices);
      triangles.push(...part.triangles.map(tri=>tri.map(index=>index+offset)));
    }
    return {vertices,triangles};
  }

  function moveMeshZ(mesh, z) {
    return {vertices:mesh.vertices.map(v=>[v[0],v[1],v[2]+z]),triangles:mesh.triangles};
  }

  function pulleyMesh(teeth, pitch, rotation = 0) {
    const spec=pulleyFlangeSpec(teeth,pitch);
    const flangeGeometry={
      outer:circlePolygon(spec.flangeRadius,Math.max(180,teeth*10),rotation),
      hole:rotateShape(holePolygon(160),rotation),
      pitchRadius:teeth*pitch/(Math.PI*2)
    };
    const body=buildMesh(pulleyGeometry(teeth,pitch,rotation),state.thickness);
    if(spec.flangeCount===0) return body;
    const flangeOffset=(state.thickness+spec.flangeThickness)/2;
    const front=moveMeshZ(buildMesh(flangeGeometry,spec.flangeThickness),flangeOffset);
    if(spec.flangeCount===1) return mergeMeshes([body,front]);
    const back=moveMeshZ(buildMesh(flangeGeometry,spec.flangeThickness),-flangeOffset);
    return mergeMeshes([body,front,back]);
  }

  const meshCache = new Map();
  function cachedMesh(key, create) {
    if (meshCache.has(key)) return meshCache.get(key);
    const mesh=create();
    meshCache.set(key,mesh);
    if(meshCache.size>24) meshCache.delete(meshCache.keys().next().value);
    return mesh;
  }

  function meshProfileKey() {
    return [state.module,state.pressure,state.backlash,state.bore,state.boreAllowance,state.boreType,state.keyWidth,state.keyDepth,state.thickness,state.flangeMode,state.frcPreset].join('|');
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return rect;
  }

  function pathGear(points, scale, cx, cy) {
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = cx + pt.x * scale;
      const y = cy - pt.y * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }

  function rotateShape(points, rotation) {
    if (!rotation) return points;
    const c = Math.cos(rotation), s = Math.sin(rotation);
    return points.map(p => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c, a: (p.a || 0) + rotation }));
  }

  function drawGear2D(points, holePoints, cx, cy, scale, pitchRadius, fill, stroke, accent) {
    ctx.save();
    pathGear(points, scale, cx, cy);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.35;
    ctx.fill();
    ctx.stroke();
    if (holePoints.length) {
      ctx.globalCompositeOperation = 'destination-out';
      pathGear(holePoints, scale, cx, cy);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      pathGear(holePoints, scale, cx, cy);
      ctx.stroke();
    }
    if (pitchRadius > 0) {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = .55;
      ctx.beginPath();
      ctx.arc(cx, cy, pitchRadius * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCenterMark(cx, cy) {
    ctx.save();
    ctx.strokeStyle = 'rgba(45,58,55,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawDimension(x1, y, x2, label) {
    ctx.save();
    ctx.strokeStyle = 'rgba(58,70,67,.45)';
    ctx.fillStyle = '#596561';
    ctx.lineWidth = .8;
    ctx.font = `500 9px ${canvasFont}`;
    ctx.beginPath();
    ctx.moveTo(x1, y); ctx.lineTo(x2, y);
    ctx.moveTo(x1, y - 4); ctx.lineTo(x1, y + 4);
    ctx.moveTo(x2, y - 4); ctx.lineTo(x2, y + 4);
    ctx.stroke();
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(237,239,233,.92)';
    ctx.fillRect((x1 + x2 - tw) / 2 - 4, y - 7, tw + 8, 13);
    ctx.fillStyle = '#596561';
    ctx.fillText(label, (x1 + x2 - tw) / 2, y + 3);
    ctx.restore();
  }

  function draw2D(rect) {
    const w = rect.width, h = rect.height;
    if (state.gearType === 'ring') {
      const pp=params(state.ringPinionTeeth);
      const rootR = state.module * state.teeth / 2 + 1.25 * state.module;
      const outerR = rootR + state.ringRim;
      const center=Math.max(0,state.module*(state.teeth-state.ringPinionTeeth)/2);
      const scale = Math.min((w-100)/(outerR*2),(h-100)/(outerR*2)) * state.zoom;
      const cx=w/2,cy=h/2,px=cx+center*scale;
      const pinionAngle=state.angle*state.teeth/state.ringPinionTeeth+Math.PI/state.ringPinionTeeth;
      drawGear2D(circlePolygon(outerR,Math.max(240,state.teeth*12)), internalGearHole(state.teeth,state.angle,quality.preview),cx,cy,scale,state.module*state.teeth/2,'rgba(232,155,36,.18)','#9b651c','#b66f13');
      drawGear2D(gearPolygon(state.ringPinionTeeth,pinionAngle,quality.preview),rotateShape(holePolygon(128),pinionAngle),px,cy,scale,pp.rp,'rgba(58,127,137,.17)','#347986','#347986');
      drawCenterMark(cx,cy); drawCenterMark(px,cy);
      drawDimension(cx,cy+outerR*scale+22,px,`a = ${fmt(center)} mm`);
      return;
    }
    if (state.gearType === 'rack') {
      const rack = rackPolygon();
      const pp=params(state.rackPinionTeeth), pitch=Math.PI*state.module;
      const travel=(state.angle*pp.rp)%pitch, movedRack=movePoints(rack,travel,0);
      const xs=rack.map(p=>p.x), ys=rack.map(p=>p.y);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=pp.rp+pp.ra;
      const spanX=Math.max(maxX-minX,pp.ra*2), spanY=maxY-minY;
      const scale=Math.min((w-90)/spanX,(h-100)/Math.max(spanY,1))*state.zoom;
      const cx=w/2, cy=h/2+(maxY+minY)/2*scale;
      const pinionY=cy-pp.rp*scale;
      drawGear2D(movedRack,[],cx,cy,scale,0,'rgba(232,155,36,.20)','#b66f13','#b66f13');
      drawGear2D(gearPolygon(state.rackPinionTeeth,state.angle,quality.preview),rotateShape(holePolygon(128),state.angle),cx,pinionY,scale,pp.rp,'rgba(58,127,137,.17)','#347986','#347986');
      drawCenterMark(cx,pinionY);
      ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle='rgba(58,127,137,.65)'; ctx.beginPath(); ctx.moveTo(cx+(minX+travel)*scale,cy); ctx.lineTo(cx+(maxX+travel)*scale,cy); ctx.stroke(); ctx.restore();
      return;
    }
    if (state.gearType === 'pulley') {
      const b=beltCalc(), r1=b.d1/2, r2=b.d2/2, c=Number.isFinite(b.center)?b.center:state.beltCenter;
      const flange1=pulleyFlangeSpec(b.z1,b.pitch), flange2=pulleyFlangeSpec(b.z2,b.pitch);
      const maxR=Math.max(flange1.flangeRadius,flange2.flangeRadius);
      const scale=Math.min((w-100)/(c+flange1.flangeRadius+flange2.flangeRadius+b.pitch*2),(h-100)/(maxR*2.7))*state.zoom;
      const x1=50+flange1.flangeRadius*scale, x2=x1+c*scale, y=h/2;
      const traceBelt=()=>{
        ctx.beginPath();
        ctx.moveTo(x1,y-r1*scale); ctx.lineTo(x2,y-r2*scale);
        ctx.arc(x2,y,r2*scale,-Math.PI/2,Math.PI/2);
        ctx.lineTo(x1,y+r1*scale); ctx.arc(x1,y,r1*scale,Math.PI/2,Math.PI*1.5);
      };
      ctx.save(); ctx.strokeStyle='rgba(43,55,54,.42)'; ctx.lineWidth=Math.max(4,b.pitch*1.7*scale); ctx.lineCap='round'; ctx.lineJoin='round';
      traceBelt(); ctx.stroke(); ctx.restore();
      // Canvas Y is inverted: positive pulley angle renders counter-clockwise,
      // so an open belt travels left on the top span and right on the bottom.
      ctx.save(); ctx.strokeStyle='rgba(255,255,255,.72)'; ctx.lineWidth=1.4; ctx.setLineDash([7,10]); ctx.lineDashOffset=state.angle*r1*scale;
      traceBelt(); ctx.stroke(); ctx.restore();
      const arrowX=(x1+x2)/2, topY=y-(r1+r2)/2*scale, bottomY=y+(r1+r2)/2*scale;
      ctx.save(); ctx.fillStyle='rgba(43,55,54,.68)';
      ctx.beginPath(); ctx.moveTo(arrowX-7,topY); ctx.lineTo(arrowX+4,topY-4); ctx.lineTo(arrowX+4,topY+4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(arrowX+7,bottomY); ctx.lineTo(arrowX-4,bottomY-4); ctx.lineTo(arrowX-4,bottomY+4); ctx.closePath(); ctx.fill(); ctx.restore();
      const a1=state.angle, a2=state.angle*b.z1/b.z2;
      const hole=holePolygon(96);
      if(flange2.flangeCount) drawGear2D(circlePolygon(flange2.flangeRadius,Math.max(180,b.z2*8),a2),rotateShape(hole,a2),x2,y,scale,r2,'rgba(58,127,137,.09)','#3a7f89','#3a7f89');
      if(flange1.flangeCount) drawGear2D(circlePolygon(flange1.flangeRadius,Math.max(180,b.z1*8),a1),rotateShape(hole,a1),x1,y,scale,r1,'rgba(232,155,36,.11)','#b66f13','#b66f13');
      drawGear2D(pulleyPolygon(b.z2,b.pitch,a2),rotateShape(hole,a2),x2,y,scale,r2,'rgba(58,127,137,.16)','#3a7f89','#3a7f89');
      drawGear2D(pulleyPolygon(b.z1,b.pitch,a1),rotateShape(hole,a1),x1,y,scale,r1,'rgba(232,155,36,.22)','#b66f13','#b66f13');
      drawCenterMark(x1,y); drawCenterMark(x2,y);
      drawDimension(x1,y+maxR*scale+28,x2,`C = ${fmt(c)} mm · ${b.beltTeeth}T belt`);
      return;
    }
    const p1 = params();
    const p2 = params(state.teeth2);
    let minX = -p1.ra, maxX = p1.ra;
    if (state.pair) maxX = p1.rp + p2.rp + p2.ra;
    const sceneW = maxX - minX;
    const scale = Math.min((w - 90) / sceneW, (h - 90) / Math.max(p1.ra * 2, p2.ra * 2)) * state.zoom;
    const originX = state.pair ? 45 - minX * scale : w / 2;
    const originY = h / 2;
    const c2x = originX + (p1.rp + p2.rp) * scale;
    const points1 = gearPolygon(state.teeth, state.angle, quality.preview);
    const angle2 = Math.PI + Math.PI / state.teeth2 - state.angle * state.teeth / state.teeth2;
    const points2 = gearPolygon(state.teeth2, angle2, quality.preview);
    const hole = holePolygon(128);

    if (state.pair) {
      drawGear2D(points2, rotateShape(hole, angle2), c2x, originY, scale, p2.rp, 'rgba(62,127,137,.14)', '#3a7f89', '#3a7f89');
      drawCenterMark(c2x, originY);
    }
    drawGear2D(points1, rotateShape(hole, state.angle), originX, originY, scale, p1.rp, 'rgba(232,155,36,.20)', '#b66f13', '#b66f13');
    drawCenterMark(originX, originY);
    if (state.pair) drawDimension(originX, originY + Math.max(p1.ra, p2.ra) * scale + 23, c2x, `a = ${fmt(p1.rp + p2.rp)} mm`);
  }

  function project3D(v, scale, cx, cy, yaw, pitch) {
    const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = v[0] * cyaw - v[1] * syaw;
    const y1 = v[0] * syaw + v[1] * cyaw;
    const y2 = y1 * cp - v[2] * sp;
    const z2 = y1 * sp + v[2] * cp;
    return { x: cx + x1 * scale, y: cy - y2 * scale, z: z2 };
  }

  function displayItems3D() {
    const profile=meshProfileKey();
    const spurItem=(teeth,angle,x=0,y=0,material=0)=>({
      key:`spur|${teeth}|${profile}|${quality.mesh}`,
      create:()=>buildMesh(spurGeometry(teeth,0,quality.mesh)),
      angle,x,y,material
    });
    if (state.gearType === 'spur' && state.pair) {
      const center=params().rp+params(state.teeth2).rp;
      const angle2=Math.PI+Math.PI/state.teeth2-state.angle*state.teeth/state.teeth2;
      return [
        spurItem(state.teeth,state.angle,0,0,0),
        spurItem(state.teeth2,angle2,center,0,1)
      ];
    }
    if (state.gearType === 'ring') {
      const center=Math.max(0,params().rp-params(state.ringPinionTeeth).rp);
      const pinionAngle=state.angle*state.teeth/state.ringPinionTeeth+Math.PI/state.ringPinionTeeth;
      return [
        {
          key:`ring|${state.teeth}|${state.ringRim}|${profile}|${quality.mesh}`,
          create:()=>buildMesh(ringGeometry(0,quality.mesh)),
          angle:state.angle,x:0,y:0,material:0
        },
        spurItem(state.ringPinionTeeth,pinionAngle,center,0,1)
      ];
    }
    if (state.gearType === 'rack') {
      const pp=params(state.rackPinionTeeth), travel=(state.angle*pp.rp)%(Math.PI*state.module);
      return [
        {
          key:`rack|${state.teeth}|${state.rackBase}|${profile}`,
          create:()=>buildMesh(rackGeometry(0)),
          angle:0,x:travel,y:0,material:0
        },
        spurItem(state.rackPinionTeeth,state.angle,0,pp.rp,1)
      ];
    }
    if (state.gearType === 'pulley') {
      const b=beltCalc(), center=Number.isFinite(b.center)?b.center:state.beltCenter;
      const pulleyItem=(teeth,angle,x,material)=>({
        key:`pulley|${teeth}|${b.pitch}|${profile}`,
        create:()=>pulleyMesh(teeth,b.pitch,0),
        angle,x,y:0,material
      });
      return [
        pulleyItem(b.z1,state.angle,0,0),
        pulleyItem(b.z2,state.angle*b.z1/b.z2,center,1)
      ];
    }
    return [spurItem(state.teeth,state.angle,0,0,0)];
  }

  function draw3D(rect) {
    const vertices=[],triangles=[],materials=[];
    for(const item of displayItems3D()){
      const part=cachedMesh(item.key,item.create), offset=vertices.length;
      const c=Math.cos(item.angle||0),s=Math.sin(item.angle||0);
      vertices.push(...part.vertices.map(v=>[v[0]*c-v[1]*s+item.x,v[0]*s+v[1]*c+item.y,v[2]]));
      triangles.push(...part.triangles.map(t=>t.map(i=>i+offset)));
      materials.push(...part.triangles.map(()=>item.material));
    }
    const mesh={vertices,triangles};
    const xs=mesh.vertices.map(v=>v[0]), ys=mesh.vertices.map(v=>v[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const sceneX=(minX+maxX)/2, sceneY=(minY+maxY)/2;
    const yaw = state.viewYaw;
    const pitch = state.viewPitch;
    const rawProjected=mesh.vertices.map(v=>project3D([v[0]-sceneX,v[1]-sceneY,v[2]],1,0,0,yaw,pitch));
    const rawX=rawProjected.map(p=>p.x),rawY=rawProjected.map(p=>p.y);
    const rawMinX=Math.min(...rawX),rawMaxX=Math.max(...rawX),rawMinY=Math.min(...rawY),rawMaxY=Math.max(...rawY);
    const rawCenterX=(rawMinX+rawMaxX)/2,rawCenterY=(rawMinY+rawMaxY)/2;
    const scale=Math.min((rect.width-100)/Math.max(rawMaxX-rawMinX,1),(rect.height-90)/Math.max(rawMaxY-rawMinY,1))*state.zoom;
    const projected=rawProjected.map(p=>({x:rect.width/2+(p.x-rawCenterX)*scale,y:rect.height/2+8+(p.y-rawCenterY)*scale,z:p.z}));
    const light = [-.4, -.5, .75];
    const faces = mesh.triangles.map((tri, index) => {
      const a = mesh.vertices[tri[0]], b = mesh.vertices[tri[1]], c = mesh.vertices[tri[2]];
      const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
      const v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
      const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      const nl = Math.hypot(...n) || 1;
      const lum = clamp((n[0]*light[0]+n[1]*light[1]+n[2]*light[2])/nl * .4 + .55, .18, .95);
      return { tri, z: tri.reduce((s,i) => s + projected[i].z,0)/3, lum, topFace: Math.abs(n[2] / nl) > .55, material:materials[index]||0, index };
    }).sort((a,b) => a.z - b.z);
    ctx.save();
    ctx.lineJoin = 'round';
    for (const face of faces) {
      const pts = face.tri.map(i => projected[i]);
      const tops=[[221,143,30],[58,127,137]], sides=[[57,82,78],[46,77,82]];
      const base = face.topFace ? tops[face.material] : sides[face.material];
      const shade = .45 + face.lum * .55;
      ctx.fillStyle = `rgb(${base.map(c => Math.round(c * shade)).join(',')})`;
      ctx.strokeStyle = 'rgba(25,34,33,.12)';
      ctx.lineWidth = .4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.closePath();
      ctx.fill();
      if(!face.topFace) ctx.stroke();
    }
    ctx.restore();
  }

  function render(now = performance.now()) {
    const dt = Math.min(.05, (now - state.lastTime) / 1000);
    state.lastTime = now;
    if (state.playing) {
      state.angle += state.rpm * Math.PI * 2 / 60 * dt;
      if (Math.abs(state.angle) > Math.PI * 2000) state.angle %= Math.PI * 2;
    }
    const rect = resizeCanvas();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (state.view === '2d') draw2D(rect); else draw3D(rect);
    requestAnimationFrame(render);
  }

  function contactRatio() {
    const p1 = params(), p2 = params(state.teeth2);
    const path = Math.sqrt(Math.max(0,p1.ra*p1.ra-p1.rb*p1.rb)) + Math.sqrt(Math.max(0,p2.ra*p2.ra-p2.rb*p2.rb)) - (p1.rp+p2.rp)*Math.sin(p1.alpha);
    return path / (Math.PI * state.module * Math.cos(p1.alpha));
  }

  function validate() {
    const p = params();
    const maxRadius = p.rf * .78;
    const holeRadius = effectiveBoreDiameter() / 2 + (state.boreType === 'keyway' ? state.keyDepth : 0);
    const warning = $('warning');
    if (state.gearType === 'pulley') {
      const b=beltCalc();
      const limit=pulleyMinimumSpec(b.pitch);
      if (!Number.isFinite(b.center)) {
        warning.textContent='선택한 벨트가 두 풀리를 감싸기에는 너무 짧습니다.';
        warning.hidden=false;
      } else if (Math.min(b.z1,b.z2)<limit.minTeeth) {
        warning.textContent=`현재 중심 구멍에는 ${limit.minTeeth}T 이상의 풀리가 필요합니다.`;
        warning.hidden=false;
      } else if (state.thickness < state.beltWidth + .5) {
        warning.textContent=`풀리 몸통 폭이 좁습니다. ${fmt(state.beltWidth)} mm 벨트에는 ${fmt(state.beltWidth+.5)} mm 이상을 권장합니다.`;
        warning.hidden=false;
      } else if (state.flangeMode==='none') {
        warning.textContent='벨트 이탈 방지를 위해 한 쌍 중 최소 한 풀리에는 플랜지를 권장합니다.';
        warning.hidden=false;
      } else if (b.teethInMesh < 6) {
        warning.textContent=`작은 풀리 맞물림이 ${fmt(b.teethInMesh,1)}개입니다. 6개 이상을 권장합니다.`;
        warning.hidden=false;
      } else warning.hidden=true;
    } else if (state.gearType === 'ring') {
      const difference=state.teeth-state.ringPinionTeeth;
      const pp=params(state.ringPinionTeeth);
      if (difference<=0) {
        warning.textContent='내접기어 잇수는 피니언보다 커야 합니다.'; warning.hidden=false;
      } else if (state.pressure===20&&state.ringPinionTeeth<17) {
        warning.textContent='피니언 잇수가 작아 언더컷·인벌류트 간섭 가능성이 있습니다. 17T 이상을 권장합니다.'; warning.hidden=false;
      } else if (difference<16) {
        warning.textContent='내접기어와 피니언의 잇수 차이가 작아 트로코이드·트리밍 간섭 가능성이 있습니다.'; warning.hidden=false;
      } else if (holeRadius>pp.rf*.78) {
        warning.textContent=`피니언 중심 구멍이 큽니다. 권장 최대 반지름은 약 ${fmt(pp.rf*.78,1)} mm입니다.`; warning.hidden=false;
      } else warning.hidden=true;
    } else if (state.gearType === 'rack') {
      const pp=params(state.rackPinionTeeth);
      if (state.pressure===20&&state.rackPinionTeeth<17) {
        warning.textContent='20° 표준 피니언은 언더컷을 줄이기 위해 17T 이상을 권장합니다.'; warning.hidden=false;
      } else if (holeRadius>pp.rf*.78) {
        warning.textContent=`피니언 중심 구멍이 큽니다. 권장 최대 반지름은 약 ${fmt(pp.rf*.78,1)} mm입니다.`; warning.hidden=false;
      } else warning.hidden=true;
    } else if (state.gearType === 'spur' && state.teeth < 17 && state.pressure === 20) {
      warning.textContent = '언더컷 가능성: 20° 표준기어는 잇수 17 이상을 권장합니다.';
      warning.hidden = false;
    } else if ((state.gearType === 'spur') && holeRadius > maxRadius) {
      warning.textContent = `중심 구멍이 큽니다. 현재 기어의 권장 최대 반지름은 약 ${fmt(maxRadius,1)} mm입니다.`;
      warning.hidden = false;
    } else warning.hidden = true;
  }

  function updateUI() {
    const p = params();
    const p2 = params(state.teeth2);
    const ratio = state.teeth2 / state.teeth;
    const isPulley=state.gearType==='pulley', isRing=state.gearType==='ring', isRack=state.gearType==='rack', isSpur=state.gearType==='spur';
    $('gearShapeControls').hidden=isPulley;
    $('beltControls').hidden=!isPulley;
    $('pairSection').hidden=!isSpur;
    $('manufacturingSection').hidden=false;
    $('typeDetail').hidden=!(isRing||isRack);
    $('ringRimRow').hidden=!isRing;
    $('ringPinionRow').hidden=!isRing;
    $('rackBaseRow').hidden=!isRack;
    $('rackPinionRow').hidden=!isRack;
    $('exportTargetControls').hidden=!((isSpur&&state.pair)||isRing||isRack);
    $('boreTypeLabel').textContent=(isRing||isRack)?'피니언 중심 구멍 형상':'중심 구멍 형상';
    $('exportDriverLabel').textContent=isRing?'내접기어':isRack?'랙':'원동기어';
    $('exportDrivenLabel').textContent=(isRing||isRack)?'피니언':'종동기어';
    $('exportBothLabel').textContent=(isRing||isRack)?'세트':'두 기어';
    $('thicknessLabel').textContent=isPulley?'풀리 몸통 폭':'두께';
    $('legendPrimary').textContent=isRing?'내접기어':isRack?'랙':isPulley?'구동 풀리':'구동 기어';
    $('legendSecondary').textContent=(isRing||isRack)?'피니언':isPulley?'종동 풀리':'종동 기어';
    $('teethLabel').innerHTML=isRack?'랙 잇수 <em>z</em>':'잇수 <em>z₁</em>';
    document.querySelectorAll('[data-gear-type]').forEach(b=>b.classList.toggle('active',b.dataset.gearType===state.gearType));
    document.querySelectorAll('[data-belt-mode]').forEach(b=>b.classList.toggle('active',b.dataset.beltMode===state.beltMode));
    document.querySelectorAll('[data-export-target]').forEach(b=>b.classList.toggle('active',b.dataset.exportTarget===state.exportTarget));
    document.querySelectorAll('[data-flange-mode]').forEach(b=>b.classList.toggle('active',b.dataset.flangeMode===state.flangeMode));
    $('centerModeControls').hidden=state.beltMode!=='center';
    $('lengthModeControls').hidden=state.beltMode!=='length';
    $('boreOutputNotice').textContent=`설계값 Ø${fmt(state.bore)} mm → 가공 출력 Ø${fmt(effectiveBoreDiameter())} mm`;

    if (isPulley) {
      const b=beltCalc();
      const limit=pulleyMinimumSpec(b.pitch);
      const pairLimit=pulleyPairMinimumSpec(b.z1,b.z2,b.pitch);
      const flange=pulleyFlangeSpec(b.z1,b.pitch);
      const selectedReference=frcPresets[state.frcPreset];
      const referenceApplied=Boolean(matchingFrcPreset(b.z1,b.pitch)||matchingFrcPreset(b.z2,b.pitch));
      const centerText=Number.isFinite(b.center)?fmt(b.center):'—';
      $('metricLabel1').textContent='풀리 1 피치지름'; $('pitchDiameter').textContent=fmt(b.d1); $('metricUnit1').textContent=`mm · ${b.z1}T`;
      $('metricLabel2').textContent='풀리 2 피치지름'; $('outsideDiameter').textContent=fmt(b.d2); $('metricUnit2').textContent=`mm · ${b.z2}T`;
      $('metricLabel3').textContent='권장 벨트'; $('baseDiameter').textContent=`${b.beltTeeth}T`; $('metricUnit3').textContent=`${fmt(b.length)} mm`;
      $('metricLabel4').textContent='실제 축간거리'; $('centerDistance').textContent=centerText; $('metricUnit4').textContent='mm · C';
      $('checkTitle').textContent='벨트 조합 계산 완료'; $('meshMessage').textContent=`${state.beltProfile} · ${flangeModeNames[flange.mode]}`;
      $('contactLabel').textContent='작은 풀리 맞물림'; $('contactRatio').textContent=`${fmt(b.teethInMesh,1)} T`;
      $('contactBar').style.width=`${clamp(b.teethInMesh/10*100,8,100)}%`; $('checkGuide').textContent='6개 이상 권장'; $('checkStatus').textContent=b.teethInMesh>=6?'양호':'검토 필요';
      $('specLabel1').textContent='벨트 피치'; $('circularPitch').textContent=`${fmt(b.pitch,1)} mm`;
      $('specLabel2').textContent='감속비'; $('addendum').textContent=`${fmt(b.ratio,3)} : 1`;
      $('specLabel3').textContent=state.beltMode==='center'?'요청 축간거리':'입력 벨트 길이'; $('dedendum').textContent=`${fmt(state.beltMode==='center'?state.beltCenter:state.beltLength)} mm`;
      $('specLabel4').textContent='플랜지 포함 폭'; $('wholeDepth').textContent=`${fmt(flange.totalWidth)} mm`;
      $('beltRecommendation').textContent=`${b.beltTeeth}T · ${fmt(b.length)} mm`;
      $('beltCenterResult').textContent=`풀리 ${b.z1}T / ${b.z2}T · ${flangeModeNames[flange.mode]} · 축간거리 ${centerText} mm`;
      $('pulleyMinNotice').textContent=`현재 조건 최소 ${limit.minTeeth}T · 피치지름 ${fmt(limit.minPitchDiameter)} mm · 축간거리 ${fmt(pairLimit.minCenter)} mm · 벨트 ${fmt(pairLimit.minBeltLength)} mm`;
      $('frcReferenceNotice').textContent=referenceApplied
        ? `${selectedReference.label} 도면 기준 적용 · ${selectedReference.flangeDiameter?`플랜지 Ø${fmt(selectedReference.flangeDiameter)} mm · `:'무플랜지 · '}전체 폭 ${fmt(selectedReference.totalWidth)} mm`
        : selectedReference?`${selectedReference.label} 프리셋 값에서 편집됨 · 현재 치수로 범용 산출`:'직접 설계 모드 · 규격과 치수를 자유롭게 설정합니다.';
      $('frcSourceLink').hidden=!selectedReference;
      if(selectedReference){
        $('frcSourceLink').href=selectedReference.sourceUrl;
        $('frcSourceLink').textContent=`${selectedReference.sourceTitle} ↗`;
      }
    } else if (isRing) {
      const pinion=params(state.ringPinionTeeth), innerRoot=p.rp+1.25*state.module, outer=innerRoot+state.ringRim;
      const center=p.rp-pinion.rp, difference=state.teeth-state.ringPinionTeeth;
      const safe=state.ringPinionTeeth>=17&&difference>=16;
      $('metricLabel1').textContent='내접 피치지름'; $('pitchDiameter').textContent=fmt(p.rp*2); $('metricUnit1').textContent=`mm · ${state.teeth}T`;
      $('metricLabel2').textContent='피니언 피치지름'; $('outsideDiameter').textContent=fmt(pinion.rp*2); $('metricUnit2').textContent=`mm · ${state.ringPinionTeeth}T`;
      $('metricLabel3').textContent='중심 거리'; $('baseDiameter').textContent=center>0?fmt(center):'—'; $('metricUnit3').textContent='mm · a';
      $('metricLabel4').textContent='내접 감속비'; $('centerDistance').textContent=fmt(state.teeth/state.ringPinionTeeth,3); $('metricUnit4').textContent=': 1';
      $('checkTitle').textContent=safe?'내접 맞물림 예비검사 통과':'내접 맞물림 검토 필요'; $('meshMessage').textContent='동일 모듈 · 동일 압력각 · 같은 회전 방향';
      $('contactLabel').textContent='내접−피니언 잇수 차이'; $('contactRatio').textContent=`${difference} T`; $('contactBar').style.width=`${clamp(difference/24*100,8,100)}%`; $('checkGuide').textContent='16T 이상 보수 권장'; $('checkStatus').textContent=safe?'양호':'검토';
      $('specLabel1').textContent='내접 바깥지름'; $('circularPitch').textContent=`${fmt(outer*2)} mm`;
      $('specLabel2').textContent='림 두께'; $('addendum').textContent=`${fmt(state.ringRim)} mm`;
      $('specLabel3').textContent='피니언 잇수'; $('dedendum').textContent=`${state.ringPinionTeeth} T`;
      $('specLabel4').textContent='회전 방향'; $('wholeDepth').textContent='같은 방향';
    } else if (isRack) {
      const pinion=params(state.rackPinionTeeth), pitch=Math.PI*state.module, length=state.teeth*pitch;
      const pitchLineHeight=1.25*state.module+state.rackBase, mounting=pitchLineHeight+pinion.rp;
      const safe=state.rackPinionTeeth>=17||state.pressure!==20;
      $('metricLabel1').textContent='랙 피치'; $('pitchDiameter').textContent=fmt(pitch); $('metricUnit1').textContent='mm';
      $('metricLabel2').textContent='피니언 피치지름'; $('outsideDiameter').textContent=fmt(pinion.rp*2); $('metricUnit2').textContent=`mm · ${state.rackPinionTeeth}T`;
      $('metricLabel3').textContent='조립 거리'; $('baseDiameter').textContent=fmt(mounting); $('metricUnit3').textContent='mm · 바닥→축';
      $('metricLabel4').textContent='1회전 이동량'; $('centerDistance').textContent=fmt(pitch*state.rackPinionTeeth); $('metricUnit4').textContent='mm';
      $('checkTitle').textContent=safe?'랙·피니언 예비검사 통과':'피니언 언더컷 검토 필요'; $('meshMessage').textContent=`${state.pressure}° 압력각 · 동일 모듈 ${state.module}`;
      $('contactLabel').textContent='피니언 잇수'; $('contactRatio').textContent=`${state.rackPinionTeeth} T`; $('contactBar').style.width=`${clamp(state.rackPinionTeeth/24*100,8,100)}%`; $('checkGuide').textContent='20° 표준은 17T 이상'; $('checkStatus').textContent=safe?'양호':'검토';
      $('specLabel1').textContent='랙 전체 길이'; $('circularPitch').textContent=`${fmt(length)} mm`;
      $('specLabel2').textContent='랙 피치선 높이'; $('addendum').textContent=`${fmt(pitchLineHeight)} mm`;
      $('specLabel3').textContent='피니언 잇수'; $('dedendum').textContent=`${state.rackPinionTeeth} T`;
      $('specLabel4').textContent='랙 잇수'; $('wholeDepth').textContent=`${state.teeth} T`;
    } else {
      $('metricLabel1').textContent='피치원 지름'; $('pitchDiameter').textContent=fmt(p.rp*2); $('metricUnit1').textContent='mm · d';
      $('metricLabel2').textContent='바깥 지름'; $('outsideDiameter').textContent=fmt(p.ra*2); $('metricUnit2').textContent='mm · dₐ';
      $('metricLabel3').textContent='기초원 지름'; $('baseDiameter').textContent=fmt(p.rb*2); $('metricUnit3').textContent='mm · dᵦ';
      $('metricLabel4').textContent='중심 거리'; $('centerDistance').textContent=state.pair?fmt(p.rp+p2.rp):'—'; $('metricUnit4').textContent='mm · a';
      $('ratioBig').textContent=`${fmt(ratio,3)} : 1`;
      $('circularPitch').textContent=`${fmt(Math.PI*state.module,3)} mm`; $('addendum').textContent=`${fmt(state.module,3)} mm`; $('dedendum').textContent=`${fmt(1.25*state.module,3)} mm`; $('wholeDepth').textContent=`${fmt(2.25*state.module,3)} mm`;
      $('specLabel1').textContent='원주 피치'; $('specLabel2').textContent='이끝높이'; $('specLabel3').textContent='이뿌리높이'; $('specLabel4').textContent='총 높이';
      const cr=contactRatio(); $('checkTitle').textContent='맞물림 검사 통과'; $('meshMessage').textContent=state.pair?'동일 모듈 · 동일 압력각':'단일 기어 형상 검사';
      $('contactLabel').textContent='접촉률 추정'; $('contactRatio').textContent=fmt(cr,2); $('contactBar').style.width=`${clamp((cr-.8)/1.4*100,10,100)}%`; $('checkGuide').textContent='1.2 이상 권장'; $('checkStatus').textContent='양호';
    }
    $('pairControls').setAttribute('aria-disabled', String(!state.pair));
    document.querySelector('.pair-section').classList.toggle('disabled', !state.pair);
    $('boreLabel').textContent = state.boreType === 'hex' ? '외접원 지름' : '구멍 지름';
    $('keywayControls').hidden = state.boreType !== 'keyway';
    document.querySelectorAll('[data-bore-type]').forEach(b => b.classList.toggle('active', b.dataset.boreType === state.boreType));
    $('viewModeLabel').textContent = state.view === '2d' ? 'TOP / 2D' : 'ISOMETRIC / 3D';
    if(!isPulley) $('frcSourceLink').hidden=true;
    const pulleyMode=flangeModeNames[state.flangeMode];
    const typeNames={spur:'인벌류트 스퍼기어 · 20 points/flank',ring:`내접기어 + ${state.ringPinionTeeth}T 피니언 · BETA`,rack:`랙 + ${state.rackPinionTeeth}T 피니언`,pulley:`${state.beltProfile} 타이밍 풀리 · ${pulleyMode} · BETA`};
    const partCount=(isSpur&&state.pair)||isRing||isRack||isPulley?2:1;
    $('geometryStatus').textContent = state.view === '2d' ? typeNames[state.gearType] : isPulley?`${partCount}개 ${pulleyMode} 풀리 · 몸통 ${fmt(state.thickness,1)} mm`:`${partCount}개 솔리드 · ${fmt(state.thickness,1)} mm extrusion`;
    $('orbitHint').hidden = state.view !== '3d';
    $('viewport').classList.toggle('is-3d', state.view === '3d');
    validate();
  }

  function readInputs(preserveId = null) {
    state.teeth = clamp(parseInt($('teeth').value) || 8, 8, 120);
    state.module = clamp(parseFloat($('module').value) || .2, .2, 10);
    state.pressure = parseFloat($('pressure').value);
    state.bore = clamp(parseFloat($('bore').value) || 0, 0, 60);
    state.boreAllowance = clamp(parseFloat($('boreAllowance').value) || 0, -1, 2);
    state.keyWidth = clamp(parseFloat($('keyWidth').value) || .5, .5, 20);
    state.keyDepth = clamp(parseFloat($('keyDepth').value) || .2, .2, 10);
    state.ringRim = clamp(parseFloat($('ringRim').value) || 1, 1, 40);
    state.ringPinionTeeth = clamp(parseInt($('ringPinionTeeth').value) || 8, 8, 160);
    state.rackBase = clamp(parseFloat($('rackBase').value) || 1, 1, 30);
    state.rackPinionTeeth = clamp(parseInt($('rackPinionTeeth').value) || 8, 8, 160);
    state.thickness = clamp(parseFloat($('thickness').value) || .5, .5, 50);
    state.backlash = clamp(parseFloat($('backlash').value) || 0, 0, 1);
    state.teeth2 = clamp(parseInt($('teeth2').value) || 8, 8, 160);
    state.pair = $('pairEnabled').checked;
    const beltOption = $('beltProfile').selectedOptions[0];
    state.beltPitch = parseFloat(beltOption.dataset.pitch);
    state.beltProfile = beltOption.value;
    const pulleyLimit=pulleyMinimumSpec(state.beltPitch);
    const rawPulley1=parseInt($('pulley1').value)||pulleyLimit.minTeeth;
    const rawPulley2=parseInt($('pulley2').value)||pulleyLimit.minTeeth;
    state.pulley1 = clamp(rawPulley1,pulleyLimit.minTeeth,200);
    state.pulley2 = clamp(rawPulley2,pulleyLimit.minTeeth,300);
    state.targetD1 = clamp(parseFloat($('targetD1').value)||pulleyLimit.minPitchDiameter,pulleyLimit.minPitchDiameter,500);
    state.targetD2 = clamp(parseFloat($('targetD2').value)||pulleyLimit.minPitchDiameter,pulleyLimit.minPitchDiameter,500);
    const limitZ1=state.beltMode==='center'?state.pulley1:Math.max(pulleyLimit.minTeeth,Math.round(Math.PI*state.targetD1/state.beltPitch));
    const limitZ2=state.beltMode==='center'?state.pulley2:Math.max(pulleyLimit.minTeeth,Math.round(Math.PI*state.targetD2/state.beltPitch));
    const pairLimit=pulleyPairMinimumSpec(limitZ1,limitZ2,state.beltPitch);
    state.beltCenter = clamp(parseFloat($('beltCenter').value)||pairLimit.minCenter,pairLimit.minCenter,5000);
    state.beltLength = clamp(parseFloat($('beltLength').value)||pairLimit.minBeltLength,pairLimit.minBeltLength,20000);
    state.beltWidth = clamp(parseFloat($('beltWidth').value)||3,3,100);
    $('pulley1').min=$('pulley2').min=String(pulleyLimit.minTeeth);
    if(preserveId!=='pulley1') $('pulley1').value=state.pulley1;
    if(preserveId!=='pulley2') $('pulley2').value=state.pulley2;
    $('targetD1').min=$('targetD2').min=fmt(pulleyLimit.minPitchDiameter,2);
    if(preserveId!=='targetD1') $('targetD1').value=fmt(state.targetD1,2);
    if(preserveId!=='targetD2') $('targetD2').value=fmt(state.targetD2,2);
    $('beltCenter').min=fmt(pairLimit.minCenter,2);
    if(preserveId!=='beltCenter') $('beltCenter').value=fmt(state.beltCenter,2);
    $('beltLength').min=fmt(pairLimit.minBeltLength,2);
    if(preserveId!=='beltLength') $('beltLength').value=fmt(state.beltLength,2);
    const rpmValue = parseFloat($('rpm').value);
    state.rpm = clamp(Number.isFinite(rpmValue) ? rpmValue : 0, 0, 240);
    if (state.gearType !== 'pulley') state.typeTeeth[state.gearType] = state.teeth;
    updateUI();
  }

  function bindMirror(a, b) {
    $(a).addEventListener('input', () => { $(b).value = $(a).value; readInputs(a); });
    $(a).addEventListener('change', () => { readInputs(); normalizeNumberInput(a); });
    $(a).addEventListener('keydown', commitNumberOnEnter);
    $(b).addEventListener('input', () => { $(a).value = $(b).value; readInputs(); });
  }

  const numberStateReaders = {
    teeth:()=>state.teeth, module:()=>state.module, backlash:()=>state.backlash, teeth2:()=>state.teeth2, rpm:()=>state.rpm,
    bore:()=>state.bore, boreAllowance:()=>state.boreAllowance, keyWidth:()=>state.keyWidth, keyDepth:()=>state.keyDepth,
    ringRim:()=>state.ringRim, ringPinionTeeth:()=>state.ringPinionTeeth, rackBase:()=>state.rackBase,
    rackPinionTeeth:()=>state.rackPinionTeeth, thickness:()=>state.thickness, pulley1:()=>state.pulley1,
    pulley2:()=>state.pulley2, beltCenter:()=>state.beltCenter, beltLength:()=>state.beltLength,
    targetD1:()=>state.targetD1, targetD2:()=>state.targetD2, beltWidth:()=>state.beltWidth
  };
  const mirrorFor={teeth:'teethRange',module:'moduleRange',backlash:'backlashRange',teeth2:'teeth2Range',rpm:'rpmRange'};
  function normalizeNumberInput(id) {
    const value=numberStateReaders[id]?.();
    if(!Number.isFinite(value)) return;
    const clean=String(Number(value.toFixed(3)));
    $(id).value=clean;
    if(mirrorFor[id]) $(mirrorFor[id]).value=clean;
  }
  function commitNumberOnEnter(event) {
    if(event.key==='Enter'){
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  bindMirror('teeth', 'teethRange');
  bindMirror('module', 'moduleRange');
  bindMirror('backlash', 'backlashRange');
  bindMirror('teeth2', 'teeth2Range');
  bindMirror('rpm', 'rpmRange');
  ['pressure','pairEnabled','beltProfile'].forEach(id => $(id).addEventListener('input', () => readInputs()));
  ['bore','boreAllowance','keyWidth','keyDepth','ringRim','ringPinionTeeth','rackBase','rackPinionTeeth','thickness','pulley1','pulley2','beltCenter','beltLength','targetD1','targetD2','beltWidth'].forEach(id => {
    $(id).addEventListener('input', () => readInputs(id));
    $(id).addEventListener('change', () => { readInputs(); normalizeNumberInput(id); });
    $(id).addEventListener('keydown', commitNumberOnEnter);
  });
  $('frcPreset').addEventListener('change',()=>{
    applyFrcPreset($('frcPreset').value);
    const preset=frcPresets[state.frcPreset];
    showToast(preset?`${preset.label} 도면 프리셋을 적용했습니다.`:'범용 직접 설계로 전환했습니다.');
  });

  document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b === btn));
    updateUI();
  }));
  document.querySelectorAll('[data-gear-type]').forEach(btn => btn.addEventListener('click', () => {
    if (state.gearType !== 'pulley') state.typeTeeth[state.gearType]=state.teeth;
    state.gearType=btn.dataset.gearType;
    if (state.gearType !== 'pulley') {
      state.teeth=state.typeTeeth[state.gearType];
      $('teeth').value=$('teethRange').value=state.teeth;
    }
    if (state.gearType==='ring'||state.gearType==='rack') state.exportTarget='both';
    state.zoom=1;
    updateUI();
    const names={spur:'스퍼기어',ring:'내접기어',rack:'랙기어',pulley:'벨트·풀리'};
    showToast(`${names[state.gearType]} 설계 모드로 전환했습니다.`);
  }));
  document.querySelectorAll('[data-belt-mode]').forEach(btn=>btn.addEventListener('click',()=>{state.beltMode=btn.dataset.beltMode; updateUI();}));
  document.querySelectorAll('[data-flange-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    state.flangeMode=btn.dataset.flangeMode;
    updateUI();
    showToast(`${flangeModeNames[state.flangeMode]} 구조로 변경했습니다.`);
  }));
  document.querySelectorAll('[data-export-target]').forEach(btn=>btn.addEventListener('click',()=>{
    state.exportTarget=btn.dataset.exportTarget;
    updateUI();
    showToast(`${btn.textContent.trim()} 내보내기로 설정했습니다.`);
  }));
  document.querySelectorAll('[data-bore-type]').forEach(btn => btn.addEventListener('click', () => {
    state.boreType = btn.dataset.boreType;
    updateUI();
    const names = { circle: '원형', hex: '외접 6각', keyway: '키자리' };
    showToast(`중심 구멍을 ${names[state.boreType]} 형상으로 변경했습니다.`);
  }));
  $('playBtn').addEventListener('click', () => {
    state.playing = !state.playing;
    $('playBtn').classList.toggle('active', state.playing);
    $('playBtn').innerHTML = state.playing ? '<span>▶</span> 회전' : '<span>Ⅱ</span> 정지';
  });
  $('fitBtn').addEventListener('click', () => {
    state.zoom = 1;
    if (state.view === '3d') { state.viewYaw = -.55; state.viewPitch = .83; }
    showToast('설계를 화면에 맞췄습니다.');
  });
  $('resetBtn').addEventListener('click', reset);
  $('quickExport').addEventListener('click', () => $('exportSection').scrollIntoView({ behavior: 'smooth', block: 'center' }));

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.zoom = clamp(state.zoom * (e.deltaY > 0 ? .9 : 1.1), .45, 2.5);
  }, { passive: false });

  const drag = { active: false, x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    if (state.view !== '3d') return;
    drag.active = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag.active || state.view !== '3d') return;
    state.viewYaw += (e.clientX - drag.x) * .012;
    state.viewPitch = clamp(state.viewPitch + (e.clientY - drag.y) * .01, .12, 1.46);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const endDrag = (e) => {
    drag.active = false;
    canvas.classList.remove('dragging');
    if (e.pointerId !== undefined && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function reset() {
    const defaults = { gearType:'spur', teeth:24, module:2, pressure:20, bore:8, boreAllowance:.2, boreType:'circle', keyWidth:3, keyDepth:1.8, ringRim:6, ringPinionTeeth:18, rackBase:6, rackPinionTeeth:20, typeTeeth:{spur:24,ring:60,rack:24}, thickness:8, backlash:.12, teeth2:48, pair:true, beltMode:'center', frcPreset:'custom', flangeMode:'double', beltProfile:'GT2', beltPitch:2, pulley1:20, pulley2:40, beltCenter:80, beltLength:300, targetD1:13, targetD2:26, beltWidth:6, rpm:24, exportTarget:'driver' };
    Object.assign(state, defaults, { angle: 0, viewYaw: -.55, viewPitch: .83, zoom: 1 });
    $('teeth').value = $('teethRange').value = 24;
    $('module').value = $('moduleRange').value = 2;
    $('pressure').value = 20;
    $('bore').value = 8;
    $('boreAllowance').value = .2;
    $('keyWidth').value = 3;
    $('keyDepth').value = 1.8;
    $('ringRim').value = 6;
    $('ringPinionTeeth').value = 18;
    $('rackBase').value = 6;
    $('rackPinionTeeth').value = 20;
    $('thickness').value = 8;
    $('backlash').value = $('backlashRange').value = .12;
    $('teeth2').value = $('teeth2Range').value = 48;
    $('pairEnabled').checked = true;
    $('frcPreset').value = 'custom';
    $('beltProfile').value = 'GT2';
    $('pulley1').value = 20;
    $('pulley2').value = 40;
    $('beltCenter').value = 80;
    $('beltLength').value = 300;
    $('targetD1').value = 13;
    $('targetD2').value = 26;
    $('beltWidth').value = 6;
    $('rpm').value = $('rpmRange').value = 24;
    document.querySelectorAll('[data-export-target]').forEach(b=>b.classList.toggle('active',b.dataset.exportTarget==='driver'));
    document.querySelectorAll('[data-flange-mode]').forEach(b=>b.classList.toggle('active',b.dataset.flangeMode==='double'));
    updateUI();
    showToast('기본 설계값으로 초기화했습니다.');
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function svgPath(points) {
    return points.map((p,i) => `${i ? 'L' : 'M'} ${p.x.toFixed(5)} ${(-p.y).toFixed(5)}`).join(' ') + ' Z';
  }

  function shapeBounds(points) {
    const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
    return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
  }

  function movePoints(points, x = 0, y = 0) {
    return points.map(p => ({...p, x:p.x+x, y:p.y+y}));
  }

  function exportItems() {
    if (state.gearType === 'pulley') {
      const b=beltCalc(),spec=pulleyFlangeSpec(b.z1,b.pitch);
      return [{
        name:'pulley',teeth:b.z1,x:0,y:0,
        geometry:pulleyGeometry(b.z1,b.pitch,0),
        mesh:pulleyMesh(b.z1,b.pitch,0),
        guides:spec.flangeCount?[circlePolygon(spec.flangeRadius,Math.max(180,b.z1*10))]:[]
      }];
    }
    if (state.gearType === 'ring') {
      const ring={name:'ring',teeth:state.teeth,x:0,y:0,geometry:ringGeometry(0)};
      const pinionGeometry=spurGeometry(state.ringPinionTeeth,Math.PI/state.ringPinionTeeth);
      if(state.exportTarget==='driver') return [ring];
      if(state.exportTarget==='driven') return [{name:'pinion',teeth:state.ringPinionTeeth,x:0,y:0,geometry:pinionGeometry}];
      const center=Math.max(0,params().rp-params(state.ringPinionTeeth).rp);
      return [ring,{name:'pinion',teeth:state.ringPinionTeeth,x:center,y:0,geometry:pinionGeometry}];
    }
    if (state.gearType === 'rack') {
      const rack={name:'rack',teeth:state.teeth,x:0,y:0,geometry:rackGeometry(0)};
      const pinionGeometry=spurGeometry(state.rackPinionTeeth,0), pinionRadius=params(state.rackPinionTeeth).rp;
      if(state.exportTarget==='driver') return [rack];
      if(state.exportTarget==='driven') return [{name:'pinion',teeth:state.rackPinionTeeth,x:0,y:0,geometry:pinionGeometry}];
      return [rack,{name:'pinion',teeth:state.rackPinionTeeth,x:0,y:pinionRadius,geometry:pinionGeometry}];
    }
    if (state.gearType !== 'spur' || !state.pair) {
      return [{name:state.gearType, teeth:state.teeth, x:0, y:0, geometry:currentGeometry()}];
    }
    if (state.exportTarget === 'driven') {
      return [{name:'driven', teeth:state.teeth2, x:0, y:0, geometry:spurGeometry(state.teeth2, 0)}];
    }
    const driver = {name:'driver', teeth:state.teeth, x:0, y:0, geometry:spurGeometry(state.teeth, 0)};
    if (state.exportTarget === 'driver') return [driver];
    const center = params().rp + params(state.teeth2).rp;
    const drivenRotation = Math.PI + Math.PI / state.teeth2;
    const driven = {name:'driven', teeth:state.teeth2, x:center, y:0, geometry:spurGeometry(state.teeth2, drivenRotation)};
    return [driver, driven];
  }

  function exportMesh() {
    const vertices=[], triangles=[];
    for (const item of exportItems()) {
      const mesh=item.mesh||buildMesh(item.geometry), offset=vertices.length;
      vertices.push(...mesh.vertices.map(v=>[v[0]+item.x,v[1]+item.y,v[2]]));
      triangles.push(...mesh.triangles.map(t=>t.map(i=>i+offset)));
    }
    return {vertices,triangles};
  }

  function exportSVG() {
    const items=exportItems();
    const placed=items.map(item=>({
      ...item,
      outer:movePoints(item.geometry.outer,item.x,item.y),
      hole:movePoints(item.geometry.hole,item.x,item.y),
      guides:(item.guides||[]).map(points=>movePoints(points,item.x,item.y))
    }));
    const allPoints=placed.flatMap(item=>[item.outer,...item.guides]).flat();
    const box=shapeBounds(allPoints), pad=state.gearType==='pulley'?state.beltPitch:state.module*2;
    const width=box.maxX-box.minX+pad*2, height=box.maxY-box.minY+pad*2;
    const paths=placed.map(item=>`  <g id="${item.name}">\n    <path d="${svgPath(item.outer)}" fill="none" stroke="#000" stroke-width="0.1"/>${item.hole.length?`\n    <path d="${svgPath(item.hole)}" fill="none" stroke="#000" stroke-width="0.1"/>`:''}${item.guides.map((points,index)=>`\n    <path id="flange-${index+1}" d="${svgPath(points)}" fill="none" stroke="#555" stroke-width="0.1"/>`).join('')}\n  </g>`).join('\n');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="${box.minX-pad} ${-box.maxY-pad} ${width} ${height}">\n  <title>GearForge ${state.gearType}</title>\n${paths}\n</svg>`;
    download(new Blob([svg], {type:'image/svg+xml'}), fileName('svg'));
  }

  function dxfPolyline(points, layer) {
    let out = `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n1\n`;
    for (const p of points) out += `0\nVERTEX\n8\n${layer}\n10\n${p.x.toFixed(6)}\n20\n${p.y.toFixed(6)}\n30\n0.0\n`;
    return out + '0\nSEQEND\n';
  }

  function exportDXF() {
    const entities=exportItems().map(item=>{
      const outer=movePoints(item.geometry.outer,item.x,item.y), hole=movePoints(item.geometry.hole,item.x,item.y), layer=item.name.toUpperCase();
      const guides=(item.guides||[]).map((points,index)=>dxfPolyline(movePoints(points,item.x,item.y),`${layer}_FLANGE_${index+1}`)).join('');
      return `${dxfPolyline(outer,`${layer}_PROFILE`)}${hole.length?dxfPolyline(hole,`${layer}_INNER`):''}${guides}`;
    }).join('');
    const dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
    download(new Blob([dxf], {type:'application/dxf'}), fileName('dxf'));
  }

  function normal(a,b,c) {
    const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const l=Math.hypot(...n)||1;
    return n.map(x=>x/l);
  }

  function exportSTL() {
    const mesh = exportMesh();
    const lines = [`solid gearforge_z${state.teeth}`];
    for (const tri of mesh.triangles) {
      const a=mesh.vertices[tri[0]], b=mesh.vertices[tri[1]], c=mesh.vertices[tri[2]], n=normal(a,b,c);
      lines.push(`facet normal ${n.join(' ')}`,' outer loop',`  vertex ${a.join(' ')}`,`  vertex ${b.join(' ')}`,`  vertex ${c.join(' ')}`,' endloop','endfacet');
    }
    lines.push(`endsolid gearforge_z${state.teeth}`);
    download(new Blob([lines.join('\n')], {type:'model/stl'}), fileName('stl'));
  }

  function crc32(bytes) {
    let c = -1;
    for (const byte of bytes) {
      c ^= byte;
      for (let k=0;k<8;k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return (c ^ -1) >>> 0;
  }

  function zipStore(files) {
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;
    const u16 = (v) => [v&255,(v>>>8)&255];
    const u32 = (v) => [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
    for (const [name, text] of files) {
      const n = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const local = new Uint8Array([80,75,3,4,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(n.length),0,0,...n]);
      chunks.push(local, data);
      const cd = new Uint8Array([80,75,1,2,20,0,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(n.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(offset),...n]);
      central.push(cd);
      offset += local.length + data.length;
    }
    const centralSize = central.reduce((s,c)=>s+c.length,0);
    const end = new Uint8Array([80,75,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),0,0]);
    return new Blob([...chunks,...central,end], {type:'model/3mf'});
  }

  function export3MF() {
    const mesh = exportMesh();
    const minZ=Math.min(...mesh.vertices.map(v=>v[2]));
    const verts = mesh.vertices.map(v => `<vertex x="${v[0].toFixed(6)}" y="${v[1].toFixed(6)}" z="${(v[2]-minZ).toFixed(6)}"/>`).join('');
    const tris = mesh.triangles.map(t => `<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join('');
    const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="ko-KR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">GearForge z${state.teeth} m${state.module}</metadata><resources><object id="1" type="model"><mesh><vertices>${verts}</vertices><triangles>${tris}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
    download(zipStore([['[Content_Types].xml',contentTypes],['_rels/.rels',rels],['3D/3dmodel.model',model]]), fileName('3mf'));
  }

  function fileName(ext) {
    if(state.gearType==='pulley'){const b=beltCalc(),ref=matchingFrcPreset(b.z1,b.pitch);return `${ref?state.frcPreset+'_reference':'pulley'}_${state.beltProfile.replace(/[^a-z0-9.-]+/gi,'_')}_${b.z1}T_p${String(b.pitch).replace('.','p')}.${ext}`;}
    if(state.gearType==='ring'){
      const target=state.exportTarget==='driver'?`body_z${state.teeth}`:state.exportTarget==='driven'?`pinion_z${state.ringPinionTeeth}`:`set_z${state.teeth}_p${state.ringPinionTeeth}`;
      return `ring_${target}_m${String(state.module).replace('.','p')}.${ext}`;
    }
    if(state.gearType==='rack'){
      const target=state.exportTarget==='driver'?`body_z${state.teeth}`:state.exportTarget==='driven'?`pinion_z${state.rackPinionTeeth}`:`set_z${state.teeth}_p${state.rackPinionTeeth}`;
      return `rack_${target}_m${String(state.module).replace('.','p')}.${ext}`;
    }
    if(state.gearType==='spur'&&state.pair){
      if(state.exportTarget==='driven') return `spur_driven_z${state.teeth2}_m${String(state.module).replace('.','p')}.${ext}`;
      if(state.exportTarget==='both') return `spur_pair_z${state.teeth}_z${state.teeth2}_m${String(state.module).replace('.','p')}.${ext}`;
      return `spur_driver_z${state.teeth}_m${String(state.module).replace('.','p')}.${ext}`;
    }
    return `${state.gearType}_z${state.teeth}_m${String(state.module).replace('.','p')}.${ext}`;
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast(`${name} 파일을 생성했습니다.`);
  }

  const exporters = { svg: exportSVG, dxf: exportDXF, stl: exportSTL, '3mf': export3MF };
  document.querySelectorAll('[data-export]').forEach(btn => btn.addEventListener('click', () => {
    state.selectedExport = btn.dataset.export;
    document.querySelectorAll('[data-export]').forEach(b => b.classList.toggle('selected', b === btn));
    $('exportSelected').innerHTML = `<span>↓</span> ${state.selectedExport.toUpperCase()} 빠른 저장`;
    exporters[state.selectedExport]();
  }));
  $('exportSelected').addEventListener('click', () => exporters[state.selectedExport]());

  $('copySpec').addEventListener('click', async () => {
    const p=params(), p2=params(state.teeth2);
    const boreNames={circle:'원형',hex:'외접 6각',keyway:'키자리'};
    const keySpec=state.boreType==='keyway'?`\n키 폭/깊이: ${fmt(state.keyWidth)} / ${fmt(state.keyDepth)} mm`:'';
    let text;
    if(state.gearType==='pulley') { const b=beltCalc(),f=pulleyFlangeSpec(b.z1,b.pitch),limit=pulleyMinimumSpec(b.pitch),ref=matchingFrcPreset(b.z1,b.pitch); text=`GearForge 벨트·풀리 사양\nFRC 도면 기준: ${ref?.label||'범용 직접 설계'}\n규격: ${state.beltProfile}\n피치: ${b.pitch} mm\n풀리: ${b.z1}T / ${b.z2}T\n현재 보어 기준 최소: ${limit.minTeeth}T\n피치지름: ${fmt(b.d1)} / ${fmt(b.d2)} mm\n플랜지: ${flangeModeNames[f.mode]}${f.flangeCount?` · 외경 ${fmt(f.flangeRadius*2)} mm`:''}\n벨트: ${b.beltTeeth}T · ${fmt(b.length)} mm\n실제 축간거리: ${fmt(b.center)} mm\n맞물림 잇수: ${fmt(b.teethInMesh,1)}T\n몸통 폭: ${fmt(state.thickness)} mm\n전체 폭: ${fmt(f.totalWidth)} mm\n보어 설계값/출력값: ${fmt(state.bore)} / ${fmt(effectiveBoreDiameter())} mm`; }
    else if(state.gearType==='ring') { const pp=params(state.ringPinionTeeth); text=`GearForge 내접기어 세트\n내접기어: ${state.teeth}T\n피니언: ${state.ringPinionTeeth}T\n모듈/압력각: ${state.module} mm / ${state.pressure}°\n중심거리: ${fmt(p.rp-pp.rp)} mm\n감속비: ${fmt(state.teeth/state.ringPinionTeeth,3)} : 1\n피니언 구멍: ${boreNames[state.boreType]} · ${fmt(state.bore)} mm${keySpec}\n두께: ${fmt(state.thickness)} mm`; }
    else if(state.gearType==='rack') { const pp=params(state.rackPinionTeeth), pitchLine=1.25*state.module+state.rackBase; text=`GearForge 랙·피니언 세트\n랙: ${state.teeth}T\n피니언: ${state.rackPinionTeeth}T\n모듈/압력각: ${state.module} mm / ${state.pressure}°\n조립거리(바닥→축): ${fmt(pitchLine+pp.rp)} mm\n1회전 이동량: ${fmt(Math.PI*state.module*state.rackPinionTeeth)} mm\n피니언 구멍: ${boreNames[state.boreType]} · ${fmt(state.bore)} mm${keySpec}\n두께: ${fmt(state.thickness)} mm`; }
    else text=`GearForge ${state.gearType} 설계 사양\n잇수: ${state.teeth}\n모듈: ${state.module} mm\n압력각: ${state.pressure}°\n피치원: ${fmt(p.rp*2)} mm\n중심구멍: ${boreNames[state.boreType]} · ${fmt(state.bore)} mm${keySpec}\n두께: ${fmt(state.thickness)} mm\n백래시: ${fmt(state.backlash)} mm${state.gearType==='spur'&&state.pair?`\n상대기어: ${state.teeth2}T\n중심거리: ${fmt(p.rp+p2.rp)} mm`:''}`;
    try { await navigator.clipboard.writeText(text); showToast('설계 사양을 복사했습니다.'); }
    catch { showToast('브라우저에서 클립보드 권한을 허용해 주세요.'); }
  });

  const guide = $('guideDialog');
  document.querySelectorAll('[data-action="guide"]').forEach(button=>button.addEventListener('click', () => guide.showModal()));
  guide.querySelector('.dialog-close').addEventListener('click', () => guide.close());
  guide.addEventListener('click', e => { if (e.target === guide) guide.close(); });

  window.addEventListener('resize', resizeCanvas);
  document.querySelector('[data-export="svg"]').classList.add('selected');
  updateUI();
  requestAnimationFrame(render);
})();
