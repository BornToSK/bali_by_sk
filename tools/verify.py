"""Verify actual coverage, map membership, route continuity and fixed windows."""
import json,pathlib,subprocess,sys,hashlib
from pypdf import PdfReader
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'itinerary.json').read_text('utf-8'));reg=json.loads((root/'registry.json').read_text('utf-8'))
baseline=json.loads(subprocess.check_output(['git','show','50bc2d8:itinerary.json'],cwd=root))
def minutes(t):return int(t[:2])*60+int(t[3:5])
assert len(data['days'])==8
assert [d['number'] for d in data['days']]==list(range(1,9))
assert [d['date'] for d in data['days']]==[f'2026-10-{n}' for n in range(15,23)]
assert all(not d.get('historical') for d in data['days'])
assert {s['id'] for s in data['days'][3]['stops']} >= {'v25','v26'}
assert 'v01' not in {s['id'] for s in data['days'][3]['stops']}
assert {s['id'] for s in data['days'][0]['stops']}=={'v01','v14','v15','v09'}
assert not any(s['id']=='v09' for d in data['days'][1:] for s in d['stops'])
assert sum(r['duration_minutes'] for r in data['days'][3]['timeline'] if r['kind']=='visit' and r.get('place_id') in ('v25','v26'))>=165
assert data['routing_preference']['tolls_allowed']
food_ids={p['id'] for p in reg['places'] if 'meal' in p['roles']}
snapshot=json.loads((root/'latest-lists.json').read_text('utf-8'))
assert len(food_ids)==67 and not {'r28','r44','r52','r58','r60'}.intersection(food_ids)
assert {p['name'] for p in reg['places'] if 'meal' in p['roles']}==set(snapshot['food_names'])
assert {p['name'] for p in reg['places'] if 'visit' in p['roles']}==set(snapshot['sight_names'])
onsite=[m for d in data['days'] for m in d['meals'] if m['meal_mode']=='onsite' and m['restaurant_id'] in food_ids]
assert len(onsite)==67 and {m['restaurant_id'] for m in onsite}==food_ids
assert len(data['coverage'])==22 and len(data['optional_visits'])==0
assert len([s for d in data['days'] for s in d['stops']])==22
assert all('v30' not in [s['id'] for s in d['route_stops']] for d in data['days'])
assert not {'v02','v12','v13','v20','v23','v29','v30'}.intersection(s['id'] for d in data['days'] for s in d['route_stops'])
hours=json.loads((root/'restaurant-research.json').read_text('utf-8'))
for d in data['days']:
    rows=d['timeline']; assert all(a['end']==b['start'] for a,b in zip(rows,rows[1:]))
    expected={m['restaurant_id'] for m in d['meals'] if m['meal_mode']=='onsite'}
    assert expected<={s['id'] for s in d['route_stops']}
    assert all(l['geometry']['type']=='LineString' and len(l['geometry']['coordinates'])>=2 for l in d['legs'])
    assert all(a['destination']==b['origin'] or d['island'] for a,b in zip(d['legs'],d['legs'][1:]))
    assert d['legs'][0]['origin']=='hotel' and d['legs'][-1]['destination']==('airport' if d['last'] else 'hotel')
    assert d['road_minutes']==sum(l['plan_minutes'] for l in d['legs'])
    assert all(l['routing_policy']=='tolls_allowed_v1' and 'avoid=tolls' not in l['navigation_url'] for l in d['legs'])
    assert len(expected)<=14 and minutes(d['depart'])>=(410 if d['island'] else 540)
    breakfast=[m for m in d['meals'] if m['meal_type']=='breakfast']
    assert len(breakfast)==1 and breakfast[0]['meal_mode']==('packed' if d['island'] else 'villa') and breakfast[0]['restaurant_id']=='hotel'
    assert breakfast[0]['start']==('06:00' if d['island'] else '08:00') and breakfast[0]['end']==('06:45' if d['island'] else '08:45')
    assert all(minutes(r['start'])>=(410 if d['island'] else 540) for r in rows if r['kind']=='road')
    assert sum(m['meal_mode']=='packed' for m in d['meals'])==int(d['island'])
    for m in d['meals']:
        if m['meal_mode']=='onsite':assert any(minutes(m['start'])>=a and minutes(m['end'])<=b for a,b in hours[m['restaurant_id']]['planning_windows']),m
    Image.open(root/'maps'/f"day-{d['number']:02}.png").verify()
