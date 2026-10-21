"""Rebuild the October 21-22 remainder from the verified current lists."""
import copy,csv,json,math,pathlib,subprocess,sys,urllib.request,urllib.parse
from concurrent.futures import ThreadPoolExecutor
sys.stdout.reconfigure(encoding='utf-8')
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(n):return json.loads((ROOT/n).read_text('utf8'))
def save(n,v):(ROOT/n).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n','utf8')
def base(n):return json.loads(subprocess.check_output(['git','show','5279373:'+n],cwd=ROOT))
def mins(s):return int(s[:2])*60+int(s[3:5])
def clock(t):return f'{t//60:02}:{t%60:02}'
snapshot=read('latest-lists.json');data=base('itinerary.json');registry=base('registry.json');research=base('restaurant-research.json')
records=registry['places'];byid={p['id']:p for p in records}
for a in read('catalog-additions.json')['records']:
 if a['id']=='r75':p=byid['r21']
 else:
  p=copy.deepcopy(byid['v27'] if a['id']=='v30' else byid['r29']);p['id']=a['id'];records.append(p)
 p.update(name=a['name'],place_url=a['place_url'],assigned_date=None)
 if a['id'] in ('r73','r74'):p.pop('dining_research',None)
 p['coordinates']=dict(lat=a['lat'],lon=a['lon'],status='Google Maps card verified 2026-10-21',source_url=a['place_url'])
 p['address']=dict(value=a['details'].split('\n')[-1].split('\n')[0],status='Google Maps 2026-10-21')
 p['area']=dict(value='Нуса-Дуа' if p['id']=='v30' else 'Убуд' if p['id']=='r73' else 'Улувату' if p['id']=='r74' else 'Унгасан',status='map_location')
for p in records:
 if p['name'].startswith('Analog Uluwatu'):p['name']='Analog Uluwatu | All Day Cafe'
registry['places']=[p for p in records if p['name'] in snapshot['food_names']+snapshot['sight_names']]
byid={p['id']:p for p in registry['places']}
for proof in read('place-verification.json')['records']+read('meal-verification.json')['records']:
 p=next(p for p in registry['places'] if p['name']==proof['name'])
 p.update(place_url=proof['place_url'],verification_note=proof['details'],operating_status='card_checked_2026-10-21_access_not_guaranteed')
 p['coordinates']=dict(lat=proof['lat'],lon=proof['lon'],status='Google Maps card verified 2026-10-21',source_url=proof['place_url'])
ratings={r['name']:r for r in read('food-ratings.json')['records']}
CHOICES={'r02':'Лёгкий обед у Jatiluwih без крюка; короткий визит, быстрый заказ согласовать.','r18':'Ужин в Berawa по дороге с севера; 4,8 и разнообразная кухня.','r21':'Обед между пляжами юга; 4,8, четверг 07:00-22:00 по карточке.'}
for id,a,b in [('r02',480,1020),('r18',600,1380),('r21',420,1320)]:
 p=byid[id];research[id].update(name=p['name'],source=p['place_url'],checked='2026-10-21',planning_windows=[[a,b]],hours_label={'r02':'Сегодня открыт, закрытие 17:00 по Google Maps','r18':'Сегодня открыт, закрытие 23:00 по Google Maps','r21':'Четверг 07:00-22:00 по недельному расписанию Google Maps'}[id],hours_status='google_card_checked',booking_required=False)
points={p['id']:dict(id=p['id'],name=p['name'],role=p['roles'][0],lat=p['coordinates']['lat'],lon=p['coordinates']['lon'],place_url=p['place_url']) for p in registry['places']}
points.update({p['id']:p for p in [data['hotel'],*data['logistics_points']]})
plans={21:['v19',('r02','lunch'),'v21','v03','v17',('r18','dinner')],22:['checkout','v26','v25',('r21','lunch'),'v30','v27','v28','v24','baggage']}
duration={'v19':40,'v21':45,'v03':20,'v17':35,'v26':60,'v25':60,'v30':30,'v27':20,'v28':20,'v24':25}
reserve={'v18':'Не помещается в северный круг после позднего старта. Можно заменить Jatiluwih, но не добавить сверху.','v22':'Отдельная поездка в Чангу. Не добавлять к южным пляжам в день вылета.'}
def route_pairs(plan):
 cur='hotel';out=[]
 for item in plan:
  dest=item[0] if isinstance(item,tuple) else item
  if dest in ('checkout','baggage'):dest='hotel'
  if cur!=dest:out.append((cur,dest));cur=dest
 if cur!='hotel':out.append((cur,'hotel'))
 return out
