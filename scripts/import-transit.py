"""Trim the Busit GTFS feed to the map and trace freight lines along the mapped railway."""

import argparse
import csv
import heapq
import io
import zipfile
from math import hypot
from pathlib import Path
from urllib.request import urlopen

from data_files import read_json, write_json
from map_extent import HEIGHT, WIDTH, screen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist' / 'hamilton-transit.json.gz'
SCENE = ROOT / 'dist' / 'hamilton.json.gz'
FEED = 'https://wrcscheduledata.blob.core.windows.net/wrcgtfs/busit-nz-public.zip'
TOLERANCE = 1.5


def metres(lat, lon):
    return (float(lon) - 175.286) * 87900, (-37.792 - float(lat)) * 111000


def visible(east, south, margin=40):
    x, y = screen(east, south)
    return -margin <= x <= WIDTH + margin and -margin <= y <= HEIGHT + margin


def seconds(text):
    hours, minutes, secs = (int(part) for part in text.split(':'))
    return hours * 3600 + minutes * 60 + secs


def offset(point, a, b):
    (px, py), (ax, ay), (bx, by) = point, a, b
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    t = 0 if not length else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length))
    return hypot(px - ax - t * dx, py - ay - t * dy)


def simplify(points, tolerance):
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        worst, index = 0, None
        for i in range(first + 1, last):
            gap = offset(points[i][:2], points[first][:2], points[last][:2])
            if gap > worst:
                worst, index = gap, i
        if index is not None and worst > tolerance:
            keep[index] = True
            stack += [(first, index), (index, last)]
    return [point for point, kept in zip(points, keep) if kept]


def read(archive, name):
    with archive.open(name) as handle:
        return list(csv.DictReader(io.TextIOWrapper(handle, 'utf-8-sig')))


