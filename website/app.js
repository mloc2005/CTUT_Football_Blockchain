
'use strict';

// TRANG KET QUA - FOOTBALLRESULTSV3
(() => {
  const ADDRESS = '0xa5f19dcd125ae01334d235f8a0366851f6ecdfe7';
  const RPC_URLS = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.gateway.tenderly.co',
    'https://rpc.sepolia.ethpandaops.io'
  ];
  const READ_ABI = [
    'function matchCount() view returns (uint256)',
    'function getMatch(uint256) view returns (string,string,uint8,uint8,uint8,uint8,uint8,uint8,bool)'
  ];
  const $ = id => document.getElementById(id);

  let matches = [];
  let loaded = false;

  // 1. KET NOI RPC SEPOLIA
  async function rpc(url, method, params = []) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || 'RPC lỗi');
      if (typeof data.result !== 'string') {
        throw new Error('RPC trả về dữ liệu không hợp lệ');
      }
      return data.result;
    } finally {
      clearTimeout(timer);
    }
  }

  // 2. DOC THONG TIN CAC TRAN TU SMART CONTRACT V3
  async function readFromRpc(url) {
    const chain = await rpc(url, 'eth_chainId');
    if (parseInt(chain, 16) !== 11155111) {
      throw new Error('Sai mạng Blockchain');
    }
    const code = await rpc(url, 'eth_getCode', [ADDRESS, 'latest']);
    if (code === '0x') throw new Error('Không tìm thấy hợp đồng V3');

    const iface = new ethers.Interface(READ_ABI);
    async function call(name, args = []) {
      const data = iface.encodeFunctionData(name, args);
      const result = await rpc(url, 'eth_call', [{ to: ADDRESS, data }, 'latest']);
      return iface.decodeFunctionResult(name, result);
    }

    const count = Number((await call('matchCount'))[0]);
    if (!Number.isSafeInteger(count) || count < 0 || count > 1000) {
      throw new Error('Số trận đấu không hợp lệ');
    }

    const result = [];
    for (let start = 1; start <= count; start += 5) {
      const ids = Array.from(
        { length: Math.min(5, count - start + 1) },
        (_, i) => start + i
      );
      const games = await Promise.all(ids.map(id => call('getMatch', [id])));
      games.forEach((g, index) => {
        result.push({
          id: ids[index],
          teamA: g[0],
          teamB: g[1],
          scoreA: Number(g[2]),
          scoreB: Number(g[3]),
          yellowA: Number(g[4]),
          redA: Number(g[5]),
          yellowB: Number(g[6]),
          redB: Number(g[7]),
          finalized: Boolean(g[8])
        });
      });
    }
    return result;
  }

  // 3. HIEN THI THE VANG/DO
  function cardStat(type, number, label) {
    const stat = document.createElement('span');
    stat.className = 'card-stat';
    stat.setAttribute('aria-label', `${label}: ${number}`);

    const symbol = document.createElement('span');
    symbol.className = `card-symbol ${type}`;
    symbol.setAttribute('aria-hidden', 'true');

    const value = document.createElement('span');
    value.textContent = String(number);
    stat.append(symbol, value);
    return stat;
  }

  // 4. TAO THE HIEN THI TUNG TRAN (GIU NGUYEN GIAO DIEN)
  function matchCard(m) {
    const article = document.createElement('article');
    article.className = 'match-card';
    article.innerHTML = `
      <div class="match-top">
        <span class="match-id"></span>
        <span class="status-badge"></span>
      </div>
      <div class="scoreboard">
        <div class="team">
          <span class="team-label">ĐỘI A</span>
          <h2 class="team-name" data-field="teamA"></h2>
        </div>
        <div class="score">
          <span data-field="scoreA"></span>
          <span class="score-separator">–</span>
          <span data-field="scoreB"></span>
        </div>
        <div class="team">
          <span class="team-label">ĐỘI B</span>
          <h2 class="team-name" data-field="teamB"></h2>
        </div>
      </div>
      <div class="cards-row">
        <div class="card-side" data-field="cardsA"></div>
        <span class="cards-title">THẺ PHẠT</span>
        <div class="card-side" data-field="cardsB"></div>
      </div>
      <div class="match-details-actions">
        <a class="match-details-link">Xem chi tiết</a>
      </div>
    `;

    article.querySelector('.match-id').textContent =
      `TRẬN ĐẤU #${String(m.id).padStart(2, '0')}`;
    const badge = article.querySelector('.status-badge');
    badge.classList.add(m.finalized ? 'status-finalized' : 'status-pending');
    badge.textContent = m.finalized ? 'Đã chốt' : 'Chưa chốt';

    for (const field of ['teamA', 'teamB', 'scoreA', 'scoreB']) {
      article.querySelector(`[data-field="${field}"]`).textContent = m[field];
    }
    article.querySelector('[data-field="cardsA"]').append(
      cardStat('yellow', m.yellowA, 'Thẻ vàng đội A'),
      cardStat('red', m.redA, 'Thẻ đỏ đội A')
    );
    article.querySelector('[data-field="cardsB"]').append(
      cardStat('yellow', m.yellowB, 'Thẻ vàng đội B'),
      cardStat('red', m.redB, 'Thẻ đỏ đội B')
    );
    article.querySelector('.match-details-link').href = `chi-tiet.html?id=${m.id}`;
    return article;
  }

  // 5. TIM KIEM & LOC CAC TRAN
  function normalize(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  function render() {
    $('totalMatches').textContent = matches.length;
    $('totalFinalized').textContent = matches.filter(m => m.finalized).length;

    const keyword = normalize($('matchSearch').value);
    const status = $('matchStatusFilter').value;
    const isId = /^#?\d+$/.test(keyword);
    const chosenId = isId ? Number(keyword.replace('#', '')) : null;

    const filtered = matches.filter(m => {
      const matchStatus = status === 'all' ||
        (status === 'finalized' && m.finalized) ||
        (status === 'pending' && !m.finalized);
      const text = normalize(`${m.teamA} ${m.teamB}`);
      const matchKeyword = !keyword ||
        (isId ? m.id === chosenId : text.includes(keyword));
      return matchStatus && matchKeyword;
    });

    $('filterSummary').textContent =
      `Hiển thị ${filtered.length}/${matches.length} trận đấu`;
    const list = $('matchList');
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = matches.length
        ? 'Không tìm thấy trận đấu phù hợp.'
        : 'Chưa có trận đấu nào trên hợp đồng V3.';
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...filtered.map(matchCard));
  }

  // 6. TAI DU LIEU BLOCKCHAIN (TU DONG THU RPC DU PHONG)
  async function loadMatches() {
    loaded = false;
    $('dataSource').textContent = 'Đang tải V3...';
    $('dataSource').classList.remove('is-live');
    $('matchList').textContent = 'Đang đọc dữ liệu từ Ethereum Sepolia...';

    try {
      if (!window.ethers?.Interface) {
        throw new Error('Không tải được ethers.js');
      }
      let error;
      for (const url of RPC_URLS) {
        try {
          matches = await readFromRpc(url);
          loaded = true;
          $('dataSource').textContent = 'Dữ liệu Blockchain · Sepolia (V3)';
          $('dataSource').classList.add('is-live');
          render();
          return;
        } catch (e) {
          error = e;
          console.warn('RPC lỗi:', url, e);
        }
      }
      throw error || new Error('Không thể đọc Sepolia');
    } catch (e) {
      $('dataSource').textContent = 'Lỗi tải dữ liệu V3';
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = `Không đọc được dữ liệu: ${e.message}`;

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'retry-blockchain';
      retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadMatches);
      $('matchList').replaceChildren(empty, retry);
    }
  }

  // 7. KHOI DONG
  document.addEventListener('DOMContentLoaded', () => {
    $('matchSearch').addEventListener('input', () => {
      if (loaded) render();
    });
    $('matchStatusFilter').addEventListener('change', () => {
      if (loaded) render();
    });
    $('clearMatchFilters').addEventListener('click', () => {
      $('matchSearch').value = '';
      $('matchStatusFilter').value = 'all';
      if (loaded) render();
    });
    loadMatches();
  });
})();
