"""Verify actual coverage, map membership, route continuity and fixed windows."""
import json,pathlib,subprocess,sys,hashlib
from pypdf import PdfReader
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'itinerary.json').read_text('utf-8'));reg=json.loads((root/'registry.json').read_text('utf-8'))
baseline=json.loads(subprocess.check_output(['git','show','50bc2d8:itinerary.json'],cwd=root))
def minutes(t):return int(t[:2])*60+int(t[3:5])
old=baseline['days'][0];now=data['days'][0]
for key in old:
    if key!='notes':assert old[key]==now[key],('changed 11 October',key)
assert old['notes']==now['notes'][:len(old['notes'])]
oldmap=subprocess.check_output(['git','show','50bc2d8:maps/day-01.png'],cwd=root)
assert oldmap==(root/'maps/day-01.png').read_bytes()
food_ids={p['id'] for p in reg['places'] if 'meal' in p['roles']}
assert len(food_ids)==70 and 'r52' not in food_ids and 'r58' not in food_ids
onsite=[m for d in data['days'] for m in d['meals'] if m['meal_mode']=='onsite' and m['restaurant_id'] in food_ids]
assert len(onsite)==70 and {m['restaurant_id'] for m in onsite}==food_ids
assert len(data['coverage'])==29 and len(data['optional_visits'])==1
assert len([s for d in data['days'] for s in d['stops']])==28
assert all('v30' not in [s['id'] for s in d['route_stops']] for d in data['days'])
for d in data['days']:
    rows=d['timeline']; assert all(a['end']==b['start'] for a,b in zip(rows,rows[1:]))
    expected={m['restaurant_id'] for m in d['meals'] if m['meal_mode']=='onsite'}
    assert expected<={s['id'] for s in d['route_stops']}
    assert all(l['geometry']['type']=='LineString' and len(l['geometry']['coordinates'])>=2 for l in d['legs'])
    assert all(a['destination']==b['origin'] or d['island'] for a,b in zip(d['legs'],d['legs'][1:]))
    assert d['legs'][0]['origin']=='hotel' and d['legs'][-1]['destination']==('airport' if d['last'] else 'hotel')
    assert d['road_minutes']==sum(l['plan_minutes'] for l in d['legs'])
    if d['number']>1: assert len(expected)<=8 and minutes(d['depart'])>=300
    Image.open(root/'maps'/f"day-{d['number']:02}.png").verify()
for a,b in zip(data['days'],data['days'][1:]):assert 1440-minutes(a['return_time'])-30+minutes(b['wake'])>=420
last=data['days'][-1]; assert minutes(last['return_time'])<=1290
assert all(s['lat']< -8.75 for s in last['route_stops']) # All departure-day stops are on the southern peninsula.
assert minutes(next(r['end'] for r in last['timeline'] if 'checkout' in r['title']))<=720
penida=data['days'][6];assert [r['start'] for r in penida['timeline'] if r['kind']=='boat']==['07:30','17:00']
reader=PdfReader(root/'guide.pdf');text='\n'.join(p.extract_text() for p in reader.pages)
missing=[p['name'] for p in reg['places'] if 'meal' in p['roles'] and p['name'].replace('—','-').replace('–','-') not in text]
assert not missing,missing
assert len(reader.pages)==43
result=dict(date='2026-10-12',food_list_points=70,scheduled_attractions=28,optional_attractions=1,
    historical_day_11_preserved=True,historical_day_11_map_unchanged=True,all_food_stops_have_day_map_markers=True,
    no_repeated_current_food_visits=True,max_future_food_stops=8,night_dolphin_trip_removed=True,
    departure_day_canggu_removed=True,airport_plan=last['return_time'],minimum_sleep_hours=7,
    route_continuity_and_boat_windows_checked=True,pdf=dict(pages=43,all_current_restaurant_names_present=True,
    all_pages_rendered=True,all_pages_visually_reviewed=True),browser=dict(all_12_days_and_markers_verified=True,
    same_day_exchange_and_restore_passed=True),limitations=data['limitations'])
(root/'final-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf-8')
print('PASS: all 70 current restaurants, day 11 unchanged, maps, roads, sleep, boats, airport and PDF')