def services(archive):
    table = {}
    for row in read(archive, 'calendar.txt'):
        table[row['service_id']] = {
            'days': ''.join(row[day] for day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
            'start': int(row['start_date']), 'end': int(row['end_date']), 'add': [], 'remove': [],
        }
    for row in read(archive, 'calendar_dates.txt'):
        service = table.setdefault(row['service_id'], {'days': '0000000', 'start': 0, 'end': 0, 'add': [], 'remove': []})
        service['add' if row['exception_type'] == '1' else 'remove'].append(int(row['date']))
    return table


def shapes(archive):
    rows = {}
    for row in read(archive, 'shapes.txt'):
        rows.setdefault(row['shape_id'], []).append(row)
    trimmed = {}
    for shape_id, points in rows.items():
        points.sort(key=lambda row: int(row['shape_pt_sequence']))
        travelled, previous, line = 0, None, []
        for row in points:
            east, south = metres(row['shape_pt_lat'], row['shape_pt_lon'])
            if previous:
                travelled += hypot(east - previous[0], south - previous[1])
            given = row.get('shape_dist_traveled')
            line.append((east, south, float(given) if given else travelled))
            previous = east, south
        inside = [i for i, (east, south, _) in enumerate(line) if visible(east, south)]
        if not inside:
            continue
        line = line[max(0, inside[0] - 1):inside[-1] + 2]
        trimmed[shape_id] = simplify(line, TOLERANCE)
    return trimmed


def project_onto(shape, east, south):
    best, along = float('inf'), 0
    for (ax, ay, ad), (bx, by, bd) in zip(shape, shape[1:]):
        dx, dy = bx - ax, by - ay
        length = dx * dx + dy * dy
        t = 0 if not length else max(0, min(1, ((east - ax) * dx + (south - ay) * dy) / length))
        gap = hypot(east - ax - t * dx, south - ay - t * dy)
        if gap < best:
            best, along = gap, ad + (bd - ad) * t
    return along


def timetable(archive, kept_shapes, routes):
    stop_rows = read(archive, 'stops.txt')
    stops = {row['stop_id']: metres(row['stop_lat'], row['stop_lon']) for row in stop_rows}
    names = {row['stop_id']: row['stop_name'].replace(', Hamilton', '').strip() for row in stop_rows}
    trips = {row['trip_id']: row for row in read(archive, 'trips.txt')
             if row['shape_id'] in kept_shapes and row['route_id'] in routes}
    times = {}
    for row in read(archive, 'stop_times.txt'):
        if row['trip_id'] in trips:
            times.setdefault(row['trip_id'], []).append(row)
    return stops, names, trips, times


def freight_lines(scene):
    nodes, edges = {}, {}
    key = lambda point: (round(point[0] * 2), round(point[1] * 2))
    for kind, _bridge, _tunnel, line, *_ in scene['roads']:
        if kind != 'rail':
            continue
        for a, b in zip(line, line[1:]):
            ka, kb = key(a), key(b)
            nodes[ka], nodes[kb] = a, b
            length = hypot(b[0] - a[0], b[1] - a[1])
            edges.setdefault(ka, {})[kb] = length
            edges.setdefault(kb, {})[ka] = length
    ends = [node for node, links in edges.items() if len(links) == 1 and not visible(*nodes[node], margin=100)]
    position = lambda node: screen(*nodes[node])

    def route(start, goal):
        best, previous, queue = {start: 0}, {}, [(0, start)]
        while queue:
            cost, node = heapq.heappop(queue)
            if node == goal:
                break
            if cost > best[node]:
                continue
            for neighbour, length in edges[node].items():
                total = cost + length
                if total < best.get(neighbour, float('inf')):
                    best[neighbour], previous[neighbour] = total, node
                    heapq.heappush(queue, (total, neighbour))
        if goal not in best:
            return None
        path, node = [goal], goal
        while node != start:
            node = previous[node]
            path.append(node)
        return [nodes[node] for node in reversed(path)]

    west = min(ends, key=lambda node: position(node)[0])
    south = max(ends, key=lambda node: position(node)[1])
    north_east = max(ends, key=lambda node: position(node)[0] - position(node)[1])
    lines = []
    for start, goal in ((west, south), (west, north_east)):
        path = route(start, goal)
        if path:
            lines.append([round(value, 1) for point in simplify([(*p, 0) for p in path], 0.6) for value in point[:2]])
    return lines


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('feed', nargs='?', help='A saved copy of the Busit GTFS zip')
    args = parser.parse_args()
    data = Path(args.feed).read_bytes() if args.feed else urlopen(FEED).read()
    archive = zipfile.ZipFile(io.BytesIO(data))

    route_rows = {row['route_id']: row for row in read(archive, 'routes.txt')}
    kept_shapes = shapes(archive)
    stops, names, trips, times = timetable(archive, kept_shapes, route_rows)
    calendar = services(archive)

    route_index, service_index, shape_index, text_index = {}, {}, {}, {}
    output_routes, output_services, output_shapes, output_trips, output_text = [], [], [], [], []

    def text(value):
        if value not in text_index:
            text_index[value] = len(output_text)
            output_text.append(value)
        return text_index[value]

    for trip_id, trip in sorted(trips.items()):
        shape = kept_shapes[trip['shape_id']]
        rows = sorted(times.get(trip_id, []), key=lambda row: int(row['stop_sequence']))
        if len(rows) < 2:
            continue
        low, high = shape[0][2], shape[-1][2]
        sequence = []
        for row in rows:
            given = row.get('shape_dist_traveled')
            along = float(given) if given else project_onto(shape, *stops[row['stop_id']])
            sequence.append((seconds(row['arrival_time']), seconds(row['departure_time']), along, text(names[row['stop_id']])))
        before = [i for i, (_, _, along, _) in enumerate(sequence) if along <= low]
        after = [i for i, (_, _, along, _) in enumerate(sequence) if along >= high]
        first = before[-1] if before else 0
        last = after[0] if after else len(sequence) - 1
        sequence = sequence[first:last + 1]
        if len(sequence) < 2 or sequence[-1][2] < low or sequence[0][2] > high:
            continue
        if trip['route_id'] not in route_index:
            row = route_rows[trip['route_id']]
            route_index[trip['route_id']] = len(output_routes)
            output_routes.append([row['route_short_name'], row['route_long_name'], '#' + (row['route_color'] or '0073d1'),
                                  '#' + (row['route_text_color'] or 'ffffff'), int(row['route_type'])])
        if trip['service_id'] not in service_index:
            service_index[trip['service_id']] = len(output_services)
            output_services.append(calendar.get(trip['service_id'], {'days': '0000000', 'start': 0, 'end': 0, 'add': [], 'remove': []}))
        if trip['shape_id'] not in shape_index:
            shape_index[trip['shape_id']] = len(output_shapes)
            output_shapes.append([round(value) for point in shape for value in point])
        encoded, clock, distance = [], 0, 0
        for arrival, departure, along, name in sequence:
            encoded += [arrival - clock, departure - arrival, round(along) - distance, name]
            clock, distance = departure, round(along)
        output_trips.append([route_index[trip['route_id']], service_index[trip['service_id']],
                             shape_index[trip['shape_id']], text(trip['trip_headsign'].strip()), *encoded])

    scene = read_json(SCENE)
    result = {
        'source': 'Busit GTFS, Waikato Regional Council',
        'text': output_text, 'routes': output_routes, 'services': output_services, 'shapes': output_shapes, 'trips': output_trips,
        'freight': freight_lines(scene),
    }
    write_json(OUTPUT, result)
    print(f'{len(output_routes)} routes, {len(output_trips)} trips, {len(output_shapes)} shapes, '
          f'{len(result["freight"])} freight lines, {OUTPUT.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
