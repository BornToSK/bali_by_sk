import pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]
for name in ['index.html','restaurants.html','guide.js','selection.js','meal-editor-all.js']:
    p=root/name;s=p.read_text('utf-8')
    s=s.replace('72 точки','70 точек').replace('72 точек','70 точек').replace('72 ресторана','70 ресторанов').replace('72 рестораны','70 ресторанов').replace('72 ресторана','70 ресторанов').replace('72 ресторана','70 ресторанов').replace('72 ресторана','70 ресторанов')
    s=s.replace('72','70') if name in ['index.html','restaurants.html','selection.js'] else s
    s=s.replace('all72-v2','balanced70-v3')
    s=s.replace('https://maps.app.goo.gl/Wmbh7BSw7CW9ShjM7','https://maps.app.goo.gl/nnRjtuZ1NpwMso9WA').replace('https://maps.app.goo.gl/BMXyLiWdFD3FvSmh7','https://maps.app.goo.gl/dVKJRWaUCJGBBQHs7')
    if name=='index.html':
        s=s.replace('Все 29 мест и 70 точек питания распределены по дням. Три основных приёма пищи ежедневно плюс кофе, десерты и перекусы. Подъезды включены в карты. Часы части заведений, боксы, катера и подачу еды в Echo Beach ещё нужно подтвердить.','Все 70 точек еды нанесены на карты дней. 11 октября сохранено; 12–22 октября перераспределены. Из 29 желаемых мест 28 в основном плане, дельфины — по желанию. Часы, катера, два бокса и еду в Echo Beach подтвердить.')
        s=s.replace('29 достопримечательностей · предварительное распределение','28 мест в плане + дельфины по желанию')
        s=s.replace('Все 70 точек назначены по одному разу. 36 основных приёмов пищи, 43 остановки на кофе, десерт или перекус; 7 основных приёмов — заранее полученные боксы. В Echo Beach возможность заказа еды не подтверждена.','Все 70 текущих точек назначены по одному разу: основные приёмы пищи и короткие дегустации. Два ранних завтрака — боксы, остальные завтраки при необходимости на вилле. Sundays сохранён только в истории 11 октября. Еду в Echo Beach подтвердить.')
        s=s.replace('Проверка источников: 9 октября 2026; состав списков — локальный снимок 6 октября.','Списки сверены 12 октября 2026. Дорожные цепочки и карты пересчитаны; время в пути остаётся оценкой.')
        s=s.replace('Дороги: OSRM, 08–09.10.2026.','Дороги: OSRM, 08–12.10.2026.')
        s=s.replace('географическая карта всех дорожных маршрутов поездки','географическая карта актуальных дорожных маршрутов поездки')
    if name=='restaurants.html':
        s=re.sub(r'Состав: полный локальный снимок.*?требуют подтверждения\.', 'Состав сверён по вашим двум живым спискам 12 октября: 70 заведений и 29 мест. Дельфины необязательны. 11 октября сохранено, будущие дни перераспределены. Подъезды и часть часов требуют подтверждения.', s)
        s=s.replace('Подтверждаю: других изменений, кроме удаления Diamond Beach и добавления Lovina 8 октября, нет','Мой текущий список из 70 заведений актуален; решение о дельфинах пока не принято')
        s=s.replace('подготовка 9 октября 2026','обновлено 12 октября 2026')
    if name=='selection.js':
        s=s.replace("registry.places.length!==101","registry.places.length!==registry.counts.total_records")
        s=s.replace("list_snapshot_date:'2026-10-06'","list_snapshot_date:'2026-10-12'")
        s=s.replace("role==='meal'?70:29","role==='meal'?registry.counts.restaurants:registry.counts.attractions")
    if name=='guide.js':
        s=s.replace('Все 72 ресторана','Все ${data.restaurant_coverage.length} заведений')
        old="<button data-date=\"${p.planned_date}\">${Number(p.planned_date.slice(-2))} окт ↗</button>"
        new="${p.planned_date?`<button data-date=\"${p.planned_date}\">${Number(p.planned_date.slice(-2))} окт ↗</button>`:`<a href=\"${esc(data.optional_visits.find(v=>v.id===p.id)?.place_url)}\" target=\"_blank\" rel=\"noopener\">По желанию · решение не принято ↗</a>`}"
        s=s.replace(old,new)
        s=s.replace("${r.meal_mode==='packed'?'Согласовать бокс заранее':", "${r.meal_mode==='villa'?'На вилле':r.meal_mode==='packed'?'Согласовать бокс заранее':")
        s=s.replace("d.why)}</p><h4>", "d.why)}</p>${d.historical?'<p>11 октября сохранено без перераспределения; Sundays отсутствует в текущем каталоге.</p>':''}<h4>")
    if name=='meal-editor-all.js':
        s=s.replace("bali-all-cafes-swaps-v1","bali-balanced70-swaps-v3")
        s=s.replace("function locked(id){return", "function locked(id){return g().data.days.some(d=>d.historical&&d.meals.some(m=>m.restaurant_id===id))||")
        s=s.replace("if(m.meal_mode!=='onsite')return;", "if(m.meal_mode!=='onsite'||g().data.days[g().currentDay-1].historical)return;")
        s=s.replace("g().data.days.flatMap(d=>d.meals.filter", "g().data.days.filter(d=>!d.historical).flatMap(d=>d.meals.filter")
        s=s.replace("const wake=['10:30','06:30','06:00','05:45','05:55','06:20','04:10','05:30','04:30','23:15','05:00','07:30'];", "const wake=draft.days.map(d=>d.wake);")
        s=s.replace("if(i===8)continue;", "")
        s=s.replace("m.meal_mode==='onsite'));if(physical.length!==72||new Set(physical.map(m=>m.restaurant_id)).size!==72)", "m.meal_mode==='onsite'&&registry.places.some(p=>p.id===m.restaurant_id)));const expected=registry.counts.restaurants;if(physical.length!==expected||new Set(physical.map(m=>m.restaurant_id)).size!==expected)")
        s=s.replace('Все 72 точки','Все 70 точек')
        s=s.replace("function refresh(){const x=g().data;", "function refresh(){const x=g().data;")
    p.write_text(s,encoding='utf-8')
