"""Attach dated tide references without treating them as swimming clearance."""
import json
from pathlib import Path

NOTICE = ('Проверено 16.10.2026; время Бали, WITA / UTC+8. Это прогнозы для районов, '
          'а не измерения на конкретном пляже. Разные модели дают разные времена и высоты. '
          'Купание зависит также от волн, течений и флагов; следуйте указаниям спасателей. '
          'Запланированное время на пляже включает отдых на берегу, если купание запрещено.')

NOTES = {
    '2026-10-18': dict(
        area='Пандава и Melasti: ориентир Беноа',
        text='Ориентир Беноа: низкая вода около 08:05, высокая около 14:05. Пандава 09:15-10:45 и Melasti 11:30-13:30 приходятся на растущую воду. Это не подтверждённые окна безопасного купания; волны, флаги и условия на пляже проверить на месте.',
        source_name='Tides Today: прогноз Беноа',
        source_url='https://tides.today/en/%F0%9F%8C%8D/indonesia/bali/benoa'),
    '2026-10-21': dict(
        area='Blue Lagoon и Bias Tugel: только районный ориентир',
        text='Местный прогноз Падангбая на 21 октября пока не подтверждён. Для Беноа опубликованы низкая вода около 12:28 и высокая около 19:36; станция находится в другом районе, это не точное время для этих пляжей. Blue Lagoon 13:40-14:40 и Bias Tugel 15:10-16:10: перед поездкой проверить местные приливы, волны, течения и флаги. Эти часы не являются подтверждённым окном безопасного купания.',
        source_name='Tides Today: Беноа, справочный прогноз другого района',
        source_url='https://tides.today/en/%F0%9F%8C%8D/indonesia/bali/benoa'),
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
            day['tides'] = dict(NOTES[day['date']], checked='2026-10-16', timezone='Asia/Makassar')
    for note in NOTES.values():
        if not any(s['url'] == note['source_url'] for s in data['sources']):
            data['sources'].append(dict(name=note['source_name'], url=note['source_url'], checked='2026-10-16'))

if __name__ == '__main__':
    path = Path(__file__).resolve().parents[1] / 'itinerary.json'
    data = json.loads(path.read_text('utf-8'))
    apply_tides(data)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
