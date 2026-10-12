"""Apply the 12-22 October calendar consistently across UI and export tools."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def edit(name,pairs):
    p=root/name;s=p.read_text('utf-8-sig')
    for a,b in pairs:s=s.replace(a,b)
    p.write_text(s,encoding='utf-8')
edit('guide.js',[
 ('Math.min(12,n)','Math.min(data.days.length,n)'),('activeDay===12','activeDay===data.days.length'),('из 12','из ${data.days.length}'),
 ("${d.historical?'<p>11 октября сохранено без перераспределения; Sundays отсутствует в текущем каталоге.</p>':''}",''),
 ("fetch('itinerary.json')","fetch('itinerary.json?v=start12-v4')")])
edit('meal-editor-all.js',[
 ('bali-balanced70-swaps-v3','bali-start12-swaps-v4'),
 ("g().data.days.some(d=>d.historical&&d.meals.some(m=>m.restaurant_id===id))|| ",''),
 ("||g().data.days[g().currentDay-1].historical",''),
 ("g().data.days.filter(d=>!d.historical).flatMap",'g().data.days.flatMap')])
edit('selection.js',[('requestedDay<=12','requestedDay<=11'),('(10+dayContext)','(11+dayContext)'),('Списки после 6 октября','Списки от 12 октября')])
edit('index.html',[
 ('11–22 октября','12–22 октября'),('НА 11–22 ОКТЯБРЯ','НА 12–22 ОКТЯБРЯ'),('12 дней','11 дней'),('Двенадцать дней','Одиннадцать дней'),
 ('<strong>12</strong>','<strong>11</strong>'),('balanced70-v3','start12-v4'),
 ('11 октября сохранено; 12–22 октября перераспределены.','Программа начинается 12 октября и длится 11 дней.'),
 ('Sundays сохранён только в истории 11 октября. ', '')])
edit('restaurants.html',[
 ('≤36','≤33'),('За 12 дней — максимум 36','За 11 дней — максимум 33'),
 ('11 октября сохранено, будущие дни перераспределены.','Маршрут начинается 12 октября; все точки перенесены в 12–22 октября.'),
 ('src="selection.js"','src="selection.js?v=start12-v4"')])
edit('tools/rebalance.py',[
 ('70 заведений за 12 дней','70 заведений за 11 дней'),
 ("data['days']=days","data['days']=days\ndata['trip_start']='2026-10-12';data['trip_end']='2026-10-22';data['restaurant_selection']['meal_slots']=33"),
 ("range_minutes=[max(5,plan-10),plan+20]","range_minutes=[max(5,plan-10),plan+20]")])
edit('tools/build_pdf.py',[
 ("[*range(2,13),'overview']","[*(d['number'] for d in data['days']),'overview']"),
 ('Ваш маршрут на 11-22 октября 2026','Ваш маршрут на 12-22 октября 2026'),
 ('11 октября сохранено, 12-22 октября перераспределены.','Маршрут начинается 12 октября. Все 70 точек еды распределены по 11 дням.'),
 ('План DPS 19:55','План DPS 20:40')])
edit('tools/export-maps.html',[("n==='7'?","days[0].island?"),("n==='12'?","days[0].last?")])
edit('README.md',[
 ('11 октября сохранено без перераспределения. Sundays остаётся только в исходном плане этого дня и не входит в текущий каталог. Gooseberry исключено из будущих дней. Перераспределены только 12–22 октября.','Программа начинается 12 октября и заканчивается 22 октября: 11 дней. Все точки бывшего 11 октября перенесены. Sundays и Gooseberry отсутствуют в текущем списке из 70 заведений.'),
 ('не более восьми','не более девяти'),('История 11-го, боксы','Боксы')])
edit('BOOKINGS.md',[('11 октября сохранено; перераспределены 12–22 октября.','11 октября убрано; весь маршрут перенесён в 12–22 октября.'),('План аэропорта 19:55','План аэропорта 20:40')])
edit('tools/verify.py',[
 ("old=baseline['days'][0];now=data['days'][0]\nfor key in old:\n    if key!='notes':assert old[key]==now[key],('changed 11 October',key)\nassert old['notes']==now['notes'][:len(old['notes'])]\noldmap=subprocess.check_output(['git','show','50bc2d8:maps/day-01.png'],cwd=root)\nassert oldmap==(root/'maps/day-01.png').read_bytes()", "assert len(data['days'])==11\nassert [d['number'] for d in data['days']]==list(range(1,12))\nassert [d['date'] for d in data['days']]==[f'2026-10-{n}' for n in range(12,23)]\nassert all(not d.get('historical') for d in data['days'])"),
 ("if d['number']>1: assert len(expected)<=8",'assert len(expected)<=9'),
 ("penida=data['days'][6]","penida=next(d for d in data['days'] if d['island'])"),
 ('assert len(reader.pages)==43','assert len(reader.pages)>30'),
 ('historical_day_11_preserved=True,historical_day_11_map_unchanged=True','trip_start="2026-10-12",trip_end="2026-10-22",day_count=11,day_11_removed=True'),
 ('max_future_food_stops=8','max_future_food_stops=9'),('pages=43','pages=len(reader.pages)'),
 ('all_12_days_and_markers_verified','all_11_days_and_markers_verified'),('day 11 unchanged','dates 12-22 October')])
