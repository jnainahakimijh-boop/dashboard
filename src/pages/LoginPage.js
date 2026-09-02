import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '/src/state/AuthContext.js';
import { hasOidcConfig } from '/src/config/runtime.js';
import { usePlatformConfig } from '/src/lib/platformConfig.js';

const h = React.createElement;
export default function LoginPage(){
  const {signIn,signInWithSso,ssoBusy,ssoError,authError}=useAuth();
  const {config}=usePlatformConfig();
  const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [showPassword,setShowPassword]=useState(false); const [busy,setBusy]=useState(false);
  const ssoEnabled=config.security.ssoEnabled; const passwordEnabled=config.security.passwordLoginEnabled;
  async function submit(e){e.preventDefault();setBusy(true);try{await signIn(username.trim(),password);}finally{setBusy(false);}}
  return h('main',{className:'min-h-screen bg-[#fcfcfc] px-4 py-8 sm:px-6 lg:px-8'},
    h('div',{className:'mx-auto grid min-h-[720px] max-w-[1180px] overflow-hidden rounded-[14px] border border-[#e0ddee] bg-white shadow-[0_18px_50px_rgba(9,8,22,.08)] lg:grid-cols-[1.02fr_.98fr]'},
      h('section',{className:'flex flex-col justify-between bg-[#f2f1f9] p-8 sm:p-12 lg:p-14'},
        h('div',null,
          h('img',{src:'/veolia-logo.webp',alt:'Veolia',className:'h-auto w-[130px]'}),
          h('div',{className:'mt-5 text-[18px] font-bold text-[#002d62]'},'Digital Performance'),
          h('div',{className:'mt-1 text-[12.5px] text-[#75748b]'},'Communication & Marketing Intelligence Platform'),
          h('div',{className:'mt-2 inline-flex items-center gap-2 rounded-[6px] bg-white px-3 py-2 text-[12px] font-semibold text-[#55555a]'},h('span',{className:'h-2 w-2 rounded-full bg-[#ee0000]'}),'Protected prototype workspace'),
          h('h1',{className:'mt-8 max-w-[470px] text-[42px] font-bold leading-[1.12] tracking-[-.03em] text-[#1c1c1f] sm:text-[48px]'},'Turn digital performance into decisions.'),
          h('p',{className:'mt-6 max-w-[500px] text-[15px] leading-7 text-[#55555a]'},'A governed cross-channel workspace for web, social media, Employee Advocacy, SEO, AI Search, campaigns, conversion and market performance.')
        ),
        h('div',{className:'text-[11.5px] text-[#75748b]'},`${config.workspace.name} · ${config.workspace.environment}`)
      ),
      h('section',{className:'flex items-center justify-center p-7 sm:p-10 lg:p-14'},h('div',{className:'w-full max-w-[440px]'},
        h('div',{className:'text-[12px] font-bold text-[#ee0000]'},'Secure access'),
        h('h2',{className:'mt-3 text-[32px] font-bold leading-tight tracking-[-.02em] text-[#1c1c1f]'},'Welcome to Veolia Digital Performance'),
        h('p',{className:'mt-3 text-[14px] leading-6 text-[#55555a]'},ssoEnabled&&passwordEnabled?'Choose Veolia SSO or use the prototype username and password.':ssoEnabled?'Continue with Veolia SSO.':'Use the prototype username and password.'),
        ssoEnabled?h(React.Fragment,null,
          h('button',{type:'button',onClick:()=>signInWithSso(),disabled:ssoBusy,className:'mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#ee0000] bg-[#ee0000] px-5 text-[14px] font-bold text-white transition hover:bg-white hover:text-[#ee0000] disabled:cursor-wait disabled:opacity-60'},h(ShieldCheck,{size:18}),ssoBusy?'Connecting to Veolia SSO…':'Continue with Veolia SSO',!ssoBusy?h(ArrowRight,{size:17}):null),
          h('div',{className:'mt-3 rounded-[6px] border border-[#d5d3e3] bg-[#fcfcfc] px-3 py-2.5 text-[11.5px] leading-5 text-[#55555a]'},hasOidcConfig?'Authorised OIDC/PKCE SSO is configured for this deployment.':'Prototype SSO simulation for Netlify Drop. Real Veolia SSO can replace it when authorised OIDC settings are available.'),
          ssoError?h('div',{role:'alert',className:'mt-3 rounded-[6px] border border-[#ffdbb3] bg-[#fff1eb] px-3 py-2.5 text-[12px] font-medium text-[#d64309]'},ssoError):null
        ):null,
        ssoEnabled&&passwordEnabled?h('div',{className:'my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.06em] text-[#9897a8]'},h('span',{className:'h-px flex-1 bg-[#e9e6f4]'}),h('span',null,'or'),h('span',{className:'h-px flex-1 bg-[#e9e6f4]'})):null,
        passwordEnabled?h('form',{onSubmit:submit,className:`rounded-[10px] border border-[#e0ddee] bg-white p-5 sm:p-6 ${ssoEnabled?'':'mt-8'}`},
          h('div',{className:'mb-4 flex items-center gap-2 text-[12.5px] font-bold text-[#1c1c1f]'},h(KeyRound,{size:16,className:'text-[#ee0000]'}),'Prototype credentials'),
          h('label',{className:'block'},h('span',{className:'mb-2 block text-[12.5px] font-bold text-[#1c1c1f]'},'Username'),h('input',{value:username,onChange:e=>setUsername(e.target.value),autoComplete:'username',required:true,className:'h-12 w-full rounded-[6px] border border-[#d5d3e3] bg-white px-3.5 text-[14px] text-[#1c1c1f] outline-none transition focus:border-[#ee0000] focus:ring-2 focus:ring-[#ee0000]/15',placeholder:'Enter username'})),
          h('label',{className:'mt-5 block'},h('span',{className:'mb-2 block text-[12.5px] font-bold text-[#1c1c1f]'},'Password'),h('div',{className:'relative'},h('input',{type:showPassword?'text':'password',value:password,onChange:e=>setPassword(e.target.value),autoComplete:'current-password',required:true,className:'h-12 w-full rounded-[6px] border border-[#d5d3e3] bg-white px-3.5 pr-14 text-[14px] text-[#1c1c1f] outline-none transition focus:border-[#ee0000] focus:ring-2 focus:ring-[#ee0000]/15',placeholder:'Enter password'}),h('button',{type:'button','aria-label':showPassword?'Hide password':'Show password',onClick:()=>setShowPassword(v=>!v),className:'absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[4px] text-[#55555a] hover:bg-[#f2f1f9]'},showPassword?h(EyeOff,{size:16}):h(Eye,{size:16})))),
          authError?h('div',{role:'alert',className:'mt-4 rounded-[6px] border border-[#f8bcbc] bg-[#fff1f1] px-3 py-2.5 text-[12px] font-medium text-[#c90000]'},authError):null,
          h('button',{type:'submit',disabled:busy,className:'mt-5 h-12 w-full rounded-[6px] bg-[#002d62] px-4 text-[13px] font-bold text-white transition hover:bg-[#001f45] disabled:cursor-wait disabled:opacity-70'},busy?'Signing in…':'Sign in')
        ):null,
        h('p',{className:'mt-5 text-[11.5px] leading-5 text-[#75748b]'},'Prototype-only access. Authentication options can be controlled from Settings → Back Office → Security. Real production protection requires Veolia-approved identity and server infrastructure.')
      ))
    )
  );
}