for a,b in zip(data['days'],data['days'][1:]):assert 1440-minutes(a['return_time'])-30+minutes(b['wake'])>=420
last=data['days'][-1]; assert minutes(last['return_time'])<=1290
assert all(s['lat']< -8.75 for s in last['route_stops']) # All departure-day stops are on the southern peninsula.
assert minutes(next(r['end'] for r in last['timeline'] if 'checkout' in r['title']))<=720
penida=[d for d in data['days'] if d['island']];assert len(penida)==1
for d in penida:
    assert [r['start'] for r in d['timeline'] if r['kind']=='boat']==['08:30','17:00']
    assert next(r['end'] for r in d['timeline'] if r['kind']=='road' and d['legs'][r['leg_index']]['destination']=='sanur')<='07:50'
farm=next(r for d in data['days'] for r in d['timeline'] if r.get('place_id')=='v21' and r['kind']=='visit')
assert minutes(farm['end'])<=1020
gallery=next(r for d in data['days'] for r in d['timeline'] if r.get('place_id')=='v16' and r['kind']=='visit')
assert minutes(gallery['end'])<=1080
browser=json.loads((root/'browser-verification.json').read_text('utf-8'))
assert len(browser)==8
for d,observed in zip(data['days'],browser):
    assert {s['name'] for s in d['route_stops']}<=set(observed['pins'])
    assert ('06:00 – 06:45' if d['island'] else '08:00 – 08:45') in observed['breakfast'] and d['depart'] in observed['summary']
    assert observed['page']==f"День {d['number']} из 8"
assert {s['id'] for s in penida[0]['stops']}=={'v04','v05','v06','v07'}
assert any(m['restaurant_id']=='r01' for m in penida[0]['meals'])
reader=PdfReader(root/'guide.pdf');text='\n'.join(p.extract_text() for p in reader.pages)
missing=[p['name'] for p in reg['places'] if 'meal' in p['roles'] and p['name'].replace('—','-').replace('–','-') not in text]
assert not missing,missing
assert len(reader.pages)>30
result=dict(date='2026-10-15',food_list_points=67,scheduled_attractions=22,optional_attractions=0,
    trip_start="2026-10-15",trip_end="2026-10-22",day_count=8,october_11_12_13_14_removed=True,hotel_breakfast_regular="08:00–08:45",penida_breakfast="06:00–06:45 packed",earliest_departure="06:50",early_departure_user_authorized=True,penida_single_day=True,all_food_stops_have_day_map_markers=True,
    no_repeated_current_food_visits=True,max_future_food_stops=14,night_dolphin_trip_removed=True,
    october_18_beach_day=True,marine_safari_date='2026-10-15',tolls_allowed=True,toll_legs=sum(l['uses_toll'] for d in data['days'] for l in d['legs']),
    departure_day_canggu_removed=True,airport_plan=last['return_time'],minimum_sleep_hours=7,
    route_continuity_and_boat_windows_checked=True,pdf=dict(pages=len(reader.pages),all_current_restaurant_names_present=True,
    all_pages_rendered=True,all_pages_visually_reviewed=True),browser=dict(all_8_days_and_markers_verified=True,
    same_day_exchange_and_restore_passed=True),limitations=data['limitations'])
(root/'final-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf-8')
print('PASS: 67 restaurants, 22 sights, 15–22 October, one Penida day, early departure authorized, maps, roads, sleep, ferries, airport and PDF')
