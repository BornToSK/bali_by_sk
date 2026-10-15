"""Rebuild the 67-stop itinerary, including road geometry and coverage.

Run from the repository root. The checked-in initial commit is the baseline;
cached roads are reused, new roads are fetched from OSRM without fabricated lines.
"""
import copy, csv, json, math, pathlib, subprocess, urllib.request, urllib.parse
import sys
sys.stdout.reconfigure(encoding='utf-8')
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = '50bc2d8502b76166cda1b919546b1234bcdf99a3'
def baseline(name):
    return json.loads(subprocess.check_output(['git', 'show', f'{BASE}:{name}'], cwd=ROOT))
def save(name, value):
    (ROOT/name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
data, registry = baseline('itinerary.json'), baseline('registry.json')
research = baseline('restaurant-research.json')
cache = json.loads((ROOT/'road-cache.json').read_text(encoding='utf-8'))
points = {p['id']: dict(id=p['id'], name=p['name'], role=p['roles'][0],
    lat=p['coordinates']['lat'], lon=p['coordinates']['lon'], place_url=p['place_url'],
    coordinate_status=p['coordinates']['status']) for p in registry['places']}
points.update({p['id']:p for p in [data['hotel'], *data['logistics_points']]})
oldlegs = {l['key']:l for d in data['days'] for l in d['legs']}
visits = {r['place_id']:r for d in data['days'] for r in d['timeline'] if r['kind']=='visit'}
def minutes(t): return int(t[:2])*60+int(t[3:5])
def clock(t): return f'{t//60:02}:{t%60:02}'
def food(id, kind='coffee'): return (id,kind)
# Geographic blocks, with all 67 restaurants visited once. All departures follow the hotel breakfast.
plans = {
5:['v01','free-lunch','v14','v15',food('r50','dinner'),food('r55'),food('r21'),food('r63'),food('r65')],
6:[food('r13'),'v16',food('r69','lunch'),food('r25'),food('r05'),food('r11'),food('r03'),food('r08'),food('r09'),food('r06'),food('r10'),food('r04','dinner')],
7:['v07','v05','v06','v04',food('r01','lunch'),'return-boat',food('r62','dinner'),food('r46'),food('r57'),food('r56'),food('r20'),food('r64')],
8:['v26','v25',food('r19','lunch'),'v27','v28',food('r72','dinner'),food('r23'),food('r66'),food('r22'),food('r47'),food('r51')],
9:['v18','v19',food('r02','lunch'),'v21',food('r70'),'v03','v17',food('r18','dinner'),food('r43'),food('r15'),food('r14')],
10:[food('r34'),food('r42'),food('r33'),food('r41','lunch'),food('r36'),food('r17'),food('r32'),'v22',food('r37'),food('r07'),food('r16'),food('r35','dinner'),food('r38'),food('r40'),food('r39')],
11:[food('r68'),food('r24'),'v09','v10','v11',food('r29','lunch'),food('r26'),food('r27'),food('r30'),food('r31','dinner'),food('r12')],
12:['checkout',food('r61'),food('r48'),food('r53'),food('r67','lunch'),food('r54'),food('r45'),food('r49'),'v24',food('r71'),food('r59','dinner'),'baggage'],
}
titles={4:'Пандава и Melasti: пляжи и купание',5:'Тегаллаланг, Sari Timbul и Кинтамани',6:'Бесаких, водопад и восточные пляжи',7:'Запад Пениды и заведения юга',8:'Crystal Bay, Amok и Чангу',9:'Террасы, озёра и северный круг',10:'Чангу и Nuanu',11:'Marine Safari, Sanur и Убуд',12:'Jaran Hill, Boneka и аэропорт'}
starts={n:'09:00' for n in plans}
starts[7]='06:50'  # Early Penida departure explicitly authorized by user on 15 October.
titles[7]='Пенида за один день: четыре места и Amok'
titles[8]='Пандава, Melasti и Нуса-Дуа'
titles[5]='Marine Safari, Blue Lagoon и Bias Tugel'
titles[6]='Тегаллаланг, Sari Timbul и Кинтамани'
titles[11]='Бесаких, Tukad Cepung и заведения Убуда'
why={4:'Первый день программы посвящён купанию: 1 час на Пандаве и 1 час 45 минут на Melasti. Утром короткие осмотры Нуса-Дуа; Waterblow без купания. Обед и ужин включены, без цепочки из девяти кафе.',5:'Северные заведения Убуда и Sari Timbul расположены по дороге к кафе Кинтамани. Часы закрытия определяют порядок кафе; день очень насыщенный.',7:'Катер 11:00 после завтрака. Kelingking только сверху, без спуска; на острове отдельная машина. Готовый обед купить до регистрации. Все ночи на вилле.',8:'Вторая поездка на Пениду: Crystal Bay и Amok, затем заведения Чангу. Короткое посещение Crystal Bay; для купания выделен первый день.',9:'Северный круг с водителем. Farm House до закрытия, затем озёра. Кафе юга посещаются на обратном пути.',10:'Все 14 заведений Чангу сохранены по вашему выбору: преимущественно небольшие порции. Это самый плотный день.',11:'Marine Safari и южные заведения Убуда объединены в один день. Последний вход Safari до 14:00; северные заведения Убуда стоят 15-го.',12:'После завтрака checkout, только южный полуостров. Jaran Hill без ожидания заката, ужин Boneka, затем багаж и DPS.'}

why[7]='Единственный день Пениды: четыре короткие смотровые и обед Amok. Kelingking только сверху, Crystal Bay без купания, Angel’s Billabong без входа в воду. Машина с водителем обязательна; ранний катер требует отдельного подтверждения.'
why[8]='Сначала Пандава и Melasti подряд, затем обед, короткие посещения Mengiat и Waterblow и ужин Koral. После Koral - небольшие заказы в заведениях юга; день очень насыщенный.'
why[9]='Северный круг, затем заведения Чангу на обратном пути. Farm House до закрытия; день с водителем и короткими остановками.'
why[5]='Сначала Marine Safari, затем обед и два пляжа Падангбая рядом друг с другом. Без дальнего заезда к Бесаких; дополнительные осмотры только при запасе времени.'
why[6]='Заведения Тегаллаланга и Sari Timbul по дороге к Кинтамани. Короткие дегустации сохраняют время на сон перед ранним выездом на Пениду.'
why[11]='Бесаких и Tukad Cepung перенесены с восточных пляжей в отдельный круг с возвратом через Убуд. День плотный; рекомендуется водитель.'

def nav(a,b):
    return 'https://www.google.com/maps/dir/?'+urllib.parse.urlencode(dict(api=1,origin=f"{a['lat']},{a['lon']}",destination=f"{b['lat']},{b['lon']}",travelmode='driving'))
def fetchroad(pair):
    a,b=map(points.get,pair); key='>'.join(pair)
    if key in cache and cache[key].get('routing_policy')=='tolls_allowed_v1':return key,copy.deepcopy(cache[key])
    coords=f"{a['lon']},{a['lat']};{b['lon']},{b['lat']}"
    base='https://router.project-osrm.org/route/v1/driving/'
    url=base+coords+'?overview=full&geometries=geojson&steps=true'
    def get(url):
        with urllib.request.urlopen(url,timeout=45) as res: return json.load(res)['routes'][0]
    route=get(url)
    def toll(r):
        return any('tol' in s.get('name','').lower().split() or 'toll' in s.get('name','').lower() or
            any('motorway' in i.get('classes',[]) for i in s.get('intersections',[]))
            for l in r['legs'] for s in l['steps'])
    uses_toll=toll(route)
    distance=round(route['distance']/1000,1); engine=route['duration']/60
    plan=math.ceil((engine*1.5+(5 if distance<5 else 12))/5)*5
    return key,dict(key=key,origin=a['id'],destination=b['id'],geometry=route['geometry'],
        distance_km=distance,engine_minutes=round(engine,1),plan_minutes=plan,
        range_minutes=[max(5,plan-10),plan+20],source=url,checked='2026-10-15',planning_checked='2026-10-15',
        status='car_road_geometry_scooter_access_not_fully_verified',avoided_toll=False,uses_toll=uses_toll,routing_policy='tolls_allowed_v1',
        road_names=sorted(set(s.get('name','') for l in route['legs'] for s in l['steps'])),
        note=('Через Bali Mandara, платная дорога разрешена. Для байка использовать отдельную мотоциклетную полосу; линия карты рассчитана для автомобиля. ' if uses_toll else 'Платные дороги разрешены; здесь выбран обычный дорожный маршрут. ')+ 'Геометрия OSRM, время с запасом без прогноза пробок.')

def roadpairs(n,plan):
    current='hotel'; pairs=[]
    if n==7: pairs.append(('hotel','sanur'));current='penida-port'
    for item in plan:
        dest=item[0] if isinstance(item,tuple) else item
        if dest=='free-lunch':continue
        if dest in ('checkout','baggage'): dest='hotel'
        if dest=='return-boat':
            pairs.append((current,'penida-port'));current='sanur';continue
        pairs.append((current,dest));current=dest
    if current!='hotel':pairs.append((current,'hotel'))
    if n==12:pairs.append(('hotel','airport'))
    return pairs
pairs=set(p for n,plan in plans.items() for p in roadpairs(n,plan))
with ThreadPoolExecutor(max_workers=4) as pool:
    futures={pool.submit(fetchroad,p):p for p in pairs}
    for f in as_completed(futures):
        key,leg=f.result();cache[key]=leg
        if key not in oldlegs:print('road',key,leg['distance_km'],leg['plan_minutes'],flush=True)
save('road-cache.json',cache)

def build(n):
    d=copy.deepcopy(data['days'][n-1]); rows=[];legs=[];stops=[]; t=minutes(starts[n]);current='hotel';num=0
    def row(kind,title,duration,**kw):
        nonlocal t
        r=dict(kind=kind,title=title,start=clock(t),end=clock(t+duration),duration_minutes=duration,**kw);rows.append(r);t+=duration;return r
    def wait(until,title='Запас до временного окна'):
        if t<until:row('buffer',title,until-t,note='Свободное время; при задержке этот запас сокращается первым.')
    def road(dest,returning=False):
        nonlocal current
        if current==dest:return
        l=copy.deepcopy(cache[current+'>'+dest]);l.update(index=len(legs),returning=returning,navigation_url=nav(points[current],points[dest]));legs.append(l)
        row('road',points[current]['name']+' → '+points[dest]['name'],l['plan_minutes'],leg_index=l['index'],distance_km=l['distance_km'],range_minutes=l['range_minutes'],navigation_url=l['navigation_url'],note=l['note']);current=dest
    def villa(kind,start,duration=40,box=None):
        nonlocal t
        t=start
        p=points[box or 'hotel'];h=research.get(box,{})
        row('meal',{'breakfast':'Завтрак','lunch':'Обед','dinner':'Ужин'}[kind]+(' · заранее полученный бокс' if box else ' · на вилле'),duration,
            restaurant_id=box or 'hotel',place_id=box or 'hotel',place_url=p['place_url'],meal_type=kind,meal_mode='packed' if box else 'villa',source_url=h.get('source',p['place_url']),checked='2026-10-15',note='Заказать накануне и согласовать охлаждение и хранение.' if box else 'Отдельный завтрак на вилле; услугу и время подачи подтвердить.')
    villa('breakfast',360 if n==7 else 480,45)
    rows[-1]['note']='Завтрак в отеле с 08:00 по вашему сообщению.'
    if n==7:
        rows[-1]['meal_mode']='packed'
        rows[-1]['title']='Завтрак · заранее полученный бокс'
        rows[-1]['note']='Заранее заказанный завтрак с собой; выдачу накануне и хранение подтвердить. Исключение для раннего выезда на Пениду.'
    wait(minutes(starts[n]),'Подготовка к выезду после завтрака')
    if n==7:
        road('sanur');assert t<=470,('late outbound port',t)
        wait(470);row('logistics','Регистрация на катер Sanur',40,note='Плановый рейс The Angkal 08:30: опубликован агентами, точную дату, места, терминал и регистрацию подтвердить до покупки.')
        row('boat','Катер Sanur → Пенида',50,note='План 08:30, The Angkal. С запасом на море; рейс и места не забронированы.')
        row('logistics','Встреча с островным водителем',20,note='Заранее договориться о машине; при задержке сокращать посещения.');current='penida-port'
    lastmain=-1000
    for item in plans[n]:
        id=item[0] if isinstance(item,tuple) else item
        if id in ('checkout','baggage'):
            road('hotel',True)
            if id=='checkout':
                row('logistics','Сбор багажа и checkout до 12:00',50,note='Оставить багаж на вилле по согласованию.');assert t<=720
            else:row('logistics','Багаж, душ, переодевание и возврат байка',45,note='Подготовить вещи заранее; хранение багажа и душ после checkout подтвердить.')
            continue
        if id=='return-boat':
            road('penida-port',True);assert t<=980,('late return port',n,clock(t))
            wait(980);row('logistics','Регистрация на обратный катер',40,note='Axe Stone 17:00. Сохранять запас на регистрацию; при задержке сокращать посещения.')
            row('boat','Катер Пенида → Sanur',50,note='17:00 по расписанию оператора; наличие мест и условия погоды подтвердить.')
            row('logistics','Получение байка в Sanur',20,note='Согласовать стоянку.');current='sanur';continue
        if id=='free-lunch':
            row('logistics','Готовый обед с собой' if n==7 else 'Обед рядом с маршрутом',10 if n==7 else 45,note='Готовая еда, купленная в порту; без ожидания заказа.' if n==7 else 'Выбор на месте; не дополнительное заведение вашего списка.');continue
        road(id);num+=1;p=copy.deepcopy(points[id]);p['number']=num
        if isinstance(item,tuple):
            kind=item[1];h=research[id];duration=25 if kind=='coffee' else (120 if id=='r72' else 55)
            if n==7 and id in ('r57','r56'):duration=20
            if n==7 and id=='r01':duration=30
            if n==8 and kind=='coffee':duration=20
            if n in (5,6) and kind=='coffee':duration=20
            if n==9 and id=='r02':duration=35
            if kind!='coffee':wait(lastmain+210);lastmain=t
            if kind=='lunch':wait(720)
            if kind=='dinner' and n!=12:wait(1020)
            if kind!='coffee':lastmain=t
            if id=='r72':wait(minutes('12:00') if kind=='lunch' else minutes('17:30'))
            window=next(([a,b] for a,b in h['planning_windows'] if max(t,a)+duration<=b),None)
            if not window:raise ValueError(f'{n} {id} arrival {clock(t)} outside hours {h["planning_windows"]}')
            wait(window[0]);p['meal_type']=kind
            label={'coffee':'Дегустация, десерт или небольшой перекус','breakfast':'Завтрак','lunch':'Обед','dinner':'Ужин'}[kind]
            note='Небольшая порция: полноценный приём пищи в каждом из 67 заведений за 8 дней не предусмотрен.' if kind=='coffee' else 'Полноценный приём пищи; кухню, наличие стола и последний заказ подтвердить.'
            if id=='r15':note='Точка списка сохранена на карте, но возможность заказа еды не подтверждена. Не считать выполненной целью по питанию до подтверждения.'
            row('meal',label+' · '+p['name'],duration,restaurant_id=id,place_id=id,place_url=p['place_url'],number=num,meal_type=kind,meal_mode='onsite',hours_label=h['hours_label'],hours_status=h['hours_status'],source_url=h['source'],checked=h['checked'],booking_required=h['booking_required'],booking_note=h['booking_note'],note=note)
        else:
            if id=='v23':wait(600)
            if id=='v01':wait(540);assert t<=840
            if id=='v28':wait(540)
            if id=='v22':wait(600)
            r=copy.deepcopy(visits[id]);duration=r['duration_minutes']
            if id=='v20':duration=60
            if id=='v21':duration=60
            if id=='v17':duration=60
            if n in (2,6,9) and id in ('v25','v26','v14','v15','v02'):duration=60
            duration={'v27':20,'v29':15,'v28':15,'v13':45,'v12':45,'v16':45,'v01':180,'v10':60,'v11':45,'v14':45,'v15':45,'v07':25,'v05':20,'v06':15,'v04':20,'v19':40,'v18':40,'v03':20,'v17':30,'v21':40,'v24':30,'v25':105,'v26':60}.get(id,duration)
            if id in ('v25','v26'):r['note']='Купание и отдых у воды. Ориентироваться на флаги и указания спасателей; при запрете купания отдыхать на берегу.'
            if n==6 and id in ('v14','v15'):
                duration=30
                r['note']='Короткое посещение с подходом, без гарантированного времени для купания. Вход, волны, течения и флаги проверить на месте.'
            if n==7 and id=='v04':
                duration=15
                r['note']='Короткий осмотр с подходом, без купания. При задержке катера или машины пересчитать островную программу; обратный катер имеет приоритет.'
            if id=='v24':wait(minutes('16:00'))
            row('visit',p['name'],duration,place_id=id,number=num,place_url=p['place_url'],note=r['note'])
            row('buffer','Парковка, вода и короткий перерыв',5 if n in (7,9) or id in ('v27','v29','v28') else 10,note='Пеший подход включён в посещение.')
        stops.append(p)
    if current!='hotel':road('hotel',True)
    if n==12:
        wait(minutes('19:00'));road('airport',True);assert t<=minutes('21:30'),[(r['start'],r['end'],r['title']) for r in rows]
        row('logistics','Аэропорт DPS · международный терминал',0,note='Цель не позднее 21:30, вылет 23 октября в 00:30.')
    else:row('logistics','Возвращение на Nunamkhalu',0,note='Полный обратный путь учтён.')
    assert t<1440,(n,t)
    onsite=[r for r in rows if r['kind']=='meal' and r['meal_mode']=='onsite']
    d.update(image='penida' if n in (7,8) else 'rice' if n in (3,5,9,11) else 'coast',title=titles[n],subtitle=' → '.join(points[x[0] if isinstance(x,tuple) else x]['name'] for x in plans[n] if not isinstance(x,tuple) and x not in ('checkout','baggage','return-boat','free-lunch')) or ('Местные заведения → вилла → аэропорт' if n==12 else 'Кафе Кинтамани → Koral → вилла'),
        wake='07:30',island=n in (7,8),last=n==12,depart=starts[n],return_time=clock(t),timeline=rows,legs=legs,route_stops=stops,
        stops=[p for p in stops if p['role']=='visit'],meals=[r for r in rows if r['kind']=='meal'],alternatives=[],distance_km_known=round(sum(l['distance_km'] for l in legs),1),road_minutes=sum(l['plan_minutes'] for l in legs),missing_legs=0,
        meal_restaurants_assigned=len(onsite),status='hotel_breakfast_departure_after_9',why=why.get(n,'Заведения сгруппированы по району; все переезды и возврат на одну виллу включены.'),
        load='Высокий' if t-minutes(starts[n])>780 else 'Средний' if t-minutes(starts[n])>600 else 'Лёгкий',
        risk='Часы и время в пути плановые. Возможность короткой дегустации и last order подтвердить. Не переносить опоздание на катер или аэропорт; при задержке отложить кафе и пересчитать покрытие.',
        notes=['Каждая из 67 точек еды назначена один раз и нанесена на карту дня.','Завтрак на вилле 08:00-08:45, выезд 09:00; 17 октября исключение: выезд 06:50 и завтрак с собой.','Все ночи на Nunamkhalu; ночёвки на Пениде не предусмотрены.'])
    if n==9:d['risk']+=' Самый дальний день: машина с водителем рекомендуется; кафе после северного круга зависят от фактического возвращения.'
    if n==5:
        d['risk']+=' Дополнительно: Goa Lawah, храм с пещерой летучих мышей, на обратном пути. Только если закончите пляжи раньше и появится 30-40 минут запаса: осмотр 20-30 минут, вход и часы уточнить. В основной расчёт не включён; при добавлении пересчитать вечер.'
        d['extra_activity']=dict(name='Goa Lawah — запасная остановка',url='https://www.google.com/maps/search/?api=1&query=Pura+Goa+Lawah+Bali',note='Не обязательная точка: только при запасе времени, доступность и часы не подтверждены.')
    else:d.pop('extra_activity',None)
    if n in (7,8):d['port_arrival_estimate']='16:20 или раньше; регистрация на 17:00'
    for k in ('sleep_window','customized'):d.pop(k,None)
    if n==7:
        d.update(island=True,image='penida',wake='05:45',depart='06:50',status='early_penida_exception',port_arrival_estimate='16:20 или раньше; регистрация на 17:00')
    else:
        d.update(island=False,image='coast' if n==8 else d['image'])
        d.pop('port_arrival_estimate',None)
    return d

days=[]
for n in plans:
    d=build(n);days.append(d);d['number']=len(days)
    print('built',n,d['depart'],d['return_time'],d['road_minutes'],flush=True)
for d in days:
    print('DAY',d['number'],d['depart'],d['return_time'],d['distance_km_known'],d['road_minutes'],len([m for m in d['meals'] if m['meal_mode']=='onsite']),flush=True)
data['days']=days
snapshot=json.loads((ROOT/'latest-lists.json').read_text('utf-8'))
food_names=set(snapshot['food_names']);sight_names=set(snapshot['sight_names'])
registry['places']=[p for p in registry['places'] if p['name'] in (food_names if 'meal' in p['roles'] else sight_names)]
assert {p['name'] for p in registry['places'] if 'meal' in p['roles']}==food_names
assert {p['name'] for p in registry['places'] if 'visit' in p['roles']}==sight_names
foods=[p for p in registry['places'] if 'meal' in p['roles']]
data.update(trip_start='2026-10-15',trip_end='2026-10-22',created='2026-10-15',status='hotel_breakfast_departure_after_9',optional_visits=[])
data['user_list_updates'].append(dict(date='2026-10-15',removed=['v29'],source='Полная сверка двух живых списков Google Maps'))
data['coverage']=[dict(id=p['id'],name=p['name'],planned_date=next((d['date'] for d in days if any(s['id']==p['id'] for s in d['stops'])),None),status='planned_access_provisional') for p in registry['places'] if 'visit' in p['roles']]
data['restaurant_coverage']=[]
for p in foods:
    assigned=[dict(date=d['date'],meal_type=m['meal_type'],start=m['start'],end=m['end'],mode=m['meal_mode']) for d in days for m in d['meals'] if m['restaurant_id']==p['id']]
    data['restaurant_coverage'].append(dict(id=p['id'],name=p['name'],date=next(a['date'] for a in assigned if a['mode']=='onsite'),visits=assigned,status='food_service_unconfirmed' if p['id']=='r15' else 'planned_onsite',reason='Один личный визит; часы кухни и возможность небольшого заказа подтвердить.'))
main=[m for d in days for m in d['meals'] if m['meal_type']!='coffee']
data['restaurant_selection'].update(meal_slots=24,unique_onsite_restaurants=67,assigned_meals=len(main),packed_meals=1,coffee_snack_visits=sum(m['meal_type']=='coffee' for d in days for m in d['meals']),note='Семь завтраков на вилле с 08:00; 17 октября заранее заказанный завтрак с собой. Заведения списка — обеды, ужины и небольшие дегустации.',coverage_note='Все 67 текущих точек назначены и нанесены на карты. Echo Beach: еда не подтверждена.')
data['list_verification']='Два живых списка Google Maps сверены 15 октября 2026: 67 заведений и 22 достопримечательности. Полные названия сохранены в latest-lists.json.'
data['routing_preference']=dict(tolls_allowed=True,preference='Более быстрые маршруты, в том числе через Bali Mandara',motorcycle_lane_source='https://bpjt.pu.go.id/faq/apakah-motor-boleh-masuk-jalan-tol/')
data['limitations']=['На платной Bali Mandara для байка использовать выделенную полосу. Геометрия карты рассчитана для автомобиля; фактические мотоциклетные въезды и съезды уточнить.','67 заведений за 8 дней — плотная программа, особенно Чангу и южный день. Большинство остановок — небольшие порции, а не полноценный приём пищи.','Пенида только 17 октября: четыре короткие смотровые и 30 минут на Amok. Ранний выезд 06:50, завтрак с собой. Плановый катер The Angkal 08:30 опубликован агентами; обратный 17:00. Рейсы, места, время регистрации и островного водителя подтвердить. При задержке пересчитать маршрут, не рискуя обратным катером.','Запад Пениды: короткие смотровые, без спуска на Kelingking и без купания у Angel’s Billabong. При задержке водителя сокращать посещения, чтобы сохранить катер.','Северный круг 19 октября и круг Бесаких–Tukad Cepung–Убуд 21 октября насыщенные; рекомендуется машина с водителем. Посещения короткие, часы входа подтвердить.','Часы части заведений оценочные, кухню, последний заказ и столы подтвердить.','Echo Beach Sunset Point: возможность заказа еды не подтверждена.','Подъезды, парковки и доступ для байка не полностью проверены; OSRM использует автомобильный профиль.','Завтрак в отеле 08:00-08:45, выезд 09:00. Исключение 17 октября: выезд 06:50, заранее заказанный завтрак с собой; выдачу и хранение подтвердить.','Koral 18 октября 17:30-19:30, Boneka на ужин 22 октября и услуги виллы после checkout согласовать. Брони не выполнены.','PDF и статические карты показывают основной план; личные обмены в браузере не меняют их автоматически.']
data['sources']=[dict(name='BPJT: отдельная полоса для мотоциклов на Bali Mandara',url='https://bpjt.pu.go.id/faq/apakah-motor-boleh-masuk-jalan-tol/',checked='2026-10-15'),dict(name='Текущий список еды: 67 мест',url=snapshot['food_url'],checked='2026-10-15'),dict(name='Текущий список достопримечательностей: 22 места',url=snapshot['sights_url'],checked='2026-10-15'),dict(name='The Angkal: 08:30 в расписании агента; рейс на 17 октября подтвердить',url='https://sailtix.com/operators/the-angkal',checked='2026-10-15'),dict(name='Axe Stone: обратный 17:00, проверен 13-го; доступ 15-го недоступен',url='https://axestonefastcruise.com/time-schedule/',checked='2026-10-13'),dict(name='Bali Farm House: 09:00–17:00',url='https://linktr.ee/balifarmhouse',checked='2026-10-15'),* [x for x in data['sources'][2:] if not any(w in x['name'].lower() for w in ['lovina','saka','gooseberry','sundays','бокс','brahmavihara','ocean speed'])]]
data['sources'].insert(0,{'name': 'Marine Safari: официальный билетный сайт, часы 09:00-17:00', 'url': 'https://overseasmarinesafari.balisafarimarinepark.com/attraction/clownfish---general-day-admission-lunch-65778?lang=en', 'checked': '2026-10-15'})
registry.update(created_date='2026-10-15',source=data['list_verification'],counts=dict(attractions=22,scheduled_attractions=22,optional_attractions=0,restaurants=67,total_records=89))
registry['meal_capacity']=dict(restaurant_count=67,main_meals=len(main),onsite_full_meals=sum(m['meal_mode']=='onsite' for m in main),coffee_snack_stops=data['restaurant_selection']['coffee_snack_visits'],packed_meals=1,note='7 завтраков на вилле и 1 завтрак с собой отдельно; Echo Beach: еда не подтверждена.')
for p in registry['places']:
    role='meal' if 'meal' in p['roles'] else 'visit'
    p['source_list'].update(url=snapshot['food_url'] if role=='meal' else snapshot['sights_url'],snapshot_date='2026-10-15',current_membership_confirmed=True)
    collection=data['restaurant_coverage'] if role=='meal' else data['coverage']
    entry=next(x for x in collection if x['id']==p['id']);p['assigned_date']=entry.get('date',entry.get('planned_date'))
    p['schedule_status']='planned'
research={k:v for k,v in research.items() if k in {p['id'] for p in foods}}
physical=[m['restaurant_id'] for d in days for m in d['meals'] if m['meal_mode']=='onsite']
assert len(physical)==len(set(physical))==67
assert set(physical)=={p['id'] for p in foods}
assert len([s for d in days for s in d['stops']])==22
for d in days:
    assert {m['restaurant_id'] for m in d['meals'] if m['meal_mode']=='onsite'} <= {s['id'] for s in d['route_stops']}
    for a,b in zip(d['timeline'],d['timeline'][1:]):assert a['end']==b['start'],(d['number'],a['title'],b['title'])
for a,b in zip(days,days[1:]):
    rest=1440-minutes(a['return_time'])-30+minutes(b['wake'])
    assert rest>=420,('sleep',a['number'],rest)
from tides import apply_tides
apply_tides(data)
save('itinerary.json',data);save('registry.json',registry);save('restaurant-research.json',research)
with (ROOT/'coverage.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.writer(f);writer.writerow(['id','name','date','type','status'])
    for c in data['coverage']:writer.writerow([c['id'],c['name'],c['planned_date'] or '', 'visit',c['status']])
    for c in data['restaurant_coverage']:writer.writerow([c['id'],c['name'],c['date'],'meal',c['status']])
print('ALL 67 RESTAURANTS AND 22 ATTRACTIONS VERIFIED',flush=True)
