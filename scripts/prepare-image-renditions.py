#!/usr/bin/env python3
"""Add faithful image display variants and source dates; never alter original objects or IDs."""
import base64
import concurrent.futures
import datetime as dt
from functools import lru_cache
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import zipfile
from PIL import Image, ImageOps

source, target, input_file, dates_file = map(Path, sys.argv[1:5])
index = json.loads((source / 'catalogue.json').read_text())
original_generation = index['generation']
inputs = json.loads(input_file.read_text())['packages']
library_dates = {entry['id']: entry for entry in json.loads(dates_file.read_text())}
(target / 'objects').mkdir(parents=True, exist_ok=True)
(target / 'variants').mkdir(exist_ok=True)
for hash_value in index['objects']:
    destination = target / 'objects' / hash_value
    if not destination.exists(): os.link(source / 'objects' / hash_value, destination)

files, groups = {}, {}
for hash_value in sorted(set(index['manifests'].values())):
    group = json.loads((source / 'objects' / hash_value).read_text())
    groups.update(group['archives'])
    for manifest in group['archives'].values():
        files.update({file['id']: file for file in manifest['files']})
images = {}
for file in sorted(files.values(), key=lambda file: file['id']):
    if file['mime'].startswith('image/'): images.setdefault(file['sha256'], file)

@lru_cache(maxsize=4)
def shard(hash_value):
    return (source / 'objects' / hash_value).read_bytes()

def original_bytes(file):
    content = b''.join(shard(part['hash'])[part['offset']:part['offset'] + part['length']] for part in file['slices'])
    if len(content) != file['size'] or hashlib.sha256(content).hexdigest() != file['sha256']:
        raise ValueError('Original resource checksum mismatch: ' + file['id'])
    return content

def encode(image, size, quality):
    result = image.copy()
    result.thumbnail((size, size), Image.Resampling.LANCZOS)
    stream = io.BytesIO()
    options = {'format': 'WEBP', 'quality': quality, 'method': 4}
    if image.info.get('icc_profile'): options['icc_profile'] = image.info['icc_profile']
    result.save(stream, **options)
    content = stream.getvalue()
    decoded = Image.open(io.BytesIO(content))
    if decoded.size != result.size or content[:4] != b'RIFF' or content[8:12] != b'WEBP':
        raise ValueError('Generated image is invalid.')
    return content, result.size

def generate(item):
    hash_value, file = item
    content = original_bytes(file)
    meta = {'original': {key: file[key] for key in ['archiveId', 'path', 'mime', 'size']}}
    if file['mime'] == 'image/svg+xml':
        # Keep SVGs native: rasterizing unsupported filters would change the artwork.
        head = content[:12000].decode('utf8', 'replace')
        viewbox = re.search(r'\bviewBox\s*=\s*["\']\s*([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)', head)
        if viewbox:
            width, height = float(viewbox[3]), float(viewbox[4])
            if 0 < width < 65536 and 0 < height < 65536: meta.update(width=max(1, round(width)), height=max(1, round(height)))
        return hash_value, meta, []
    try:
        with Image.open(io.BytesIO(content)) as source_image:
            animated = getattr(source_image, 'n_frames', 1) > 1
            source_image.seek(0)
            oriented = ImageOps.exif_transpose(source_image)
            alpha = oriented.mode in ('RGBA', 'LA') or 'transparency' in oriented.info
            image = oriented.convert('RGBA' if alpha else 'RGB')
            if oriented.info.get('icc_profile'): image.info['icc_profile'] = oriented.info['icc_profile']
            meta.update(width=image.width, height=image.height)
            if animated: meta['animated'] = True
            thumb, thumb_size = encode(image, 360, 65)
            preview, preview_size = encode(image, 1600, 80)
            placeholder_image = image.copy(); placeholder_image.info.pop('icc_profile', None)
            tiny, _ = encode(placeholder_image, 24, 15)
            placeholder = 'data:image/webp;base64,' + base64.b64encode(tiny).decode('ascii')
            if len(placeholder.encode()) > 1024: raise ValueError('Placeholder exceeds its bound.')
            variants = []
            for kind, payload, dimensions in [('thumbnail', thumb, thumb_size), ('preview', preview, preview_size)]:
                variant_hash = hashlib.sha256(payload).hexdigest()
                (target / 'variants' / variant_hash).write_bytes(payload)
                meta[kind] = variant_hash; meta[kind + 'Bytes'] = len(payload)
                variants.append({'sha256': variant_hash, 'size': len(payload), 'mime': 'image/webp', 'width': dimensions[0], 'height': dimensions[1]})
            meta['placeholder'] = placeholder
            return hash_value, meta, variants
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        # Preserve the original and make unsupported display conversions explicit.
        return hash_value, meta, [{'error': str(error), 'originalHash': hash_value}]

