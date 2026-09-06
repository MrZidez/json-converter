from flask import Flask, request, jsonify, send_from_directory
import json
import re
import base64
import urllib.parse
import os

app = Flask(__name__, static_folder='.', static_url_path='')

# ===== ЛОГИКА КОНВЕРТАЦИИ =====

def parse_vless(url):
    url = url.replace('vless://', '')
    tag = ''
    if '#' in url:
        url, tag = url.split('#', 1)
        tag = urllib.parse.unquote(tag.strip())
    if not tag:
        tag = 'proxy'

    if '@' not in url:
        return None
    uid, rest = url.split('@', 1)
    if '?' in rest:
        addr_port, params = rest.split('?', 1)
    else:
        addr_port = rest
        params = ''
    if ':' not in addr_port:
        return None
    address, port = addr_port.split(':', 1)

    param_dict = {}
    if params:
        for p in params.split('&'):
            if '=' in p:
                k, v = p.split('=', 1)
                if k in ('path', 'host'):
                    v = urllib.parse.unquote(v)
                param_dict[k] = v

    network = param_dict.get('type', 'tcp')
    security = param_dict.get('security', 'none')

    outbound = {
        "tag": tag,
        "protocol": "vless",
        "settings": {
            "vnext": [{
                "address": address,
                "port": int(port),
                "users": [{
                    "id": uid,
                    "encryption": param_dict.get('encryption', 'none'),
                    "flow": param_dict.get('flow', ''),
                    "level": 0
                }]
            }]
        }
    }

    stream = {"network": network, "security": security}

    if network == 'ws':
        ws = {}
        if 'path' in param_dict:
            ws['path'] = param_dict['path']
        if 'host' in param_dict:
            ws['headers'] = {"Host": param_dict['host']}
        elif 'sni' in param_dict:
            ws['headers'] = {"Host": param_dict['sni']}
        stream['wsSettings'] = ws

    if security == 'tls':
        tls = {}
        if 'sni' in param_dict:
            tls['serverName'] = param_dict['sni']
        elif 'host' in param_dict:
            tls['serverName'] = param_dict['host']
        tls['fingerprint'] = param_dict.get('fp', 'chrome')
        stream['tlsSettings'] = tls

    elif security == 'reality':
        reality = {}
        if 'sni' in param_dict:
            reality['serverName'] = param_dict['sni']
        if 'fp' in param_dict:
            reality['fingerprint'] = param_dict['fp']
        if 'pbk' in param_dict:
            reality['publicKey'] = param_dict['pbk']
        if 'sid' in param_dict:
            reality['shortId'] = param_dict['sid']
        stream['realitySettings'] = reality

    if network == 'xhttp':
        xhttp = {}
        if 'path' in param_dict:
            xhttp['path'] = param_dict['path']
        if 'mode' in param_dict:
            xhttp['mode'] = param_dict['mode']
        if 'host' in param_dict:
            xhttp['host'] = param_dict['host']
        if 'extra' in param_dict:
            try:
                xhttp['extra'] = json.loads(param_dict['extra'])
            except:
                pass
        stream['xhttpSettings'] = xhttp

    elif network == 'grpc':
        grpc = {}
        if 'serviceName' in param_dict:
            grpc['serviceName'] = param_dict['serviceName']
        if param_dict.get('mode') == 'gun':
            grpc['multiMode'] = True
        stream['grpcSettings'] = grpc

    if stream:
        outbound['streamSettings'] = stream

    return outbound

def parse_hysteria2(url):
    url = url.replace('hysteria2://', '')
    tag = ''
    if '#' in url:
        url, tag = url.split('#', 1)
        tag = urllib.parse.unquote(tag.strip())
    if not tag:
        tag = 'proxy'

    if '@' not in url:
        return None
    auth, rest = url.split('@', 1)
    if '?' in rest:
        addr_port, params = rest.split('?', 1)
    else:
        addr_port = rest
        params = ''
    if ':' not in addr_port:
        return None
    address, port = addr_port.split(':', 1)

    param_dict = {}
    if params:
        for p in params.split('&'):
            if '=' in p:
                k, v = p.split('=', 1)
                if k == 'sni':
                    v = urllib.parse.unquote(v)
                param_dict[k] = v

    outbound = {
        "tag": tag,
        "protocol": "hysteria",
        "settings": {"address": address, "port": int(port), "version": 2},
        "streamSettings": {
            "network": "hysteria",
            "security": "tls",
            "hysteriaSettings": {"version": 2, "auth": auth}
        }
    }

    tls = {}
    if 'sni' in param_dict:
        tls['serverName'] = param_dict['sni']
    if 'fp' in param_dict:
        tls['fingerprint'] = param_dict['fp']
    if tls:
        outbound['streamSettings']['tlsSettings'] = tls

    return outbound

def parse_trojan(url):
    url = url.replace('trojan://', '')
    tag = ''
    if '#' in url:
        url, tag = url.split('#', 1)
        tag = urllib.parse.unquote(tag.strip())
    if not tag:
        tag = 'proxy'

    if '@' not in url:
        return None
    password, rest = url.split('@', 1)
    if '?' in rest:
        addr_port, params = rest.split('?', 1)
    else:
        addr_port = rest
        params = ''
    if ':' not in addr_port:
        return None
    address, port = addr_port.split(':', 1)

    param_dict = {}
    if params:
        for p in params.split('&'):
            if '=' in p:
                k, v = p.split('=', 1)
                if k in ('path', 'host'):
                    v = urllib.parse.unquote(v)
                param_dict[k] = v

    outbound = {
        "tag": tag,
        "protocol": "trojan",
        "settings": {"servers": [{"address": address, "port": int(port), "password": password}]}
    }

    stream = {}
    network = param_dict.get('type', 'tcp')
    security = param_dict.get('security', 'tls')
    stream['network'] = network
    stream['security'] = security

    if security == 'tls':
        tls = {}
        if 'sni' in param_dict:
            tls['serverName'] = param_dict['sni']
        elif 'host' in param_dict:
            tls['serverName'] = param_dict['host']
        if 'fp' in param_dict:
            tls['fingerprint'] = param_dict['fp']
        stream['tlsSettings'] = tls

    if network == 'ws':
        ws = {}
        if 'path' in param_dict:
            ws['path'] = param_dict['path']
        if 'host' in param_dict:
            ws['headers'] = {'Host': param_dict['host']}
        stream['wsSettings'] = ws

    if stream:
        outbound['streamSettings'] = stream

    return outbound

