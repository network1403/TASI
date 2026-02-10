const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxSRZFTE4U59Rc98J1xVZFqRuVQDybPzjgsJ39JXdi10JcJ_C9x8j3W_3wWCPxAghNN/exec';
let globalData = { Stocks: [], Trades: [], Dividends: [], Bonus: [] };
const FEE_RATE = 0.001725124; 

function getStockName(symbol) {
    const stock = globalData.Stocks.find(s => String(s[0]) === String(symbol));
    return stock ? stock[1] : symbol;
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    ['tr-date', 'div-date', 'bn-date'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = today;
    });
}

function navigateTo(id, el) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById('section-' + id).style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    if(id === 'dashboard') renderDashboard();
}

async function fetchDataFromServer() {
    toggleLoader(true);
    try {
        const res = await fetch(SCRIPT_URL);
        const data = await res.json();
        globalData.Stocks = data.Stocks || [];
        globalData.Trades = data.Trades || [];
        globalData.Dividends = data.Dividends || [];
        globalData.Bonus = data.Bonus || [];
        renderAll();
        setDefaultDates();
    } catch (e) { 
        console.error(e);
        alert("فشل جلب البيانات"); 
    }
    toggleLoader(false);
}

function renderAll() {
    renderDropdowns();
    renderStocksList();
    renderTradesList();
    renderDividendsList();
    renderBonusList();
    renderDashboard();
}

function getStockMetrics(symbol) {
    let bQty = 0, bCost = 0, sQty = 0, sValue = 0, divAmt = 0, bonusQty = 0;
    
    globalData.Trades.slice(1).forEach(t => {
        if(String(t[2]) === String(symbol)) {
            let q = parseFloat(t[4]) || 0, p = parseFloat(t[5]) || 0;
            let rawTotal = q * p;
            if(t[1] === 'شراء') { bQty += q; bCost += rawTotal + (rawTotal * FEE_RATE); }
            else if(t[1] === 'بيع') { sQty += q; sValue += rawTotal - (rawTotal * FEE_RATE); }
        }
    });

    globalData.Dividends.slice(1).forEach(d => { if(String(d[1]) === String(symbol)) divAmt += (parseFloat(d[3]) || 0); });
    globalData.Bonus.slice(1).forEach(b => { if(String(b[1]) === String(symbol)) bonusQty += (parseFloat(b[3]) || 0); });
    
    let currentQty = (bQty + bonusQty) - sQty;
    let realizedPL = sQty > 0 ? (sValue - (sQty * (bCost / bQty))) : 0;

    return { currentQty, netCost: bCost - sValue, divAmt, yieldPct: bCost > 0 ? (divAmt * 100 / bCost) : 0, pl: realizedPL, totalBuyCost: bCost };
}

function renderDashboard() {
    const body = document.getElementById('dashboard-table');
    body.innerHTML = '';
    let totalDiv = 0, totalPL = 0, totalShares = 0, totalCost = 0, totalNetCost = 0;

    globalData.Stocks.slice(1).forEach(s => {
        const m = getStockMetrics(s[0]);
        totalDiv += m.divAmt; 
        totalPL += m.pl; 
        totalShares += m.currentQty; 
        totalCost += m.totalBuyCost;
        totalNetCost += m.netCost;

        body.innerHTML += `<tr>
            <td><span class="fw-bold">${s[1]}</span><br><small class="badge bg-secondary" style="font-size:10px">${s[2] || 'غير محدد'}</small></td>
            <td><span class="badge bg-light text-dark border">${m.currentQty.toLocaleString()}</span></td>
            <td>${m.netCost.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
            <td class="text-primary fw-bold">${m.divAmt.toLocaleString()}</td>
            <td>${m.yieldPct.toFixed(2)}%</td>
            <td class="${m.pl >= 0 ? 'val-pos' : 'val-neg'}">${m.pl.toLocaleString()}</td>
        </tr>`;
    });

    let avgYield = (totalCost > 0 ? (totalDiv * 100 / totalCost) : 0);

    document.getElementById('total-qty-row').innerText = totalShares.toLocaleString();
    document.getElementById('total-cost-row').innerText = totalNetCost.toLocaleString(undefined, {minimumFractionDigits:2});
    document.getElementById('total-div-row').innerText = totalDiv.toLocaleString(undefined, {minimumFractionDigits:2});
    document.getElementById('total-yield-row').innerText = avgYield.toFixed(2) + "%";
    document.getElementById('total-pl-row').innerText = totalPL.toLocaleString(undefined, {minimumFractionDigits:2});
    document.getElementById('total-pl-row').className = totalPL >= 0 ? 'val-pos' : 'val-neg';
}

