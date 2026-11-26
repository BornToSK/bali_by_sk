'use strict';
(() => {
  const scenes=[
    {n:'02',en:'Ocean & Cliffs',title:'Там, где скалы встречают океан',copy:'Пандава и Меласти. Первый день начинается на южном берегу Букита.',art:'coast',day:1,tone:'ocean'},
    {n:'03',en:'Into the Jungle',title:'Вода под пологом джунглей',copy:'Канто Лампо и Тибумана, затем дорога к Тегаллалангу.',art:'beyond-jungle',day:3,tone:'deep'},
    {n:'04',en:'Rice Terraces',title:'Зелёный рисунок склонов',copy:'Джатилувих, водопад Леке Леке и вечер в Чангу.',art:'rice',day:11,tone:'olive'},
    {n:'05',en:'Beyond the Island',title:'За проливом — Пенида',copy:'Утренний катер из Санура и запад острова за один день.',art:'penida',day:7,tone:'ocean'},
    {n:'06',en:'Northern Bali',title:'Ловина до рассвета',copy:'Ночной выезд через Бедугул, лодка на рассвете и Брахмавихара-Арама.',art:'bukit-journal',day:10,tone:'deep'},
    {n:'07',en:'Taste of Bali',title:'Остров за столом',copy:'72 точки питания по маршруту: от раннего кофе до ужина у воды.',art:'coast',link:'restaurants.html',tone:'sand'},
    {n:'08',en:'Your Journey',title:'Путешествие в вашем ритме',copy:'Двенадцать дней. Выберите главу и откройте её карту и расписание.',art:'penida',link:'#overviewHeading',tone:'olive'}
  ];
  const os=matchMedia('(prefers-reduced-motion: reduce)');
  const mode=()=>window.BaliPassport?.motion?.()||document.documentElement.dataset.baliMotion||(os.matches?'reduced':'balanced');
  const directDay=day=>`#day-${day}`;
  function openDay(event) {
    const day=Number(event.currentTarget.dataset.storyDay);
    if (window.__guide && day) {
      event.preventDefault();
      window.__guide.selectDay(day,true);
    }
  }
  addEventListener('hashchange',()=>{
    const match=location.hash.match(/^#day-(\d+)$/);
    if(match && window.__guide && Number(match[1])!==window.__guide.currentDay) window.__guide.selectDay(Number(match[1]),true);
  });

  function artwork(art,small=false) {
    return 'assets/'+art+(small && art!=='bukit-journal' ? '-card' : '')+'.webp';
  }
  function story() {
    const section=document.getElementById('beyondStory');
    const visual=document.getElementById('beyondStoryImage');
    const track=document.getElementById('beyondStoryTrack');
    let current=-1;
    track.innerHTML=scenes.map((s,i)=>`<article class="beyond-story-chapter" data-chapter="${i}">
      <img data-lazy-src="${artwork(s.art,true)}" width="640" height="426" alt="">
      <div class="beyond-story-copy"><p class="beyond-kicker">${s.n} / ${s.en}</p><h3>${s.title}</h3><p>${s.copy}</p>
      <a href="${s.link||directDay(s.day)}" ${s.day?'data-story-day="'+s.day+'"':''}>${s.day?'Открыть день '+s.day:s.link.startsWith('#')?'Выбрать день':'Каталог заведений'} ↗</a></div>
    </article>`).join('');
    const chapters=[...track.children];
    loadEditorialImages(track);
    chapters.forEach(c=>c.querySelector('[data-story-day]')?.addEventListener('click',openDay));
    function show(i) {
      if(i===current)return;
      current=i;
      const s=scenes[i];
      section.dataset.tone=s.tone;
      const path=artwork(s.art);
      const next=new Image();
      next.src=path;
      next.decode().catch(()=>{}).then(()=>{
        if(current!==i||!next.naturalWidth)return;
        visual.src=path;
        if(mode()!=='reduced') visual.animate([{clipPath:'inset(2% 12% 2% 0)',transform:'scale(1.05)'},{clipPath:'inset(0)',transform:'scale(1)'}],{duration:650,easing:'cubic-bezier(.2,.65,.3,1)'});
      });
      document.getElementById('beyondStoryIndex').textContent=s.n+' / 08';
      document.getElementById('beyondStoryName').textContent=s.en;
      chapters.forEach((chapter,index)=>chapter.toggleAttribute('data-active',index===i));
    }
    const mobile=matchMedia('(max-width: 760px)');
    let pending=false;
    function setup() {
      if (mobile.matches || pending) return;
      pending=true;
      requestAnimationFrame(()=>{
        pending=false;
        const rect=section.getBoundingClientRect();
        if(rect.bottom<0||rect.top>innerHeight)return;
        const mid=innerHeight*.49;
        let nearest=Infinity, selected=0;
        for(const chapter of chapters){
          const r=chapter.getBoundingClientRect();
          const distance=Math.abs(mid-(r.top+r.bottom)/2);
          if(distance<nearest){nearest=distance;selected=Number(chapter.dataset.chapter);}
        }
        show(selected);
      });
    }
    mobile.addEventListener('change',setup);
    addEventListener('scroll',setup,{passive:true});
    addEventListener('resize',setup);
    setup();
  }

  function diary() {
    const entries=[scenes[0],scenes[3],scenes[2],scenes[4]];
    const grid=document.getElementById('beyondDiaryGrid');
    const dialog=document.getElementById('beyondLightbox');
    let current=0,trigger;
    grid.innerHTML=entries.map((s,i)=>`<button type="button" class="beyond-print" data-print="${i}">
      <img data-lazy-src="${artwork(s.art,true)}" alt="" width="640" height="426">
      <span>${s.en}</span><small>День ${s.day} · AI-иллюстрация</small>
    </button>`).join('');
    loadEditorialImages(grid);
    function render() {
      const s=entries[current];
      const img=dialog.querySelector('img');
      img.src=artwork(s.art);
      img.alt='Сгенерированная иллюстрация · '+s.title;
      dialog.querySelector('h3').textContent=s.title;
      dialog.querySelector('output').textContent=(current+1)+' / '+entries.length;
      const link=dialog.querySelector('[data-story-day]');
      link.href=directDay(s.day);
      link.dataset.storyDay=s.day;
    }
    function advance(delta) {
      current=(current+delta+entries.length)%entries.length;
      render();
    }
    const modalImage=dialog.querySelector('img');
    for(const button of grid.querySelectorAll('button')) button.onclick=()=>{
      current=Number(button.dataset.print);
      trigger=button;
      const thumbnail=button.querySelector('img');
      function open(){render();dialog.showModal();}
      if(!document.startViewTransition||mode()==='reduced'){open();return;}
      thumbnail.style.viewTransitionName='bali-diary-frame';
      const transition=document.startViewTransition(()=>{
        thumbnail.style.viewTransitionName='';
        open();
        modalImage.style.viewTransitionName='bali-diary-frame';
      });
      transition.finished.catch(()=>{}).finally(()=>{
        thumbnail.style.viewTransitionName='';
        modalImage.style.viewTransitionName='';
      });
    };
    for(const b of dialog.querySelectorAll('[data-gallery-step]')) b.onclick=()=>advance(Number(b.dataset.galleryStep));
    dialog.querySelector('[data-story-day]').onclick=e=>{dialog.close();openDay(e);};
    dialog.addEventListener('close',()=>trigger?.focus({preventScroll:true}));
    dialog.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();advance(e.key==='ArrowLeft'?-1:1);}
    });
  }

  function camera() {
    const stage=document.getElementById('top');
    const fine=matchMedia('(pointer:fine)');
    let visible=true,frame=0,x=0,y=0;
    function paint(){
      frame=0;
      stage.style.setProperty('--beyond-x',x.toFixed(3));
      stage.style.setProperty('--beyond-y',y.toFixed(3));
    }
    function reset(){x=y=0;if(!frame)frame=requestAnimationFrame(paint);}
    stage.addEventListener('pointermove',event=>{
      if(!fine.matches||!visible||mode()==='reduced')return;
      const r=stage.getBoundingClientRect();
      const strength=mode()==='full'?1:.58;
      x=((event.clientX-r.left)/r.width-.5)*strength;
      y=((event.clientY-r.top)/r.height-.5)*strength;
      if(!frame)frame=requestAnimationFrame(paint);
    },{passive:true});
    stage.addEventListener('pointerleave',reset);
    document.addEventListener('bali-motion-changed',reset);
    if('IntersectionObserver' in window) new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting;
      if(!visible)reset();
    }).observe(stage);
    let scheduled=false;
    addEventListener('scroll',()=>{
      if(!scheduled){
        scheduled=true;
        requestAnimationFrame(()=>{
          document.documentElement.classList.toggle('beyond-compact-nav',scrollY>90);
          scheduled=false;
        });
      }
    },{passive:true});
  }
  story();
  diary();
  camera();
})();
