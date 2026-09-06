// ============================================================
//  ВСЯ ЛОГИКА КОНВЕРТАЦИИ
// ============================================================

// ===== ОТЛАДКА =====
const debugLog = document.getElementById('debugLog');
let debugVisible = false;

function log(msg, type = 'info') {
    const types = {
        'error': 'log-error',
        'success': 'log-success',
        'info': 'log-info',
        'warning': 'log-warning'
    };
    const cls = types[type] || 'log-info';
    const time = new Date().toLocaleTimeString();
    debugLog.innerHTML += `<div><span class="${cls}">[${time}] ${msg}</span></div>`;
    debugLog.scrollTop = debugLog.scrollHeight;
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

function toggleDebug() {
    const console = document.getElementById('debugConsole');
    debugVisible = !debugVisible;
    console.style.display = debugVisible ? 'block' : 'none';
    if (debugVisible) {
        log('🐛 Отладка включена');
    }
}

// ===== ТЕМА =====
function toggleTheme() {
    const body = document.body;
    const btn = document.querySelector('.theme-toggle');
    if (body.classList.contains('light-theme')) {
        body.classList.remove('light-theme');
        btn.textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.add('light-theme');
        btn.textContent = '☀️';
        localStorage.setItem('theme', 'light');
    }
}

// Загрузка сохраненной темы
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    document.querySelector('.theme-toggle').textContent = '☀️';
}

// ===== СОСТОЯНИЕ =====
let lastInput = '';
let convertedData = null;

// ===== DOM =====
const inputArea = document.getElementById('inputArea');
const outputArea = document.getElementById('outputArea');
const linkCount = document.getElementById('linkCount');
const statsLabel = document.getElementById('statsLabel');
const outputSize = document.getElementById('outputSize');
const serverCount = document.getElementById('serverCount');
const autoConvert = document.getElementById('autoConvert');
const prettyJson = document.getElementById('prettyJson');
const inputStatus = document.getElementById('inputStatus');

// ===== СОБЫТИЯ =====
inputArea.addEventListener('input', () => {
    updateLinkCount();
    if (autoConvert.checked) {
        convert();
    }
});

inputArea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        convert();
    }
});

// ===== ФУНКЦИИ =====

function updateLinkCount() {
    const text = inputArea.value;
    const lines = text.split('\n').filter(l => l.trim());
    const links = lines.filter(l => /^(vless:\/\/|hysteria2:\/\/|trojan:\/\/|vmess:\/\/|ss:\/\/)/.test(l.trim()));
    linkCount.textContent = `${lines.length} строк, ${links.length} ссылок`;
    log(`Обновлен счетчик: ${lines.length} строк, ${links.length} ссылок`, 'info');
}

function pasteFromClipboard() {
    log('Попытка вставки из буфера...', 'info');
    navigator.clipboard.readText().then(text => {
        log(`Вставлено ${text.length} символов`, 'success');
        inputArea.value = text;
        updateLinkCount();
        if (autoConvert.checked) convert();
    }).catch((err) => {
        log(`Ошибка вставки: ${err.message}`, 'error');
        alert('Не удалось получить данные из буфера обмена');
    });
}

function clearInput() {
    log('Очистка ввода', 'warning');
    inputArea.value = '';
    updateLinkCount();
    lastInput = '';
    inputStatus.innerHTML = '<span>💡 Ввод очищен</span>';
}

function clearOutput() {
    log('Очистка вывода', 'warning');
    outputArea.value = '';
    statsLabel.textContent = 'Ожидание…';
    outputSize.textContent = '0';
    serverCount.textContent = '🌐 0 серверов';
    convertedData = null;
}

function copyJson() {
    const text = outputArea.value;
    if (!text) {
        log('Нет данных для копирования', 'warning');
        alert('Нет данных для копирования');
        return;
    }
    log(`Копирование ${text.length} символов...`, 'info');
    navigator.clipboard.writeText(text).then(() => {
        log('JSON скопирован!', 'success');
        const btn = document.querySelector('.btn.success');
        const orig = btn.textContent;
        btn.textContent = '✅ Скопировано!';
        setTimeout(() => btn.textContent = orig, 1500);
    }).catch(err => {
        log(`Ошибка копирования: ${err.message}`, 'error');
    });
}

