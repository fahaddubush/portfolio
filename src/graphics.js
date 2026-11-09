/* 3. Graphics — Same refraction, precision, lighting and 40-step raymarch. */
const FS=`precision highp float;uniform vec2 r;uniform vec4 balls[4];uniform float t,s,f,g;uniform sampler2D tx;
// Liquid blend — Join spheres with the original smooth union.
float smn(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
// Distance field — Sample the four precomputed spheres.
float map(vec3 p){float d=length(p-balls[0].xyz)-balls[0].w;
 for(int i=1;i<4;i++){d=smn(d,length(p-balls[i].xyz)-balls[i].w,.45);}return d;}
// Background — Preserve the original moving pastel palette.
vec3 bgc(vec2 q){vec2 w=q*2.-1.;float a=t*.15+s*.0006;
 vec3 A=vec3(.80,.72,1.),B=vec3(1.,.83,.76),C=vec3(.74,.95,.86),D=vec3(.75,.88,1.);
 float x=sin(w.x*1.6+a*3.+sin(w.y*2.+a*2.))*.5+.5,y=sin(w.y*1.4-a*2.5+cos(w.x*2.3-a))*.5+.5;
 return mix(mix(mix(A,B,x),mix(C,D,x),y),vec3(.985,.972,1.),.38);}
// Scene sample — Combine the background with the heading texture.
vec3 scene(vec2 q){vec4 k=texture2D(tx,vec2(q.x,q.y-s/r.y+(1.-g)*(1.-g)*.2));return mix(bgc(q),k.rgb,k.a*g);}
// Bounds — Reject impossible rays without changing any candidate march steps.
bool possibleHit(vec3 origin,vec3 direction){
 vec3 low=balls[0].xyz-vec3(balls[0].w),high=balls[0].xyz+vec3(balls[0].w);
 for(int i=1;i<4;i++){low=min(low,balls[i].xyz-vec3(balls[i].w));high=max(high,balls[i].xyz+vec3(balls[i].w));}
 low-=vec3(.35);high+=vec3(.35);float first=0.,last=6.;
 for(int axis=0;axis<3;axis++){
  if(abs(direction[axis])<.000001){if(origin[axis]<low[axis]||origin[axis]>high[axis])return false;}
  else{float a=(low[axis]-origin[axis])/direction[axis],b=(high[axis]-origin[axis])/direction[axis];first=max(first,min(a,b));last=min(last,max(a,b));}
 }return last>=first;
}
// Final pixel — Original raymarch, refraction, iridescence and grain.
void main(){vec2 q=gl_FragCoord.xy/r,p=(gl_FragCoord.xy*2.-r)/r.y;
 vec3 ro=vec3(0,0,3.),rd=normalize(vec3(p,-1.6));float d,tt=0.;bool hit=false;
 if(f>.01&&possibleHit(ro,rd))for(int i=0;i<40;i++){d=map(ro+rd*tt);if(d<.002){hit=true;break;}tt+=d;if(tt>6.)break;}
 vec3 col;
 if(hit){vec3 P=ro+rd*tt;vec2 e=vec2(.004,0);
  vec3 n=normalize(vec3(map(P+e.xyy)-map(P-e.xyy),map(P+e.yxy)-map(P-e.yxy),map(P+e.yyx)-map(P-e.yyx)));
  float ar=min(1.,r.x/r.y);vec2 o=(refract(rd,n,.72).xy-rd.xy)*vec2(r.y/r.x,1.)*(.3*ar);
  col=vec3(scene(q+o).r,scene(q+o*1.08).g,scene(q+o*1.16).b);
  float fr=pow(1.+dot(rd,n),3.);
  vec3 ir=.5+.5*cos(6.283*(dot(n,vec3(.3,.5,.7))*.8+vec3(0.,.33,.67)+t*.05));
  col=mix(col,col*ir*1.15,.28)+fr*.55+pow(max(dot(reflect(rd,n),normalize(vec3(.5,.8,.6))),0.),40.)*.9;}else{col=scene(q);}

 col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;gl_FragColor=vec4(col,1.);}`;

// disableGraphics: Restore real text immediately when graphics are unavailable.
function disableGraphics(error) {
  ok = false;
  H.classList.remove('gl');
  if (error) console.warn('Portfolio graphics fallback:', error);
}

