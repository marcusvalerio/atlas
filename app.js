// ---------- Supabase: cliente e sessão ----------
  const SUPABASE_URL = 'https://byqeownckckbxbfctkde.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_tpWCM84h98HsM4lRG53pyg_cXHNzxHg';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let currentUser = null;
  let weekStartDB = null;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- clock + date ----------
  function updateClock(){
    const d = new Date();
    document.getElementById('clock').textContent = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
    const days = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    document.getElementById('datecap').textContent = `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
  }
  updateClock(); setInterval(updateClock, 15000);

  // ---------- arc / dial renderer (fan of ticks + progress) ----------
  function renderArc(svgId, percent, glow){
    const svg = document.getElementById(svgId);
    const cx = 135, cy = 140, rOuter = 118, rInner = 100, ticks = 32;
    let html = '';
    for(let i=0;i<ticks;i++){
      const t = i/(ticks-1);
      const angle = Math.PI * (1 - t); // 180deg (left) -> 0deg (right), sweeping the top arc
      const x1 = cx + rInner*Math.cos(angle), y1 = cy - rInner*Math.sin(angle);
      const x2 = cx + rOuter*Math.cos(angle), y2 = cy - rOuter*Math.sin(angle);
      const lit = t <= percent;
      const color = lit ? (glow||'#33E39A') : 'rgba(255,255,255,0.10)';
      const width = lit ? 3 : 2;
      html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${lit?`style="filter:drop-shadow(0 0 4px ${glow||'#33E39A'})"`:''}/>`;
    }
    svg.innerHTML = html;
  }

  // ---------- progresso persistente ----------
  let WEEKLY_GOAL = 5;
  let weekCount = 0;
  let streakDays = 0;
  let userName = '';
  let userGoal = 'hipertrofia';

  async function loadProgressCloud(){
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    if(data){
      WEEKLY_GOAL = data.weekly_goal || 5;
      weekCount = data.week_count || 0;
      streakDays = data.streak_days || 0;
      userName = data.name || '';
      userGoal = data.goal || 'hipertrofia';
      weekStartDB = data.week_start;
      return true;
    }
    return false;
  }
  function saveProgress(){
    if(!currentUser) return;
    sb.from('profiles').upsert({
      id: currentUser.id, name: userName, weekly_goal: WEEKLY_GOAL, goal: userGoal,
      week_count: weekCount, streak_days: streakDays, week_start: weekStartDB, updated_at: new Date().toISOString()
    }).then(({error})=>{ if(error) console.error('saveProgress', error); });
  }
  function renderHomeArc(){
    renderArc('homeArc', Math.min(weekCount / WEEKLY_GOAL, 1), '#33E39A');
    document.getElementById('weekCount').textContent = weekCount;
    document.getElementById('weekCount').nextElementSibling.textContent = '/' + WEEKLY_GOAL;
  }
  function updateHomeStats(){
    document.getElementById('streakNum').textContent = streakDays;
    document.getElementById('streakDays').textContent = streakDays;
    if(streakDays > 0){
      const badge = document.querySelector('.stat2 .tile:nth-child(2) .badge');
      badge.textContent = 'Em dia'; badge.className = 'badge ok';
    }
    if(weekCount > 0){
      document.getElementById('lastWorkoutBadge').textContent = 'Registrado';
      document.getElementById('lastWorkoutBadge').className = 'badge ok';
      document.getElementById('lastWorkoutName').textContent = 'Sessão de hoje';
      document.getElementById('lastWorkoutVal').textContent = weekCount + (weekCount===1?' treino':' treinos');
    }
    if(userName){
      document.querySelectorAll('.profile-name').forEach(el=> el.textContent = userName);
      document.querySelector('.avatar').textContent = userName[0].toUpperCase();
    }
  }
  function getMonday(d){
    d = new Date(d);
    const day = d.getDay();
    const diff = (day===0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  }
  function checkWeekReset(){
    const monday = getMonday(new Date());
    if(weekStartDB !== monday){
      weekCount = 0;
      weekStartDB = monday;
      saveProgress();
    }
  }
  // ---------- haptics (Vibration API — não suportada no Safari/iOS por decisão da Apple) ----------
  function haptic(pattern){ try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){} }

  // ---------- rascunho do treino em andamento ----------
  function saveWorkoutDraft(){
    if(!currentUser) return;
    sb.from('workout_draft').upsert({
      user_id: currentUser.id, routine_name: activeRoutineName || null, exercises: workout, updated_at: new Date().toISOString()
    }).then(({error})=>{ if(error) console.error('saveWorkoutDraft', error); });
  }
  async function loadWorkoutDraftCloud(){
    const { data } = await sb.from('workout_draft').select('*').eq('user_id', currentUser.id).maybeSingle();
    if(data){ workout = data.exercises || []; activeRoutineName = data.routine_name || ''; }
  }

  // ---------- recordes pessoais ----------
  async function loadRecordsCloud(){
    const { data } = await sb.from('records').select('*').eq('user_id', currentUser.id);
    records = {};
    (data||[]).forEach(r=>{ records[r.exercise_name] = { weight:Number(r.weight), reps:r.reps, date:r.date }; });
  }
  function saveRecordRow(name){
    if(!currentUser) return;
    const r = records[name];
    sb.from('records').upsert({ user_id: currentUser.id, exercise_name:name, weight:r.weight, reps:r.reps, date:r.date }).then(({error})=>{ if(error) console.error('saveRecordRow', error); });
  }
  let records = {};

  // ---------- última performance por exercício ----------
  async function loadLastPerfCloud(){
    const { data } = await sb.from('last_performed').select('*').eq('user_id', currentUser.id);
    lastPerf = {};
    (data||[]).forEach(r=>{ lastPerf[r.exercise_name] = { kg:Number(r.kg), reps:r.reps, date:r.date }; });
  }
  function saveLastPerfRow(name){
    if(!currentUser) return;
    const r = lastPerf[name];
    sb.from('last_performed').upsert({ user_id: currentUser.id, exercise_name:name, kg:r.kg, reps:r.reps, date:r.date }).then(({error})=>{ if(error) console.error('saveLastPerfRow', error); });
  }
  let lastPerf = {};
  function recordLastPerf(name, kg, reps){
    lastPerf[name] = { kg, reps, date:new Date().toISOString() };
    saveLastPerfRow(name);
  }
  function checkPR(name, kg, reps){
    if(!kg || kg <= 0) return false;
    const cur = records[name];
    if(!cur || kg > cur.weight){
      records[name] = { weight:kg, reps:reps, date:new Date().toISOString() };
      saveRecordRow(name);
      return true;
    }
    return false;
  }
  function showPRToast(name, kg){
    document.getElementById('ptSub').textContent = `${name} — ${kg}kg`;
    const t = document.getElementById('prToast');
    t.classList.add('show');
    haptic([15,40,15]);
    setTimeout(()=> t.classList.remove('show'), 2600);
  }
  function renderRecords(){
    const box = document.getElementById('recordsList');
    const entries = Object.entries(records).sort((a,b)=> new Date(b[1].date) - new Date(a[1].date));
    if(!entries.length){
      box.innerHTML = `<div class="emptystate" style="padding:26px 4px; text-align:left;"><div class="emptystate-title">Nenhum recorde ainda.</div><div class="emptystate-sub">Quando você bater um recorde numa série, ele aparece aqui automaticamente.</div></div>`;
      return;
    }
    const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    box.innerHTML = entries.slice(0,12).map(([name,r])=>{
      const d = new Date(r.date);
      return `<div class="pr-item"><div><div class="exn">${name}</div><div class="prd">${d.getDate()} de ${months[d.getMonth()]}</div></div><div class="prv">${r.weight}<span>kg × ${r.reps}</span></div></div>`;
    }).join('');
  }

  // ---------- histórico de treinos ----------
  async function loadHistoryCloud(){
    const { data } = await sb.from('workout_history').select('*').eq('user_id', currentUser.id).order('date', { ascending:false }).limit(90);
    history = (data||[]).map(h=>({ date:h.date, exercises:h.exercises, totalVolume:Number(h.total_volume), totalSets:h.total_sets, minutes:h.minutes }));
  }
  function insertHistoryRow(entry){
    if(!currentUser) return;
    sb.from('workout_history').insert({
      user_id: currentUser.id, date: entry.date, exercises: entry.exercises,
      total_volume: entry.totalVolume, total_sets: entry.totalSets, minutes: entry.minutes
    }).then(({error})=>{ if(error) console.error('insertHistoryRow', error); });
  }
  let history = [];
  function renderHistory(){
    const box = document.getElementById('historyList');
    if(!history.length){
      box.innerHTML = `<div class="emptystate" style="padding:26px 4px; text-align:left;"><div class="emptystate-title">Nenhum treino registrado ainda.</div><div class="emptystate-sub">Toda sessão concluída aparece aqui, com data, volume e duração.</div></div>`;
      return;
    }
    const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    box.innerHTML = history.slice(0,15).map(h=>{
      const d = new Date(h.date);
      return `<div class="hist-item"><div><div class="hn">${h.exercises.length} exercício${h.exercises.length===1?'':'s'}</div><div class="hd">${d.getDate()} de ${months[d.getMonth()]} · ${h.minutes}min</div></div><div class="hv">${h.totalVolume.toLocaleString('pt-BR')}<span>kg total</span></div></div>`;
    }).join('');
  }
  function renderChartFromHistory(){
    const days = ['D','S','T','Q','Q','S','S'];
    const today = new Date(); today.setHours(0,0,0,0);
    const buckets = Array.from({length:7}).map((_,i)=>{
      const d = new Date(today); d.setDate(d.getDate() - (6-i));
      return { label: days[d.getDay()], date: d.toISOString().slice(0,10), v: 0 };
    });
    history.forEach(h=>{
      const key = h.date.slice(0,10);
      const b = buckets.find(x=>x.date === key);
      if(b) b.v += h.totalVolume;
    });
    const hasData = buckets.some(b=>b.v>0);
    document.getElementById('chartEmptyMsg').style.display = hasData ? 'none' : 'block';
    const chart = document.getElementById('chart');
    chart.innerHTML = '';
    const max = Math.max(...buckets.map(b=>b.v), 1);
    buckets.forEach((b,i)=>{
      const col = document.createElement('div');
      col.className = 'bar-col' + (i===buckets.length-1 ? ' today' : '');
      col.innerHTML = `<div class="bar" style="height:110px;"><div class="fill"></div></div><div class="bar-day">${b.label}</div>`;
      chart.appendChild(col);
      setTimeout(()=>{ col.querySelector('.fill').style.height = (b.v/max*100)+'%'; }, 200+i*80);
    });
  }

  // ---------- força por exercício (a partir do histórico real) ----------
  function getTrackedExerciseNames(){
    const set = new Set();
    history.forEach(h => (h.exercises||[]).forEach(e=>{ if(e.sets && e.sets.some(s=>s.kg>0)) set.add(e.name); }));
    return Array.from(set);
  }
  function getStrengthSeries(name){
    const points = [];
    history.slice().reverse().forEach(h=>{
      const ex = (h.exercises||[]).find(e=>e.name===name);
      if(ex && ex.sets && ex.sets.length){
        const maxKg = Math.max(...ex.sets.map(s=>s.kg||0));
        if(maxKg>0) points.push({ date:h.date, kg:maxKg });
      }
    });
    return points;
  }
  function renderStrengthChart(name){
    const points = getStrengthSeries(name);
    const wrap = document.getElementById('strengthSvgWrap');
    if(points.length < 2){
      wrap.innerHTML = `<div class="strength-card"><div class="emptystate-sub" style="text-align:left; margin:0;">Precisa de pelo menos 2 sessões registradas de "${name}" pra desenhar a curva. Você já tem ${points.length}.</div></div>`;
      return;
    }
    const w = 294, h = 130, pad = 18;
    const kgs = points.map(p=>p.kg);
    const maxKg = Math.max(...kgs), minKg = Math.min(...kgs);
    const range = Math.max(maxKg - minKg, 1);
    const stepX = (w - pad*2) / (points.length - 1);
    const coords = points.map((p,i)=>{
      const x = pad + i*stepX;
      const y = h - pad - ((p.kg - minKg)/range) * (h - pad*2);
      return [x, y];
    });
    const path = coords.map((c,i)=> (i===0?'M':'L') + c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ');
    const dots = coords.map(c=>`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3.5" fill="#33E39A"/>`).join('');
    wrap.innerHTML = `
      <div class="strength-card">
        <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}">
          <path d="${path}" fill="none" stroke="#33E39A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px rgba(51,227,154,0.5))"/>
          ${dots}
        </svg>
        <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:10.5px; color:var(--mute);">
          <span>Mín. ${minKg}kg</span><span>Máx. ${maxKg}kg</span>
        </div>
      </div>`;
  }
  function renderStrengthChips(){
    const names = getTrackedExerciseNames();
    const box = document.getElementById('strengthChips');
    if(!names.length){
      box.innerHTML = '';
      document.getElementById('strengthSvgWrap').innerHTML = `<div class="strength-card"><div class="emptystate-sub" style="text-align:left; margin:0;">Registre pelo menos 2 treinos com o mesmo exercício pra ver a evolução de carga aqui.</div></div>`;
      return;
    }
    box.innerHTML = names.map((n,i)=>`<div class="chip-ex ${i===0?'sel':''}" data-name="${n}">${n}</div>`).join('');
    box.querySelectorAll('.chip-ex').forEach(c=>{
      c.addEventListener('click', ()=>{
        box.querySelectorAll('.chip-ex').forEach(x=>x.classList.remove('sel'));
        c.classList.add('sel');
        renderStrengthChart(c.dataset.name);
      });
    });
    renderStrengthChart(names[0]);
  }


  // ---------- onboarding ----------
  const REST_BY_GOAL = { hipertrofia:90, forca:150, emagrecimento:45, saude:60 };
  const GOAL_LABEL = { hipertrofia:'Hipertrofia', forca:'Força máxima', emagrecimento:'Emagrecimento', saude:'Saúde geral' };
  let obData = { name:'', freq:5, goal:'hipertrofia' };
  let obStep = 0;
  const OB_STEPS = 5;

  function obRenderDots(){
    const dots = document.getElementById('obDots');
    dots.innerHTML = Array.from({length:OB_STEPS}).map((_,i)=>`<span class="${i===obStep?'active':''}"></span>`).join('');
  }
  function obShow(){
    document.querySelectorAll('.ob-step').forEach(s=> s.style.display = (+s.dataset.step === obStep) ? 'flex' : 'none');
    obRenderDots();
  }
  function obNext(){
    if(obStep===1) obData.name = document.getElementById('obName').value.trim();
    if(obStep < OB_STEPS-1){ obStep++; obShow(); if(obStep===4) obFillSummary(); }
  }
  function obBack(){ if(obStep>0){ obStep--; obShow(); } }
  function obFillSummary(){
    document.getElementById('obFinalTitle').textContent = obData.name ? `Prontinho, ${obData.name}.` : 'Tudo pronto.';
    document.getElementById('obFinalSub').textContent = `Meta de ${obData.freq}x por semana · foco em ${GOAL_LABEL[obData.goal].toLowerCase()}. Você pode mudar isso depois no Perfil.`;
  }
  function buildOnboardOptions(){
    const grid = document.getElementById('obFreqGrid');
    grid.innerHTML = [2,3,4,5,6,7].map(n=>`<div class="ob-chip ${n===obData.freq?'sel':''}" data-freq="${n}">${n}</div>`).join('');
    grid.querySelectorAll('.ob-chip').forEach(c=>{
      c.addEventListener('click', ()=>{ obData.freq = +c.dataset.freq; grid.querySelectorAll('.ob-chip').forEach(x=>x.classList.remove('sel')); c.classList.add('sel'); });
    });
    const list = document.getElementById('obGoalList');
    const goals = [
      {k:'hipertrofia', t:'Hipertrofia', s:'Ganho de massa muscular — descanso de 90s'},
      {k:'forca', t:'Força máxima', s:'Cargas altas, poucas reps — descanso de 150s'},
      {k:'emagrecimento', t:'Emagrecimento', s:'Mais densidade, menos pausa — descanso de 45s'},
      {k:'saude', t:'Saúde geral', s:'Consistência acima de intensidade — descanso de 60s'},
    ];
    list.innerHTML = goals.map(g=>`<div class="ob-opt ${g.k===obData.goal?'sel':''}" data-goal="${g.k}"><div><div class="ot">${g.t}</div><div class="os">${g.s}</div></div></div>`).join('');
    list.querySelectorAll('.ob-opt').forEach(o=>{
      o.addEventListener('click', ()=>{ obData.goal = o.dataset.goal; list.querySelectorAll('.ob-opt').forEach(x=>x.classList.remove('sel')); o.classList.add('sel'); });
    });
  }
  function obFinish(){
    WEEKLY_GOAL = obData.freq;
    userName = obData.name;
    userGoal = obData.goal;
    weekStartDB = getMonday(new Date());
    DEFAULT_REST = REST_BY_GOAL[obData.goal] || 90;
    saveProgress();
    renderHomeArc();
    updateHomeStats();
    document.getElementById('onboard').classList.remove('show');
  }
  let DEFAULT_REST = 90;

  // ---------- tab switching ----------
  const views = { home:'view-home', train:'view-train', progress:'view-progress', profile:'view-profile' };
  function goTab(target){ const btn = document.querySelector(`.tabbtn[data-tab="${target}"]`); if(btn) btn.click(); }
  document.querySelectorAll('.tabbtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = btn.dataset.tab;
      if(btn.classList.contains('active')) return;
      document.querySelectorAll('.tabbtn').forEach(b=>{ b.classList.remove('active'); b.removeAttribute('aria-current'); });
      btn.classList.add('active'); btn.setAttribute('aria-current','page');
      Object.values(views).forEach(id=>{
        const el = document.getElementById(id);
        if(el.id !== views[target] && el.style.display !== 'none'){
          if(reduced){ el.style.display='none'; }
          else{ el.classList.add('exit'); setTimeout(()=>{ el.style.display='none'; el.classList.remove('exit'); }, 380); }
        }
      });
      const next = document.getElementById(views[target]);
      setTimeout(()=>{ next.style.display='block'; next.scrollTop = 0; }, reduced ? 0 : 190);
    });
  });

  // ---------- session timer: iniciar / pausar / retomar ----------
  const iconPlay = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 4.5v15l13-7.5-13-7.5z" fill="currentColor"/></svg>';
  const iconPause = '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor"/></svg>';
  const iconDot = '<span class="dotpulse"></span>';
  let sessionSeconds = 0, sessionState = 'idle'; // idle | running | paused
  function toggleSession(){
    sessionState = sessionState === 'running' ? 'paused' : 'running';
    updateSessionUI();
  }
  function updateSessionUI(){
    const btn = document.getElementById('sessionBtn');
    const icon = document.getElementById('sessionIcon');
    btn.classList.toggle('running', sessionState==='running');
    if(sessionState==='running') icon.innerHTML = iconDot;
    else if(sessionState==='paused') icon.innerHTML = iconPlay;
    else icon.innerHTML = iconPlay;
    document.getElementById('sessionTime').textContent = sessionLabel();
  }
  function sessionLabel(){
    if(sessionState==='idle' && sessionSeconds===0) return 'Iniciar';
    const m = Math.floor(sessionSeconds/60).toString().padStart(2,'0');
    const s = (sessionSeconds%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }
  function resetSession(){ sessionSeconds = 0; sessionState = 'idle'; updateSessionUI(); }
  setInterval(()=>{
    if(sessionState !== 'running') return;
    sessionSeconds++;
    document.getElementById('sessionTime').textContent = sessionLabel();
  }, 1000);
  updateSessionUI();

  // ---------- rest timer (sheet with arc) ----------
  let restActive = false, restInterval = null, restSeconds = 90, restTotal = 90;
  function startRest(seconds, label){
    restActive = true; restTotal = seconds || 90; restSeconds = restTotal;
    document.getElementById('restExName').textContent = label || 'Próxima série';
    document.getElementById('restSheet').classList.add('show');
    clearInterval(restInterval);
    tickRest();
    restInterval = setInterval(tickRest, 1000);
  }
  function adjustRest(delta){
    if(!restActive) return;
    restSeconds = Math.max(0, restSeconds + delta);
    restTotal = Math.max(restTotal, restSeconds);
    tickRest(false);
  }
  function tickRest(advance){
    if(advance === undefined) advance = true;
    if(restSeconds<=0){ haptic([20,50,20]); endRest(); return; }
    const m = Math.floor(restSeconds/60).toString().padStart(2,'0');
    const s = (restSeconds%60).toString().padStart(2,'0');
    document.getElementById('rtTime').textContent = `${m}:${s}`;
    renderArc('restArc', 1 - (restSeconds/restTotal), '#33E39A');
    if(advance) restSeconds--;
  }
  function endRest(){ restActive = false; clearInterval(restInterval); document.getElementById('restSheet').classList.remove('show'); }
  function skipRest(){ endRest(); }

  // ---------- icons ----------
  const checkSVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- base local de exercícios (PT-BR), fotos hospedadas no próprio repo ----------
  const EXERCISES = [
    { name:'Supino reto — barra', code:'PT', meta:'Peito · Barra', img:'images/barbell-bench-press-medium-grip.jpg' },
    { name:'Supino inclinado — halteres', code:'PT', meta:'Peito · Halteres', img:'images/incline-dumbbell-press.jpg' },
    { name:'Crucifixo — polia', code:'PT', meta:'Peito · Polia', img:'images/cable-crossover.jpg' },
    { name:'Peck deck (voador)', code:'PT', meta:'Peito · Máquina', img:'images/butterfly.jpg' },
    { name:'Desenvolvimento militar — barra', code:'OM', meta:'Ombro · Barra', img:'images/standing-military-press.jpg' },
    { name:'Elevação lateral — halteres', code:'OM', meta:'Ombro · Halteres', img:'images/side-lateral-raise.jpg' },
    { name:'Elevação frontal — halteres', code:'OM', meta:'Ombro · Halteres', img:'images/front-dumbbell-raise.jpg' },
    { name:'Encolhimento — barra', code:'OM', meta:'Trapézio · Barra', img:'images/barbell-shrug.jpg' },
    { name:'Remada curvada — barra', code:'CO', meta:'Costas · Barra', img:'images/bent-over-barbell-row.jpg' },
    { name:'Puxada frontal — polia', code:'CO', meta:'Costas · Polia', img:'images/wide-grip-lat-pulldown.jpg' },
    { name:'Barra fixa', code:'CO', meta:'Costas · Peso corporal', img:'images/pullups.jpg' },
    { name:'Remada baixa — polia', code:'CO', meta:'Costas · Polia', img:'images/seated-cable-rows.jpg' },
    { name:'Levantamento terra — barra', code:'CO', meta:'Costas · Barra', img:'images/barbell-deadlift.jpg' },
    { name:'Rosca direta — barra', code:'BI', meta:'Bíceps · Barra', img:'images/barbell-curl.jpg' },
    { name:'Rosca alternada — halteres', code:'BI', meta:'Bíceps · Halteres', img:'images/dumbbell-alternate-bicep-curl.jpg' },
    { name:'Rosca martelo', code:'BI', meta:'Bíceps · Halteres', img:'images/hammer-curls.jpg' },
    { name:'Extensão de tríceps — polia', code:'TR', meta:'Tríceps · Polia', img:'images/triceps-pushdown.jpg' },
    { name:'Tríceps testa — barra', code:'TR', meta:'Tríceps · Barra', img:'images/lying-triceps-press.jpg' },
    { name:'Mergulho — paralelas', code:'TR', meta:'Tríceps · Peso corporal', img:'images/dips-triceps-version.jpg' },
    { name:'Agachamento livre — barra', code:'PR', meta:'Pernas · Barra', img:'images/barbell-squat.jpg' },
    { name:'Leg press', code:'PR', meta:'Pernas · Máquina', img:'images/leg-press.jpg' },
    { name:'Cadeira extensora', code:'PR', meta:'Pernas · Máquina', img:'images/leg-extensions.jpg' },
    { name:'Mesa flexora', code:'PR', meta:'Pernas · Máquina', img:'images/lying-leg-curls.jpg' },
    { name:'Panturrilha em pé', code:'PR', meta:'Pernas · Máquina', img:'images/standing-calf-raises.jpg' },
    { name:'Stiff — barra', code:'PR', meta:'Pernas · Barra', img:'images/stiff-legged-barbell-deadlift.jpg' },
    { name:'Prancha', code:'AB', meta:'Abdômen · Peso corporal', img:'images/plank.jpg' },
    { name:'Abdominal supra', code:'AB', meta:'Abdômen · Peso corporal', img:'images/crunches.jpg' },
    { name:'Elevação de pernas', code:'AB', meta:'Abdômen · Peso corporal', img:'images/hanging-leg-raise.jpg' },
  ];

  function thumbInner(ex){
    const mono = `<span class="mono">${ex.code}</span>`;
    if(ex.img) return mono + `<img class="frame show" src="${ex.img}" alt="" onerror="this.remove()">` + `<div class="tone"></div>`;
    return mono;
  }

  // ---------- workout state (em branco) ----------
  let workout = [];

  // ---------- conta ----------
  async function handleSignOut(){
    await sb.auth.signOut();
    location.reload();
  }


  // ---------- rotinas salvas ----------
  async function loadRoutinesCloud(){
    const { data } = await sb.from('routines').select('*').eq('user_id', currentUser.id).order('created_at');
    routines = (data||[]).map(r=>({ id:r.id, name:r.name, exercises:r.exercises }));
  }
  async function insertRoutineRow(routine){
    const { data, error } = await sb.from('routines').insert({ user_id: currentUser.id, name: routine.name, exercises: routine.exercises }).select().single();
    if(error){ console.error('insertRoutineRow', error); return null; }
    return data;
  }
  function deleteRoutineRow(id){
    if(!id) return;
    sb.from('routines').delete().eq('id', id).then(({error})=>{ if(error) console.error('deleteRoutineRow', error); });
  }
  let routines = [];
  let activeRoutineName = '';

  function openRoutineSheet(){ renderRoutineList(); document.getElementById('routineSheet').classList.add('show'); }
  function closeRoutineSheet(){
    document.getElementById('routineSheet').classList.remove('show');
    document.getElementById('saveRoutineInputBox').classList.remove('open');
    document.getElementById('saveRoutineBtn').style.display = 'block';
  }
  function renderRoutineList(){
    const box = document.getElementById('routineListBox');
    if(!routines.length){ box.innerHTML = `<div class="exempty">Nenhuma rotina salva ainda. Monte um treino e salve como rotina abaixo.</div>`; return; }
    box.innerHTML = routines.map((r,i)=>`
      <div class="routine-item">
        <div class="routine-info">
          <div class="routine-badge">${r.exercises.length}x</div>
          <div style="min-width:0;">
            <div class="routine-name">${r.name}</div>
            <div class="routine-meta">${r.exercises.length} exercício${r.exercises.length===1?'':'s'}</div>
          </div>
        </div>
        <div class="routine-actions">
          <button class="routine-start" data-startroutine="${i}">Iniciar</button>
          <button class="exremove" data-delroutine="${i}" aria-label="Excluir rotina"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
        </div>
      </div>
    `).join('');
    box.querySelectorAll('[data-startroutine]').forEach(btn=>{
      btn.addEventListener('click', ()=> startRoutine(+btn.dataset.startroutine));
    });
    box.querySelectorAll('[data-delroutine]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = +btn.dataset.delroutine;
        deleteRoutineRow(routines[idx].id);
        routines.splice(idx, 1);
        renderRoutineList();
      });
    });
  }
  function startRoutine(idx){
    const r = routines[idx];
    if(!r) return;
    activeRoutineName = r.name;
    workout = r.exercises.map(e=>{
      const lp = lastPerf[e.name];
      return {
        name:e.name, meta:e.meta, code:e.code, img:e.img, rest:e.rest,
        sets: e.sets.map(s=>({ kg: lp?lp.kg:s.kg, reps: lp?lp.reps:s.reps, done:false }))
      };
    });
    document.getElementById('routineTitle').textContent = r.name;
    document.getElementById('routineSub').textContent = 'Rotina salva';
    renderExercises();
    closeRoutineSheet();
  }
  function showSaveRoutineInput(){
    document.getElementById('saveRoutineInputBox').classList.add('open');
    document.getElementById('saveRoutineBtn').style.display = 'none';
    document.getElementById('routineNameInput').focus();
  }
  async function confirmSaveRoutine(){
    const name = document.getElementById('routineNameInput').value.trim();
    if(!name || !workout.length) return;
    const routine = {
      name,
      exercises: workout.map(e=>({ name:e.name, meta:e.meta, code:e.code, img:e.img, rest:e.rest, sets: e.sets.map(s=>({kg:s.kg, reps:s.reps})) }))
    };
    const saved = await insertRoutineRow(routine);
    routine.id = saved ? saved.id : null;
    routines.push(routine);
    activeRoutineName = name;
    saveWorkoutDraft();
    document.getElementById('routineTitle').textContent = name;
    document.getElementById('routineSub').textContent = 'Rotina salva';
    document.getElementById('routineNameInput').value = '';
    closeRoutineSheet();
    renderRoutineList();
  }


  function renderExercises(){
    saveWorkoutDraft();
    const list = document.getElementById('exList');
    list.innerHTML = '';
    if(!workout.length){
      list.innerHTML = `<div class="emptystate"><div class="emptystate-title">Ainda em branco.</div><div class="emptystate-sub">Use "Adicionar exercício" abaixo para montar seu treino do zero.</div></div>`;
      return;
    }
    workout.forEach((ex, exi)=>{
      if(ex.rest === undefined) ex.rest = 90;
      const wrap = document.createElement('div');
      wrap.className = 'exercise';
      wrap.innerHTML = `
        <div class="exmedia">
          <div class="thumb">${thumbInner(ex)}</div>
          <div style="flex:1; min-width:0;">
            <div class="exname">${ex.name}</div>
            <div class="exmeta">${ex.meta}</div>
            ${lastPerf[ex.name] ? `<div class="exlast">Última vez: ${lastPerf[ex.name].kg}kg × ${lastPerf[ex.name].reps}</div>` : ''}
          </div>
          <div class="excontrols">
            <button class="restpill" data-restex="${exi}" title="Toque para mudar o tempo de descanso">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.4"/><path d="M12 8v4.5l3 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>${ex.rest}s</span>
            </button>
            <button class="exremove" data-removeex="${exi}" aria-label="Remover exercício" title="Remover exercício">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="setlabels"><span>Série</span><span>Kg</span><span>Reps</span><span></span></div>
        ${ex.sets.map((s,si)=>`
          <div class="srow-wrap">
            <div class="srow-delete"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a1 1 0 001 1h6a1 1 0 001-1V7" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <div class="setrow ${s.done?'done':''}" data-ex="${exi}" data-set="${si}">
              <div class="sidx">${si+1}</div>
              <div class="sval" contenteditable="true" inputmode="decimal" data-field="kg" aria-label="Peso em quilos" onclick="event.stopPropagation()">${s.kg}</div>
              <div class="sval" contenteditable="true" inputmode="numeric" data-field="reps" aria-label="Repetições" onclick="event.stopPropagation()">${s.reps}</div>
              <div class="scheck"><div class="scheck-badge">${checkSVG}</div></div>
            </div>
          </div>
        `).join('')}
        <button class="addset" data-addset="${exi}">+ Adicionar série</button>
      `;
      list.appendChild(wrap);
    });

    list.querySelectorAll('[data-removeex]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ workout.splice(btn.dataset.removeex, 1); renderExercises(); });
    });
    const REST_PRESETS = [30,45,60,90,120,150,180,240];
    list.querySelectorAll('.restpill').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const exi = btn.dataset.restex;
        const idx = REST_PRESETS.indexOf(workout[exi].rest);
        workout[exi].rest = REST_PRESETS[(idx+1) % REST_PRESETS.length];
        btn.querySelector('span').textContent = workout[exi].rest + 's';
      });
    });
    let suppressRowClick = false;
    list.querySelectorAll('.setrow').forEach(row=>{
      let startX=0, startY=0, dx=0, dragging=false, decided=false, isHorizontal=false;
      const THRESHOLD = 68;
      row.addEventListener('pointerdown', (e)=>{
        startX = e.clientX; startY = e.clientY; dx = 0; dragging = true; decided = false; isHorizontal = false;
        row.style.transition = 'none';
        try{ row.setPointerCapture(e.pointerId); }catch(err){}
      });
      row.addEventListener('pointermove', (e)=>{
        if(!dragging) return;
        const dxRaw = e.clientX - startX, dyRaw = e.clientY - startY;
        if(!decided){
          if(Math.abs(dxRaw) > 8 || Math.abs(dyRaw) > 8){ decided = true; isHorizontal = Math.abs(dxRaw) > Math.abs(dyRaw); }
          else return;
        }
        if(!isHorizontal) return;
        dx = Math.max(-96, Math.min(0, dxRaw));
        row.style.transform = `translateX(${dx}px)`;
      });
      function endDrag(){
        if(!dragging) return;
        dragging = false;
        row.style.transition = 'transform .28s cubic-bezier(.22,1,.36,1)';
        if(isHorizontal && dx < -THRESHOLD){
          row.style.transform = 'translateX(-100%)';
          haptic(15);
          const wrap = row.closest('.srow-wrap');
          wrap.style.transition = 'max-height .25s ease .1s, opacity .25s ease .1s, margin .25s ease .1s';
          wrap.style.maxHeight = wrap.offsetHeight + 'px';
          requestAnimationFrame(()=>{ wrap.style.maxHeight = '0px'; wrap.style.opacity = '0'; });
          suppressRowClick = true;
          setTimeout(()=>{
            const {ex, set} = row.dataset;
            workout[ex].sets.splice(set, 1);
            renderExercises();
            suppressRowClick = false;
          }, 300);
        } else {
          row.style.transform = 'translateX(0)';
          if(isHorizontal){ suppressRowClick = true; setTimeout(()=>suppressRowClick = false, 80); }
        }
        isHorizontal = false; decided = false;
      }
      row.addEventListener('pointerup', endDrag);
      row.addEventListener('pointercancel', endDrag);
      row.addEventListener('click', ()=>{
        if(suppressRowClick) return;
        const {ex, set} = row.dataset;
        const s = workout[ex].sets[set];
        const nowDone = !s.done;
        s.done = nowDone;
        row.classList.toggle('done', nowDone);
        saveWorkoutDraft();
        if(nowDone){
          haptic(12);
          recordLastPerf(workout[ex].name, s.kg, s.reps);
          const isPR = checkPR(workout[ex].name, s.kg, s.reps);
          if(isPR) showPRToast(workout[ex].name, s.kg);
          startRest(workout[ex].rest || 90, workout[ex].name);
        }
      });
    });
    list.querySelectorAll('.sval').forEach(c=>{
      c.addEventListener('blur', ()=>{
        const row = c.closest('.setrow');
        const {ex, set} = row.dataset;
        const field = c.dataset.field;
        const val = parseFloat(c.textContent.replace(',', '.')) || 0;
        workout[ex].sets[set][field] = val;
        c.textContent = val;
      });
      c.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); c.blur(); } });
    });
    list.querySelectorAll('[data-addset]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const exi = btn.dataset.addset;
        const last = workout[exi].sets[workout[exi].sets.length-1];
        workout[exi].sets.push({ kg:last.kg, reps:last.reps, done:false });
        renderExercises();
      });
    });
  }
  renderExercises();

  // ---------- add exercise: live search ----------
  function toggleSearch(){
    const box = document.getElementById('exSearchBox');
    const btn = document.getElementById('addexBtn');
    const open = box.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    btn.textContent = open ? '— Fechar busca' : '+ Adicionar exercício';
    if(open) document.getElementById('exSearchInput').focus();
    else document.getElementById('exResults').innerHTML = '';
  }
  function onSearchInput(){
    const q = document.getElementById('exSearchInput').value.trim().toLowerCase();
    const box = document.getElementById('exResults');
    if(q.length < 2){ box.innerHTML = ''; return; }
    const matches = EXERCISES.filter(ex=>ex.name.toLowerCase().includes(q)).slice(0,6);
    const rawName = document.getElementById('exSearchInput').value.trim();
    const customRow = `<div class="exresult" id="customExRow"><div class="thumb"><span class="mono">+</span></div><div><div class="rn">Criar "${rawName}"</div><div class="rm">Exercício personalizado</div></div></div>`;
    if(!matches.length){
      box.innerHTML = `<div class="exempty">Nenhum exercício encontrado na base.</div>${customRow}`;
    } else {
      box.innerHTML = matches.map((m)=>`
        <div class="exresult">
          <div class="thumb">${thumbInner(m)}</div>
          <div><div class="rn">${m.name}</div><div class="rm">${m.meta}</div></div>
        </div>`).join('') + customRow;
    }
    box.querySelectorAll('.exresult').forEach((el,i)=>{
      if(el.id === 'customExRow'){
        el.addEventListener('click', ()=>{
          addCustomExercise(rawName);
        });
        return;
      }
      el.addEventListener('click', ()=>{
        const m = matches[i];
        const lp = lastPerf[m.name];
        workout.push({ name:m.name, meta:m.meta, code:m.code, img:m.img, rest:DEFAULT_REST, sets:[{kg: lp?lp.kg:20, reps: lp?lp.reps:10, done:false}] });
        renderExercises();
        toggleSearch();
        document.getElementById('exSearchInput').value = '';
      });
    });
  }
  function addCustomExercise(name){
    if(!name) return;
    const lp = lastPerf[name];
    workout.push({ name, meta:'Personalizado', code:'•', img:null, rest:DEFAULT_REST, sets:[{kg: lp?lp.kg:20, reps: lp?lp.reps:10, done:false}] });
    renderExercises();
    toggleSearch();
    document.getElementById('exSearchInput').value = '';
  }

  function calcSessionStats(){
    let totalSets = 0, totalVolume = 0;
    workout.forEach(ex => ex.sets.forEach(s=>{ if(s.done){ totalSets++; totalVolume += (s.kg||0) * (s.reps||0); } }));
    return { totalSets, totalVolume, minutes: Math.floor(sessionSeconds/60) };
  }

  function fireConfetti(count){
    const layer = document.getElementById('confettiLayer');
    layer.innerHTML = '';
    if(reduced) return;
    const colors = ['#33E39A','#4FA6E8','#F0B84E','#FFFFFF'];
    for(let i=0;i<count;i++){
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      const size = 5 + Math.random()*5;
      p.style.width = size + 'px';
      p.style.height = (size*0.45) + 'px';
      p.style.left = Math.random()*100 + '%';
      p.style.background = colors[Math.floor(Math.random()*colors.length)];
      p.style.animationDuration = (1.5 + Math.random()*1.3) + 's';
      p.style.animationDelay = (Math.random()*0.35) + 's';
      layer.appendChild(p);
    }
    setTimeout(()=>{ layer.innerHTML = ''; }, 3200);
  }

  function showCelebration(goalReached){
    const stats = calcSessionStats();
    document.getElementById('celDuration').textContent = stats.minutes + 'min';
    document.getElementById('celSets').textContent = stats.totalSets;
    document.getElementById('celVolume').textContent = stats.totalVolume.toLocaleString('pt-BR');
    const badge = document.getElementById('celGoalBadge');
    badge.classList.toggle('show', goalReached);
    if(goalReached){
      document.getElementById('celTitle').textContent = 'Semana batida.';
      document.getElementById('celSub').textContent = 'Você fechou sua meta desta semana.';
      document.getElementById('celGoalSub').textContent = `${WEEKLY_GOAL} de ${WEEKLY_GOAL} treinos concluídos.`;
    } else {
      document.getElementById('celTitle').textContent = 'Treino concluído.';
      document.getElementById('celSub').textContent = 'Mais um registrado no seu progresso.';
    }
    document.getElementById('celebrate').classList.add('show');
    fireConfetti(goalReached ? 46 : 24);
  }
  function closeCelebration(){ document.getElementById('celebrate').classList.remove('show'); }

  function finishWorkout(){
    if(!workout.length){
      const bar = document.querySelector('.finishbar');
      bar.textContent = 'Adicione um exercício primeiro';
      setTimeout(()=>{ bar.textContent = 'Concluir treino'; }, 1600);
      return;
    }
    endRest();
    const stats = calcSessionStats();
    const entry = {
      date: new Date().toISOString(),
      exercises: workout.map(e=>({ name:e.name, sets: e.sets.filter(s=>s.done).map(s=>({kg:s.kg, reps:s.reps})) })),
      totalVolume: stats.totalVolume,
      totalSets: stats.totalSets,
      minutes: stats.minutes
    };
    history.unshift(entry);
    insertHistoryRow(entry);
    renderHistory();
    renderChartFromHistory();
    renderStrengthChips();

    const wasBelowGoal = weekCount < WEEKLY_GOAL;
    weekCount = Math.min(weekCount + 1, WEEKLY_GOAL);
    streakDays++;
    const goalJustReached = wasBelowGoal && weekCount === WEEKLY_GOAL;
    haptic(goalJustReached ? [10,30,10,30,80] : [10,30,10]);
    showCelebration(goalJustReached);
    saveProgress();
    renderHomeArc();
    updateHomeStats();
    resetSession();

    workout = [];
    activeRoutineName = '';
    document.getElementById('routineTitle').textContent = 'Treino livre';
    document.getElementById('routineSub').textContent = 'Monte sua sessão de hoje';
    renderExercises();
  }

  // ---------- boot: autenticação + carregamento do app ----------
  async function bootApp(){
    document.getElementById('authScreen').classList.remove('show');
    const hasProfile = await loadProgressCloud();
    checkWeekReset();
    await Promise.all([
      loadWorkoutDraftCloud(),
      loadRecordsCloud(),
      loadLastPerfCloud(),
      loadRoutinesCloud(),
      loadHistoryCloud()
    ]);
    DEFAULT_REST = REST_BY_GOAL[userGoal] || 90;
    renderHomeArc();
    updateHomeStats();
    renderHistory();
    renderRecords();
    renderStrengthChips();
    renderChartFromHistory();
    renderExercises();
    buildOnboardOptions();
    if(activeRoutineName){
      document.getElementById('routineTitle').textContent = activeRoutineName;
      document.getElementById('routineSub').textContent = 'Rotina salva';
    }
    if(hasProfile){
      document.getElementById('onboard').classList.remove('show');
    } else {
      obStep = 0; obShow();
      document.getElementById('onboard').classList.add('show');
    }
  }

  let authMode = 'signin';
  function renderAuthMode(){
    document.getElementById('authTitle').textContent = authMode==='signin' ? 'Entrar' : 'Criar conta';
    document.getElementById('authSubmitBtn').textContent = authMode==='signin' ? 'Entrar' : 'Criar conta';
    document.getElementById('authToggle').textContent = authMode==='signin' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar';
    document.getElementById('authError').textContent = '';
  }
  function toggleAuthMode(){ authMode = authMode==='signin' ? 'signup' : 'signin'; renderAuthMode(); }
  function translateAuthError(msg){
    if(/already registered|already exists/i.test(msg)) return 'Esse email já tem conta — tenta entrar.';
    if(/invalid login credentials/i.test(msg)) return 'Email ou senha incorretos.';
    if(/6 characters|at least 6/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if(/valid email/i.test(msg)) return 'Digite um email válido.';
    return 'Algo deu errado — tenta de novo.';
  }
  async function handleAuthSubmit(){
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errEl = document.getElementById('authError');
    errEl.style.color = '#E8674A';
    errEl.textContent = '';
    if(!email || !password){ errEl.textContent = 'Preencha email e senha.'; return; }
    const btn = document.getElementById('authSubmitBtn');
    btn.textContent = 'Aguarde…'; btn.disabled = true;
    try{
      let result;
      if(authMode === 'signup') result = await sb.auth.signUp({ email, password });
      else result = await sb.auth.signInWithPassword({ email, password });
      if(result.error) throw result.error;
      if(authMode === 'signup' && !result.data.session){
        errEl.style.color = 'var(--neon)';
        errEl.textContent = 'Conta criada — confira seu email para confirmar antes de entrar.';
        btn.textContent = 'Criar conta'; btn.disabled = false;
        return;
      }
      currentUser = result.data.user;
      await bootApp();
    }catch(err){
      errEl.textContent = translateAuthError(err.message || '');
      btn.textContent = authMode==='signup' ? 'Criar conta' : 'Entrar';
      btn.disabled = false;
    }
  }
  async function initAuthFlow(){
    const { data:{ session } } = await sb.auth.getSession();
    if(session){
      currentUser = session.user;
      await bootApp();
    } else {
      renderAuthMode();
      document.getElementById('authScreen').classList.add('show');
    }
  }
  initAuthFlow();
