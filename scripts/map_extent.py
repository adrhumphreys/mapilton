"""The projected map extent, matching the camera in dist/city.js."""

from math import cos, pi, sin

WIDTH, HEIGHT = 5900, 2800
ORIGIN_X, ORIGIN_Y = 3880, 1790
SCALE, PITCH = 0.58, 0.68
COS, SIN = cos(pi / 9), sin(pi / 9)


def screen(east, south):
    return (ORIGIN_X + SCALE * (COS * east + SIN * south),
            ORIGIN_Y + SCALE * PITCH * (COS * south - SIN * east))


def ground(x, y):
    across, depth = (x - ORIGIN_X) / SCALE, (y - ORIGIN_Y) / (SCALE * PITCH)
    return COS * across - SIN * depth, SIN * across + COS * depth


def in_scene(points, margin=120):
    x, y = zip(*(screen(east, south) for east, south in points))
    return (min(x) <= WIDTH + margin and max(x) >= -margin
            and min(y) <= HEIGHT + margin and max(y) >= -margin)


def footprint_key(ring):
    # Neighbouring buildings can share their first edge.
    return ','.join(format(value, '.10g') for value in (*ring[0], *ring[1], *ring[2], len(ring)))