pairs=set(p for plan in plans.values() for p in route_pairs(plan));pairs.add(('hotel','airport'))
def fetch(pair):
 a,b=map(points.get,pair);url='https://router.project-osrm.org/route/v1/driving/'+f"{a['lon']},{a['lat']};{b['lon']},{b['lat']}"+'?overview=full&geometries=geojson&steps=true'
 with urllib.request.urlopen(url,timeout=45) as response:r=json.load(response)['routes'][0]
 km=round(r['distance']/1000,1);engine=r['duration']/60;plan=math.ceil((engine*1.5+(5 if km<5 else 12))/5)*5
 toll=any('tol' in s.get('name','').lower().split() or 'toll' in s.get('name','').lower() or any('motorway' in i.get('classes',[]) for i in s.get('intersections',[])) for l in r['legs'] for s in l['steps'])
 return '>'.join(pair),dict(key='>'.join(pair),origin=a['id'],destination=b['id'],geometry=r['geometry'],distance_km=km,engine_minutes=round(engine,1),plan_minutes=plan,range_minutes=[max(5,plan-10),plan+20],source=url,checked='2026-10-21',routing_policy='tolls_allowed_v1',uses_toll=toll,avoided_toll=False,note='Платные дороги разрешены. OSRM: автомобильная геометрия, время с запасом без прогноза пробок. На Bali Mandara для байка отдельная полоса.')
cache=read('road-cache.json')
with ThreadPoolExecutor(max_workers=4) as pool:
 for k,v in pool.map(fetch,pairs):cache[k]=v