image_meta, variant_meta, failures = {}, {}, []
if '--reuse-variants' in sys.argv[5:]:
    cached = json.loads((target / 'catalogue.json').read_text())
    if cached['manifests'] != index['manifests'] or set(cached['images']) != set(images): raise ValueError('Incompatible cached image generation.')
    image_meta = cached['images']; variant_meta = cached['imageAssets']
else:
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(generate, item) for item in images.items()]
        for number, future in enumerate(concurrent.futures.as_completed(futures), 1):
            hash_value, meta, variants = future.result(); image_meta[hash_value] = meta
            for variant in variants:
                if 'error' in variant: failures.append(variant)
                else: variant_meta[variant['sha256']] = variant
            if number % 200 == 0: print(f'Generated {number}/{len(images)} image display records', flush=True)
# Pack only new derivative bytes; all original immutable objects remain shared.
objects = dict(index['objects']); image_assets = {}; parts = []; size = 0; pending = []
def flush():
    global parts, size, pending
    if not size: return
    content = b''.join(parts); hash_value = hashlib.sha256(content).hexdigest()
    (target / 'objects' / hash_value).write_bytes(content); objects[hash_value] = len(content)
    for asset, offset, count in pending: asset['slices'] = [{'hash': hash_value, 'offset': offset, 'length': count}]
    parts = []; size = 0; pending = []
for hash_value, meta in sorted(variant_meta.items()):
    payload = (target / 'variants' / hash_value).read_bytes()
    if hashlib.sha256(payload).hexdigest() != hash_value: raise ValueError('Cached variant checksum mismatch.')
    if len(payload) > 4 * 1024 * 1024: raise ValueError('Display image exceeds 4 MiB.')
    if size + len(payload) > 16 * 1024 * 1024: flush()
    asset = {key: meta[key] for key in ['sha256', 'size', 'mime']}
    image_assets[hash_value] = asset; pending.append((asset, size, len(payload))); parts.append(payload); size += len(payload)
flush()

# Source date backfill follows the original archive graph, including nested ZIPs.
archive_map = {archive['id']: archive for archive in index['archives']}
children = {}
for archive in index['archives']: children.setdefault(archive['parentId'], []).append(archive)
page_dates = {}
def canonical(name): return '/'.join(part for part in name.replace('\\', '/').split('/') if part not in ('', '.'))
def timestamp(date_tuple):
    try:
        # This exact Back-to-the-Future timestamp is a reproducible ZIP exporter sentinel.
        if tuple(date_tuple) == (1985, 10, 26, 8, 15, 0): return None
        if date_tuple[0] <= 1980 or date_tuple[0] > 2100: return None
        return int(dt.datetime(*date_tuple, tzinfo=dt.timezone.utc).timestamp() * 1000)
    except (ValueError, OverflowError): return None
