"use strict";(globalThis.webpackChunkextract_css=globalThis.webpackChunkextract_css||[]).push([["74713"],{688114:(function(R,y,d){d.d(y,{G:()=>p,RL:()=>m,Un:()=>E,Vf:()=>M,lc:()=>S,re:()=>g,zn:()=>b});let S=(function(o){return o.TOP="top",o.MIDDLE="middle",o.BOTTOM="bottom",o})({}),m=(function(o){return o.REPLACE="replace",o.ACCUMULATE="accumulate",o})({}),E=(function(o){return o.EASE="ease",o.EASE_IN="ease-in",o.EASE_IN_BACK="ease-in-back",o.EASE_OUT="ease-out",o.EASE_OUT_BACK="ease-out-back",o.EASE_IN_OUT="ease-in-out",o.EASE_IN_OUT_BACK="ease-in-out-back",o.LINEAR="linear",o.CUSTOM="custom",o.SPRING="spring",o})({}),b=(function(o){return o.HOVER="hover",o.LOOP="loop",o.APPEAR="appear",o.SCROLL="scroll",o.PRESS="press",o.FOLLOW="follow",o.PREVIEW="preview",o})({}),M=(function(o){return o.SELF="self",o.SECTION="section",o})({}),g=(function(o){return o.COVER="cover",o.CONTAIN="contain",o.ENTRY="entry",o.EXIT="exit",o.ENTRY_CROSSING="entry-crossing",o.EXIT_CROSSING="exit-crossing",o})({}),p=(function(o){return o.ENTERS="enters",o.LEAVES="leaves",o.SCROLLS="scrolls",o.PASSES="passes",o.CUSTOM="custom",o})({})}),600866:(function(R,y,d){d.r(y),d.d(y,{AnimationRuntime:()=>b});var S=d(70901);class m{constructor(g,p){this.strategy=new S.ZP({target:g,blockData:p})}async init(){await this.strategy.init()}enable(){this.strategy.enable()}disable(){this.strategy.disable()}destroy(){this.strategy.destroy()}}var E=d(757098);class b{animationTriggerManagers=new Map;pendingDestroyIds=new Set;async createAnimationTriggers(g){let p=arguments.length>1&&arguments[1]!==void 0?arguments[1]:document;this.destroyAnimationTriggers(g);const{componentId:o,animations:V}=g,C=(0,E.OF)(g.componentId,p);if(!C||!V?.length)return;const x=new m(C,g);if(this.pendingDestroyIds.delete(o),await x.init(),this.pendingDestroyIds.has(o)){x.destroy(),this.pendingDestroyIds.delete(o);return}x.enable(),this.animationTriggerManagers.set(o,x)}destroyAnimationTriggers(g){const{componentId:p}=g,o=this.animationTriggerManagers.get(p);if(o){o.destroy(),this.animationTriggerManagers.delete(p);return}this.pendingDestroyIds.add(p)}}}),257954:(function(R,y,d){d.d(y,{A9:()=>k,VI:()=>K});function S(n){const t=parseFloat(n);return typeof t=="number"&&!Number.isNaN(t)}function m(n,t,e){return Math.min(Math.max(n,t),e)}function E(n,t,e){return t+(e-t)*n}function b(n,t){return Math.round(n*10**t)/10**t}function M(n){const t=parseFloat(n);return n.toString().replace(t.toString(),"")}function g(n,t,e=3){const r=t.length-1,s=[];let i=0,a=0,u=n.length;for(;a<u;a++){i=n[a];const f=m(Math.floor(i*r),0,r-1),c=t[f],l=t[f+1],h=(i-f/r)*r;s.push(b(E(h,c,l),e))}return s}function p(n,t){const e=t.length-1,r=[];let s=0,i=0,a=n.length;for(;i<a;i++){s=m(n[i],0,1);const u=Math.round(s*e);r.push(t[u])}return r}const o=null;function V(n,t,e=3){let r="";return S(t[0])&&(r=M(t[0])),g(n,t.map(s=>typeof s=="number"?s:parseFloat(s)),e).map(s=>s+r)}function C(n,t,e=3){let r=!0,s=!0,i=0,a;const u=t.length;for(;i<u;i++)a=t[i],r&&(r=typeof a=="number"),s&&(s=S(a));return r?g(n,t,e):s?V(n,t,e):p(n,t)}function x(n,t={},e=C){const r=A(t),[s,i]=k(r);return[e?.(s,n,r.decimal),i]}function st(n){return(t,e,r)=>t.map(s=>n(s,e,r))}/*!
 * Based off of https://github.com/jakearchibald/linear-easing-generator
 * 
 * Changes:
 * - Added comments and docs top explain logic
 * - Switched to iterative approach for the `ramerDouglasPeucker` algorithim
 * - Renamed functions, parameters and variables to improve readability and to better match a library usecase 
 * 
 * Copyright 2023 Jake Archibald [@jakearchibald](https://github.com/jakearchibald)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function $(n,t,e){let[r,s]=t,i=e[0]-r,a=e[1]-s;if(i!==0||a!==0){let u=((n[0]-r)*i+(n[1]-s)*a)/(i*i+a*a);u>1?(r=e[0],s=e[1]):u>0&&(r+=i*u,s+=a*u)}return i=n[0]-r,a=n[1]-s,i*i+a*a}function B(n,t){const e=t*t;if(n.length<3)return n;let r=[n[0]],s=[[0,n.length-1]];for(;s.length>0;){let[i,a]=s.pop(),u=0,f=0;for(let c=i+1;c<a;c++){const l=$(n[c],n[i],n[a]);l>u&&(f=c,u=l)}u>e?(s.push([i,f]),s.push([f,a])):r.push(n[a])}return r.sort((i,a)=>i[0]-a[0])}function G(n,t,e){if(!n)return null;const r=Math.max(e,2);return B(n,t).map(([s,i])=>[b(s,r),b(i,e)])}/*!
 * Based off of https://github.com/jakearchibald/linear-easing-generator
 * 
 * Changes:
 * - Added comments and docs top explain logic
 * - Switched to iterative approach for the `ramerDouglasPeucker` algorithim
 * - Renamed functions, parameters and variables to improve readability and to better match a library usecase 
 * 
 * Copyright 2023 Jake Archibald [@jakearchibald](https://github.com/jakearchibald)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function z(n,t){if(!n)return[];const e=new Intl.NumberFormat("en-US",{maximumFractionDigits:Math.max(t-2,0)}),r=new Intl.NumberFormat("en-US",{maximumFractionDigits:t}),s=n,i=new Set,a=1/10**t;for(const[c,l]of s.entries()){const[h]=l;if(c===0){h===0&&i.add(l);continue}if(c===s.length-1){const D=s[c-1][0];h===1&&D<=1&&i.add(l);continue}const N=s[c-1][0],P=(s[c+1][0]-N)/2+N;Math.abs(h-P)<a&&i.add(l)}const u=[[s[0]]];for(const c of s.slice(1))c[1]===u.at(-1)[0][1]?u.at(-1).push(c):u.push([c]);return u.map(c=>{const l=r.format(c[0][1]),h=c.map(w=>{const[D]=w;let T=l;return i.has(w)||(T+=" "+e.format(D*100)+"%"),T}).join(", ");if(c.length===1)return h;const q=[c[0][0],c.at(-1)[0]].map(w=>e.format(w*100)+"%").join(" "),P=`${l} ${q}`;return P.length>h.length?h:P})}function K(n={}){const t=A(n),[e,r]=k(t),s=m(t.quality??.85,0,1),i=E(1-s,0,.025),a=e.length,u=e.map((c,l)=>[l/(a-1),c]),f=G(u,i,t.decimal);return[z(f,t.decimal).join(", "),r]}/*!
 * Spring solver inspired by Webkit Copyright © 2016 Apple Inc. All rights reserved. https://webkit.org/demos/spring/spring.js
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
*/const I=(n,[t=1,e=100,r=10,s=0]=[],i)=>{t=m(t,1e-4,1e3),e=m(e,1e-4,1e3),r=m(r,1e-4,1e3),s=m(s,1e-4,1e3);const a=Math.sqrt(e/t),u=r/(2*Math.sqrt(e*t)),f=u<1?a*Math.sqrt(1-u*u):0,c=u<1?(u*a+-s)/f:-s+a;let l=i?i*n/1e3:n;return u<1?l=Math.exp(-l*u*a)*(Math.cos(f*l)+c*Math.sin(f*l)):l=(1+c*l)*Math.exp(-l*a),1-l},L=new Map,U=1e5;function W([n,t,e,r]=[]){let s=[n,t,e,r],i=`${s}`;if(L.has(i))return L.get(i);const a=1/6;let u=0,f=0;for(;++f<U;){if(Math.abs(1-I(u,s))<.001){let l=u,h=1;for(;++f<U&&(u+=a,!(Math.abs(1-I(u,s))>=.001));)if(h++,h===16){const N=l*1e3;return L.set(i,[N,f]),[N,f]}}u+=a}const c=u*1e3;return L.set(i,[c,f]),[c,f]}function X(n){return(t,e=[],r)=>1-n(1-t,e,r)}function Y(n){return function(t,e=[],r){return t<.5?n(t*2,e,r)/2:1-n(t*-2+2,e,r)/2}}function H(n){return function(t,e=[],r){return t<.5?(1-n(1-t*2,e,r))/2:(n(t*2-1,e,r)+1)/2}}const Z=I,J=X(I),Q=Y(I),v=H(I);function _(n,t,e=3){const r=t.length-1,s=m(Math.floor(n*r),0,r-1),i=t[s],a=t[s+1],u=(n-s/r)*r;return b(E(u,i,a),e)}function tt(n,t){const e=t.length-1;n=m(n,0,1);const r=Math.round(n*e);return t[r]}const it=null;function nt(n,t,e=3){let r="";return S(t[0])&&(r=M(t[0])),_(n,t.map(s=>typeof s=="number"?s:parseFloat(s)),e)+r}function et(n,t,e=3){return t.every(i=>typeof i=="number")?_(n,t,e):t.every(i=>S(i))?nt(n,t,e):tt(n,t)}let O={spring:I,"spring-in":Z,"spring-out":J,"spring-in-out":Q,"spring-out-in":v},j=Object.keys(O);function ot(n,t){O={...O,[n]:t},j=Object.keys(O)}function at(n){O={...O,...n},j=Object.keys(O)}function rt(n){const t=/(\(|\s)([^)]+)\)?/.exec(n.toString());return t?t[2].split(",").map(e=>{let r=parseFloat(e);return Number.isNaN(r)?e.trim():r}):[]}function A(n={}){const t=typeof n=="string"||Array.isArray(n)&&typeof n[0]=="function";let{easing:e=[I,1,100,10,0],numPoints:r=38,decimal:s=3,...i}=t?{easing:n}:n;if(typeof e=="string"){const a=O[e.replace(/(\(|\s).+/,"").toLowerCase().trim()],u=rt(e);e=[a,...u]}return{easing:e,numPoints:r,decimal:s,...i}}const F=new Map;function k(n={}){let{easing:t,numPoints:e}=A(n);if(Array.isArray(t)){if(typeof t[0]!="function")throw new Error("[spring-easing] A frame function is required as the first element in the easing array, e.g. [SpringFrame, ...]")}else throw new Error(`[spring-easing] The easing needs to be in the format:  
* "spring-out(mass, stiffness, damping, velocity)" or 
* [SpringOutFrame, mass, stiffness, damping, velocity], the easing recieved is "${t}", [spring-easing] doesn't really know what to do with that.`);let[r,...s]=t;const[i,a=38]=W(s);e||(e=a);const u=`${s},${e}`;if(F.has(u)){let l=F.get(u);if(l.has(r))return l.get(r)}const f=[];for(let l=0;l<e;l++)f[l]=r(l/(e-1),s,i);const c=F.has(u)?F.get(u):new WeakMap;return c.set(r,[f,i]),F.set(u,c),[f,i]}function ut(n,t={},e=et){const r=A(t),[s,i]=k(r);return[s.map(a=>e(a,n,r.decimal)),i]}})}]);

//# sourceMappingURL=https://sourcemaps.squarespace.net/universal/scripts-compressed/sourcemaps/31b40fc950827756/trigger-animation-runtime-864c0ece75986a53-min.en-US.js.map