function renderStocksList() {
    const list = globalData.Stocks.slice(1).reverse().map(s => `<tr><td>${s[0]}</td><td>${s[1]}</td><td>${s[2] || '-'}</td></tr>`).join('');
    document.getElementById('stocks-list-body').innerHTML = list || '<tr><td colspan="3">لا يوجد بيانات</td></tr>';
}

function renderTradesList() {
    const list = globalData.Trades.slice(1).reverse().map(t => `<tr><td>${t[0] || '-'}</td><td><span class="badge ${t[1]=='شراء'?'bg-success':'bg-danger'}">${t[1]}</span></td><td>${t[2]}</td><td>${getStockName(t[2])}</td><td>${t[4]}</td><td>${t[5]}</td></tr>`).join('');
    document.getElementById('trades-list-body').innerHTML = list || '<tr><td colspan="6">لا يوجد صفقات</td></tr>';
}

function renderDividendsList() {
    const list = globalData.Dividends.slice(1).reverse().map(d => `<tr><td>${d[0] || '-'}</td><td>${d[1]}</td><td>${getStockName(d[1])}</td><td>${parseFloat(d[3]).toLocaleString()}</td></tr>`).join('');
    document.getElementById('dividends-list-body').innerHTML = list || '<tr><td colspan="4">لا يوجد توزيعات</td></tr>';
}

function renderBonusList() {
    const list = globalData.Bonus.slice(1).reverse().map(b => `<tr><td>${b[0]}</td><td>${b[1]}</td><td>${getStockName(b[1])}</td><td class="val-pos">+ ${b[3]}</td></tr>`).join('');
    document.getElementById('bonus-table-body').innerHTML = list || '<tr><td colspan="4">لا يوجد أسهم منحة</td></tr>';
}

function renderDropdowns() {
    const options = globalData.Stocks.slice(1).map(s => `<option value="${s[0]}">${s[1]} (${s[0]})</option>`).join('');
    document.querySelectorAll('.stock-dd').forEach(d => d.innerHTML = '<option value="">اختر الشركة...</option>' + options);
}

async function sendData(sheet, row) {
    toggleLoader(true);
    try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'CREATE', sheetName: sheet, rowData: row }) });
        setTimeout(fetchDataFromServer, 2000);
    } catch (e) { alert("خطأ في الحفظ"); toggleLoader(false); }
}

document.getElementById('stockForm').onsubmit = (e) => {
    e.preventDefault();
    sendData('Stocks', [document.getElementById('st-symbol').value, document.getElementById('st-name').value, document.getElementById('st-sector').value]);
    e.target.reset();
};

document.getElementById('tradeForm').onsubmit = (e) => {
    e.preventDefault();
    const symbol = document.getElementById('tr-symbol').value;
    const type = document.getElementById('tr-type').value;
    const qty = parseFloat(document.getElementById('tr-qty').value);
    const price = document.getElementById('tr-price').value;
    const date = document.getElementById('tr-date').value;

    if (type === 'بيع') {
        const metrics = getStockMetrics(symbol);
        if (qty > metrics.currentQty) {
            alert(`عذراً، لا يمكنك بيع كمية أكبر من المملوكة حالياً.\nالكمية المتوفرة: ${metrics.currentQty}`);
            return;
        }
    }
    sendData('Trades', [date, type, symbol, "", qty, price]);
    e.target.reset(); setDefaultDates();
};

document.getElementById('dividendForm').onsubmit = (e) => {
    e.preventDefault();
    const symbol = document.getElementById('div-symbol').value;
    const amount = document.getElementById('div-amount').value;
    const date = document.getElementById('div-date').value;
    sendData('Dividends', [date, symbol, "", amount]);
    e.target.reset(); setDefaultDates();
};

document.getElementById('bonusForm').onsubmit = (e) => {
    e.preventDefault();
    const symbol = document.getElementById('bn-symbol').value;
    const qty = document.getElementById('bn-qty').value;
    const date = document.getElementById('bn-date').value;
    sendData('Bonus', [date, symbol, "", qty]);
    e.target.reset(); setDefaultDates();
};

function toggleLoader(s) { document.getElementById('loading-overlay').style.display = s ? 'flex' : 'none'; }
window.onload = fetchDataFromServer;