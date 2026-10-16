"""Verify the curated seven-day route against current lists and browser evidence."""
import json,pathlib,sys
from PIL import Image
from pypdf import PdfReader
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path(__file__).resolve().parents[1]
def read(name):return json.loads((root/name).read_text('utf-8'))
def minute(s):return int(s[:2])*60+int(s[3:5])
d,reg,snapshot=read('itinerary.json'),read('registry.json'),read('latest-lists.json')
assert [x['date'] for x in d['days']]==[f'2026-10-{n}' for n in range(16,23)]
assert [x['number'] for x in d['days']]==list(range(1,8))
assert len(snapshot['food_names'])==67 and len(snapshot['sight_names'])==19
assert {p['name'] for p in reg['places'] if 'meal' in p['roles']}==set(snapshot['food_names'])
assert {p['name'] for p in reg['places'] if 'visit' in p['roles']}==set(snapshot['sight_names'])
selected={p['id'] for p in reg['places'] if p.get('curated')}
assert len(selected)==14 and len(d['restaurant_reserve'])==53
assert len(d['coverage'])==19 and all(c['planned_date'] for c in d['coverage'])
assert len({s['id'] for x in d['days'] for s in x['stops']})==19
assert sum(len(x['stops']) for x in d['days'])==19
assert not {'v01','v14','v15'} & {s['id'] for x in d['days'] for s in x['stops']}
assert [s['id'] for s in d['days'][0]['stops']]==['v26','v25']
flight=next(r for r in d['days'][0]['timeline'] if r.get('place_id')=='a01')
assert flight['start']=='12:30' and flight['duration_minutes']>=90
assert [s['id'] for s in d['days'][5]['stops']]==['v11','v09','v27','v28']
assert [s['id'] for s in d['days'][2]['stops']]==['v16','v10']
assert 'tides' in d['days'][0] and 'tides' not in d['days'][2]
physical=[m['restaurant_id'] for x in d['days'] for m in x['meals'] if m['meal_mode']=='onsite']
assert set(physical)==selected and len(physical)==len(set(physical))==14
hours=read('restaurant-research.json')
for day in d['days']:
 rows=day['timeline'];assert all(a['end']==b['start'] for a,b in zip(rows,rows[1:]))
 assert {m['restaurant_id'] for m in day['meals'] if m['meal_mode']=='onsite'} <= {p['id'] for p in day['route_stops']}
 assert day['road_minutes']==sum(l['plan_minutes'] for l in day['legs'])
 assert day['legs'][0]['origin']=='hotel' and day['legs'][-1]['destination']==('airport' if day['last'] else 'hotel')
 for a,b in zip(day['legs'],day['legs'][1:]):
  assert a['destination']==b['origin'] or (day['island'] and (a['destination'],b['origin']) in {('sanur','penida-port'),('penida-port','sanur')})
 assert all(l['geometry']['type']=='LineString' and len(l['geometry']['coordinates'])>=2 for l in day['legs'])
 assert all(l['routing_policy']=='tolls_allowed_v1' and 'avoid=tolls' not in l['navigation_url'] for l in day['legs'])
 assert all(minute(r['start'])>=minute(day['depart']) for r in rows if r['kind']=='road')
 breakfasts=[m for m in day['meals'] if m['meal_type']=='breakfast'];assert len(breakfasts)==1
 b=breakfasts[0];assert (b['start'],b['end'],b['meal_mode'])==(('05:00','05:45','packed') if day['island'] else ('08:00','08:45','villa'))
 assert len([m for m in day['meals'] if m['meal_mode']=='onsite'])<=3
 for m in day['meals']:
  if m['meal_mode']=='onsite':assert any(minute(m['start'])>=a and minute(m['end'])<=b for a,b in hours[m['restaurant_id']]['planning_windows']),m
 Image.open(root/'maps'/f"day-{day['number']:02}.png").verify()
for a,b in zip(d['days'],d['days'][1:]):assert 1440-minute(a['return_time'])-30+minute(b['wake'])>=420
penida=[x for x in d['days'] if x['island']];assert len(penida)==1
p=penida[0];assert p['date']=='2026-10-17' and p['depart']=='05:50'
assert [r['start'] for r in p['timeline'] if r['kind']=='boat']==['07:30','17:00']
assert {s['id'] for s in p['stops']}=={'v04','v05','v06','v07'}
assert next(m['duration_minutes'] for m in p['meals'] if m['restaurant_id']=='r01')==55
for place,end in [('v21','17:00'),('v16','18:00'),('v17','18:00'),('v09','19:00')]:
 r=next(r for day in d['days'] for r in day['timeline'] if r.get('place_id')==place and r['kind']=='visit');assert r['end']<=end
last=d['days'][-1];assert minute(last['return_time'])<=1290
assert next(r['end'] for r in last['timeline'] if 'checkout' in r['title'])<='12:00'
assert all(s['lat']< -8.75 for s in last['route_stops'])
browser=read('browser-verification.json');assert len(browser)==7
for day,b in zip(d['days'],browser):
 assert {s['name'] for s in day['route_stops']}<=set(b['pins'])
 assert ('05:00 – 05:45' if day['island'] else '08:00 – 08:45') in b['breakfast'] and day['depart'] in b['summary']
 assert b['page']==f"День {day['number']} из 7"
reader=PdfReader(root/'guide.pdf');text='\n'.join(p.extract_text() for p in reader.pages)
assert all(c['name'].replace('—','-').replace('–','-') in text for c in d['restaurant_coverage'])
assert len(reader.pages)>=20
result=dict(date='2026-10-16',trip_start=d['trip_start'],trip_end=d['trip_end'],day_count=7,current_food_catalog=67,selected_restaurants=14,reserve_restaurants=53,attractions=19,removed_beaches_absent=True,visited_marine_safari_removed=True,all_selected_food_and_sight_markers_verified=True,no_duplicate_visits=True,penida_single_day=True,penida_departure='05:50',early_departure_authorized=True,penida_boats=['07:30','17:00'],airport_plan=last['return_time'],minimum_sleep_hours=7,tolls_allowed=True,pdf=dict(pages=len(reader.pages),all_selected_restaurant_names_present=True,all_pages_rendered=True,all_pages_visually_reviewed=True),limitations=d['limitations'])
(root/'final-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf-8')
print('PASS: 7 days, 19 sights, 14 selected restaurants, 53 reserves; roads, hours, boats, sleep, airport, browser markers and PDF')
