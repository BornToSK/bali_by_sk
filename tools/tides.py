"""Attach dated tide references without treating them as swimming clearance."""
import json
from pathlib import Path

NOTICE = ('Проверено 14.10.2026; время Бали, WITA / UTC+8. Это прогнозы для ближайших районов, '
          'а не измерения на конкретном пляже. Разные модели дают разные времена и высоты. '
          'Купание зависит также от волн, течений и флагов; следуйте указаниям спасателей. '
          'Запланированное время на пляже включает отдых на берегу, если купание запрещено.')

NOTES = {
    '2026-10-14': dict(
        area='Пандава и Melasti: ориентир Беноа',
        text='Высокая вода около 12:00, низкая около 17:40. Пандава 14:25-15:25 приходится на убывающую воду; Melasti 16:10-17:55 близко к минимуму. Весь интервал Melasti не считается подтверждённым временем для купания; условия уточнить на пляже.',
        source_name='Tides Today: прогноз Беноа',
        source_url='https://tides.today/en/%F0%9F%8C%8D/indonesia/bali/benoa'),
    '2026-10-16': dict(
        area='Blue Lagoon и Bias Tugel: ориентир Падангбай',
        text='По Surfline высокая вода около 13:29, низкая около 18:05. Blue Lagoon 15:20-16:05 и Bias Tugel 16:35-17:20 приходятся на убывающую воду. Это ориентир порта Падангбай; возможность купаться на каждом пляже проверяется на месте.',
        source_name='Surfline: прогноз Падангбая',
        source_url='https://www.surfline.com/tide-charts/padangbai/640a67cd99dd4433510cdc38'),
    '2026-10-18': dict(
        area='Crystal Bay: ориентир Нуса-Пенида',
        text='По прогнозу для Нуса-Пениды низкая вода около 09:07, высокая около 14:31. Короткое посещение Crystal Bay 12:50-13:15 ориентировочно приходится на растущую воду. Это не отдельный прогноз для бухты и не подтверждённое окно купания.',
        source_name='Havstemperatur: прогноз Нуса-Пениды',
        source_url='https://www.havstemperatur.se/sydostasien/bali/nusa-penida/tides/month/all/?m=2026-10'),
}

def apply_tides(data):
    data['tide_notice'] = NOTICE
    for day in data['days']:
        day.pop('tides', None)
        if day['date'] in NOTES:
            day['tides'] = dict(NOTES[day['date']], checked='2026-10-14', timezone='Asia/Makassar')
    for note in NOTES.values():
        if not any(s['url'] == note['source_url'] for s in data['sources']):
            data['sources'].append(dict(name=note['source_name'], url=note['source_url'], checked='2026-10-14'))

if __name__ == '__main__':
    path = Path(__file__).resolve().parents[1] / 'itinerary.json'
    data = json.loads(path.read_text('utf-8'))
    apply_tides(data)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
