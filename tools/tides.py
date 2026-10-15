"""Attach dated tide references without treating them as swimming clearance."""
import json
from pathlib import Path

NOTICE = ('Проверено 15.10.2026; время Бали, WITA / UTC+8. Это прогнозы для ближайших районов, '
          'а не измерения на конкретном пляже. Разные модели дают разные времена и высоты. '
          'Купание зависит также от волн, течений и флагов; следуйте указаниям спасателей. '
          'Запланированное время на пляже включает отдых на берегу, если купание запрещено.')

NOTES = {
    '2026-10-18': dict(
        area='Пандава и Melasti: ориентир Беноа',
        text='Ориентир Беноа: низкая вода около 08:05, высокая около 14:05. Пандава 09:15-10:15 и Melasti 11:00-12:45 приходятся на растущую воду. Это не подтверждённые окна безопасного купания; волны, флаги и условия на пляже проверить на месте.',
        source_name='Tides Today: прогноз Беноа',
        source_url='https://tides.today/en/%F0%9F%8C%8D/indonesia/bali/benoa'),
    '2026-10-15': dict(
        area='Blue Lagoon и Bias Tugel: ориентир Падангбай',
        text='По Surfline высокая вода около 12:57, низкая около 17:55. Blue Lagoon 14:55-15:40 и Bias Tugel 16:10-16:55 приходятся на убывающую воду. Каждая остановка 45 минут включает подход. Это ориентир порта Падангбай, а не подтверждённые окна безопасного купания: волны, течения и флаги проверяются на месте.',
        source_name='Surfline: прогноз Падангбая',
        source_url='https://www.surfline.com/tide-charts/padangbai/640a67cd99dd4433510cdc38'),
    '2026-10-17': dict(
        area='Пенида: Crystal Bay и Angel’s Billabong',
        text='Прогноз района Нуса-Пенида: низкая вода около 08:09, высокая около 13:43. Crystal Bay - короткий осмотр без купания. Angel’s Billabong только со смотровой: вход в природный бассейн не предусмотрен при любом приливе. Прогноз района не определяет местные течения и волны.',
        source_name='Havstemperatur: прогноз Нуса-Пениды',
        source_url='https://www.havstemperatur.se/sydostasien/bali/nusa-penida/tides/month/all/?m=2026-10'),
}

def apply_tides(data):
    data['tide_notice'] = NOTICE
    for day in data['days']:
        day.pop('tides', None)
        if day['date'] in NOTES:
            day['tides'] = dict(NOTES[day['date']], checked='2026-10-15', timezone='Asia/Makassar')
    for note in NOTES.values():
        if not any(s['url'] == note['source_url'] for s in data['sources']):
            data['sources'].append(dict(name=note['source_name'], url=note['source_url'], checked='2026-10-15'))

if __name__ == '__main__':
    path = Path(__file__).resolve().parents[1] / 'itinerary.json'
    data = json.loads(path.read_text('utf-8'))
    apply_tides(data)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
