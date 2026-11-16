"""Read and write the gzip-compressed JSON data bundled with the viewer."""

import gzip
import json


def write_json(path, value):
    with open(path, 'wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', compresslevel=9, mtime=0) as handle:
        handle.write(json.dumps(value, separators=(',', ':')).encode())


def read_json(path):
    with gzip.open(path, 'rb') as handle:
        return json.loads(handle.read())