// initGraphics: Check every GPU resource before replacing the visible heading.
function initGraphics() {
  try {
    gl = cv.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return disableGraphics();
    const compile = function (type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || 'Shader compilation failed');
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}');
    const fragment = compile(gl.FRAGMENT_SHADER, FS);
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader linking failed');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'a');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    ['r', 't', 's', 'f', 'g', 'tx', 'balls[0]'].forEach(function (key) { U[key] = gl.getUniformLocation(program, key); });
    texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(function (pair) { gl.texParameteri(gl.TEXTURE_2D, pair[0], pair[1]); });
    gl.uniform1i(U.tx, 0);
    textureWidth = textureHeight = 0;
    ok = true;
    layoutDirty = textDirty = true;
    invalidateLayout();
  } catch (error) { disableGraphics(error); }
}

// drawTex: Rasterize settled heading geometry at full Retina DPR with exact tracking and pixel alignment.
function drawTex() {
  if (!ok || !textContext) { textDirty = false; return; }
  if (tc.width !== cv.width) tc.width = cv.width;
  if (tc.height !== cv.height) tc.height = cv.height;
  textContext.setTransform(1, 0, 0, 1, 0, 0);
  textContext.clearRect(0, 0, tc.width, tc.height);
  textContext.scale(dpr, dpr);
  textContext.fillStyle = '#2b2540';
  textContext.textBaseline = 'middle';
  if ('fontKerning' in textContext) textContext.fontKerning = 'normal';
  if ('textRendering' in textContext) textContext.textRendering = 'geometricPrecision';
  const scrollOffset = sm ? cur : scrollY;
  $$('.ln').forEach(function (line) {
    const rect = line.getBoundingClientRect();
    const style = getComputedStyle(line);
    const fontSizePx = parseFloat(style.fontSize) || 80;
    const lsPx = parseFloat(style.letterSpacing) || (-0.05 * fontSizePx);
    if ('letterSpacing' in textContext) textContext.letterSpacing = '0px';
    textContext.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    const widthZero = textContext.measureText(line.textContent).width;
    if ('letterSpacing' in textContext) textContext.letterSpacing = lsPx.toFixed(2) + 'px';
    const widthSpaced = textContext.measureText(line.textContent).width;
    const xSnap = Math.round(rect.left * dpr) / dpr;
    const ySnap = Math.round((rect.top + scrollOffset + rect.height * .52) * dpr) / dpr;
    if (Math.abs(widthSpaced - widthZero) > 0.5 || !lsPx) {
      textContext.fillText(line.textContent, xSnap, ySnap);
    } else {
      // Fallback for mobile browsers where Canvas 2D ignores negative letterSpacing
      let cursorX = xSnap;
      const chars = Array.from(line.textContent);
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        textContext.fillText(ch, cursorX, ySnap);
        const adv = i < chars.length - 1
          ? textContext.measureText(ch + chars[i + 1]).width - textContext.measureText(chars[i + 1]).width
          : textContext.measureText(ch).width;
        cursorX += adv + lsPx;
      }
    }
  });
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (textureWidth !== tc.width || textureHeight !== tc.height) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    textureWidth = tc.width;
    textureHeight = tc.height;
  } else {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, tc);
  }
  textDirty = false;
  textVersion++;
  H.classList.add('gl');
}

// renderGraphics: Calculate shared sphere motion once, instead of per shader sample.
function renderGraphics(time, amount, entrance) {
  const isMobileHero = !fine || viewportWidth <= 820;
  spheres[0] = mx * 1.875;
  spheres[1] = my * 1.875;
  spheres[2] = 0;
  spheres[3] = .55 * amount;
  for (let i = 0; i < 3; i++) {
    const angle = time * .5 + i * 2.094;
    const offset = (i + 1) * 4;
    spheres[offset] = Math.cos(angle * 1.3) * .95;
    spheres[offset + 1] = Math.sin(angle * 1.7) * .55;
    spheres[offset + 2] = Math.sin(angle) * .4;
    spheres[offset + 3] = (.38 + .08 * Math.sin(time + i)) * amount;
  }
  gl.uniform4fv(U['balls[0]'], spheres);
  gl.uniform1f(U.t, time);
  gl.uniform1f(U.s, Math.round(cur * dpr));
  gl.uniform1f(U.f, amount);
  gl.uniform1f(U.g, isMobileHero ? 0 : entrance);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

cv.addEventListener('webglcontextlost', function (event) {
  event.preventDefault();
  disableGraphics();
  wake();
});
cv.addEventListener('webglcontextrestored', function () { initGraphics(); wake(); });

