// ========== Состояние ==========
let lastInput = '';
let convertedData = null;

// ========== DOM ==========
const inputArea = document.getElementById('inputArea');
const outputArea = document.getElementById('outputArea');
const linkCount = document.getElementById('linkCount');
const statsLabel = document.getElementById('statsLabel');
const autoConvert = document.getElementById('autoConvert');
const prettyJson = document.getElementById('prettyJson');

// ========== События ==========
inputArea.addEventListener('input', () => {
    updateLinkCount();
    if (autoConvert.checked) {
        convert();
    }
});

inputArea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        convert();
    }
});

// ========== Функции ==========

function updateLinkCount() {
    const text = inputArea.value;
    const lines = text.split('\n').filter(l => l.trim());
    const links = lines.filter(l => /^(vless:\/\/|hysteria2:\/\/|trojan:\/\/|vmess:\/\/|ss:\/\/)/.test(l.trim()));
    linkCount.textContent = `${lines.length} строк, ${links.length} ссылок`;
}

function pasteFromClipboard() {
    navigator.clipboard.readText().then(text => {
        inputArea.value = text;
        updateLinkCount();
        if (autoConvert.checked) convert();
    }).catch(() => {
        alert('Не удалось получить данные из буфера обмена');
    });
}

function clearInput() {
    inputArea.value = '';
    updateLinkCount();
    lastInput = '';
}

function clearOutput() {
    outputArea.value = '';
    statsLabel.textContent = 'Ожидание…';
    convertedData = null;
}

function copyJson() {
    const text = outputArea.value;
    if (!text) {
        alert('Нет данных для копирования');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.btn.success');
        const orig = btn.textContent;
        btn.textContent = '✅ Скопировано!';
        setTimeout(() => btn.textContent = orig, 1500);
    });
}

function showStats() {
    if (!convertedData) {
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
}

function closeStats() {
    document.getElementById('statsModal').classList.add('hidden');
}

function convert() {
    const text = inputArea.value.trim();
    if (!text) {
        outputArea.value = '';
        statsLabel.textContent = 'Нет данных';
        convertedData = null;
        return;
    }

    const lines = text.split('\n');
    const groups = [];
    let currentGroup = null;
    let currentServers = [];

    const groupRegex = /^[🇦-🇿]+\s*.*/;
    const vlessRegex = /^vless:\/\//;
    const hysteriaRegex = /^hysteria2:\/\//;
    const trojanRegex = /^trojan:\/\//;
    const vmessRegex = /^vmess:\/\//;
    const ssRegex = /^ss:\/\//;

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        if (groupRegex.test(line) &&
            !line.startsWith('vless://') &&
            !line.startsWith('hysteria2://') &&
            !line.startsWith('trojan://') &&
            !line.startsWith('vmess://') &&
            !line.startsWith('ss://') &&
            !line.startsWith('{')) {
            if (currentGroup && currentServers.length) {
                groups.push({ name: currentGroup, servers: currentServers });
            }
            currentGroup = line;
            currentServers = [];
        } else if (vlessRegex.test(line)) {
            currentServers.push({ type: 'vless', data: line });
        } else if (hysteriaRegex.test(line)) {
            currentServers.push({ type: 'hysteria2', data: line });
        } else if (trojanRegex.test(line)) {
            currentServers.push({ type: 'trojan', data: line });
        } else if (vmessRegex.test(line)) {
            currentServers.push({ type: 'vmess', data: line });
        } else if (ssRegex.test(line)) {
            currentServers.push({ type: 'ss', data: line });
        } else if (line.startsWith('{')) {
            try {
                const parsed = JSON.parse(line);
                currentServers.push({ type: 'json', data: parsed });
            } catch {}
        } else if (!currentGroup &&
            (vlessRegex.test(line) || hysteriaRegex.test(line) ||
             trojanRegex.test(line) || vmessRegex.test(line) || ssRegex.test(line))) {
            currentGroup = 'Без названия';
            if (vlessRegex.test(line)) currentServers.push({ type: 'vless', data: line });
            else if (hysteriaRegex.test(line)) currentServers.push({ type: 'hysteria2', data: line });
            else if (trojanRegex.test(line)) currentServers.push({ type: 'trojan', data: line });
            else if (vmessRegex.test(line)) currentServers.push({ type: 'vmess', data: line });
            else if (ssRegex.test(line)) currentServers.push({ type: 'ss', data: line });
        }
    }

    if (currentGroup && currentServers.length) {
        groups.push({ name: currentGroup, servers: currentServers });
    }

    if (!groups.length) {
        outputArea.value = '';
        statsLabel.textContent = 'Нет групп';
        convertedData = null;
        return;
    }

    // Отправляем на сервер
    fetch('/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert('Ошибка: ' + data.error);
            return;
        }
        const json = prettyJson.checked ?
            JSON.stringify(data.result, null, 2) :
            JSON.stringify(data.result);
        outputArea.value = json;
        convertedData = data.result;
        const total = data.result.reduce((acc, g) => acc + (g.outbounds?.filter(o => !['direct','block'].includes(o.tag)).length || 0), 0);
        statsLabel.textContent = `📊 ${data.result.length} групп, ${total} серверов`;
    })
    .catch(err => {
        alert('Ошибка связи с сервером: ' + err.message);
    });
}