function saveJson() {
    const text = outputArea.value;
    if (!text) {
        log('Нет данных для сохранения', 'warning');
        alert('Нет данных для сохранения');
        return;
    }
    log(`Сохранение ${text.length} символов...`, 'info');
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `happ_config_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    log('Файл сохранен', 'success');
}

function showStats() {
    if (!convertedData) {
        log('Нет данных для статистики', 'warning');
        alert('Сначала сконвертируйте данные');
        return;
    }
    const modal = document.getElementById('statsModal');
    const text = document.getElementById('statsText');
    const groups = convertedData.length;
    let servers = 0;
    const protocols = {};
    for (const g of convertedData) {
        for (const ob of g.outbounds || []) {
            if (ob.tag && !['direct', 'block'].includes(ob.tag)) {
                servers++;
                const proto = ob.protocol || 'unknown';
                protocols[proto] = (protocols[proto] || 0) + 1;
            }
        }
    }
    let protoStr = Object.entries(protocols)
        .map(([k, v]) => `   • ${k}: ${v}`)
        .join('\n');
    if (!protoStr) protoStr = '   • Не определено';

    text.textContent = `
📊 СТАТИСТИКА КОНФИГУРАЦИИ

📁 Групп: ${groups}
🌐 Всего серверов: ${servers}

📝 Протоколы:
${protoStr}

✅ Конфигурация готова к использованию в HAPP
💡 Размер: ${outputArea.value.length} символов
    `.trim();
    modal.classList.remove('hidden');
    log('Статистика показана', 'info');
}

function closeStats() {
    document.getElementById('statsModal').classList.add('hidden');
}

// ===== ОСНОВНАЯ ЛОГИКА КОНВЕРТАЦИИ =====

function parseVless(url) {
    log(`Парсинг VLESS: ${url.substring(0, 60)}...`, 'info');
    url = url.replace('vless://', '');
    let tag = '';
    if (url.includes('#')) {
        const parts = url.split('#');
        url = parts[0];
        tag = decodeURIComponent(parts[1] || '').trim();
    }
    if (!tag) tag = 'proxy';

    if (!url.includes('@')) {
        log('Ошибка: нет @ в VLESS ссылке', 'error');
        return null;
    }
    const [uid, rest] = url.split('@', 2);
    let addrPort = rest,
        params = '';
    if (rest.includes('?')) {
        const parts = rest.split('?');
        addrPort = parts[0];
        params = parts[1] || '';
    }
    if (!addrPort.includes(':')) {
        log('Ошибка: нет : в адресе', 'error');
        return null;
    }
    const [address, port] = addrPort.split(':', 2);

    const param = {};
    if (params) {
        for (const p of params.split('&')) {
            if (p.includes('=')) {
                const [k, v] = p.split('=', 2);
                param[k] = (k === 'path' || k === 'host') ? decodeURIComponent(v) : v;
            }
        }
    }

    const network = param.type || 'tcp';
    const security = param.security || 'none';

    log(`VLESS: ${address}:${port} | network: ${network} | security: ${security} | tag: ${tag}`, 'success');

    const outbound = {
        tag: tag,
        protocol: 'vless',
        settings: {
            vnext: [{
                address: address,
                port: parseInt(port),
                users: [{
                    id: uid,
                    encryption: param.encryption || 'none',
                    flow: param.flow || '',
                    level: 0
                }]
            }]
        }
    };

    const stream = { network: network, security: security };

    if (network === 'ws') {
        const ws = {};
        if (param.path) ws.path = param.path;
        if (param.host) ws.headers = { Host: param.host };
        else if (param.sni) ws.headers = { Host: param.sni };
        stream.wsSettings = ws;
    }

    if (security === 'tls') {
        const tls = {};
        if (param.sni) tls.serverName = param.sni;
        else if (param.host) tls.serverName = param.host;
        tls.fingerprint = param.fp || 'chrome';
        stream.tlsSettings = tls;
    } else if (security === 'reality') {
        const reality = {};
        if (param.sni) reality.serverName = param.sni;
        if (param.fp) reality.fingerprint = param.fp;
        if (param.pbk) reality.publicKey = param.pbk;
        if (param.sid) reality.shortId = param.sid;
        stream.realitySettings = reality;
    }

    if (network === 'xhttp') {
        const xhttp = {};
        if (param.path) xhttp.path = param.path;
        if (param.mode) xhttp.mode = param.mode;
        if (param.host) xhttp.host = param.host;
        if (param.extra) {
            try { xhttp.extra = JSON.parse(param.extra); } catch (e) { log(`Ошибка парсинга extra: ${e.message}`, 'warning'); }
        }
        stream.xhttpSettings = xhttp;
    } else if (network === 'grpc') {
        const grpc = {};
        if (param.serviceName) grpc.serviceName = param.serviceName;
        if (param.mode === 'gun') grpc.multiMode = true;
        stream.grpcSettings = grpc;
    }

    if (Object.keys(stream).length > 1) {
        outbound.streamSettings = stream;
    }

    return outbound;
}

function parseHysteria2(url) {
    log(`Парсинг Hysteria2: ${url.substring(0, 60)}...`, 'info');
    url = url.replace('hysteria2://', '');
    let tag = '';
    if (url.includes('#')) {
        const parts = url.split('#');
        url = parts[0];
        tag = decodeURIComponent(parts[1] || '').trim();
    }
    if (!tag) tag = 'proxy';

    if (!url.includes('@')) return null;
    const [auth, rest] = url.split('@', 2);
    let addrPort = rest,
        params = '';
    if (rest.includes('?')) {
        const parts = rest.split('?');
        addrPort = parts[0];
        params = parts[1] || '';
    }
    if (!addrPort.includes(':')) return null;
    const [address, port] = addrPort.split(':', 2);

    const param = {};
    if (params) {
        for (const p of params.split('&')) {
            if (p.includes('=')) {
                const [k, v] = p.split('=', 2);
                param[k] = (k === 'sni') ? decodeURIComponent(v) : v;
            }
        }
    }

    log(`Hysteria2: ${address}:${port} | tag: ${tag}`, 'success');

    const outbound = {
        tag: tag,
        protocol: 'hysteria',
        settings: { address: address, port: parseInt(port), version: 2 },
        streamSettings: {
            network: 'hysteria',
            security: 'tls',
            hysteriaSettings: { version: 2, auth: auth }
        }
    };

    const tls = {};
    if (param.sni) tls.serverName = param.sni;
    if (param.fp) tls.fingerprint = param.fp;
    if (Object.keys(tls).length) {
        outbound.streamSettings.tlsSettings = tls;
    }

    return outbound;
}

function parseTrojan(url) {
    log(`Парсинг Trojan: ${url.substring(0, 60)}...`, 'info');
    url = url.replace('trojan://', '');
    let tag = '';
    if (url.includes('#')) {
        const parts = url.split('#');
        url = parts[0];
        tag = decodeURIComponent(parts[1] || '').trim();
    }
    if (!tag) tag = 'proxy';

    if (!url.includes('@')) return null;
    const [password, rest] = url.split('@', 2);
    let addrPort = rest,
        params = '';
    if (rest.includes('?')) {
        const parts = rest.split('?');
        addrPort = parts[0];
        params = parts[1] || '';
    }
    if (!addrPort.includes(':')) return null;
    const [address, port] = addrPort.split(':', 2);

    const param = {};
    if (params) {
        for (const p of params.split('&')) {
            if (p.includes('=')) {
                const [k, v] = p.split('=', 2);
                param[k] = (k === 'path' || k === 'host') ? decodeURIComponent(v) : v;
            }
        }
    }

    log(`Trojan: ${address}:${port} | tag: ${tag}`, 'success');

    const network = param.type || 'tcp';
    const security = param.security || 'tls';

    const outbound = {
        tag: tag,
        protocol: 'trojan',
        settings: {
            servers: [{ address: address, port: parseInt(port), password: password }]
        }
    };

    const stream = { network: network, security: security };

    if (security === 'tls') {
        const tls = {};
        if (param.sni) tls.serverName = param.sni;
        else if (param.host) tls.serverName = param.host;
        if (param.fp) tls.fingerprint = param.fp;
        stream.tlsSettings = tls;
    }

    if (network === 'ws') {
        const ws = {};
        if (param.path) ws.path = param.path;
        if (param.host) ws.headers = { Host: param.host };
        stream.wsSettings = ws;
    }

    if (Object.keys(stream).length > 1) {
        outbound.streamSettings = stream;
    }

    return outbound;
}

function parseVmess(url) {
    log(`Парсинг VMESS...`, 'info');
    url = url.replace('vmess://', '');
    try {
        const decoded = atob(url);
        const config = JSON.parse(decoded);
        let uid = config.id || '';
        if (uid.length > 36) uid = uid.slice(0, 36);
        let tag = config.ps || 'proxy';
        try { tag = decodeURIComponent(tag); } catch (e) {}

        log(`VMESS: ${config.add || ''}:${config.port || 0} | tag: ${tag}`, 'success');

        const outbound = {
            tag: tag,
            protocol: 'vmess',
            settings: {
                vnext: [{
                    address: config.add || '',
                    port: parseInt(config.port || 0),
                    users: [{
                        id: uid,
                        alterId: parseInt(config.aid || 0),
                        security: config.scy || 'auto'
                    }]
                }]
            },
            streamSettings: {
                network: config.net || 'tcp',
                security: config.tls || 'none'
            }
        };

        if ((config.net || '') === 'ws') {
            const ws = {};
            if (config.path) ws.path = config.path;
            if (config.host) ws.headers = { Host: config.host };
            outbound.streamSettings.wsSettings = ws;
        }

        if ((config.tls || '') === 'tls') {
            const tls = {};
            if (config.sni) tls.serverName = config.sni;
            if (config.fp) tls.fingerprint = config.fp;
            outbound.streamSettings.tlsSettings = tls;
        }

        return outbound;
    } catch (e) {
        log(`Ошибка парсинга VMESS: ${e.message}`, 'error');
        return null;
    }
}

function parseShadowsocks(url) {
    log(`Парсинг Shadowsocks...`, 'info');
    url = url.replace('ss://', '');
    let tag = '';
    if (url.includes('#')) {
        const parts = url.split('#');
        url = parts[0];
        tag = decodeURIComponent(parts[1] || '').trim();
    }
    if (!tag) tag = 'proxy';

    if (url.includes('@')) {
        const [methodPassword, rest] = url.split('@', 2);
        let method = 'aes-256-gcm',
            password = methodPassword;
        if (methodPassword.includes(':')) {
            const parts = methodPassword.split(':');
            method = parts[0];
            password = parts[1] || '';
        }
        let addrPort = rest;
        if (rest.includes('?')) {
            addrPort = rest.split('?')[0];
        }
        if (!addrPort.includes(':')) return null;
        const [address, port] = addrPort.split(':', 2);

        log(`Shadowsocks: ${address}:${port} | method: ${method}`, 'success');

        return {
            tag: tag,
            protocol: 'shadowsocks',
            settings: {
                servers: [{
                    address: address,
                    port: parseInt(port),
                    method: method,
                    password: password
                }]
            }
        };
    }
    log('Ошибка парсинга Shadowsocks: нет @', 'error');
    return null;
}

function parseLink(entry) {
    const url = entry.data || '';
    const type = entry.type || '';
    try {
        if (type === 'vless') return parseVless(url);
        if (type === 'hysteria2') return parseHysteria2(url);
        if (type === 'trojan') return parseTrojan(url);
        if (type === 'vmess') return parseVmess(url);
        if (type === 'ss') return parseShadowsocks(url);
        if (type === 'json') return entry.data;
    } catch (e) {
        log(`Ошибка парсинга ${type}: ${e.message}`, 'error');
    }
    return null;
}

function convertGroups(groups) {
    log(`Начинаем конвертацию ${groups.length} групп...`, 'info');
    const result = [];
    for (const g of groups) {
        log(`Обработка группы: ${g.name} (${g.servers.length} серверов)`, 'info');
        const outbounds = [];
        let counter = 1;
        const usedTags = new Set();

        for (const entry of g.servers || []) {
            const ob = parseLink(entry);
            if (ob) {
                let tag = ob.tag || 'proxy';
                if (tag === 'proxy' || usedTags.has(tag)) {
                    tag = `proxy-${counter}`;
                    counter++;
                }
                ob.tag = tag;
                usedTags.add(tag);
                outbounds.push(ob);
                log(`Добавлен сервер: ${tag} (${ob.protocol})`, 'success');
            } else {
                log(`Не удалось распарсить: ${entry.data?.substring(0, 50)}...`, 'warning');
            }
        }

        if (!outbounds.length) {
            log(`Группа ${g.name} пропущена (нет серверов)`, 'warning');
            continue;
        }

        outbounds.push({ tag: 'direct', protocol: 'freedom' });
        outbounds.push({ tag: 'block', protocol: 'blackhole' });

        result.push({
            remarks: g.name,
            dns: {
                servers: ['1.1.1.1', '1.0.0.1'],
                queryStrategy: 'UseIP'
            },
            routing: {
                rules: [{ type: 'field', protocol: ['bittorrent'], outboundTag: 'direct' }],
                domainMatcher: 'hybrid',
                domainStrategy: 'IPIfNonMatch'
            },
            inbounds: [{
                tag: 'socks',
                port: 10808,
                listen: '127.0.0.1',
                protocol: 'socks',
                settings: { udp: true, auth: 'noauth' },
                sniffing: { enabled: true, routeOnly: false, destOverride: ['http', 'tls', 'quic'] }
            }, {
                tag: 'http',
                port: 10809,
                listen: '127.0.0.1',
                protocol: 'http',
                settings: { allowTransparent: false },
                sniffing: { enabled: true, routeOnly: false, destOverride: ['http', 'tls', 'quic'] }
            }],
            outbounds: outbounds
        });
    }
    log(`Конвертация завершена. Получено ${result.length} групп`, 'success');
    return result;
}

function convert() {
    const text = inputArea.value.trim();
    log(`Начинаем конвертацию. Длина текста: ${text.length} символов`, 'info');

    if (!text) {
        log('Текст пуст', 'warning');
        outputArea.value = '';
        statsLabel.textContent = 'Нет данных';
        outputSize.textContent = '0';
        serverCount.textContent = '🌐 0 серверов';
        convertedData = null;
        inputStatus.innerHTML = '<span>⚠️ Нет данных для конвертации</span>';
        return;
    }

    const lines = text.split('\n');
    log(`Разбито на ${lines.length} строк`, 'info');

    const groups = [];
    let currentGroup = null;
    let currentServers = [];

    const groupRegex = /^[🇦-🇿]+\s*.*/;
    let lineNumber = 0;

    for (const raw of lines) {
        lineNumber++;
        const line = raw.trim();
        if (!line) continue;

        const isLink = /^(vless:\/\/|hysteria2:\/\/|trojan:\/\/|vmess:\/\/|ss:\/\/)/.test(line);
        const isJson = line.startsWith('{');

        if (groupRegex.test(line) && !isLink && !isJson) {
            log(`Строка ${lineNumber}: Найдена группа "${line}"`, 'info');
            if (currentGroup && currentServers.length) {
                groups.push({ name: currentGroup, servers: currentServers });
                log(`Добавлена группа "${currentGroup}" с ${currentServers.length} серверами`, 'success');
            }
            currentGroup = line;
            currentServers = [];
        } else if (isLink) {
            const type = line.split(':')[0];
            log(`Строка ${lineNumber}: Найдена ссылка ${type}`, 'info');
            currentServers.push({ type: type, data: line });
        } else if (isJson) {
            log(`Строка ${lineNumber}: Найден JSON`, 'info');
            try {
                const parsed = JSON.parse(line);
                currentServers.push({ type: 'json', data: parsed });
            } catch (e) {
                log(`Ошибка парсинга JSON: ${e.message}`, 'error');
            }
        } else if (!currentGroup && isLink) {
            log(`Строка ${lineNumber}: Создана группа "Без названия"`, 'warning');
            currentGroup = 'Без названия';
            const type = line.split(':')[0];
            currentServers.push({ type: type, data: line });
        }
    }

    if (currentGroup && currentServers.length) {
        groups.push({ name: currentGroup, servers: currentServers });
        log(`Добавлена последняя группа "${currentGroup}" с ${currentServers.length} серверами`, 'success');
    }

    log(`Всего найдено групп: ${groups.length}`, 'info');

    if (!groups.length) {
        log('Группы не найдены!', 'error');
        outputArea.value = '';
        statsLabel.textContent = 'Нет групп';
        outputSize.textContent = '0';
        serverCount.textContent = '🌐 0 серверов';
        convertedData = null;
        inputStatus.innerHTML = '<span class="error">❌ Группы не найдены! Проверьте формат ввода</span>';
        return;
    }

    try {
        const result = convertGroups(groups);
        const json = prettyJson.checked ?
            JSON.stringify(result, null, 2) :
            JSON.stringify(result);

        outputArea.value = json;
        convertedData = result;
        outputSize.textContent = json.length;

        const total = result.reduce((acc, g) => {
            return acc + (g.outbounds?.filter(o => !['direct', 'block'].includes(o.tag)).length || 0);
        }, 0);
        statsLabel.textContent = `📊 ${result.length} групп, ${total} серверов`;
        serverCount.textContent = `🌐 ${total} серверов`;
        inputStatus.innerHTML = `<span class="success">✅ Успешно сконвертировано! ${result.length} групп, ${total} серверов</span>`;
        log(`✅ ГОТОВО! ${result.length} групп, ${total} серверов`, 'success');
    } catch (e) {
        log(`❌ ОШИБКА КОНВЕРТАЦИИ: ${e.message}`, 'error');
        log(`Stack: ${e.stack}`, 'error');
        inputStatus.innerHTML = `<span class="error">❌ Ошибка: ${e.message}</span>`;
        alert(`Ошибка конвертации:\n${e.message}`);
    }
}

// ===== ПЕРВАЯ КОНВЕРТАЦИЯ ПРИ ЗАГРУЗКЕ =====
document.addEventListener('DOMContentLoaded', function() {
    log('Приложение загружено', 'info');
    if (inputArea.value.trim()) {
        log('Обнаружен текст в поле ввода, запускаем конвертацию...', 'info');
        convert();
    } else {
        log('Поле ввода пустое, ждем данных', 'info');
    }
});