save('road-cache.json',cache)
def build(date):
 t=mins('11:30' if date==21 else '09:00');cur='hotel';rows=[];legs=[];stops=[];num=0
 def row(kind,title,dur,**kw):
  nonlocal t
  r=dict(kind=kind,title=title,start=clock(t),end=clock(t+dur),duration_minutes=dur,**kw);rows.append(r);t+=dur;return r
 def wait(until,title='Запас до временного окна'):
  if until>t:row('buffer',title,until-t)
 def road(dest):
  nonlocal cur
  if cur==dest:return
  l=copy.deepcopy(cache[cur+'>'+dest]);l.update(index=len(legs),returning=dest in ('hotel','airport'),navigation_url='https://www.google.com/maps/dir/?'+urllib.parse.urlencode(dict(api=1,origin=f"{points[cur]['lat']},{points[cur]['lon']}",destination=f"{points[dest]['lat']},{points[dest]['lon']}",travelmode='driving')));legs.append(l)
  row('road',points[cur]['name']+' → '+points[dest]['name'],l['plan_minutes'],leg_index=l['index'],distance_km=l['distance_km'],range_minutes=l['range_minutes'],navigation_url=l['navigation_url'],note=l['note']);cur=dest
 if date==22:
  t=480;row('meal','Завтрак · на вилле',45,restaurant_id='hotel',place_id='hotel',meal_type='breakfast',meal_mode='villa',place_url=data['hotel']['place_url'],source_url=data['hotel']['place_url'],checked='2026-10-21',note='Завтрак с 08:00 по вашему сообщению.');wait(540,'Сборы после завтрака')
 else:row('logistics','Начало оставшейся программы',0,note='Сегодня уже позднее утро. Выезд 11:30 — план; если позже, сокращать северный круг. Утро не отмечено как состоявшиеся посещения.')
 for item in plans[date]:
  id=item[0] if isinstance(item,tuple) else item
  if id in ('checkout','baggage'):
   road('hotel');row('logistics','Checkout и хранение багажа' if id=='checkout' else 'Багаж, переодевание и возврат байка',45,note='Хранение багажа и душ после checkout согласовать.');continue
  road(id);num+=1;p=copy.deepcopy(points[id]);p['number']=num
  if isinstance(item,tuple):
   h=research[id];kind=item[1];dur=30 if id=='r02' else 75 if id=='r18' else 60
   wait(720 if kind=='lunch' else 1020)
   assert any(t>=a and t+dur<=b for a,b in h['planning_windows']),(id,clock(t))
   row('meal',('Обед' if kind=='lunch' else 'Ужин')+' · '+p['name'],dur,number=num,restaurant_id=id,place_id=id,meal_type=kind,meal_mode='onsite',place_url=p['place_url'],source_url=h['source'],checked=h['checked'],hours_label=h['hours_label'],hours_status=h['hours_status'],booking_required=False,note='Согласовать быстрый заказ; это короткий обед. Кухню и последний заказ уточнить.' if id=='r02' else 'Стол, меню и последний заказ подтвердить.')
  else:
   if id=='v24':wait(960)
   row('visit',p['name'],duration[id],number=num,place_id=id,place_url=p['place_url'],note='Короткий осмотр, время включает подход. При задержке сокращать программу с учётом закрытия.' if date==21 else 'Время включает подход и осмотр. Купание определяется волнами, флагами и спасателями. Waterblow только смотровая.');row('buffer','Парковка, вода и переход',5)
  stops.append(p)
 road('hotel')
 if date==22:
  wait(1200,'Запас перед трансфером в аэропорт');road('airport');assert t<=1290,('airport late',clock(t));row('logistics','DPS · международный терминал',0,note='Вылет 23 октября 00:30. Ужин после регистрации в аэропорту по желанию; без отдельного ресторанного крюка.')
 else:row('logistics','Возвращение на Nunamkhalu',0,note='Все ночи на одной вилле.')
 return dict(number=date-20,date=f'2026-10-{date}',weekday='среда' if date==21 else 'четверг',title='Террасы, Farm House и озёра' if date==21 else 'Пляжи юга, Jaran Hill и аэропорт',subtitle=' → '.join(s['name'] for s in stops if s['role']=='visit'),image='rice' if date==21 else 'coast',wake='Утро уже прошло' if date==21 else '07:30',depart='11:30' if date==21 else '09:00',return_time=clock(t),island=False,last=date==22,timeline=rows,legs=legs,route_stops=stops,stops=[s for s in stops if s['role']=='visit'],meals=[r for r in rows if r['kind']=='meal'],alternatives=[],distance_km_known=round(sum(l['distance_km'] for l in legs),1),road_minutes=sum(l['plan_minutes'] for l in legs),missing_legs=0,load='Высокая',why='Jatiluwih, короткий обед, Farm House до 17:00, Buyan и Beratan. Leke Leke и Nuanu в резерве; при позднем выезде сокращать круг.' if date==21 else 'После checkout южные пляжи без поездки на север или остров. Jaran Hill до сумерек, затем багаж и отдельный трансфер в аэропорт.',risk='Время в пути оценочное. Вход, парковку, погоду и текущий доступ проверить. При отставании пропустить осмотр и сохранить время аэропорта.',notes=[])
days=[build(n) for n in plans]
for d in days:print(d['date'],d['depart'],d['return_time'],[(r['title'],r['start'],r['end']) for r in d['timeline'] if r['kind'] in ('visit','meal')],flush=True)
for id,closing in [('v21','17:00'),('v17','18:15'),('v28','18:00'),('v24','18:15')]:
 r=next(r for d in days for r in d['timeline'] if r.get('place_id')==id);assert r['end']<=closing,(id,r['end'],closing)
coverage=[];selected=set(CHOICES)
for p in registry['places']:
 p['assigned_date']=next((d['date'] for d in days if any(s['id']==p['id'] for s in d['route_stops'])),None);p['schedule_status']='planned' if p['assigned_date'] else 'reserve';p['source_list'].update(snapshot_date='2026-10-21',current_membership_confirmed=True)
 if 'meal' in p['roles']:
  p.update(curated=p['id'] in selected,review_snapshot=ratings[p['name']],selection_reason=CHOICES.get(p['id'],'Резерв: выбрать вместо основного ресторана, без дополнительного крюка.'))
  if p['id'] in research:p['dining_research']=research[p['id']]
 else:coverage.append(dict(id=p['id'],name=p['name'],planned_date=p['assigned_date'],status=p['schedule_status'],reason=reserve.get(p['id'],''),place_url=p['place_url']))