def walk_zip(stream, archive_id, fallback):
    with zipfile.ZipFile(stream) as archive:
        entries = {canonical(entry.filename): entry for entry in archive.infolist()}
        dates = []
        for file in groups[archive_id]['files']:
            entry = entries.get(file['path'])
            stamp = timestamp(entry.date_time) if entry else None
            if stamp: page_dates[file['id']] = (stamp, 'file'); dates.append(stamp)
            elif fallback: page_dates[file['id']] = (fallback, 'library'); dates.append(fallback)
        for child in children.get(archive_id, []):
            entry = entries.get(child['mountPath'])
            if entry:
                walk_zip(io.BytesIO(archive.read(entry)), child['id'], fallback)
                if archive_map[child['id']].get('modifiedAt'): dates.append(archive_map[child['id']]['modifiedAt'])
        if dates: archive_map[archive_id]['modifiedAt'] = max(dates)
for entry in inputs:
    root_id = f"cloud-{entry['sha256'][:20]}-{entry['order']}-0"
    source_date = library_dates.get(entry.get('library_file_id'))
    fallback = int(dt.datetime.fromisoformat(source_date['modifiedAt'].replace('Z', '+00:00')).timestamp() * 1000) if source_date else None
    walk_zip(Path(entry['source_path']), root_id, fallback)
for category in (archive for archive in index['archives'] if archive['parentId'] is None):
    dates = [child['modifiedAt'] for child in children.get(category['id'], []) if child.get('modifiedAt')]
    if dates: category['modifiedAt'] = max(dates)
for page in index['pages']:
    if page['id'] in page_dates: page['modifiedAt'], page['dateSource'] = page_dates[page['id']]
    file = files[page['id']]
    if page.get('kind') == 'image': page.update(imageHash=file['sha256'], mime=file['mime'])
index.update(images=dict(sorted(image_meta.items())), imageAssets=image_assets, objects=objects)
index['stats'].update(imageVariants=len(image_assets), displayImageBytes=sum(variant['size'] for variant in variant_meta.values()))
index['generation'] = hashlib.sha256(json.dumps({'source': original_generation, 'images': index['images'], 'imageAssets': image_assets, 'dates': page_dates}, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
encoded = json.dumps(index, separators=(',', ':')).encode()
if len(encoded) > 16 * 1024 * 1024: raise ValueError('Catalogue exceeds 16 MiB; do not upload.')
(target / 'catalogue.json').write_bytes(encoded)
month_counts = {}
for page in index['pages']:
    month = dt.datetime.fromtimestamp(page['modifiedAt'] / 1000, dt.timezone.utc).strftime('%Y-%m') if page.get('modifiedAt') else 'Undated'
    month_counts[month] = month_counts.get(month, 0) + 1
preview_sizes = sorted(meta['previewBytes'] for meta in image_meta.values() if 'preview' in meta)
thumb_sizes = sorted(meta['thumbnailBytes'] for meta in image_meta.values() if 'thumbnail' in meta)
reductions = sorted(meta['original']['size'] / max(1, meta['previewBytes']) for meta in image_meta.values() if 'preview' in meta)
def percentile(values, fraction): return values[int((len(values) - 1) * fraction)] if values else None
report = {'generation': index['generation'], 'originalGeneration': original_generation, 'originalIdsPreserved': True, 'uniqueImages': len(images), 'rasterImagesOptimized': len(preview_sizes), 'nativeVectorImages': sum(file['mime'] == 'image/svg+xml' for file in images.values()), 'conversionFailures': failures, 'variantCount': len(image_assets), 'newObjectCount': len(objects) - len(json.loads((source / 'catalogue.json').read_text())['objects']), 'rootBytes': len(encoded), 'thumbnailMedianBytes': percentile(thumb_sizes, .5), 'thumbnailP95Bytes': percentile(thumb_sizes, .95), 'previewMedianBytes': percentile(preview_sizes, .5), 'previewP95Bytes': percentile(preview_sizes, .95), 'medianPreviewReduction': percentile(reductions, .5), 'months': month_counts, 'stats': index['stats']}
(target / 'rendition-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
