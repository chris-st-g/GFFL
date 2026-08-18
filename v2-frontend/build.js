/*
 * GFFL 2.0 — GitHub Pages build.
 *
 * Assembles a static docs/index.html from the GFFL 2.0 Apps Script HTML sources
 * (../v2-backend/*.html), inlining the <?!= include('X') ?> server templates and
 * injecting a shim that reimplements `google.script.run` on top of fetch() so the
 * exact same frontend code talks to the Apps Script JSON API cross-origin.
 *
 * Calls go out as GET ?action=api&fn=NAME&args=[...] — a CORS "simple request"
 * that Apps Script answers with permissive CORS, avoiding the POST preflight it
 * can't handle. Run:  node v2-frontend/build.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'v2-backend');
const OUT = path.join(__dirname, '..', 'docs');

// GFFL 2.0 web-app /exec endpoint (the JSON API the browser calls).
const API_URL = 'https://script.google.com/macros/s/AKfycbydtM2JPIEvgYtG4jsvNFA0qmHh6uZIlNAPc4bi_CPRIhuOoR9dMbRMcNHYIC1-1UHqbw/exec';

// Backend functions the frontend may call (must match apiFunctions_() in Code.gs).
const FN = [
  'getLeagueData', 'getConferencePicks', 'getPickPageData', 'submitPick',
  'getStandings', 'getAlmaCup', 'adminLogin', 'setCurrentWeek',
  'triggerWeekScoring', 'addBonusPoints', 'adminAddPlayerFull', 'adminMovePlayer',
  'adminToggleRookie', 'setAlmaWinner', 'adminSetAutoWeek', 'adminGetBonusEditor',
  'adminSetTeamBonus'
];

const shim = `<script>(function(){
  var API=${JSON.stringify(API_URL)};
  var FN=${JSON.stringify(FN)};
  function Runner(s,f){this._s=s;this._f=f;}
  Runner.prototype.withSuccessHandler=function(c){return new Runner(c,this._f);};
  Runner.prototype.withFailureHandler=function(c){return new Runner(this._s,c);};
  FN.forEach(function(fn){
    Runner.prototype[fn]=function(){
      var s=this._s,f=this._f,args=[].slice.call(arguments);
      var url=API+'?action=api&fn='+encodeURIComponent(fn)+'&args='+encodeURIComponent(JSON.stringify(args));
      fetch(url,{method:'GET',redirect:'follow'})
        .then(function(r){return r.json();})
        .then(function(j){ if(j&&j.__ok){ if(s)s(j.data); } else { if(f)f(new Error((j&&j.error)||'Request failed')); } })
        .catch(function(e){ if(f)f(e); });
    };
  });
  window.google=window.google||{};
  window.google.script={run:new Runner(null,null),host:{close:function(){},editor:{}},url:{getLocation:function(cb){cb&&cb({parameter:{}});}}};
})();</script>`;

let html = fs.readFileSync(path.join(SRC, 'Index.html'), 'utf8');

// Inline each <?!= include('Name') ?> with the raw file contents.
html = html.replace(/<\?!=\s*include\('([^']+)'\)\s*\?>/g, function (_m, name) {
  return fs.readFileSync(path.join(SRC, name + '.html'), 'utf8');
});

// Inject the shim right after <body> so window.google exists before the app's
// load handler (which calls google.script.run.getLeagueData) fires.
html = html.replace('<body>', '<body>\n' + shim);

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log('Wrote', path.join(OUT, 'index.html'), '(' + html.length + ' bytes)');
