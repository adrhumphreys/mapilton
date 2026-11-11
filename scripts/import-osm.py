"""Convert OpenStreetMap extracts into the atlas's compact scene data."""

import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from map_extent import in_scene

OUTPUT = Path(__file__).resolve().parents[1] / 'dist' / 'hamilton.json'
ENDPOINT = 'https://api.openstreetmap.org/api/0.6/map'


def point(node):
    return [
        round((node['lon'] - 175.286) * 87900, 1),
        round((-37.792 - node['lat']) * 111000, 1),
    ]


def geometry(way):
    return [point(node) for node in way.get('geometry', []) if node]


def closed_rings(parts):
    parts = [part for part in parts if len(part) > 1]
    rings = []
    while parts:
        chain = parts.pop()
        while chain[0] != chain[-1]:
            for i, part in enumerate(parts):
                if chain[-1] == part[0]:
                    chain.extend(parts.pop(i)[1:])
                    break
                if chain[-1] == part[-1]:
                    chain.extend(parts.pop(i)[-2::-1])
                    break
                if chain[0] == part[-1]:
                    chain = parts.pop(i)[:-1] + chain
                    break
                if chain[0] == part[0]:
                    chain = parts.pop(i)[:0:-1] + chain
                    break
            else:
                break
        if len(chain) >= 4 and chain[0] == chain[-1]:
            rings.append(chain)
    return rings


def contains(ring, point):
    x, y = point
    inside = False
    for (ax, ay), (bx, by) in zip(ring, ring[1:]):
        if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
            inside = not inside
    return inside


def area_kind(tags):
    if tags.get('highway') == 'pedestrian' and tags.get('area') == 'yes':
        return 'plaza'
    if tags.get('natural') == 'water':
        return 'water'
    if tags.get('natural') in ('wood', 'scrub') or tags.get('landuse') == 'forest':
        return 'wood'
    if tags.get('leisure') in ('pitch', 'stadium'):
        return 'pitch'
    if tags.get('amenity') == 'parking':
        return 'parking' if tags.get('parking', 'surface') == 'surface' else None
    if 'leisure' in tags or 'landuse' in tags:
        return 'grass'
    return None


