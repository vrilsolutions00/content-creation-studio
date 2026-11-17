// Content Creation Studio – WebGL2 beauty renderer (skin, lips & eyes, background, color)
const VS = `#version 300 es
in vec2 a; out vec2 vUV;
void main(){ vUV=a; gl_Position=vec4(a*2.0-1.0,0.0,1.0); }`;

// draws source (cropped to output aspect) into an FBO. imgUV is y-down image space.
const FS_CROP = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uOff, uScale;
void main(){ vec2 iuv=vec2(vUV.x,1.0-vUV.y); o=vec4(texture(uSrc,uOff+iuv*uScale).rgb,1.0); }`;

const FS_BILATERAL = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o;
uniform sampler2D uT; uniform vec2 uStep;
void main(){
  vec3 c=texture(uT,vUV).rgb; vec3 s=vec3(0.0); float w=0.0;
  for(int i=-3;i<=3;i++) for(int j=-3;j<=3;j++){
    vec2 d=vec2(float(i),float(j));
    vec3 t=texture(uT,vUV+d*uStep).rgb; vec3 dc=t-c;
    float wt=exp(-dot(d,d)/12.0 - dot(dc,dc)/(2.0*0.07*0.07));
    s+=t*wt; w+=wt; }
  o=vec4(s/w,1.0); }`;