restaurants=[dict(id=p['id'],name=p['name'],date=p['assigned_date'],rating=p['review_snapshot']['rating'],reviews=p['review_snapshot']['reviews'],reason=p['selection_reason'],visits=[dict(date=d['date'],start=m['start'],end=m['end'],mode='onsite',meal_type=m['meal_type']) for d in days for m in d['meals'] if m['restaurant_id']==p['id']]) for p in registry['places'] if p.get('curated')]
data.update(created='2026-10-21',trip_start='2026-10-21',trip_end='2026-10-22',status='remaining_two_days',days=days,coverage=coverage,optional_visits=[dict(id=p['id'],name=p['name'],place_url=p['place_url'],reason=reserve[p['id']]) for p in registry['places'] if p['id'] in reserve],restaurant_coverage=restaurants,restaurant_reserve=[dict(id=p['id'],name=p['name'],place_url=p['place_url']) for p in registry['places'] if 'meal' in p['roles'] and not p.get('curated')],restaurant_selection=dict(unique_onsite_restaurants=3,catalog_restaurants=54,reserve_restaurants=51),additional_activities=[],schedule_updates=[],user_list_updates=[dict(date='2026-10-21',source='Повторная живая сверка обоих списков; пользователь подтвердил, что в списках только оставшееся')],list_verification='21 октября повторно сверены списки: 54 заведения и 12 мест. Карточки и координаты всех 12 мест и выбранных ресторанов перепроверены. В программе 10 мест; Leke Leke и Nuanu в резерве.')
data['limitations']=['В двух днях запланированы 10 из 12 мест. Leke Leke и Nuanu сохранены в резерве, не считаются посещёнными или назначенными.','21 октября выезд 11:30 с Nunamkhalu. Если позже, сокращайте северный круг. Визиты короткие, особенно Farm House и храмы.','22 октября checkout до 12:00, хранение багажа и душ по согласованию. Аэропорт не позже 21:30; вылет 23 октября 00:30. Возврат байка и трансфер с багажом отдельные.','Еда: 3 выбранных заведения из 54; остальные 51 в резерве. Завтрак 22-го на вилле; ужин после регистрации в аэропорту по желанию. Посещения и бронирования не подтверждены.','Все ночи на Nunamkhalu. Платные дороги разрешены; на Bali Mandara для байка отдельная полоса. OSRM: автомобильная геометрия, время без прогноза пробок.','Сверка карточек не подтверждает доступность входа, парковку и пеший подход. У Buyan, Geger и Jaran часы не указаны. Прилив не является разрешением на купание.','Пенида удалена из текущего списка. Старые активности 16 октября не назначены повторно и не отмечены автоматически посещёнными.','PDF содержит основной вариант; изменения еды в браузере не меняют PDF автоматически.']
data['sources']=[dict(name='Живой список еды: 54 заведения',url=snapshot['food_url'],checked='2026-10-21'),dict(name='Живой список мест: 12 точек',url=snapshot['sights_url'],checked='2026-10-21')]+[dict(name=p['name']+' · Google Maps',url=p['place_url'],checked='2026-10-21') for p in registry['places'] if 'visit' in p['roles'] or p['id'] in selected]
data['tide_notice']='Время Бали, WITA / UTC+8. Точный прогноз приливов на 22 октября проверяется отдельно; старые времена на 16 октября не перенесены. Волны, течения и флаги важнее календарного окна.'
registry.update(created_date='2026-10-21',source=data['list_verification'],counts=dict(attractions=12,scheduled_attractions=10,optional_attractions=2,restaurants=54,selected_restaurants=3,reserve_restaurants=51,total_records=66),meal_capacity=dict(restaurant_count=54,selected_restaurants=3,note='Три заведения по пути, без попытки посетить весь список.'))
from tides import apply_tides
apply_tides(data)
save('itinerary.json',data);save('registry.json',registry);save('restaurant-research.json',research)
with (ROOT/'coverage.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['id','name','date','type','status'])
 for p in registry['places']:w.writerow([p['id'],p['name'],p['assigned_date'] or '','meal' if 'meal' in p['roles'] else 'visit',p['schedule_status']])