def parse_vmess(url):
    url = url.replace('vmess://', '')
    try:
        decoded = base64.b64decode(url).decode('utf-8')
        config = json.loads(decoded)
        uid = config.get('id', '')
        if len(uid) > 36:
            uid = uid[:36]
        tag = config.get('ps', 'proxy')
        tag = urllib.parse.unquote(tag)

        outbound = {
            "tag": tag,
            "protocol": "vmess",
            "settings": {
                "vnext": [{
                    "address": config.get('add', ''),
                    "port": int(config.get('port', 0)),
                    "users": [{
                        "id": uid,
                        "alterId": int(config.get('aid', 0)),
                        "security": config.get('scy', 'auto')
                    }]
                }]
            },
            "streamSettings": {
                "network": config.get('net', 'tcp'),
                "security": config.get('tls', 'none')
            }
        }

        if config.get('net') == 'ws':
            ws = {}
            if 'path' in config:
                ws['path'] = config['path']
            if 'host' in config:
                ws['headers'] = {'Host': config['host']}
            outbound['streamSettings']['wsSettings'] = ws

        if config.get('tls') == 'tls':
            tls = {}
            if 'sni' in config:
                tls['serverName'] = config['sni']
            if 'fp' in config:
                tls['fingerprint'] = config['fp']
            outbound['streamSettings']['tlsSettings'] = tls

        return outbound
    except:
        return None

def parse_shadowsocks(url):
    url = url.replace('ss://', '')
    tag = ''
    if '#' in url:
        url, tag = url.split('#', 1)
        tag = urllib.parse.unquote(tag.strip())
    if not tag:
        tag = 'proxy'

    if '@' in url:
        method_password, rest = url.split('@', 1)
        if ':' in method_password:
            method, password = method_password.split(':', 1)
        else:
            method = 'aes-256-gcm'
            password = method_password

        if '?' in rest:
            addr_port, _ = rest.split('?', 1)
        else:
            addr_port = rest

        if ':' not in addr_port:
            return None
        address, port = addr_port.split(':', 1)

        return {
            "tag": tag,
            "protocol": "shadowsocks",
            "settings": {
                "servers": [{
                    "address": address,
                    "port": int(port),
                    "method": method,
                    "password": password
                }]
            }
        }
    return None

def parse_link(entry):
    url = entry.get('data', '')
    typ = entry.get('type', '')
    if typ == 'vless':
        return parse_vless(url)
    elif typ == 'hysteria2':
        return parse_hysteria2(url)
    elif typ == 'trojan':
        return parse_trojan(url)
    elif typ == 'vmess':
        return parse_vmess(url)
    elif typ == 'ss':
        return parse_shadowsocks(url)
    elif typ == 'json':
        return entry.get('data')
    return None

def convert_groups(groups):
    result = []
    for g in groups:
        outbounds = []
        counter = 1
        for entry in g.get('servers', []):
            ob = parse_link(entry)
            if ob:
                if ob.get('tag') == 'proxy':
                    ob['tag'] = f'proxy-{counter}'
                    counter += 1
                outbounds.append(ob)

        if not outbounds:
            continue

        outbounds.append({"tag": "direct", "protocol": "freedom"})
        outbounds.append({"tag": "block", "protocol": "blackhole"})

        result.append({
            "remarks": g['name'],
            "dns": {
                "servers": ["1.1.1.1", "1.0.0.1"],
                "queryStrategy": "UseIP"
            },
            "routing": {
                "rules": [{"type": "field", "protocol": ["bittorrent"], "outboundTag": "direct"}],
                "domainMatcher": "hybrid",
                "domainStrategy": "IPIfNonMatch"
            },
            "inbounds": [
                {
                    "tag": "socks",
                    "port": 10808,
                    "listen": "127.0.0.1",
                    "protocol": "socks",
                    "settings": {"udp": True, "auth": "noauth"},
                    "sniffing": {"enabled": True, "routeOnly": False, "destOverride": ["http", "tls", "quic"]}
                },
                {
                    "tag": "http",
                    "port": 10809,
                    "listen": "127.0.0.1",
                    "protocol": "http",
                    "settings": {"allowTransparent": False},
                    "sniffing": {"enabled": True, "routeOnly": False, "destOverride": ["http", "tls", "quic"]}
                }
            ],
            "outbounds": outbounds
        })
    return result

# ===== API =====

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def style():
    return send_from_directory('.', 'style.css')

@app.route('/script.js')
def script():
    return send_from_directory('.', 'script.js')

@app.route('/logo.jpg')
def logo():
    return send_from_directory('.', 'logo.jpg')

@app.route('/convert', methods=['POST'])
def convert():
    data = request.get_json()
    if not data or 'groups' not in data:
        return jsonify({'error': 'Нет данных'}), 400

    try:
        result = convert_groups(data['groups'])
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
