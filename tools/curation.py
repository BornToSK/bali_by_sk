"""Subjective shortlist: current Google reviews, cuisine variety and route fit."""
CHOICES = {
 'r05':'Террасы Тегаллаланга и полноценный обед по пути; 4,8 при большом числе отзывов.',
 'r04':'Одна остановка на кофе с видом на Батур вместо цепочки кафе Кинтамани.',
 'r29':'Паназиатская кухня и ужин в Убуде; 4,9, официальный сайт и меню.',
 'r01':'Обед с видом на Гамат-Бэй на Пениде. Ранний катер даёт время на нормальный обед.',
 'r50':'Японская кухня: разнообразие меню, 4,7 и отдельная рекомендация Condé Nast Traveler.',
 'r21':'Обед в Унгасане после пляжей; 4,8 и короткий переезд.',
 'r47':'Греческая кухня на ужин в Улувату; 4,8 и удобный маршрут по югу.',
 'r02':'Лёгкий обед и кофе у террас Jatiluwih, без отдельного крюка.',
 'r18':'Ужин на обратном пути с севера через Чангу; 4,8 и европейское бистро.',
 'r40':'Обед в Berawa: 4,8 при большом числе отзывов, официальное меню на весь день.',
 'r43':'Итальянское бистро на ужин в том же районе Чангу; 4,8.',
 'r54':'Обед по возвращении с востока; 4,8 при большом числе отзывов.',
 'r67':'Обед в день вылета рядом с виллой, 4,8; без поездки в Чангу.',
 'r48':'Испанские тапас для раннего ужина перед аэропортом; 4,9, подача тапас с 15:00.',
}
SOURCES = [
 ('Ramu: официальный сайт, ежедневно 07:00-22:00','https://titikdua.id/ramu-kitchen/'),
 ('nüde Berawa: официальный сайт, 07:00-23:00','https://nude-bali.com/locations/berawa'),
 ('Alma Uluwatu: brunch 07:00-12:00, tapas 15:00-23:00','https://almatapasbar.com/'),
 ('YUKI Uluwatu: официальный сайт','https://www.yuki-bali.com/uluwatu'),
 ('YUKI: независимая ресторанная рецензия Condé Nast Traveler','https://www.cntraveler.com/restaurants/bali/yuki-uluwatu'),
 ('LUSA: официальный сайт By/Suka','https://www.bysuka.com/lusa-by-suka'),
 ('SUKA Uluwatu: официальный сайт','https://www.bysuka.com/suka-uluwatu'),
 ('Amok: официальные контакты и часы 11:00-23:00','https://amoksunset.com/contact/'),
 ('The Angkal: расписание агента, 07:30 и обратно 17:00; рейсы и места подтвердить','https://sailtix.com/operators/the-angkal'),
]