const FS_GAUSS = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o;
uniform sampler2D uT; uniform vec2 uDir;
void main(){
  vec4 s=texture(uT,vUV)*0.2270270270;
  s+=(texture(uT,vUV+uDir*1.3846153846)+texture(uT,vUV-uDir*1.3846153846))*0.3162162162;
  s+=(texture(uT,vUV+uDir*3.2307692308)+texture(uT,vUV-uDir*3.2307692308))*0.0702702703;
  o=s; }`;

const VS_MASK = `#version 300 es
in vec2 p; void main(){ gl_Position=vec4(p.x*2.0-1.0,1.0-p.y*2.0,0.0,1.0); }`;
const FS_MASK = `#version 300 es
precision highp float; uniform vec4 uC; out vec4 o; void main(){ o=uC; }`;

const FS_FINAL = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o;
uniform sampler2D uSrc,uSmooth,uBlur,uPerson,uFaceA,uFaceB,uBgImg;
uniform vec2 uOff,uScale,uRes,uBgScale,uBgOff;
uniform float uPass,uHasPerson,uHasFace;
uniform float uShine,uDebug; uniform float uSmoothAmt,uBright,uContrast,uWarm,uSat,uGlow;
uniform float uBgMode; uniform vec3 uBgColor;
uniform vec3 uLipColor; uniform float uLipTint,uGloss,uLipFull,uLiner;
uniform float uWhites,uIris,uLash,uUnder,uEyeSize,uEyeLift,uBrow;
uniform vec2 uEyeC[2]; uniform float uEyeR[2]; uniform vec2 uIrisC[2]; uniform float uIrisR[2];
uniform vec2 uLipC; uniform vec2 uLipR; uniform vec2 uGlossC[2]; uniform vec2 uGlossR;
uniform float uRoll,uRotZoom,uPersp,uNeck,uJaw,uFaceW,uFaceH; uniform vec2 uChin; uniform float uGaze,uEyeOpen,uNeckCX,uJawY; uniform vec2 uGazeD[2];
const vec3 L=vec3(0.299,0.587,0.114);
vec3 sat(vec3 c,float s){ return mix(vec3(dot(c,L)),c,s); }
float skinColor(vec3 c){
  float y=dot(c,L); float cb=0.5+(-0.168736*c.r-0.331264*c.g+0.5*c.b); float cr=0.5+(0.5*c.r-0.418688*c.g-0.081312*c.b);
  float a=smoothstep(0.03,0.06,cr-cb+0.0)*(1.0-smoothstep(0.30,0.36,cr-cb));
  return a*smoothstep(0.08,0.2,y);
}
void main(){
  vec2 iuv=vec2(vUV.x,1.0-vUV.y);
  vec2 asp=vec2(uRes.x/uRes.y,1.0);
  if(uPass<0.5){
    // perspective: simulate a higher / eye-level camera (magnify top, compress bottom)
    float k=uPersp*0.12;
    if(k>0.0001){
      float fx=(1.0-k*(1.0-2.0*iuv.y))/(1.0+k);
      iuv.x=0.5+(iuv.x-0.5)*fx;
      iuv.y=iuv.y-k*0.9*iuv.y*(1.0-iuv.y);
    }
    // auto-level: rotate around frame centre with zoom so no edges show
    if(abs(uRoll)>0.0002){
      vec2 c=vec2(0.5)*asp; vec2 d=iuv*asp-c; float cs=cos(uRoll), sn=sin(uRoll);
      d=vec2(cs*d.x-sn*d.y, sn*d.x+cs*d.y)/uRotZoom; iuv=(c+d)/asp;
    }
  }
  if(uPass<0.5 && uHasFace>0.01){
    // neck slimming: every row from just under the jawline down is compressed toward the neck centre by the same
    // factor (up to 30% narrower, eased in over the under-jaw so strap tops lean gently instead of kinking), so straight things (straps, necklace chain, collar) stay straight. A wide band
    // further out (shoulders/background) absorbs the change; outside it nothing moves.
    if(uNeck>0.001){
      vec2 p=iuv*asp; vec2 ch=uChin*asp; float cx=uNeckCX*asp.x;
      float wy=smoothstep(ch.y-uFaceH*0.05,ch.y+uFaceH*0.20,p.y);
      float sN=1.0-uNeck*0.30*wy*uHasFace;
      float dx=p.x-cx, ax=abs(dx), src=ax;
      float R=min(uFaceW*1.2, (dx>0.0?asp.x-cx:cx)-0.004);
      float e=min(uFaceW*0.70,R*0.6), m=R-e, es=e*sN;
      if(ax<es) src=ax/sN; else if(ax<R) src=e+(ax-es)*(m/(R-es));
      p.x=cx+sign(dx)*src; iuv=p/asp;
    }
    // jawline & chin contour
    if(uJaw>0.001){
      vec2 p=iuv*asp; vec2 ch=uChin*asp; vec2 lc=uLipC*asp;
      float wy=smoothstep(lc.y-uFaceH*0.12,lc.y+uFaceH*0.08,p.y)*(1.0-smoothstep(ch.y-uFaceH*0.02,ch.y+uFaceH*0.14,p.y));
      float u=(p.x-ch.x)/(uFaceW*0.72); if(abs(u)<1.0){ float g=(1.0-u*u); g*=g;
        p.x=ch.x+(p.x-ch.x)*(1.0+uJaw*0.09*g*wy*uHasFace); }
      vec2 dc=(p-ch)/vec2(uFaceW*0.45,uFaceH*0.22); float cw=exp(-dot(dc,dc)*1.5);
      p.y+=uJaw*0.025*uFaceH*cw*uHasFace; iuv=p/asp;
    }
    // eye enlarge + lift
    for(int k=0;k<2;k++){
      vec2 p=(iuv-uEyeC[k])*asp; float d=length(p)/uEyeR[k];
      if(d<1.0){ float f=(1.0-d*d); f*=f*uHasFace;
        iuv=uEyeC[k]+(iuv-uEyeC[k])*(1.0-uEyeSize*0.16*f);
        iuv.y+=uEyeLift*uEyeR[k]*0.10*f; }
      // open the eyes: vertical-only stretch in a flat ellipse (brows/cheeks stay put)
      vec2 pe=p/vec2(uEyeR[k]*0.85,uEyeR[k]*0.42); float de=length(pe);
      if(de<1.0){ float f=(1.0-de*de); f*=f*uHasFace;
        iuv.y=uEyeC[k].y+(iuv.y-uEyeC[k].y)*(1.0-uEyeOpen*0.34*f); }
    }
    // eye contact: move iris toward the lens, only inside the visible eye (blinks stay natural)
    if(uGaze>0.001){
      float em=texture(uFaceA,vec2(iuv.x,1.0-iuv.y)).g*uHasFace;
      if(em>0.02){ for(int k=0;k<2;k++){ vec2 dd=(iuv-uIrisC[k])*asp; float r=length(dd)/(uIrisR[k]*2.0);
        if(r<1.0){ float w=(1.0-r*r); iuv-=uGazeD[k]*uGaze*w*smoothstep(0.02,0.5,em); } } }
    }
    // lip fullness
    vec2 q=(iuv-uLipC)*asp; vec2 qq=q/uLipR; float d=length(qq);
    if(d<1.0){ float f=(1.0-d*d); f*=f*uHasFace;
      iuv.y=uLipC.y+(iuv.y-uLipC.y)*(1.0-uLipFull*0.20*f);
      iuv.x=uLipC.x+(iuv.x-uLipC.x)*(1.0-uLipFull*0.05*f); }
  }
  vec2 fuv=vec2(iuv.x,1.0-iuv.y);
  vec2 suv=uOff+iuv*uScale;
  vec3 orig=texture(uSrc,suv).rgb;
  if(uPass>0.5){ o=vec4(orig,1.0); return; }
  vec3 sm=texture(uSmooth,fuv).rgb;
  vec4 fa=texture(uFaceA,fuv)*uHasFace; vec4 fb=texture(uFaceB,fuv)*uHasFace;
  float person=uHasPerson>0.5?texture(uPerson,suv).r:1.0;
  float cs=skinColor(orig);
  float faceSkin=fb.b*(1.0-fa.g)*(1.0-fa.a*0.9)*(1.0-fa.r);
  float skin=max(faceSkin*mix(0.6,1.0,cs), cs*person*(uHasFace>0.01?0.7:1.0));
  float diff=length(orig-sm);
  float edge=1.0-smoothstep(0.05,0.20,diff);
  vec3 col=mix(orig,sm,clamp(uSmoothAmt*skin*edge*1.1,0.0,0.92));
  // shine / glare reduction on face skin (keeps colour, pulls hot spots down to skin tone)
  if(uShine>0.001){
    float lm=dot(col,L); float hl=smoothstep(0.58,0.9,lm)*max(faceSkin,skin*0.5);
    vec3 tamed=col*(0.7/max(lm,0.01)); tamed=mix(tamed,vec3(0.86,0.70,0.60)*(0.7/0.7329),0.35);
    col=mix(col,clamp(tamed,0.0,1.0),hl*uShine*0.75);
  }
  // under-eye
  float ue=fa.b*(1.0-fa.g);
  vec3 ueC=mix(col,sm,0.75)*1.05+vec3(0.006,0.004,0.0);
  col=mix(col,ueC,clamp(ue*uUnder*0.6,0.0,0.6));
  // brows
  float lumC=dot(col,L);
  col=mix(col,col*0.62*vec3(0.98,0.95,0.94),fa.a*uBrow*0.75*smoothstep(0.85,0.25,lumC));
  // eyes
  float eye=fa.g;
  float irisM=0.0, ring=0.0, pupil=0.0;
  for(int k=0;k<2;k++){
    float d=length((iuv-uIrisC[k])*asp)/max(uIrisR[k],1e-4);
    float m=1.0-smoothstep(0.88,1.06,d);
    irisM=max(irisM,m); ring=max(ring,m*smoothstep(0.62,0.98,d)); pupil=max(pupil,1.0-smoothstep(0.30,0.42,d));
  }
  irisM*=eye; ring*=eye; pupil*=eye;
  float sclera=eye*(1.0-irisM);
  float sl=dot(col,L);
  vec3 white=mix(col,vec3(sl)*1.16+0.035,0.65);
  col=mix(col,clamp(white,0.0,1.0),sclera*uWhites*smoothstep(0.12,0.4,sl));
  float ia=irisM*(1.0-pupil)*uIris;
  col=mix(col,clamp(sat(col,1.7)*1.22,0.0,1.0),ia*(1.0-ring));
  col*=1.0-0.45*uIris*ring;
  // lash line / liner
  col=mix(col,col*0.18,clamp(fb.r*uLash*(1.0-eye*0.7),0.0,1.0)*0.9);
  // lips
  float ll=dot(col,L);
  float chroma=max(col.r,max(col.g,col.b))-min(col.r,min(col.g,col.b));
  float teeth=smoothstep(0.5,0.75,ll)*(1.0-smoothstep(0.10,0.22,chroma));
  float lip=fa.r*(1.0-teeth);
  vec3 tc=uLipColor*(ll/max(dot(uLipColor,L),0.05));
  tc=mix(tc,uLipColor,0.25);
  col=mix(col,clamp(tc,0.0,1.0),lip*uLipTint*0.85);
  float lineBand=clamp(4.0*fa.r*(1.0-fa.r),0.0,1.0);
  col*=1.0-uLiner*0.30*lineBand*smoothstep(0.0,0.4,uLipTint+0.3);
  float gl=0.0;
  for(int k=0;k<2;k++){ vec2 g=(iuv-uGlossC[k])*asp/uGlossR; gl=max(gl,exp(-dot(g,g)*2.2)*(k==0?1.0:0.55)); }
  float spec=gl*lip*smoothstep(0.18,0.6,ll);
  col+=vec3(1.0,0.97,0.97)*spec*uGloss*0.45;
  col=mix(col,sat(col,1.15)*1.03,lip*uGloss*0.4);
  // background
  if(uBgMode>0.5){
    vec3 bg;
    if(uBgMode<1.5) bg=texture(uBlur,fuv).rgb;
    else if(uBgMode<2.5) bg=uBgColor;
    else bg=texture(uBgImg,uBgOff+iuv*uBgScale).rgb;
    float pm=smoothstep(0.25,0.75,person);
    col=mix(bg,col,pm);
  }
  // color grade
  col*=1.0+uBright*0.35; col+=uBright*0.03;
  col=(col-0.5)*(1.0+uContrast*0.5)+0.5;
  col.r*=1.0+uWarm*0.08; col.g*=1.0+uWarm*0.02; col.b*=1.0-uWarm*0.09;
  col=sat(col,1.0+uSat*0.6);
  vec3 g=texture(uBlur,fuv).rgb*(1.0+uBright*0.3);
  col=1.0-(1.0-clamp(col,0.0,1.0))*(1.0-g*uGlow*0.45);
  col=mix(col,col*0.94+0.06*vec3(1.0,0.96,0.93),uGlow*0.35);
  if(uDebug>0.5){ col=mix(col,vec3(1,0,0.3),fa.r*0.7); col=mix(col,vec3(0,1,1),fa.g*0.6); col=mix(col,vec3(1,1,0),fa.b*0.5); col=mix(col,vec3(0.6,0,1),fa.a*0.6);
    col=mix(col,vec3(0,0,0),fb.r*0.8); col=mix(col,vec3(0,1,0),fb.b*0.15); col=mix(col,vec3(1,0.5,0),irisM*0.6); }
  o=vec4(clamp(col,0.0,1.0),1.0);
}`;

