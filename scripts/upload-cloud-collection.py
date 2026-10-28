#!/usr/bin/env python3
"""Load verified collection objects into the existing private Site; secrets arrive on stdin only."""
import concurrent.futures
import hashlib
import http.client
import io
import json
from pathlib import Path
import sys
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

if sys.stdin.isatty():
    import termios
    settings = termios.tcgetattr(sys.stdin)
    hidden = settings[:]
    hidden[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin, termios.TCSANOW, hidden)
    print('Ready for private collection upload JSON on stdin (input is hidden).', flush=True)
    try:
        config = json.loads(sys.stdin.readline())
    finally:
        termios.tcsetattr(sys.stdin, termios.TCSANOW, settings)
else:
    config = json.load(sys.stdin)

origin = config['url'].rstrip('/')
parsed = urllib.parse.urlsplit(origin)
if parsed.scheme != 'https' or parsed.hostname != 'folio-html-workspace.byronjacobs.chatgpt.site' or parsed.path:
    raise ValueError('Upload destination must be the existing private Folio origin.')
directory = Path(config['directory'])
index_bytes = (directory / 'catalogue.json').read_bytes()
index = json.loads(index_bytes)
auth = {'OAI-Sites-Authorization': 'Bearer ' + config['serviceToken'], 'X-Folio-Ingest-Token': config['ingestToken']}
connections = threading.local()
proxy = urllib.parse.urlsplit(urllib.request.getproxies().get('https', ''))

class Reply(io.BytesIO):
    def __init__(self, body, headers):
        super().__init__(body)
        self.headers = headers

def send(path, method, body):
    # Reuse one TLS connection per worker instead of repeating CONNECT/TLS for
    # every HEAD and upload. The destination remains the exact existing Site.
    if proxy.scheme not in ('', 'http'):
        req = urllib.request.Request(origin + path, data=body, method=method, headers=auth)
        with urllib.request.urlopen(req, timeout=120) as response:
            return Reply(response.read(), response.headers)
    connection = getattr(connections, 'value', None)
    if connection is None:
        connection = http.client.HTTPSConnection(proxy.hostname or parsed.hostname, proxy.port or (80 if proxy.hostname else 443), timeout=120, context=ssl.create_default_context())
        if proxy.hostname:
            connection.set_tunnel(parsed.hostname, 443)
        connections.value = connection
    try:
        connection.request(method, path, body=body, headers={**auth, 'Connection': 'keep-alive', **({'Content-Type': 'application/octet-stream'} if body is not None else {})})
        response = connection.getresponse()
        content = response.read()
        if response.status >= 400:
            raise urllib.error.HTTPError(origin + path, response.status, response.reason, response.headers, io.BytesIO(content))
        return Reply(content, response.headers)
    except urllib.error.HTTPError:
        # The response was fully drained; expected 404 HEADs keep the socket usable.
        raise
    except (OSError, http.client.HTTPException):
        connection.close(); connections.value = None
        raise

def call(path, method='GET', body=None):
    for attempt in range(5):
        try:
            return send(path, method, body)
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(min(2 ** attempt, 8)); continue
            message = exc.read(2000).decode('utf8', 'replace')
            raise RuntimeError(f'HTTP {exc.code} at {path}: {message}') from None
        except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException):
            if attempt == 4:
                raise RuntimeError(f'Network transfer did not complete at {path}') from None
            time.sleep(min(2 ** attempt, 8))

def upload(item):
    hash_value, size = item
    path = '/api/collection/admin/object/' + hash_value
    try:
        with call(path, 'HEAD') as response:
            if response.headers.get('X-Content-SHA256') != hash_value or int(response.headers.get('Content-Length', '-1')) != size:
                raise RuntimeError('Stored object receipt does not match ' + hash_value)
            return hash_value, size, True
    except RuntimeError as exc:
        if not str(exc).startswith('HTTP 404 '):
            raise
    content = (directory / 'objects' / hash_value).read_bytes()
    if len(content) != size or hashlib.sha256(content).hexdigest() != hash_value:
        raise ValueError('Local object verification failed: ' + hash_value)
    with call(path, 'PUT', content) as response:
        result = json.load(response)
    if result.get('hash') != hash_value or result.get('size') != size or not result.get('stored'):
        raise RuntimeError('Upload acknowledgement failed: ' + hash_value)
    return hash_value, size, bool(result.get('reused'))

objects = list(index['objects'].items())
completed = {}
receipts = directory / 'upload-receipts.json'
start = time.monotonic()
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futures = {pool.submit(upload, item): item for item in objects}
    for future in concurrent.futures.as_completed(futures):
        hash_value, size, reused = future.result()
        completed[hash_value] = {'size': size, 'verified': True}
        receipts.write_text(json.dumps({'generation': index['generation'], 'objects': completed}, indent=2))
        if len(completed) % 10 == 0 or len(completed) == len(objects):
            total = sum(value['size'] for value in completed.values())
            print(f'Verified {len(completed)}/{len(objects)} objects · {total / 1024**3:.2f} GiB · {int(time.monotonic()-start)}s', flush=True)

print('All objects verified. Activating the complete collection…', flush=True)
with call('/api/collection/admin/commit', 'PUT', index_bytes) as response:
    committed = json.load(response)
if not committed.get('published') or committed.get('generation') != index['generation']:
    raise RuntimeError('Collection activation was not acknowledged.')
with call('/api/collection') as response:
    active = json.load(response)
if active.get('generation') != index['generation'] or active.get('stats') != index['stats']:
    raise RuntimeError('Active collection does not match the verified upload.')
report = {'generation': index['generation'], 'stats': index['stats'], 'verifiedObjects': len(completed), 'published': True, 'seconds': round(time.monotonic()-start)}
(directory / 'publication-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