def finish(data,registry,research,snapshot,days):
 import json
 from pathlib import Path
 from urllib.parse import quote, urlparse
 root=Path(__file__).resolve().parents[1]
 for p in registry['places']:
  link=p.get('place_url','')
  if not link or (urlparse(link).path.rstrip('/')=='/maps/search' and not urlparse(link).query):
   p['place_url']='https://www.google.com/maps/search/?api=1&query='+quote(p['name']+' Bali')
 for id,url,label,windows in [
  ('r29','https://titikdua.id/ramu-kitchen/','Официальный сайт 07:00-22:00; используем вечерний визит',[[900,1320]]),
  ('r40','https://nude-bali.com/locations/berawa','Официальный сайт: ежедневно 07:00-23:00',[[420,1380]]),
  ('r48','https://almatapasbar.com/','Официальный сайт: brunch 07:00-12:00; tapas 15:00-23:00',[[420,720],[900,1380]])]:
  research[id].update(source=url,hours_label=label,planning_windows=windows,hours_status='official_current',checked='2026-10-16')
 ratings={r['name']:r for r in json.loads((root/'food-ratings.json').read_text('utf-8'))['records']}
 foods=[p for p in registry['places'] if 'meal' in p['roles']]
 selected=set(CHOICES)
 assert selected <= {p['id'] for p in foods}
 physical=[m['restaurant_id'] for d in days for m in d['meals'] if m['meal_mode']=='onsite']
 assert len(physical)==len(set(physical))==len(selected) and set(physical)==selected
 data.update(trip_start='2026-10-16',trip_end='2026-10-22',created='2026-10-16',status='curated_restaurants',days=days,optional_visits=[])
 data['coverage']=[dict(id=p['id'],name=p['name'],planned_date=next(d['date'] for d in days if any(s['id']==p['id'] for s in d['stops'])),status='planned_access_provisional') for p in registry['places'] if 'visit' in p['roles']]
 data['restaurant_coverage']=[]
 for p in foods:
  p['review_snapshot']=ratings[p['name']]
  p['dining_research']=research[p['id']]
  p['curated']=p['id'] in selected
  p['selection_reason']=CHOICES.get(p['id'],'Не добавляем ради посещения ещё одного кафе. Можно выбрать вместо основного ресторана.')
  p['assigned_date']=next((d['date'] for d in days if any(m['restaurant_id']==p['id'] for m in d['meals'])),None)
  p['schedule_status']='planned' if p['curated'] else 'reserve'
  if p['curated']:
   visits=[dict(date=d['date'],meal_type=m['meal_type'],start=m['start'],end=m['end'],mode=m['meal_mode']) for d in days for m in d['meals'] if m['restaurant_id']==p['id']]
   data['restaurant_coverage'].append(dict(id=p['id'],name=p['name'],date=p['assigned_date'],visits=visits,status='planned_onsite',reason=p['selection_reason'],rating=ratings[p['name']]['rating'],reviews=ratings[p['name']]['reviews']))
 for d in days:
  for r in d['timeline']:
   if r['kind']=='meal' and r['meal_mode']=='onsite':
    h=research[r['restaurant_id']]
    r.update(hours_label=h['hours_label'],hours_status=h['hours_status'],source_url=h['source'],checked=h['checked'])
 data['restaurant_reserve']=[dict(id=p['id'],name=p['name'],reason=p['selection_reason'],place_url=p['place_url']) for p in foods if not p['curated']]
 main=[m for d in days for m in d['meals'] if m['meal_type']!='coffee']
 data['restaurant_selection']=dict(meal_slots=21,unique_onsite_restaurants=len(selected),catalog_restaurants=len(foods),reserve_restaurants=len(foods)-len(selected),assigned_meals=len(main),packed_meals=1,coffee_snack_visits=sum(m['meal_type']=='coffee' for d in days for m in d['meals']),note='Полноценные обеды и ужины, одна видовая остановка на кофе. 17 октября ранний выезд с завтраком с собой.',coverage_note='Субъективный выбор по кухне, актуальным оценкам, числу отзывов и расположению. Это не объективный рейтинг лучших ресторанов Бали.')
 data['list_verification']='Два живых списка Google Maps сверены 16 октября: 67 заведений и 19 мест. Marine Safari посещён; Blue Lagoon и Bias Tugel также удалены пользователем из текущего списка. Полный список еды остаётся каталогом, в маршрут включены 14 заведений.'
 data['user_list_updates'].append(dict(date='2026-10-16',removed=['v01','v14','v15'],source='Полная сверка живых списков; посещение океанариума подтверждено пользователем'))
 data['limitations']=[
  'В основной маршрут включены 14 из 67 заведений; 53 сохранены в каталоге как резерв. Выбор субъективный: кухня, отзывы, разнообразие и отсутствие лишнего крюка. Высокая оценка не гарантирует качество.',
  'На Пениду 17 октября выезд 05:50 и плановый катер 07:30. Пользователь разрешил ранние выезды. Завтрак с собой заказать накануне, согласовать выдачу и хранение. Катера и островной водитель не забронированы.',
  'Пенида за один день: четыре коротких осмотра и обед Amok. Kelingking только сверху, Angel’s Billabong без входа в воду. При задержке пересчитать программу, сохраняя обратный катер.',
  'В остальные дни завтрак на вилле 08:00-08:45 и выезд 09:00. Все ночи на Nunamkhalu.',
  'Северный круг 19 октября и поездки 16 и 20 октября остаются длинными; рекомендуется водитель. Время в пути оценочное, без прогноза пробок.',
  'На платной Bali Mandara байку нужна отдельная полоса. Геометрия OSRM автомобильная; въезды, парковки и доступ для байка не полностью проверены.',
  '21 октября Blue Lagoon и Bias Tugel убраны по текущему списку. После Tukad Cepung и Satya Dharma — обед SUKA, затем свободный вечер. Ужин на вилле или рядом выбрать самостоятельно.',
  'Часы части заведений и доступ в храмы требуют подтверждения; столы, последний заказ и точное меню проверить. Бронирования и оплаты не выполнялись.',
  'Koral и Boneka оставлены в резерве: отдельный дорогой ужин и бронь не обязательны. В день вылета Alma заменяет позднюю ресторанную цепочку.',
  '22 октября checkout до 12:00, хранение багажа и душ согласовать. Аэропорт не позже 21:30, вылет 23 октября 00:30.',
  'PDF показывает основной маршрут; личные перестановки еды в браузере не меняют PDF автоматически.',
 ]
 data['sources']=[dict(name=n,url=u,checked='2026-10-16') for n,u in SOURCES]+[dict(name='Живой список еды и оценки Google Maps',url=snapshot['food_url'],checked='2026-10-16'),dict(name='Живой список мест',url=snapshot['sights_url'],checked='2026-10-16')]+[s for s in data['sources'] if not any(x in s['name'] for x in ['Marine Safari','Текущий список','Axe Stone','The Angkal'])]
 registry.update(created_date='2026-10-16',source=data['list_verification'],counts=dict(attractions=len(snapshot['sight_names']),scheduled_attractions=len(snapshot['sight_names']),optional_attractions=0,restaurants=len(foods),selected_restaurants=len(selected),reserve_restaurants=len(foods)-len(selected),total_records=len(registry['places'])))
 registry['meal_capacity']=dict(restaurant_count=len(foods),selected_restaurants=len(selected),main_meals=len(main),coffee_snack_stops=data['restaurant_selection']['coffee_snack_visits'],packed_meals=1,note='6 завтраков на вилле, 1 завтрак с собой; 21 октября ужин свободный, на вилле или рядом.')
 for p in registry['places']:
  role='meal' if 'meal' in p['roles'] else 'visit'
  p['source_list'].update(url=snapshot['food_url'] if role=='meal' else snapshot['sights_url'],snapshot_date='2026-10-16',current_membership_confirmed=True)
  if role=='visit':p['assigned_date']=next(c['planned_date'] for c in data['coverage'] if c['id']==p['id'])
 return data,registry