function sh(gl, type, src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function prog(gl, vs, fs){ const p=gl.createProgram(); gl.attachShader(p,sh(gl,gl.VERTEX_SHADER,vs)); gl.attachShader(p,sh(gl,gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u={}; const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS); for(let i=0;i<n;i++){ const info=gl.getActiveUniform(p,i); const nm=info.name.replace(/\[0\]$/,''); u[nm]=gl.getUniformLocation(p,info.name); }
  return {p,u}; }

export class Renderer {
  constructor(canvas){
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:false,antialias:false,premultipliedAlpha:false});
    if(!gl) throw new Error('WebGL2 not supported in this browser');
    this.gl=gl;
    this.pCrop=prog(gl,VS,FS_CROP); this.pBil=prog(gl,VS,FS_BILATERAL); this.pGauss=prog(gl,VS,FS_GAUSS);
    this.pFinal=prog(gl,VS,FS_FINAL); this.pMask=prog(gl,VS_MASK,FS_MASK);
    this.quad=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
    this.vao=gl.createVertexArray(); gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    for(const p of [this.pCrop,this.pBil,this.pGauss,this.pFinal]) gl.bindAttribLocation(p.p,0,'a');
    this.maskBuf=gl.createBuffer(); this.maskVao=gl.createVertexArray(); gl.bindVertexArray(this.maskVao);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.maskBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindVertexArray(null);
    this.srcTex=this.tex(); this.personTex=this.tex(); this.bgTex=this.tex();
    gl.bindTexture(gl.TEXTURE_2D,this.bgTex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([20,120,120,255]));
    this.bgSize=[1,1];
    this.fbos={}; this.size=[0,0];
  }
  tex(){ const gl=this.gl,t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return t; }
  fbo(name,w,h){ const gl=this.gl; let f=this.fbos[name]; if(f&&f.w===w&&f.h===h) return f;
    if(f){ gl.deleteTexture(f.t); gl.deleteFramebuffer(f.f); }
    const t=this.tex(); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    f={t,f:fb,w,h}; this.fbos[name]=f; return f; }
  setSize(w,h){ this.canvas.width=w; this.canvas.height=h; this.size=[w,h]; }
  // true if the last frame drawn to the screen is (nearly) black – used to fall back to the plain camera
  isBlank(){ const gl=this.gl; if(gl.isContextLost&&gl.isContextLost()) return true; try{ gl.bindFramebuffer(gl.FRAMEBUFFER,null); const px=new Uint8Array(4*16);
    gl.readPixels(Math.floor(this.size[0]/2)-2,Math.floor(this.size[1]/2)-2,4,4,gl.RGBA,gl.UNSIGNED_BYTE,px); let m=0; for(let i=0;i<px.length;i+=4) m=Math.max(m,px[i],px[i+1],px[i+2]); return m<6; }catch(e){ return false; } }
  setBackgroundImage(img){ const gl=this.gl; gl.bindTexture(gl.TEXTURE_2D,this.bgTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img); this.bgSize=[img.naturalWidth||img.width,img.naturalHeight||img.height]; }
  setPersonMask(u8,w,h){ const gl=this.gl; gl.bindTexture(gl.TEXTURE_2D,this.personTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,w,h,0,gl.RED,gl.UNSIGNED_BYTE,u8); gl.pixelStorei(gl.UNPACK_ALIGNMENT,4); this.hasPerson=true; }
  pass(p,target,setup){ const gl=this.gl; gl.useProgram(p.p);
    if(target){ gl.bindFramebuffer(gl.FRAMEBUFFER,target.f); gl.viewport(0,0,target.w,target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,this.size[0],this.size[1]); }
    setup&&setup(p.u); gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLE_STRIP,0,4); }
  bind(unit,tex,loc){ const gl=this.gl; gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,tex); gl.uniform1i(loc,unit); }
  gauss(a,b,step,iters){ const gl=this.gl; for(let i=0;i<iters;i++){
      this.pass(this.pGauss,b,u=>{ this.bind(0,a.t,u.uT); gl.uniform2f(u.uDir,step/a.w,0); });
      this.pass(this.pGauss,a,u=>{ this.bind(0,b.t,u.uT); gl.uniform2f(u.uDir,0,step/a.h); }); } }
  drawMaskGeom(target, items){ // items: [{tris:Float32Array, ch:[r,g,b,a], v}]
    const gl=this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER,target.f); gl.viewport(0,0,target.w,target.h);
    gl.clearColor(0,0,0,0); gl.colorMask(true,true,true,true); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.pMask.p); gl.bindVertexArray(this.maskVao); gl.bindBuffer(gl.ARRAY_BUFFER,this.maskBuf);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE);
    for(const it of items){ if(!it.tris||!it.tris.length) continue;
      gl.bufferData(gl.ARRAY_BUFFER,it.tris,gl.DYNAMIC_DRAW);
      gl.colorMask(...it.ch.map(x=>!!x)); gl.uniform4f(this.pMask.u.uC,1,1,1,1);
      gl.drawArrays(gl.TRIANGLES,0,it.tris.length/2);
      if(it.cut){ gl.blendFunc(gl.ZERO,gl.ZERO); gl.bufferData(gl.ARRAY_BUFFER,it.cut,gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES,0,it.cut.length/2); gl.blendFunc(gl.ONE,gl.ONE); }
    }
    gl.disable(gl.BLEND); gl.colorMask(true,true,true,true); gl.bindVertexArray(null); }
  // src: video/image element; S: settings; face: geometry from face.js (in output image space) or null
  render(src, srcW, srcH, S, face, opts={}){
    const gl=this.gl, [W,H]=this.size; if(!W||!srcW) return;
    // cover crop
    const outA=W/H, srcA=srcW/srcH; let sx=1,sy=1; if(srcA>outA) sx=outA/srcA; else sy=srcA/outA;
    const off=[(1-sx)/2,(1-sy)/2], scale=[sx,sy]; this.crop={off,scale};
    gl.bindTexture(gl.TEXTURE_2D,this.srcTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src); }catch(e){ return; }
    const passthrough=!!opts.passthrough;
    const hw=Math.max(2,Math.round(W/2)),hh=Math.max(2,Math.round(H/2)),qw=Math.max(2,Math.round(W/6)),qh=Math.max(2,Math.round(H/6));
    const half=this.fbo('half',hw,hh), sm=this.fbo('smooth',hw,hh), q=this.fbo('q',qw,qh), q2=this.fbo('q2',qw,qh);
    const fa=this.fbo('fa',hw,hh), fb=this.fbo('fb',hw,hh), ft=this.fbo('ft',hw,hh);
    if(!passthrough){
      this.pass(this.pCrop,half,u=>{ this.bind(0,this.srcTex,u.uSrc); gl.uniform2f(u.uOff,...off); gl.uniform2f(u.uScale,...scale); });
      this.pass(this.pBil,sm,u=>{ this.bind(0,half.t,u.uT); gl.uniform2f(u.uStep,1.6/hw,1.6/hh); });
      this.pass(this.pCrop,q,u=>{ this.bind(0,this.srcTex,u.uSrc); gl.uniform2f(u.uOff,...off); gl.uniform2f(u.uScale,...scale); });
      const blurAmt=S.bgMode==='blur'?S.bgBlur:0.4;
      this.gauss(q,q2,1+blurAmt*2.5,S.bgMode==='blur'?3:1);
      if(face){
        this.drawMaskGeom(fa,face.maskA); this.drawMaskGeom(fb,face.maskB);
        const st=Math.max(0.6,face.faceW*hw*0.012);
        this.gauss(fa,ft,st,1); this.gauss(fb,ft,st,1);
      }
    }
    const fw=face?face.weight:0;
    this.pass(this.pFinal,null,u=>{
      this.bind(0,this.srcTex,u.uSrc); this.bind(1,sm.t,u.uSmooth); this.bind(2,q.t,u.uBlur); this.bind(3,this.personTex,u.uPerson);
      this.bind(4,fa.t,u.uFaceA); this.bind(5,fb.t,u.uFaceB); this.bind(6,this.bgTex,u.uBgImg);
      gl.uniform2f(u.uOff,...off); gl.uniform2f(u.uScale,...scale); gl.uniform2f(u.uRes,W,H);
      gl.uniform1f(u.uPass,passthrough?1:0); gl.uniform1f(u.uHasPerson,this.hasPerson&&S.bgMode!=='none'?1:(this.hasPerson?1:0)); gl.uniform1f(u.uHasFace,fw);
      gl.uniform1f(u.uSmoothAmt,S.smooth); gl.uniform1f(u.uDebug,opts.debug?1:0); gl.uniform1f(u.uShine,S.shine||0); gl.uniform1f(u.uBright,S.bright); gl.uniform1f(u.uContrast,S.contrast); gl.uniform1f(u.uWarm,S.warmth);
      gl.uniform1f(u.uSat,S.sat); gl.uniform1f(u.uGlow,S.glow);
      gl.uniform1f(u.uBgMode,{none:0,blur:1,color:2,image:3}[S.bgMode]||0); gl.uniform3fv(u.uBgColor,hex(S.bgColor));
      // bg image cover
      const bA=this.bgSize[0]/this.bgSize[1]; let bx=1,by=1; if(bA>outA) bx=outA/bA; else by=bA/outA;
      gl.uniform2f(u.uBgScale,bx,by); gl.uniform2f(u.uBgOff,(1-bx)/2,(1-by)/2);
      gl.uniform3fv(u.uLipColor,hex(S.lipColor)); gl.uniform1f(u.uLipTint,S.lipTint); gl.uniform1f(u.uGloss,S.gloss); gl.uniform1f(u.uLipFull,S.lipFull); gl.uniform1f(u.uLiner,S.liner);
      gl.uniform1f(u.uWhites,S.whites); gl.uniform1f(u.uIris,S.iris); gl.uniform1f(u.uLash,S.lash); gl.uniform1f(u.uUnder,S.underEye);
      { const asp=W/H; let roll=face?Math.max(-0.21,Math.min(0.21,face.roll))*S.level*fw:0; this.rollS=(this.rollS||0)*0.85+roll*0.15; roll=this.rollS;
        const c=Math.cos(Math.abs(roll)), sn=Math.sin(Math.abs(roll)); const z=Math.max(c+sn/asp,c+sn*asp);
        gl.uniform1f(u.uRoll,roll); gl.uniform1f(u.uRotZoom,z); gl.uniform1f(u.uPersp,S.persp||0);
        gl.uniform1f(u.uNeck,S.neck||0); gl.uniform1f(u.uJaw,S.jaw||0); }
      gl.uniform1f(u.uEyeSize,S.eyeSize); gl.uniform1f(u.uEyeLift,S.eyeLift); gl.uniform1f(u.uBrow,S.brow);
      if(face){
        gl.uniform2fv(u.uEyeC,face.eyeC); gl.uniform1fv(u.uEyeR,face.eyeR); gl.uniform2fv(u.uIrisC,face.irisC); gl.uniform1fv(u.uIrisR,face.irisR);
        gl.uniform2fv(u.uChin,face.chin); gl.uniform2fv(u.uGazeD,face.gazeD); gl.uniform1f(u.uGaze,S.gaze||0); gl.uniform1f(u.uEyeOpen,S.eyeOpen||0); gl.uniform1f(u.uNeckCX,face.neckCX); gl.uniform1f(u.uJawY,face.jawY); gl.uniform1f(u.uFaceW,face.faceWh); gl.uniform1f(u.uFaceH,face.faceH);
        gl.uniform2fv(u.uLipC,face.lipC); gl.uniform2fv(u.uLipR,face.lipR); gl.uniform2fv(u.uGlossC,face.glossC); gl.uniform2fv(u.uGlossR,face.glossR);
      }
    });
  }
}
export function hex(h){ const n=parseInt((h||'#000000').slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; }