def street_detail(tags):
    highway = tags.get('highway')
    markings = tags.get('crossing:markings', '')
    if highway == 'crossing' or tags.get('traffic_signals') == 'pedestrian_crossing':
        if markings == 'no' or tags.get('crossing') == 'unmarked':
            return None
        if markings.startswith('zebra') or tags.get('crossing') == 'zebra':
            return 'crossing', 'zebra'
        if markings in ('yes', 'lines') or tags.get('crossing') == 'traffic_signals' or tags.get('traffic_signals') == 'pedestrian_crossing':
            return 'crossing', 'lines'
    if highway == 'traffic_signals' and tags.get('traffic_signals:direction'):
        return 'signal', None
    if highway == 'bus_stop':
        return 'bus', tags.get('shelter') == 'yes'
    if highway == 'street_lamp':
        return 'lamp', None
    if tags.get('amenity') == 'waste_basket':
        return 'bin', None
    if tags.get('amenity') == 'drinking_water':
        return 'fountain', None
    if tags.get('leisure') == 'picnic_table':
        return 'picnic', None
    if tags.get('amenity') == 'bench':
        return 'bench', None
    if tags.get('amenity') == 'bicycle_parking' and tags.get('bicycle_parking') in ('stands', 'rack'):
        capacity = tags.get('capacity', '')
        return 'bicycle', min(8, max(1, int(capacity) // 2)) if capacity.isdecimal() else 3
    return None


def convert(snapshot):
    elements = snapshot['elements']
    scene = {key: [] for key in ('areas', 'buildings', 'roads', 'trees', 'streetDetails')}
    building_members = {
        member['ref']
        for element in elements
        if element['type'] == 'relation' and 'building' in element.get('tags', {})
        for member in element.get('members', [])
        if member['type'] == 'way' and member.get('role') in ('outer', 'inner')
    }
    for element in elements:
        tags = element.get('tags', {})
        kind = element['type']
        if kind == 'node':
            if tags.get('natural') == 'tree':
                scene['trees'].append(point(element))
            detail = street_detail(tags)
            if detail:
                feature, variant = detail
                scene['streetDetails'].append([feature, *point(element), variant])
            continue
        if kind == 'relation':
            if ('building' in tags or area_kind(tags)) and tags.get('type') == 'multipolygon':
                members = element.get('members', [])
                outer = closed_rings([geometry(m) for m in members if m.get('role') == 'outer'])
                inner = closed_rings([geometry(m) for m in members if m.get('role') == 'inner'])
                if 'building' in tags:
                    for ring in outer:
                        holes = [hole for hole in inner if contains(ring, hole[0])]
                        building = [tags['building'], tags.get('height'), tags.get('building:levels'), ring]
                        if holes:
                            building.append(holes)
                        scene['buildings'].append(building)
                elif outer:
                    scene['areas'].append([area_kind(tags), outer + inner])
            continue
        if kind != 'way':
            continue
        points = geometry(element)
        if len(points) < 2:
            continue
        closed = len(points) >= 4 and points[0] == points[-1]
        if 'building' in tags and closed and element.get('id') not in building_members:
            scene['buildings'].append([tags['building'], tags.get('height'), tags.get('building:levels'), points])
        elif closed and area_kind(tags):
            scene['areas'].append([area_kind(tags), [points]])
        elif 'highway' in tags or tags.get('railway') == 'rail':
            road = [
                tags.get('highway', 'rail'), tags.get('bridge', 'no') != 'no',
                tags.get('tunnel', 'no') != 'no' or tags.get('location') == 'underground', points,
            ]
            count = tags.get('step_count', '')
            if road[0] == 'steps' and count.isdecimal() and 1 <= int(count) <= 200:
                road.append([int(count), tags.get('handrail') == 'yes'])
            if tags.get('service') == 'parking_aisle':
                road.append('parking_aisle')
            scene['roads'].append(road)
    scene['areas'] = [area for area in scene['areas'] if in_scene([p for ring in area[1] for p in ring])]
    scene['buildings'] = [building for building in scene['buildings'] if in_scene(building[3])]
    scene['roads'] = [road for road in scene['roads'] if in_scene(road[3])]
    scene['trees'] = [tree for tree in scene['trees'] if in_scene([tree])]
    scene['streetDetails'] = [detail for detail in scene['streetDetails'] if in_scene([detail[1:3]])]
    for key in ('areas', 'buildings', 'roads'):
        if not scene[key]:
            raise ValueError(f'OSM snapshot contains no {key}')
    return scene


def tile_bounds():
    for column in range(-5, 8):
        for row in range(-3, 9):
            west, south = 175.259 + column * 0.014, -37.814 + row * 0.011
            east, north = west + 0.014, south + 0.011
            corners = [((lon - 175.286) * 87900, (-37.792 - lat) * 111000)
                       for lon in (west, east) for lat in (south, north)]
            if in_scene(corners):
                yield column, row, (west, south, east, north)


def fetch_tiles():
    for _, _, bounds in tile_bounds():
        url = ENDPOINT + '?bbox=' + ','.join(f'{v:.5f}' for v in bounds)
        with urlopen(Request(url, headers={'User-Agent': 'PixelHamilton/1.0'}), timeout=60) as response:
            yield ElementTree.parse(response).getroot()


def read_osm(tiles):
    nodes, ways, relations = {}, {}, {}
    for tile in tiles:
        for element in tile:
            tags = {tag.attrib['k']: tag.attrib['v'] for tag in element.findall('tag')}
            if element.tag == 'node':
                nodes[element.attrib['id']] = {
                    'type': 'node', 'lat': float(element.attrib['lat']),
                    'lon': float(element.attrib['lon']), 'tags': tags,
                }
            elif element.tag == 'way':
                refs = [node.attrib['ref'] for node in element.findall('nd')]
                ways[element.attrib['id']] = {'type': 'way', 'id': element.attrib['id'], 'tags': tags, 'refs': refs}
            elif element.tag == 'relation' and tags.get('type') == 'multipolygon' and ('building' in tags or area_kind(tags)):
                relations[element.attrib['id']] = {
                    'type': 'relation', 'tags': tags,
                    'members': [dict(member.attrib) for member in element.findall('member')],
                }

    for way in ways.values():
        way['geometry'] = [nodes[ref] for ref in way.pop('refs')]
    for relation in relations.values():
        for member in relation['members']:
            if member['type'] == 'way' and member['ref'] in ways:
                member['geometry'] = ways[member['ref']]['geometry']
    return {'elements': [*nodes.values(), *ways.values(), *relations.values()]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tiles', type=Path, nargs='*', help='Use saved OSM XML extracts instead of fetching')
    args = parser.parse_args()
    tiles = (ElementTree.parse(file).getroot() for file in args.tiles) if args.tiles else fetch_tiles()
    scene = convert(read_osm(tiles))
    OUTPUT.write_text(json.dumps(scene, separators=(',', ':')) + '\n')
    print(', '.join(f'{len(value)} {key}' for key, value in scene.items()))


if __name__ == '__main__':
    main()
